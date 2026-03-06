"""Contract tests for backend task registry and stdio host routing."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.host.task_registry import build_task_registry
from cx_backend.host.stdio_host import StdioTaskHost
from cx_backend.models.errors import TaskValidationError


class BackendStructureContractTests(unittest.TestCase):
    def test_feature_packages_exist_for_las_and_dlis(self) -> None:
        from cx_backend.features.dlis import models as dlis_models
        from cx_backend.features.dlis import parser as dlis_parser
        from cx_backend.features.dlis import tasks as dlis_tasks
        from cx_backend.features.las import models as las_models
        from cx_backend.features.las import normalize as las_normalize
        from cx_backend.features.las import parser as las_parser
        from cx_backend.features.las import tasks as las_tasks

        self.assertIsNotNone(las_tasks)
        self.assertIsNotNone(las_parser)
        self.assertIsNotNone(las_normalize)
        self.assertIsNotNone(las_models)
        self.assertIsNotNone(dlis_tasks)
        self.assertIsNotNone(dlis_parser)
        self.assertIsNotNone(dlis_models)


class TaskRegistryContractTests(unittest.TestCase):
    def test_build_task_registry_contains_core_tasks(self) -> None:
        registry = build_task_registry()
        self.assertIn("backend.health", registry)
        self.assertIn("backend.get_capabilities", registry)
        self.assertIn("backend.shutdown", registry)
        self.assertIn("las.parse_file", registry)
        self.assertIn("las.get_curve_data", registry)
        self.assertIn("las.export_curve_data_csv", registry)
        self.assertIn("las.get_curve_values_at_depth", registry)
        self.assertIn("las.get_curve_statistics", registry)
        self.assertIn("las.get_correlation_matrix", registry)
        self.assertIn("las.delete_session", registry)

    def test_registry_unknown_task_raises_task_validation_error(self) -> None:
        registry = build_task_registry()
        with self.assertRaises(TaskValidationError):
            registry["unknown.task"]({})

    def test_backend_get_capabilities_exposes_task_versions(self) -> None:
        registry = build_task_registry()
        result = registry["backend.get_capabilities"]({})
        self.assertIn("taskVersions", result)
        self.assertEqual(result["taskVersions"]["backend.health"], "1.0")
        self.assertEqual(result["taskVersions"]["las.parse_file"], "1.0")
        self.assertEqual(result["taskVersions"]["las.export_curve_data_csv"], "1.0")
        self.assertEqual(result["taskVersions"]["las.get_curve_statistics"], "1.0")


class StdioHostRoutingContractTests(unittest.TestCase):
    def test_handle_message_backend_health_succeeds(self) -> None:
        host = StdioTaskHost()
        response = host.handle_message(
            {
                "requestId": "req-1",
                "task": "backend.health",
                "taskVersion": "1.0",
                "payload": {},
                "context": {},
            }
        )
        self.assertTrue(response["ok"])
        self.assertEqual(response["result"]["status"], "ok")
        self.assertEqual(response["result"]["transport"], "stdio")
        self.assertEqual(response["taskVersion"], "1.0")

    def test_handle_message_unknown_task_returns_error_envelope(self) -> None:
        host = StdioTaskHost()
        response = host.handle_message(
            {
                "requestId": "req-2",
                "task": "unknown.task",
                "taskVersion": "1.0",
                "payload": {},
                "context": {},
            }
        )
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "UNKNOWN_TASK")


if __name__ == "__main__":
    unittest.main()
