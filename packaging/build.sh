#!/bin/bash
# Installs dependencies and builds git-webui's distributable artifacts:
#   1. dist/                    - the normal web app (grunt build)
#   2. dist-pyinstaller/        - a single-file headless server binary
#   3. packaging/tauri/.../bundle/ - a standalone desktop app (if Rust is available)
#
# Usage:
#   packaging/build.sh                    # build everything, desktop app in the
#                                          # native format for this machine
#   packaging/build.sh --format=deb       # ... in a specific format instead
#   packaging/build.sh --format=all       # ... in every format Tauri supports here
#   packaging/build.sh --install          # ... and install the built desktop app
#   packaging/build.sh --no-tauri         # skip the desktop app entirely
#   packaging/build.sh --frontend-only    # just step 1 (grunt dist/)
#   packaging/build.sh -h                 # help
#
# --format accepts a comma-separated list of Tauri bundle identifiers
# (deb, rpm, appimage, dmg, app, msi, nsis, ...) or "all". Left
# unspecified, it defaults to whichever single format is native to
# this machine: rpm (dnf-based Linux), deb (apt-based Linux), appimage
# (any other Linux), dmg (macOS), or msi (Windows, e.g. under Git
# Bash) - so a plain run produces exactly the one installer you'd
# actually use here, not every format Tauri knows how to build.
#
# --install installs the resulting bundle onto this machine right
# after building it (rpm via `sudo dnf install`, deb via `sudo apt-get
# install`, both of which replace any existing install of the same
# package - needs sudo). Only valid with a single concrete --format
# (not the default "all"); for appimage/dmg/msi/other formats it just
# prints where the built artifact is, since those aren't installed
# through a system package manager.
#
# What this installs automatically (all project-local or user-scoped,
# nothing system-wide): npm devDependencies, bower frontend deps, and
# PyInstaller via `pip install --user`. It will NOT install a Rust
# toolchain for you - that's a system-level install best done
# deliberately (see https://rustup.rs). If cargo isn't found, the
# Tauri step is skipped with instructions instead of failing the
# whole build.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUILD_TAURI=1
FRONTEND_ONLY=0
FORMAT=""
DO_INSTALL=0

for arg in "$@"; do
    case "$arg" in
        --no-tauri)
            BUILD_TAURI=0
            ;;
        --frontend-only)
            FRONTEND_ONLY=1
            BUILD_TAURI=0
            ;;
        --format=*)
            FORMAT="${arg#--format=}"
            ;;
        --format)
            echo "--format needs a value, e.g. --format=deb or --format=all (see --help)" >&2
            exit 1
            ;;
        --install)
            DO_INSTALL=1
            ;;
        -h|--help)
            sed -n '2,31p' "${BASH_SOURCE[0]}"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg (see --help)" >&2
            exit 1
            ;;
    esac
done

if [ "$DO_INSTALL" = "1" ]; then
    if [ "$FRONTEND_ONLY" = "1" ] || [ "$BUILD_TAURI" = "0" ]; then
        echo "--install needs the desktop app step - drop --frontend-only/--no-tauri, or drop --install." >&2
        exit 1
    fi
    if [ "$FORMAT" = "all" ]; then
        echo "--install needs a single concrete --format (e.g. --format=rpm) - it can't tell which built bundle to install from --format=all." >&2
        exit 1
    fi
fi

echo "=== 1. Frontend dependencies (npm, bower) ==="
npm install --no-audit --no-fund
npx --yes bower install --allow-root

echo
echo "=== 2. Building dist/ (grunt) ==="
npx --yes grunt-cli

if [ "$FRONTEND_ONLY" = "1" ]; then
    echo
    echo "--frontend-only: stopping after dist/. Done."
    exit 0
fi

echo
echo "=== 3. Headless single-binary server (PyInstaller) ==="
PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! "$PYTHON_BIN" -m PyInstaller --version >/dev/null 2>&1; then
    echo "PyInstaller not found - installing it for the current user..."
    "$PYTHON_BIN" -m pip install --user pyinstaller
fi
"$PYTHON_BIN" -m PyInstaller packaging/pyinstaller/git-webui.spec --distpath dist-pyinstaller --noconfirm

SIDECAR_BIN="dist-pyinstaller/git-webui-server"
if [ ! -f "$SIDECAR_BIN" ]; then
    SIDECAR_BIN="dist-pyinstaller/git-webui-server.exe"
fi
echo "Headless server built: $SIDECAR_BIN"

