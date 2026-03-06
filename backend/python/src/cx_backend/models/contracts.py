"""Shared backend task contract metadata and envelope validation."""

from __future__ import annotations

from dataclasses import dataclass

from cx_backend.models.errors import TaskValidationError

TASK_CONTRACT_VERSIONS: dict[str, str] = {
    "backend.health": "1.0",
    "backend.get_capabilities": "1.0",
    "backend.shutdown": "1.0",
    "las.parse_file": "1.0",
    "las.get_curve_data": "1.0",
    "las.export_curve_data_csv": "1.0",
    "las.get_curve_values_at_depth": "1.0",
    "las.get_curve_statistics": "1.0",
    "las.get_correlation_matrix": "1.0",
    "las.delete_session": "1.0",
}

TASK_RESULT_MODEL_VERSIONS: dict[str, str] = {
    "backend.health": "1.0",
    "backend.get_capabilities": "1.0",
    "backend.shutdown": "1.0",
    "las.parse_file": "1.0",
    "las.get_curve_data": "1.0",
    "las.export_curve_data_csv": "1.0",
    "las.get_curve_values_at_depth": "1.0",
    "las.get_curve_statistics": "1.0",
    "las.get_correlation_matrix": "1.0",
    "las.delete_session": "1.0",
}

DEFAULT_RESULT_MODEL_VERSION = "1.0"


@dataclass(slots=True, frozen=True)
class RequestEnvelope:
    """Normalized request envelope used by the task host."""

    request_id: object
    task: str
    task_version: str
    payload: dict[str, object]
    context: dict[str, object]


def _as_dict(value: object, *, field_name: str, error_code: str) -> dict[str, object]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise TaskValidationError(f"'{field_name}' must be an object.", code=error_code)
    return value


def parse_request_envelope(message: dict[str, object]) -> RequestEnvelope:
    """Validate and normalize a task request envelope."""

    request_id = message.get("requestId")
    task = str(message.get("task") or "").strip()
    if not task:
        raise TaskValidationError("'task' is required.", code="MISSING_TASK")

    task_version = str(message.get("taskVersion") or "").strip()
    if not task_version:
        raise TaskValidationError("'taskVersion' is required.", code="MISSING_TASK_VERSION")

    expected_version = TASK_CONTRACT_VERSIONS.get(task)
    if expected_version and task_version != expected_version:
        raise TaskValidationError(
            f"Unsupported taskVersion '{task_version}' for task '{task}'. Expected '{expected_version}'.",
            code="UNSUPPORTED_TASK_VERSION",
        )

    payload = _as_dict(message.get("payload"), field_name="payload", error_code="INVALID_PAYLOAD_TYPE")
    context = _as_dict(message.get("context"), field_name="context", error_code="INVALID_CONTEXT_TYPE")

    return RequestEnvelope(
        request_id=request_id,
        task=task,
        task_version=task_version,
        payload=payload,
        context=context,
    )


def result_model_version_for_task(task_name: str) -> str:
    """Resolve result model version for a task."""

    return TASK_RESULT_MODEL_VERSIONS.get(task_name, DEFAULT_RESULT_MODEL_VERSION)
