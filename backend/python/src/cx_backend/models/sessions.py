"""Shared session storage for backend feature data."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Generic, TypeVar
from uuid import uuid4

from cx_backend.models.errors import SessionNotFoundError

SessionDataT = TypeVar("SessionDataT")


@dataclass(slots=True)
class StoredSession(Generic[SessionDataT]):
    """Value persisted in the in-memory session store."""

    expires_at: float
    created_at: float
    data: SessionDataT


class InMemorySessionStore(Generic[SessionDataT]):
    """Bounded in-memory session store."""

    def __init__(self, ttl_seconds: int, max_sessions: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._max_sessions = max_sessions
        self._store: dict[str, StoredSession[SessionDataT]] = {}
        self._lock = threading.Lock()

    def _cleanup_locked(self) -> None:
        now = time.time()
        expired = [session_id for session_id, entry in self._store.items() if entry.expires_at <= now]
        for session_id in expired:
            self._store.pop(session_id, None)

    def create(self, data: SessionDataT) -> str:
        with self._lock:
            self._cleanup_locked()
            if len(self._store) >= self._max_sessions:
                oldest_session_id = min(self._store.items(), key=lambda item: item[1].created_at)[0]
                self._store.pop(oldest_session_id, None)

            session_id = uuid4().hex
            now = time.time()
            self._store[session_id] = StoredSession(
                expires_at=now + self._ttl_seconds,
                created_at=now,
                data=data,
            )
            return session_id

    def get(self, session_id: str) -> SessionDataT:
        with self._lock:
            self._cleanup_locked()
            if session_id not in self._store:
                raise SessionNotFoundError("Session not found or expired. Re-parse the file.")
            entry = self._store[session_id]
            entry.expires_at = time.time() + self._ttl_seconds
            self._store[session_id] = entry
            return entry.data

    def delete(self, session_id: str) -> bool:
        with self._lock:
            return self._store.pop(session_id, None) is not None
