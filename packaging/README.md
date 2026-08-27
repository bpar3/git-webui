# Packaging GitPar

Two independent distribution modes, both optional - the normal
`gitpar` alias (Python script + `webbrowser.open()`) keeps working
unchanged regardless of whether either of these is built.

## Quick start

```sh
packaging/build.sh              # everything: dist/, headless binary, desktop app
                                 # (desktop app in the native format for this machine)
packaging/build.sh --format=all # ... every bundle format Tauri supports here
packaging/build.sh --format=deb # ... one specific format instead
packaging/build.sh --install    # ... and install the built desktop app (needs sudo)
packaging/build.sh --no-tauri   # skip the desktop app (no Rust needed)
packaging/build.sh --frontend-only  # just dist/, nothing frozen/bundled
```

`--install` installs the bundle it just built onto this machine
(`sudo dnf install`/`sudo apt-get install` for rpm/deb - both replace
an existing install of the same package; `.AppImage` is just marked
executable, since it isn't installed through a package manager). It
requires a single concrete `--format` - it's ambiguous which bundle to
install from `--format=all`.

Installs what it safely can on its own (npm/bower deps, PyInstaller via
`pip install --user`, and - on Linux, via `sudo apt`/`dnf`/`pacman` -
the WebKitGTK/dbus/gtk3 development packages Tauri needs to compile;
`fuse`/`libfuse2` are only pulled in when an AppImage is actually being
built). It will not install a Rust toolchain for you; if `cargo` isn't
found the desktop-app step is skipped with instructions instead of
failing the whole run.

By default the desktop-app step builds only the one bundle format
native to the machine it's run on (`rpm` on dnf-based Linux, `deb` on
apt-based Linux, `appimage` on other Linux, `dmg` on macOS, `msi` on
Windows) via Tauri's `cargo tauri build --bundles <format>` flag, so a
plain run produces exactly the installer you'd actually use - not
every format `tauri.conf.json` lists. Pass `--format=<name>` for a
specific format or `--format=all` to restore building everything. See
`packaging/build.sh -h` for all flags.

Status as actually run in this environment: `packaging/build.sh
--no-tauri` was run end-to-end - it installed dependencies, built
`dist/`, froze the headless binary, and the binary was then started
and confirmed to serve the real app (index/CSS/JS/`/api/context` all
returned correctly, including reading back repo state persisted from
earlier runs). The full desktop-app step was exercised up through
`cargo tauri build` starting to compile; it only stopped short because
this sandbox's Linux system libraries weren't present and `sudo`
requires an interactive password that isn't available here (the
system-dependency install this script now does automatically was
added in response to hitting exactly that). `Cargo.lock`, generated
during that run, is committed. Rerun on a machine with a normal sudo
session to get a real bundle end to end - the remaining risk is
narrow (the Rust/Tauri side specifically), not the whole pipeline.

## 1. Headless single-binary (no window, your own browser is the UI)

Freezes the built `dist/bin/gitpar` (stdlib-only
Python) plus the `dist/share/gitpar/web` static assets - CSS
compiled from LESS, and jQuery/Bootstrap vendored locally rather than
loaded from a CDN, so the frozen app also works fully offline - into
one executable. Run `grunt` (or `packaging/build.sh`, which does this
for you) before packaging so `dist/` is up to date; end users don't
need Python or Node installed to run the result.

```sh
pip install pyinstaller
pyinstaller packaging/pyinstaller/gitpar.spec --distpath dist-pyinstaller
```

Output: `dist-pyinstaller/gitpar-server` (`.exe` on Windows). Run it
exactly like the normal script:

```sh
./dist-pyinstaller/gitpar-server --repo-root /path/to/repo
```

You need one build per target OS - PyInstaller does not cross-compile.
`src/bin/gitpar`'s `resolve_web_root()` detects the
frozen case (`sys.frozen` + `sys._MEIPASS`, both set by PyInstaller at
runtime) and finds the bundled assets there instead of walking up from
`sys.argv[0]`; nothing else about the script changes when frozen.

## 2. Standalone desktop app (Tauri + the sidecar above)

