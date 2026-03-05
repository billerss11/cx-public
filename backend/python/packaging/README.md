# Python Backend Packaging

This directory contains packaging artifacts for the desktop Python backend runtime.

## Files

- `requirements.lock.txt`
  - Pinned dependency set for reproducible backend builds.
- `cx_backend.spec`
  - PyInstaller build spec for the `cx-backend` executable.
- `smoke_stdio_host.py`
  - Smoke script that launches the packaged host and validates `backend.health`.

## Build Flow

1. Install pinned dependencies in `cx_js_oil_gas`.
2. Build executable with PyInstaller spec.
3. Run smoke script against produced executable.

Example:

```powershell
conda run -n cx_js_oil_gas uv pip install -r backend/python/packaging/requirements.lock.txt
conda run -n cx_js_oil_gas pyinstaller --clean -y --distpath backend/python/packaging/dist --workpath backend/python/packaging/build backend/python/packaging/cx_backend.spec
$env:CX_BACKEND_EXECUTABLE = "backend/python/packaging/dist/cx-backend/cx-backend.exe"
conda run -n cx_js_oil_gas python backend/python/packaging/smoke_stdio_host.py
```
