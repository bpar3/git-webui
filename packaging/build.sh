#!/bin/bash
# Installs dependencies and builds GitPar's distributable artifacts:
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
#   packaging/build.sh --reinstall        # ... replacing it even at the same version
#   packaging/build.sh --clean            # remove build artifacts, then stop
#   packaging/build.sh --clean-all        # ... and node_modules/bower_components
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
# install` - needs sudo). Only valid with a single concrete --format
# (not the default "all"); for appimage/dmg/msi/other formats it just
# prints where the built artifact is, since those aren't installed
# through a system package manager.
#
# --clean removes everything a build produces - dist/, dist-pyinstaller/,
# build/, the Rust target/ and gen/ trees, copied sidecar binaries and
# __pycache__ - and exits. It leaves release/ alone, since that is
# committed and belongs to git rather than to this script, and it leaves
# untracked local files alone, which `git clean -xdf` would not.
# --clean-all additionally drops node_modules/ and bower_components/,
# which the next build re-fetches.
#
# --reinstall is --install that replaces the package even when the
# version is unchanged. Both package managers treat installing a version
# that is already present as nothing to do, so a rebuild would otherwise
# leave the old files on disk - and the version only moves on a release,
# so during development that is the usual case. Use this to see your
# build's changes on the installed app.
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
FORCE_REINSTALL=0
DO_CLEAN=0
CLEAN_DEPS=0
# The package name the app was distributed under before the rename. A
# post-rename build produces a differently named package, so the old one
# is left installed and keeps shadowing the new one until it's removed.
LEGACY_PKG_NAME="git-webui"

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
        --clean)
            DO_CLEAN=1
            ;;
        --clean-all)
            DO_CLEAN=1
            CLEAN_DEPS=1
            ;;
        --install)
            DO_INSTALL=1
            ;;
        --reinstall)
            DO_INSTALL=1
            FORCE_REINSTALL=1
            ;;
        -h|--help)
            sed -n "2,50p" "${BASH_SOURCE[0]}"
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

if [ "$DO_CLEAN" = "1" ]; then
    echo "=== Removing build artifacts ==="
    # Everything here is regenerated by a build. release/ is deliberately
    # excluded: it is committed, so `git checkout` owns it, not this.
    for path in dist dist-pyinstaller build .pytest_cache \
                packaging/tauri/src-tauri/target \
                packaging/tauri/src-tauri/gen; do
        if [ -e "$path" ]; then
            echo "  $path ($(du -sh "$path" 2>/dev/null | cut -f1))"
            rm -rf "$path"
        fi
    done

    # Sidecar binaries copied in for bundling, including any left under a
    # previous name. The .gitkeep stays so the directory survives.
    find packaging/tauri/src-tauri/binaries -type f ! -name '.gitkeep' -delete 2>/dev/null || true

    # Compiled Python, which the backend leaves beside its source.
    find . -name '__pycache__' -type d \
        -not -path './node_modules/*' -prune -exec rm -rf {} + 2>/dev/null || true

    # Directories emptied by the above, so a renamed tree doesn't leave
    # its old skeleton behind.
    find src packaging/tauri/src-tauri -type d -empty -delete 2>/dev/null || true

    if [ "$CLEAN_DEPS" = "1" ]; then
        for path in node_modules bower_components; do
            if [ -e "$path" ]; then
                echo "  $path ($(du -sh "$path" 2>/dev/null | cut -f1))"
                rm -rf "$path"
            fi
        done
        echo
        echo "Dependencies removed too - the next build re-fetches them."
    fi

    echo
    echo "Clean. Source, release/ and local settings are untouched."
    exit 0
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
"$PYTHON_BIN" -m PyInstaller packaging/pyinstaller/gitpar.spec --distpath dist-pyinstaller --noconfirm

SIDECAR_BIN="dist-pyinstaller/gitpar-server"
if [ ! -f "$SIDECAR_BIN" ]; then
    SIDECAR_BIN="dist-pyinstaller/gitpar-server.exe"
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

SIDECAR_DEST="packaging/tauri/src-tauri/binaries/gitpar-server-$TARGET_TRIPLE"
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
# Bundles from previous runs stay in the output directory - a rename or
# a version change leaves the old file sitting next to the new one. This
# marker makes "produced by this run" answerable, so neither the success
# check nor the install step can pick up a leftover.
BUILD_MARKER="$(mktemp)"
trap 'rm -f "$BUILD_MARKER"' EXIT

set +e
(cd packaging/tauri/src-tauri && APPIMAGE_EXTRACT_AND_RUN=1 cargo tauri build "${BUNDLE_ARGS[@]}")
BUILD_STATUS=$?
set -e

BUNDLE_DIR="packaging/tauri/src-tauri/target/release/bundle"
if [ "$BUILD_STATUS" -ne 0 ]; then
    if find "$BUNDLE_DIR" -type f -newer "$BUILD_MARKER" \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o -name '*.dmg' -o -name '*.app' -o -name '*.msi' -o -name '*.exe' \) 2>/dev/null | grep -q .; then
        echo
        echo "cargo tauri build exited non-zero, but at least one installable bundle was produced under $BUNDLE_DIR - see the build output above for which format(s) failed (commonly just AppImage, if FUSE still isn't usable here). Not treating this as a hard failure." >&2
    else
        echo "cargo tauri build failed and no bundles were produced under $BUNDLE_DIR." >&2
        exit "$BUILD_STATUS"
    fi