if [ "$BUILD_TAURI" = "0" ]; then
    echo
    echo "--no-tauri: skipping the desktop app. Done."
    exit 0
fi

echo
echo "=== 4. Standalone desktop app (Tauri) ==="
if ! command -v cargo >/dev/null 2>&1; then
    cat >&2 <<'EOF'
cargo (Rust) not found - skipping the desktop app build.

This step is optional: dist/ and dist-pyinstaller/ from steps 1-3
above are already built and usable on their own (the normal web app
and the headless single-binary server, respectively).

To also build the standalone desktop app, install Rust first:
    https://rustup.rs

then re-run this script (or run it again with just --no-tauri to
silence this message if you don't want the desktop app at all).
EOF
    exit 0
fi

# Pick the default bundle format for this machine if the user didn't
# request one with --format. Kept to a single native format so a plain
# run produces exactly the installer you'd actually use here.
DEFAULT_FORMAT=""
PKG_MANAGER=""
if [ "$(uname -s)" = "Linux" ]; then
    if command -v dnf >/dev/null 2>&1; then
        PKG_MANAGER="dnf"
        DEFAULT_FORMAT="rpm"
    elif command -v apt-get >/dev/null 2>&1; then
        PKG_MANAGER="apt-get"
        DEFAULT_FORMAT="deb"
    elif command -v pacman >/dev/null 2>&1; then
        PKG_MANAGER="pacman"
        DEFAULT_FORMAT="appimage"
    else
        DEFAULT_FORMAT="appimage"
    fi
elif [ "$(uname -s)" = "Darwin" ]; then
    DEFAULT_FORMAT="dmg"
else
    # Windows (Git Bash/MSYS/Cygwin) and anything else unrecognized.
    DEFAULT_FORMAT="msi"
fi

if [ -z "$FORMAT" ]; then
    FORMAT="$DEFAULT_FORMAT"
    echo "No --format given - defaulting to '$FORMAT' for this machine (use --format=all for every format)."
fi

# fuse/libfuse2 is only needed to run the AppImage bundling tools
# themselves (linuxdeploy and friends are distributed *as* AppImages,
# which need FUSE to mount-and-run), so only install it when an
# AppImage is actually going to be built.
case ",$FORMAT," in
    *,all,*|*,appimage,*) NEED_FUSE=1 ;;
    *) NEED_FUSE=0 ;;
esac

if [ "$(uname -s)" = "Linux" ]; then
    echo "Checking Linux system libraries Tauri needs to build (webkit2gtk, dbus, ...)..."
    if [ "$PKG_MANAGER" = "dnf" ]; then
        FUSE_PKGS=""
        [ "$NEED_FUSE" = "1" ] && FUSE_PKGS="fuse fuse-libs"
        if ! rpm -q webkit2gtk4.1-devel dbus-devel pkgconf-pkg-config gtk3-devel librsvg2-devel openssl-devel $FUSE_PKGS >/dev/null 2>&1; then
            echo "Installing via dnf (needs sudo)..."
            sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
                librsvg2-devel gtk3-devel dbus-devel pkgconf-pkg-config $FUSE_PKGS
        fi
    elif [ "$PKG_MANAGER" = "apt-get" ]; then
        if ! dpkg -s libwebkit2gtk-4.1-dev libdbus-1-dev pkg-config libgtk-3-dev librsvg2-dev libssl-dev >/dev/null 2>&1; then
            echo "Installing via apt-get (needs sudo)..."
            sudo apt-get update
            sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
                libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
                libgtk-3-dev libdbus-1-dev pkg-config
            if [ "$NEED_FUSE" = "1" ]; then
                # Package name varies by release (time_t transition on
                # newer Ubuntu/Debian); try both, don't fail the build
                # if neither hits.
                sudo apt-get install -y libfuse2 || sudo apt-get install -y libfuse2t64 || true
            fi
        fi
    elif [ "$PKG_MANAGER" = "pacman" ]; then
        FUSE_PKGS=""
        [ "$NEED_FUSE" = "1" ] && FUSE_PKGS="fuse2"
        sudo pacman -S --needed --noconfirm webkit2gtk-4.1 base-devel curl wget file \
            openssl gtk3 librsvg dbus pkgconf $FUSE_PKGS
    else
        echo "Unrecognized Linux package manager - skipping automatic system-dependency install." >&2
        echo "Tauri needs webkit2gtk, gtk3, librsvg, dbus, pkg-config, and (for AppImage bundling) fuse/libfuse2; install them manually if the build below fails." >&2
    fi
