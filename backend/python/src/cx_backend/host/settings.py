"""Backend host settings sourced from environment variables."""

from __future__ import annotations

import os
from pathlib import Path


def _read_paths(name: str, defaults: list[Path]) -> list[Path]:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return [path.expanduser().resolve() for path in defaults]

    parsed: list[Path] = []
    for chunk in raw.split(os.pathsep):
        candidate = chunk.strip()
        if not candidate:
            continue
        parsed.append(Path(candidate).expanduser().resolve())

    if parsed:
        return parsed
    return [path.expanduser().resolve() for path in defaults]


def _read_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(value, maximum))


SETTINGS = {
    "session_ttl_seconds": _read_int("LAS_SESSION_TTL_SECONDS", default=3600, minimum=60, maximum=86400),
    "max_sessions": _read_int("LAS_MAX_SESSIONS", default=20, minimum=1, maximum=200),
    "preview_rows": _read_int("LAS_PREVIEW_ROWS", default=30, minimum=1, maximum=2000),
    "allowed_file_roots": _read_paths("BACKEND_ALLOWED_FILE_ROOTS", defaults=[Path.cwd()]),
}
