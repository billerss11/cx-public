"""Stdio task host for the Python backend."""

from __future__ import annotations

import json
import math
import os
import sys
import time
import traceback

from cx_backend.host.task_registry import build_task_registry
from cx_backend.models.contracts import parse_request_envelope, result_model_version_for_task
from cx_backend.models.errors import TaskError, TaskExecutionError, TaskValidationError


def _to_json_safe(value: object) -> object:
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: _to_json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_to_json_safe(item) for item in value]
    item_getter = getattr(value, "item", None)
    if callable(item_getter):
        try:
            return _to_json_safe(item_getter())
        except Exception:
            return str(value)
    return str(value)


def serialize_json_line(payload: object) -> str:
    """Serialize payload as JSON without NaN/Infinity literals."""

    return json.dumps(
        _to_json_safe(payload),
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def _read_debug_flag(name: str) -> bool:
    raw = str(os.getenv(name, "")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


class StdioTaskHost:
    """Line-delimited JSON task host over stdin/stdout."""

    def __init__(self) -> None:
        self._shutdown_requested = False
        self._debug_enabled = _read_debug_flag("CX_BACKEND_DEBUG")
        self._task_registry = build_task_registry(request_shutdown=self._request_shutdown)

    def _request_shutdown(self) -> None:
        self._shutdown_requested = True

    def _build_success_response(
        self,
        request_id: object,
        task_version: str,
        task_name: str,
        result: dict[str, object],
        elapsed_ms: int,
    ) -> dict[str, object]:
        return {
            "requestId": request_id,
            "task": task_name,
            "taskVersion": task_version,
            "ok": True,
            "resultModelVersion": result_model_version_for_task(task_name),
            "result": result,
            "metrics": {
                "elapsedMs": elapsed_ms,
            },
        }

    def _build_error_response(
        self,
        request_id: object,
        task_name: str | None,
        error: TaskError,
        elapsed_ms: int,
        details: dict[str, object] | None = None,
    ) -> dict[str, object]:
        error_payload: dict[str, object] = {
            "code": error.code,
            "message": str(error),
        }
        if details:
            error_payload["details"] = details

        return {
            "requestId": request_id,
            "task": task_name,
            "ok": False,
            "error": error_payload,
            "metrics": {
                "elapsedMs": elapsed_ms,
            },
        }

    def _emit_host_log(self, event: str, payload: dict[str, object]) -> None:
        record = {
            "type": "backend.host",
            "event": event,
            "timestampMs": int(time.time() * 1000),
            **payload,
        }
        print(serialize_json_line(record), file=sys.stderr, flush=True)

    def handle_message(self, message: dict[str, object]) -> dict[str, object]:
        request_id = message.get("requestId")
        task_name_raw = str(message.get("task") or "").strip()
        task_name = task_name_raw or None
        self._emit_host_log(
            "request.received",
            {
                "requestId": request_id,
                "task": task_name,
            },
        )
        started = time.perf_counter()
        try:
            envelope = parse_request_envelope(message)
            request_id = envelope.request_id
            task_name = envelope.task
            result = self._task_registry[envelope.task](envelope.payload)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            self._emit_host_log(
                "request.succeeded",
                {
                    "requestId": request_id,
                    "task": task_name,
                    "elapsedMs": elapsed_ms,
                },
            )
            return self._build_success_response(
                request_id=request_id,
                task_version=envelope.task_version,
                task_name=task_name,
                result=result,
                elapsed_ms=elapsed_ms,
            )
        except TaskError as exc:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            self._emit_host_log(
                "request.failed",
                {
                    "requestId": request_id,
                    "task": task_name,
                    "elapsedMs": elapsed_ms,
                    "errorCode": exc.code,
                    "message": str(exc),
                },
            )
            return self._build_error_response(
                request_id=request_id,
                task_name=task_name,
                error=exc,
                elapsed_ms=elapsed_ms,
            )
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            wrapped = TaskExecutionError(f"Unhandled backend error: {exc}", code="UNHANDLED_BACKEND_ERROR")
            details = None
            if self._debug_enabled:
                details = {
                    "exceptionType": exc.__class__.__name__,
                    "traceback": traceback.format_exc(),
                }
            self._emit_host_log(
                "request.failed",
                {
                    "requestId": request_id,
                    "task": task_name,
                    "elapsedMs": elapsed_ms,
                    "errorCode": wrapped.code,
                    "message": str(wrapped),
                    "exceptionType": exc.__class__.__name__,
                },
            )
            return self._build_error_response(
                request_id=request_id,
                task_name=task_name,
                error=wrapped,
                elapsed_ms=elapsed_ms,
                details=details,
            )

    def run(self) -> None:
        while True:
            try:
                raw_line = input()
            except EOFError:
                break

            message_line = raw_line.strip()
            if not message_line:
                continue

            try:
                message = json.loads(message_line)
                if not isinstance(message, dict):
                    raise TaskValidationError("Message must be a JSON object.", code="INVALID_MESSAGE_SHAPE")
            except TaskError as exc:
                self._emit_host_log(
                    "transport.invalid_message_shape",
                    {
                        "errorCode": exc.code,
                        "message": str(exc),
                    },
                )
                response = self._build_error_response(request_id=None, task_name=None, error=exc, elapsed_ms=0)
                print(serialize_json_line(response), flush=True)
                continue
            except json.JSONDecodeError:
                self._emit_host_log(
                    "transport.invalid_json",
                    {
                        "message": "Invalid JSON message.",
                    },
                )
                response = self._build_error_response(
                    request_id=None,
                    task_name=None,
                    error=TaskValidationError("Invalid JSON message.", code="INVALID_JSON"),
                    elapsed_ms=0,
                )
                print(serialize_json_line(response), flush=True)
                continue

            response = self.handle_message(message)
            print(serialize_json_line(response), flush=True)

            if self._shutdown_requested:
                break


def run_stdio_host() -> None:
    StdioTaskHost().run()
