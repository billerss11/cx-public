# Backend Contract Artifacts

This directory contains backend-facing contract artifacts mirrored from runtime contracts.

## Files

- `manifest.json`
  - Task name -> `taskVersion` + `resultModelVersion` mapping.
- `schemas/request-envelope.v1.json`
  - Common request envelope schema.
- `schemas/success-envelope.v1.json`
  - Common success envelope schema.
- `schemas/error-envelope.v1.json`
  - Common error envelope schema.
- `schemas/tasks/*.json`
  - Task payload schemas by task and version.

## Ownership

- Backend runtime code uses `backend/python/src/cx_backend/models/contracts.py`.
- This folder is the serialized artifact mirror for audits, tooling, and CI checks.
