"""Smoke test for parsing the bundled sample LAS file."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SOURCE_ROOT = REPO_ROOT / "backend" / "python" / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.tasks import make_las_parse_file_task
from cx_backend.models.sessions import InMemorySessionStore


class LasSampleFileSmokeTests(unittest.TestCase):
    def test_sample_las_file_parses_through_backend_task(self) -> None:
        sample_path = REPO_ROOT / "files" / "sample_las" / "S2R1_NGI-XPT_Up Log.las"
        self.assertTrue(sample_path.is_file(), f"Expected sample LAS file to exist: {sample_path}")

        session_store = InMemorySessionStore(ttl_seconds=60, max_sessions=5)
        task = make_las_parse_file_task(
            session_store=session_store,
            default_preview_rows=20,
            allowed_roots=[sample_path.parent],
        )

        result = task({"filePath": str(sample_path)})

        self.assertEqual(result["fileName"], sample_path.name)
        self.assertGreater(int(result["rowCount"]), 0)
        self.assertGreater(int(result["curveCount"]), 0)
        self.assertIn(result["indexCurve"], {"DEPT", "DEPTH", "MD", "TDEP"})
        self.assertTrue(result["validCurves"])
        self.assertTrue(result["overview"])
        self.assertTrue(result["previewRows"])
        self.assertGreater(len(result["previewRows"]), 0)


if __name__ == "__main__":
    unittest.main()
