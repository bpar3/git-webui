# -*- mode: python ; coding: utf-8 -*-
#
# Freezes the stdlib-only Python backend (src/bin/gitpar)
# into a single self-contained executable, with the frontend's static
# assets (src/share/gitpar/web) bundled alongside it.
#
# Build (from the repo root, with `pip install pyinstaller` done first):
#
#   pyinstaller packaging/pyinstaller/gitpar.spec --distpath dist-pyinstaller
#
# Output: dist-pyinstaller/gitpar-server(.exe). Run it exactly like the
# normal script, e.g.:
#
#   ./dist-pyinstaller/gitpar-server --no-browser --port 8000 --repo-root .
#
# This bundles the built dist/share/gitpar/web tree, so `grunt`
# (or `packaging/build.sh`, which runs it for you) must be run first -
# dist/ is where the compiled CSS and the vendored jquery/bootstrap
# assets that index.html now loads locally (instead of from a CDN, so
# the packaged app also works fully offline) actually live.
#
# See packaging/README.md for the bigger picture (this is also the
# sidecar binary the Tauri desktop app in packaging/tauri/ spawns).

import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(SPEC))))
ENTRY_SCRIPT = os.path.join(REPO_ROOT, "dist", "bin", "gitpar")
WEB_ASSETS = os.path.join(REPO_ROOT, "dist", "share", "gitpar", "web")

a = Analysis(
    [ENTRY_SCRIPT],
    pathex=[],
    binaries=[],
    datas=[(WEB_ASSETS, os.path.join("share", "gitpar", "web"))],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="gitpar-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