fi

echo
echo "Desktop app built under $BUNDLE_DIR/"

# Returns the bundle this run produced, and says so when older ones are
# sitting alongside it - `find | head` used to pick whichever came first,
# which after a rename meant installing the previous build.
built_bundle() {
    local dir="$1" pattern="$2" newest all
    newest="$(find "$dir" -maxdepth 1 -type f -name "$pattern" -newer "$BUILD_MARKER" 2>/dev/null | head -n1)"
    all="$(find "$dir" -maxdepth 1 -type f -name "$pattern" 2>/dev/null | wc -l)"
    if [ -n "$newest" ] && [ "$all" -gt 1 ]; then
        echo "Note: $dir holds $all bundles; using the one this run built." >&2
        echo "      Older ones are left in place - delete them if unwanted." >&2
    fi
    if [ -z "$newest" ]; then
        # Nothing new: fall back to the most recently modified, so a
        # re-run with an unchanged build still has something to install.
        newest="$(ls -t "$dir"/$pattern 2>/dev/null | head -n1)"
    fi
    printf '%s' "$newest"
}

if [ "$DO_INSTALL" = "1" ]; then
    echo
    echo "=== 5. Installing the desktop app (--install) ==="
    case "$FORMAT" in
        rpm)
            RPM_FILE="$(built_bundle "$BUNDLE_DIR/rpm" '*.rpm')"
            if [ -z "$RPM_FILE" ]; then
                echo "No .rpm found under $BUNDLE_DIR/rpm - nothing to install." >&2
                exit 1
            fi
            if [ "$FORCE_REINSTALL" = "1" ]; then
                echo "Reinstalling $RPM_FILE (needs sudo)..."
                sudo dnf reinstall -y "$RPM_FILE"
            else
                echo "Installing $RPM_FILE (needs sudo)..."
                sudo dnf install -y "$RPM_FILE"
                # dnf treats an already-installed identical version as
                # nothing to do and exits happily, so a rebuild at the
                # same version silently leaves the old files in place.
                # The version only moves on a release, so during
                # development that is the normal case, not the odd one.
                PKG_NAME="$(rpm -qp --qf '%{NAME}' "$RPM_FILE" 2>/dev/null)"
                if [ -n "$PKG_NAME" ] && \
                   [ "$(rpm -q --qf '%{NAME}-%{VERSION}-%{RELEASE}' "$PKG_NAME" 2>/dev/null)" \
                     = "$(rpm -qp --qf '%{NAME}-%{VERSION}-%{RELEASE}' "$RPM_FILE" 2>/dev/null)" ]; then
                    echo
                    echo "Note: $PKG_NAME was already installed at this exact version, so dnf" >&2
                    echo "had nothing to do and the files on disk are unchanged. Re-run with" >&2
                    echo "--reinstall to replace them with what you just built." >&2
                fi
            fi
            ;;
        deb)
            DEB_FILE="$(built_bundle "$BUNDLE_DIR/deb" '*.deb')"
            if [ -z "$DEB_FILE" ]; then
                echo "No .deb found under $BUNDLE_DIR/deb - nothing to install." >&2
                exit 1
            fi
            if [ "$FORCE_REINSTALL" = "1" ]; then
                echo "Reinstalling $DEB_FILE (needs sudo)..."
                sudo apt-get install -y --reinstall --allow-downgrades "$DEB_FILE"
            else
                echo "Installing $DEB_FILE (needs sudo)..."
                sudo apt-get install -y "$DEB_FILE"
            fi
            ;;
        appimage)
            APPIMAGE_FILE="$(built_bundle "$BUNDLE_DIR/appimage" '*.AppImage')"
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

    # The rename changed the package name, so an install leaves the old
    # package in place with its own binary, icon and desktop entry - and
    # launching the app can still pick up the old one.
    if command -v rpm >/dev/null 2>&1 && rpm -q "$LEGACY_PKG_NAME" >/dev/null 2>&1; then
        echo
        echo "Warning: $LEGACY_PKG_NAME is still installed alongside this build." >&2
        echo "It ships its own binary, icon and desktop entry, so you may keep" >&2
        echo "launching the old app. Remove it with:" >&2
        echo "    sudo dnf remove $LEGACY_PKG_NAME" >&2
    elif command -v dpkg >/dev/null 2>&1 && dpkg -s "$LEGACY_PKG_NAME" >/dev/null 2>&1; then
        echo
        echo "Warning: $LEGACY_PKG_NAME is still installed alongside this build." >&2
        echo "Remove it with:" >&2
        echo "    sudo apt-get remove $LEGACY_PKG_NAME" >&2
    fi

    echo "Installed."
fi

echo "Done."
