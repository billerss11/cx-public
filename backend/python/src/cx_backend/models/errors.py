"""Shared backend task errors."""

from __future__ import annotations


class TaskError(Exception):
    """Base task error with machine-readable code."""

    def __init__(self, message: str, code: str = "TASK_ERROR") -> None:
        super().__init__(message)
        self.code = code


class TaskValidationError(TaskError):
    """Input or task contract error."""

    def __init__(self, message: str, code: str = "INVALID_PAYLOAD") -> None:
        super().__init__(message, code=code)


class TaskExecutionError(TaskError):
    """Task runtime failure error."""

    def __init__(self, message: str, code: str = "TASK_EXECUTION_FAILED") -> None:
        super().__init__(message, code=code)


class SessionNotFoundError(TaskError):
    """Session resolution error."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="SESSION_NOT_FOUND")