A thin Tauri v2 shell that spawns the binary from step 1 as a
"sidecar" child process, waits for its loopback port to accept
connections, then points its native window at `http://127.0.0.1:<port>/`.
The window is real OS-native chrome (WebView2 on Windows, WKWebView on
macOS, WebKitGTK on Linux) - not Chromium, so the bundle stays small
(~10-40MB with the sidecar included, vs. 100MB+ for an Electron
equivalent).

`packaging/build.sh` (see Quick start above) does everything below
automatically once Rust itself is installed. This section is the
manual/reference version, e.g. for adapting into your own CI.

### One-time setup

```sh
# Rust toolchain (rustup.rs), then:
cargo install tauri-cli --version "^2"
```

### Build

```sh
# 1. Build the sidecar binary (step 1 above), one per target platform.
pyinstaller packaging/pyinstaller/gitpar.spec --distpath dist-pyinstaller

# 2. Copy it into Tauri's expected sidecar location, suffixed with the
#    Rust target triple (`rustc -vV` to find yours - e.g.
#    x86_64-unknown-linux-gnu, x86_64-pc-windows-msvc,
#    aarch64-apple-darwin). Tauri's externalBin mechanism requires this
#    exact naming.
TARGET_TRIPLE=$(rustc -vV | sed -n 's/host: //p')
cp dist-pyinstaller/gitpar-server \
   "packaging/tauri/src-tauri/binaries/gitpar-server-$TARGET_TRIPLE"

# 3. Build the app.
cd packaging/tauri/src-tauri
cargo tauri build
```

Output lands under `packaging/tauri/src-tauri/target/release/bundle/`
(a `.deb`/`.rpm`/`.AppImage` on Linux, `.dmg`/`.app` on macOS, `.msi`/`.exe`
on Windows, per `cargo tauri build`'s usual layout).

On Linux, the `.deb`/`.rpm` bundlers work with just the dev packages
listed above, but AppImage bundling additionally needs a *working*
FUSE (`linuxdeploy` and its plugins are themselves distributed as
AppImages, which need FUSE to mount-and-run) - not just the
`fuse`/`libfuse2` package installed, but `/dev/fuse` actually usable,
which containers/sandboxes often don't have. `build.sh` sets
`APPIMAGE_EXTRACT_AND_RUN=1` around the build to route around that
(extract-and-run instead of mounting), and treats an AppImage-only
bundling failure as non-fatal as long as at least one bundle format
succeeded - confirmed against a real run where `.deb` and `.rpm` built
fine and only `.AppImage` failed on `failed to run linuxdeploy`.

### Dev loop

```sh
cd packaging/tauri/src-tauri
cargo tauri dev
```

(Still requires the sidecar binary to be in place first, per step 2
above - `cargo tauri dev` doesn't rebuild the Python side for you.)

### What's already in place

- `src-tauri/tauri.conf.json` - window config, sidecar declaration
  (`bundle.externalBin`), bundle icon references.
- `src-tauri/capabilities/default.json` - Tauri v2's permission system
  needs an explicit grant to execute the sidecar; this is it.
- `src-tauri/src/main.rs` - spawns the sidecar on a free ephemeral
  port, polls until it accepts connections, navigates the window to
  it, forwards its stdout/stderr to the app's own logs, and kills it
  when the window closes.
- `src-tauri/icons/` - generated from the existing
  `src/share/gitpar/web/img/git-icon.png` (32x32, 128x128,
  128x128@2x PNGs, plus `.ico` and `.icns`). Real files, not
  placeholders - regenerate only if you want a different icon
  (`cargo tauri icon <path-to-source-png>` is the easiest way once you
  have the Tauri CLI).
- `dist-shell/index.html` - a "Starting GitPar..." placeholder the
  window shows for the (normally sub-second) gap before the sidecar's
  port responds; `main.rs` navigates away from it automatically.

### What isn't

- No CI workflow wiring this up per-OS. Each target still needs a
  matching PyInstaller build + `cargo tauri build` on that OS (or in a
  matching CI runner/cross-compilation setup).
- No code signing / notarization config (`bundle.macOS.signingIdentity`,
  Windows Authenticode, etc.) - required for smooth installs on macOS
  and increasingly on Windows, but is credential/account-specific and
  deliberately left out here.