fi

if ! cargo tauri --version >/dev/null 2>&1; then
    echo "tauri-cli not found - installing it (cargo install tauri-cli)..."
    cargo install tauri-cli --version "^2" --locked
fi

TARGET_TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
if [ -z "$TARGET_TRIPLE" ]; then
    echo "Could not determine the Rust target triple (rustc -vV failed) - aborting the desktop build." >&2
    exit 1
fi

SIDECAR_DEST="packaging/tauri/src-tauri/binaries/git-webui-server-$TARGET_TRIPLE"
if [[ "$SIDECAR_BIN" == *.exe ]]; then
    SIDECAR_DEST="$SIDECAR_DEST.exe"
fi
echo "Copying sidecar binary to $SIDECAR_DEST"
cp "$SIDECAR_BIN" "$SIDECAR_DEST"

if [ "$FORMAT" = "all" ]; then
    BUNDLE_ARGS=()
else
    BUNDLE_ARGS=(--bundles "$FORMAT")
fi
echo "Building bundle format(s): $FORMAT"

# APPIMAGE_EXTRACT_AND_RUN tells the AppImage-bundling tools (linuxdeploy
# and friends, which are themselves distributed as AppImages) to extract
# and run instead of mounting via FUSE - works even when /dev/fuse isn't
# usable (common in containers/sandboxes) regardless of whether the
# fuse/libfuse2 package above actually got installed.
set +e
(cd packaging/tauri/src-tauri && APPIMAGE_EXTRACT_AND_RUN=1 cargo tauri build "${BUNDLE_ARGS[@]}")
BUILD_STATUS=$?
set -e

BUNDLE_DIR="packaging/tauri/src-tauri/target/release/bundle"
if [ "$BUILD_STATUS" -ne 0 ]; then
    if find "$BUNDLE_DIR" -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o -name '*.dmg' -o -name '*.app' -o -name '*.msi' -o -name '*.exe' \) 2>/dev/null | grep -q .; then
        echo
        echo "cargo tauri build exited non-zero, but at least one installable bundle was produced under $BUNDLE_DIR - see the build output above for which format(s) failed (commonly just AppImage, if FUSE still isn't usable here). Not treating this as a hard failure." >&2
    else
        echo "cargo tauri build failed and no bundles were produced under $BUNDLE_DIR." >&2
        exit "$BUILD_STATUS"
    fi
fi

echo
echo "Desktop app built under $BUNDLE_DIR/"

if [ "$DO_INSTALL" = "1" ]; then
    echo
    echo "=== 5. Installing the desktop app (--install) ==="
    case "$FORMAT" in
        rpm)
            RPM_FILE="$(find "$BUNDLE_DIR/rpm" -name '*.rpm' 2>/dev/null | head -n1)"
            if [ -z "$RPM_FILE" ]; then
                echo "No .rpm found under $BUNDLE_DIR/rpm - nothing to install." >&2
                exit 1
            fi
            echo "Installing $RPM_FILE (needs sudo)..."
            sudo dnf install -y "$RPM_FILE"
            ;;
        deb)
            DEB_FILE="$(find "$BUNDLE_DIR/deb" -name '*.deb' 2>/dev/null | head -n1)"
            if [ -z "$DEB_FILE" ]; then
                echo "No .deb found under $BUNDLE_DIR/deb - nothing to install." >&2
                exit 1
            fi
            echo "Installing $DEB_FILE (needs sudo)..."
            sudo apt-get install -y "$DEB_FILE"
            ;;
        appimage)
            APPIMAGE_FILE="$(find "$BUNDLE_DIR/appimage" -name '*.AppImage' 2>/dev/null | head -n1)"
            if [ -z "$APPIMAGE_FILE" ]; then
                echo "No .AppImage found under $BUNDLE_DIR/appimage - nothing to mark executable." >&2
                exit 1
            fi
            chmod +x "$APPIMAGE_FILE"
            echo "AppImages aren't installed through a package manager - made executable:"
            echo "    $APPIMAGE_FILE"
            echo "Run it directly, or move it wherever you launch it from."
            ;;
        *)
            echo "--install doesn't know how to install format '$FORMAT' automatically." >&2
            echo "The built artifact is under $BUNDLE_DIR/ - install/open it manually." >&2
            exit 1
            ;;
    esac
    echo "Installed."
fi

echo "Done."
