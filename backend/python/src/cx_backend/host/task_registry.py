"""Task registry assembly for the stdio host."""

from __future__ import annotations

from collections.abc import Callable, Iterator, Mapping, Sequence

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.tasks import (
    make_las_get_correlation_matrix_task,
    make_las_delete_session_task,
    make_las_get_curve_data_task,
    make_las_export_curve_data_csv_task,
    make_las_get_curve_values_at_depth_task,
    make_las_get_curve_statistics_task,
    make_las_parse_file_task,
)
from cx_backend.host.settings import SETTINGS
from cx_backend.models.contracts import TASK_CONTRACT_VERSIONS
from cx_backend.models.errors import TaskValidationError
from cx_backend.models.sessions import InMemorySessionStore

TaskHandler = Callable[[dict[str, object]], dict[str, object]]

SUPPORTED_TASKS = (
    "backend.health",
    "backend.get_capabilities",
    "backend.shutdown",
    "las.parse_file",
    "las.get_curve_data",
    "las.export_curve_data_csv",
    "las.get_curve_values_at_depth",
    "las.get_curve_statistics",
    "las.get_correlation_matrix",
    "las.delete_session",
)


def task_backend_health(payload: dict[str, object]) -> dict[str, object]:
    _ = payload
    return {
        "status": "ok",
        "transport": "stdio",
        "runtime": "python",
    }


def make_backend_get_capabilities_task(
    supported_tasks: Sequence[str],
    task_contract_versions: dict[str, str],
) -> TaskHandler:
    """Create the capabilities task bound to the known task list."""

    task_names = list(supported_tasks)

    def task_backend_get_capabilities(payload: dict[str, object]) -> dict[str, object]:
        _ = payload
        return {
            "tasks": task_names,
            "taskVersions": {task_name: task_contract_versions[task_name] for task_name in task_names},
            "supportsProgressEvents": False,
            "supportsSessionTasks": True,
        }

    return task_backend_get_capabilities


def make_backend_shutdown_task(request_shutdown: Callable[[], None]) -> TaskHandler:
    """Create the shutdown task bound to the host lifecycle callback."""

    def task_backend_shutdown(payload: dict[str, object]) -> dict[str, object]:
        _ = payload
        request_shutdown()
        return {"status": "shutting_down"}

    return task_backend_shutdown


class TaskRegistry(Mapping[str, TaskHandler]):
    """Mapping wrapper that raises backend task errors for unknown tasks."""

    def __init__(self, handlers: dict[str, TaskHandler]) -> None:
        self._handlers = handlers

    def __getitem__(self, task_name: str) -> TaskHandler:
        handler = self._handlers.get(task_name)
        if handler is None:
            raise TaskValidationError(f"Unknown task: {task_name}", code="UNKNOWN_TASK")
        return handler

    def __iter__(self) -> Iterator[str]:
        return iter(self._handlers)

    def __len__(self) -> int:
        return len(self._handlers)


def build_task_registry(
    session_store: InMemorySessionStore[ParsedLasSession] | None = None,
    request_shutdown: Callable[[], None] | None = None,
) -> TaskRegistry:
    """Build the callable task registry for the backend host."""

    resolved_store = session_store or InMemorySessionStore(
        ttl_seconds=SETTINGS["session_ttl_seconds"],
        max_sessions=SETTINGS["max_sessions"],
    )
    resolved_shutdown = request_shutdown or (lambda: None)

    handlers: dict[str, TaskHandler] = {
        "backend.health": task_backend_health,
        "backend.get_capabilities": make_backend_get_capabilities_task(SUPPORTED_TASKS, TASK_CONTRACT_VERSIONS),
        "backend.shutdown": make_backend_shutdown_task(resolved_shutdown),
        "las.parse_file": make_las_parse_file_task(
            session_store=resolved_store,
            default_preview_rows=SETTINGS["preview_rows"],
            allowed_roots=SETTINGS["allowed_file_roots"],
        ),
        "las.get_curve_data": make_las_get_curve_data_task(resolved_store),
        "las.export_curve_data_csv": make_las_export_curve_data_csv_task(
            session_store=resolved_store,
            allowed_roots=SETTINGS["allowed_file_roots"],
        ),
        "las.get_curve_values_at_depth": make_las_get_curve_values_at_depth_task(resolved_store),
        "las.get_curve_statistics": make_las_get_curve_statistics_task(resolved_store),
        "las.get_correlation_matrix": make_las_get_correlation_matrix_task(resolved_store),
        "las.delete_session": make_las_delete_session_task(resolved_store),
    }
    return TaskRegistry(handlers)
