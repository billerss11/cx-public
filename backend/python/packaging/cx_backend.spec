# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules


def _resolve_project_root() -> Path:
    spec_file = globals().get("__file__")
    if spec_file:
        return Path(spec_file).resolve().parents[2]

    cwd = Path.cwd().resolve()
    for candidate in [cwd, *cwd.parents]:
        if (candidate / "backend" / "python" / "src").exists():
            return candidate

    raise FileNotFoundError("Unable to resolve project root for cx_backend.spec")


PROJECT_ROOT = _resolve_project_root()
SOURCE_ROOT = PROJECT_ROOT / "backend" / "python" / "src"
ENTRYPOINT = SOURCE_ROOT / "cx_backend" / "__main__.py"
sys.path.insert(0, str(SOURCE_ROOT))
CX_BACKEND_HIDDEN_IMPORTS = collect_submodules("cx_backend")

block_cipher = None

a = Analysis(
    [str(ENTRYPOINT)],
    pathex=[str(SOURCE_ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=CX_BACKEND_HIDDEN_IMPORTS,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="cx-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="cx-backend",
)
