"""Task bindings for the LAS backend feature."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from pathlib import Path

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.parser import (
    build_correlation_matrix_response,
    build_curve_data_response,
    build_curve_statistics_response,
    build_parse_response,
    parse_las_file_content,
)
from cx_backend.host.file_transport import is_path_allowed
from cx_backend.models.errors import TaskExecutionError, TaskValidationError
from cx_backend.models.sessions import InMemorySessionStore


def resolve_file_path(value: object, allowed_roots: Sequence[Path]) -> Path:
    file_path_raw = str(value or "").strip()
    if not file_path_raw:
        raise TaskValidationError("'filePath' is required.", code="MISSING_FILE_PATH")
    file_path = Path(file_path_raw).expanduser().resolve()
    if not file_path.exists() or not file_path.is_file():
        raise TaskValidationError(f"File does not exist: {file_path}", code="FILE_NOT_FOUND")
    if file_path.suffix.lower() != ".las":
        raise TaskValidationError("Only .las files are supported.", code="UNSUPPORTED_FILE_EXTENSION")
    if not is_path_allowed(file_path, allowed_roots):
        raise TaskValidationError("File path is outside allowed backend roots.", code="FILE_PATH_NOT_ALLOWED")
    return file_path


def _parse_int(value: object, field_name: str, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise TaskValidationError(f"'{field_name}' must be an integer.", code="INVALID_INTEGER_FIELD") from exc
    return max(minimum, min(parsed, maximum))


def make_las_parse_file_task(
    session_store: InMemorySessionStore[ParsedLasSession],
    default_preview_rows: int,
    allowed_roots: Sequence[Path],
) -> Callable[[dict[str, object]], dict[str, object]]:
    """Create the LAS parse task bound to the session store."""

    def task_las_parse_file(payload: dict[str, object]) -> dict[str, object]:
        file_path = resolve_file_path(payload.get("filePath"), allowed_roots=allowed_roots)
        preview_rows = _parse_int(
            payload.get("previewRows"),
            field_name="previewRows",
            default=default_preview_rows,
            minimum=1,
            maximum=2000,
        )

        try:
            content = file_path.read_bytes()
        except OSError as exc:
            raise TaskExecutionError(f"Unable to read file: {exc}", code="FILE_READ_FAILED") from exc

        parsed = parse_las_file_content(
            file_name=file_path.name,
            content=content,
            preview_rows=preview_rows,
        )
        session_id = session_store.create(parsed)
        return build_parse_response(session_id=session_id, parsed=parsed)

    return task_las_parse_file


def make_las_get_curve_data_task(
    session_store: InMemorySessionStore[ParsedLasSession],
) -> Callable[[dict[str, object]], dict[str, object]]:
    """Create the curve-data task bound to the session store."""

    def task_las_get_curve_data(payload: dict[str, object]) -> dict[str, object]:
        session_id = str(payload.get("sessionId") or "").strip()
        if not session_id:
            raise TaskValidationError("'sessionId' is required.", code="MISSING_SESSION_ID")
        parsed = session_store.get(session_id)
        return build_curve_data_response(parsed=parsed, request=payload, session_id=session_id)

    return task_las_get_curve_data


def make_las_get_curve_statistics_task(
    session_store: InMemorySessionStore[ParsedLasSession],
) -> Callable[[dict[str, object]], dict[str, object]]:
    """Create the curve-statistics task bound to the session store."""

    def task_las_get_curve_statistics(payload: dict[str, object]) -> dict[str, object]:
        session_id = str(payload.get("sessionId") or "").strip()
        if not session_id:
            raise TaskValidationError("'sessionId' is required.", code="MISSING_SESSION_ID")
        parsed = session_store.get(session_id)
        return build_curve_statistics_response(parsed=parsed, request=payload, session_id=session_id)

    return task_las_get_curve_statistics


def make_las_get_correlation_matrix_task(
    session_store: InMemorySessionStore[ParsedLasSession],
) -> Callable[[dict[str, object]], dict[str, object]]:
    """Create the correlation-matrix task bound to the session store."""

    def task_las_get_correlation_matrix(payload: dict[str, object]) -> dict[str, object]:
        session_id = str(payload.get("sessionId") or "").strip()
        if not session_id:
            raise TaskValidationError("'sessionId' is required.", code="MISSING_SESSION_ID")
        parsed = session_store.get(session_id)
        return build_correlation_matrix_response(parsed=parsed, request=payload, session_id=session_id)

    return task_las_get_correlation_matrix


def make_las_delete_session_task(
    session_store: InMemorySessionStore[ParsedLasSession],
) -> Callable[[dict[str, object]], dict[str, object]]:
    """Create the delete-session task bound to the session store."""

    def task_las_delete_session(payload: dict[str, object]) -> dict[str, object]:
        session_id = str(payload.get("sessionId") or "").strip()
        if not session_id:
            raise TaskValidationError("'sessionId' is required.", code="MISSING_SESSION_ID")
        deleted = session_store.delete(session_id)
        return {"status": "deleted" if deleted else "not_found"}

    return task_las_delete_session
