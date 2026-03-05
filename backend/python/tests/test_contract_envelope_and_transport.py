"""Contract tests for request envelope validation and file transport policy."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.tasks import make_las_parse_file_task
from cx_backend.host.stdio_host import StdioTaskHost
from cx_backend.models.errors import TaskValidationError
from cx_backend.models.sessions import InMemorySessionStore


class StdioEnvelopeContractTests(unittest.TestCase):
    def test_handle_message_requires_task_version(self) -> None:
        host = StdioTaskHost()
        response = host.handle_message({"requestId": "req-1", "task": "backend.health", "payload": {}})
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "MISSING_TASK_VERSION")

    def test_handle_message_rejects_invalid_context_type(self) -> None:
        host = StdioTaskHost()
        response = host.handle_message(
            {
                "requestId": "req-2",
                "task": "backend.health",
                "taskVersion": "1.0",
                "payload": {},
                "context": "not-an-object",
            }
        )
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "INVALID_CONTEXT_TYPE")

    def test_handle_message_rejects_unsupported_task_version(self) -> None:
        host = StdioTaskHost()
        response = host.handle_message(
            {
                "requestId": "req-3",
                "task": "backend.health",
                "taskVersion": "9.9",
                "payload": {},
                "context": {},
            }
        )
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "UNSUPPORTED_TASK_VERSION")

    def test_handle_message_accepts_supported_task_version(self) -> None:
        host = StdioTaskHost()
        response = host.handle_message(
            {
                "requestId": "req-4",
                "task": "backend.health",
                "taskVersion": "1.0",
                "payload": {},
                "context": {},
            }
        )
        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "ok")


class FileTransportPolicyTests(unittest.TestCase):
    def test_las_parse_rejects_file_outside_allowed_roots(self) -> None:
        with tempfile.TemporaryDirectory() as allowed_root_raw, tempfile.TemporaryDirectory() as outside_root_raw:
            allowed_root = Path(allowed_root_raw)
            outside_file = Path(outside_root_raw) / "outside.las"
            outside_file.write_text("~Version Information", encoding="utf-8")

            session_store = InMemorySessionStore(ttl_seconds=60, max_sessions=5)
            task = make_las_parse_file_task(
                session_store=session_store,
                default_preview_rows=30,
                allowed_roots=[allowed_root],
            )

            with self.assertRaises(TaskValidationError) as raised:
                task({"filePath": str(outside_file), "previewRows": 30})

            self.assertEqual(raised.exception.code, "FILE_PATH_NOT_ALLOWED")


if __name__ == "__main__":
    unittest.main()
