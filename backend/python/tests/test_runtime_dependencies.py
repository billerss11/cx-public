"""Smoke tests for backend runtime dependencies."""

from __future__ import annotations

import importlib
import unittest


class RuntimeDependencySmokeTests(unittest.TestCase):
    def test_runtime_dependencies_import_successfully(self) -> None:
        module_names = ("dlisio", "lasio", "pandas", "wellpathpy")

        for module_name in module_names:
            with self.subTest(module=module_name):
                imported_module = importlib.import_module(module_name)
                self.assertIsNotNone(imported_module)


if __name__ == "__main__":
    unittest.main()
