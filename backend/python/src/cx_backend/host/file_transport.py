"""Helpers for backend file transport/path safety checks."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path


def normalize_allowed_roots(raw_roots: Sequence[Path]) -> list[Path]:
    """Normalize and de-duplicate allowed roots."""

    normalized: list[Path] = []
    seen: set[str] = set()
    for root in raw_roots:
        resolved = Path(root).expanduser().resolve()
        key = str(resolved).lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(resolved)
    return normalized


def is_path_allowed(file_path: Path, allowed_roots: Sequence[Path]) -> bool:
    """Return True when file path is inside one of allowed roots."""

    resolved_path = file_path.expanduser().resolve()
    for root in normalize_allowed_roots(allowed_roots):
        try:
            resolved_path.relative_to(root)
            return True
        except ValueError:
            continue
    return False
