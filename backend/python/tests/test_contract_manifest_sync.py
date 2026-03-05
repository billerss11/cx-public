"""Contract mirror tests for backend contract artifacts."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.models.contracts import TASK_CONTRACT_VERSIONS, TASK_RESULT_MODEL_VERSIONS

BACKEND_ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_ROOT = BACKEND_ROOT / "contracts"


class ContractManifestSyncTests(unittest.TestCase):
    def test_manifest_versions_match_runtime_contract_maps(self) -> None:
        manifest = json.loads((CONTRACTS_ROOT / "manifest.json").read_text(encoding="utf-8"))
        manifest_tasks = manifest["tasks"]

        task_versions = {task_name: config["taskVersion"] for task_name, config in manifest_tasks.items()}
        result_versions = {task_name: config["resultModelVersion"] for task_name, config in manifest_tasks.items()}

        self.assertEqual(task_versions, TASK_CONTRACT_VERSIONS)
        self.assertEqual(result_versions, TASK_RESULT_MODEL_VERSIONS)

    def test_manifest_payload_schema_paths_exist(self) -> None:
        manifest = json.loads((CONTRACTS_ROOT / "manifest.json").read_text(encoding="utf-8"))
        for task_name, config in manifest["tasks"].items():
            with self.subTest(task=task_name):
                schema_path = CONTRACTS_ROOT / config["payloadSchema"]
                self.assertTrue(schema_path.exists(), f"Missing schema: {schema_path}")

    def test_envelope_schema_files_exist(self) -> None:
        schema_paths = (
            CONTRACTS_ROOT / "schemas" / "request-envelope.v1.json",
            CONTRACTS_ROOT / "schemas" / "success-envelope.v1.json",
            CONTRACTS_ROOT / "schemas" / "error-envelope.v1.json",
        )
        for schema_path in schema_paths:
            with self.subTest(schema=schema_path.name):
                self.assertTrue(schema_path.exists(), f"Missing schema: {schema_path}")


if __name__ == "__main__":
    unittest.main()
