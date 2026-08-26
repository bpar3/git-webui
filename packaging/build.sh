#!/bin/bash
# Installs dependencies and builds git-webui's distributable artifacts:
#   1. dist/                    - the normal web app (grunt build)
#   2. dist-pyinstaller/        - a single-file headless server binary
#   3. packaging/tauri/.../bundle/ - a standalone desktop app (if Rust is available)
#
# Usage:
#   packaging/build.sh                 # build everything available
#   packaging/build.sh --no-tauri      # skip the desktop app, just the two above
#   packaging/build.sh --frontend-only # just step 1 (grunt dist/)
#   packaging/build.sh -h              # help
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

for arg in "$@"; do
    case "$arg" in
        --no-tauri)
            BUILD_TAURI=0
            ;;
        --frontend-only)
            FRONTEND_ONLY=1
            BUILD_TAURI=0
            ;;
        -h|--help)
            sed -n '2,17p' "${BASH_SOURCE[0]}"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg (see --help)" >&2
            exit 1
            ;;
    esac
done

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

if [ "$(uname -s)" = "Linux" ]; then
    echo "Checking Linux system libraries Tauri needs to build (webkit2gtk, dbus, ...)..."
    if command -v dnf >/dev/null 2>&1; then
        if ! rpm -q webkit2gtk4.1-devel dbus-devel pkgconf-pkg-config gtk3-devel librsvg2-devel openssl-devel >/dev/null 2>&1; then
            echo "Installing via dnf (needs sudo)..."
            sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
                librsvg2-devel gtk3-devel dbus-devel pkgconf-pkg-config
        fi
    elif command -v apt-get >/dev/null 2>&1; then
        if ! dpkg -s libwebkit2gtk-4.1-dev libdbus-1-dev pkg-config libgtk-3-dev librsvg2-dev libssl-dev >/dev/null 2>&1; then
            echo "Installing via apt-get (needs sudo)..."
            sudo apt-get update
            sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
                libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
                libgtk-3-dev libdbus-1-dev pkg-config
        fi
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -S --needed --noconfirm webkit2gtk-4.1 base-devel curl wget file \
            openssl gtk3 librsvg dbus pkgconf
    else
        echo "Unrecognized Linux package manager - skipping automatic system-dependency install." >&2
        echo "Tauri needs webkit2gtk, gtk3, librsvg, dbus, and pkg-config development packages; install them manually if the build below fails." >&2
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

(cd packaging/tauri/src-tauri && cargo tauri build)

echo
echo "Desktop app built under packaging/tauri/src-tauri/target/release/bundle/"
echo "Done."
