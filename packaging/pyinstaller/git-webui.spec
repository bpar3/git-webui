# -*- mode: python ; coding: utf-8 -*-
#
# Freezes the stdlib-only Python backend (src/libexec/git-core/git-webui)
# into a single self-contained executable, with the frontend's static
# assets (src/share/git-webui/webui) bundled alongside it.
#
# Build (from the repo root, with `pip install pyinstaller` done first):
#
#   pyinstaller packaging/pyinstaller/git-webui.spec --distpath dist-pyinstaller
#
# Output: dist-pyinstaller/git-webui-server(.exe). Run it exactly like the
# normal script, e.g.:
#
#   ./dist-pyinstaller/git-webui-server --no-browser --port 8000 --repo-root .
#
# This does NOT require Node/grunt/bower - it freezes the already-built
# src/share/git-webui/webui tree as-is, so run `grunt` first if you want
# your latest frontend changes included (the spec bundles src/, not
# dist/, so grunt isn't strictly required, but dist/ is what's tested
# day to day - keep them in sync before packaging a release).
#
# See packaging/README.md for the bigger picture (this is also the
# sidecar binary the Tauri desktop app in packaging/tauri/ spawns).

import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(SPEC))))
ENTRY_SCRIPT = os.path.join(REPO_ROOT, "src", "libexec", "git-core", "git-webui")
WEBUI_ASSETS = os.path.join(REPO_ROOT, "src", "share", "git-webui", "webui")

a = Analysis(
    [ENTRY_SCRIPT],
    pathex=[],
    binaries=[],
    datas=[(WEBUI_ASSETS, os.path.join("share", "git-webui", "webui"))],
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
    name="git-webui-server",
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
