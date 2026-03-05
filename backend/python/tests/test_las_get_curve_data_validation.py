"""Contract tests for LAS get_curve_data request validation."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.tasks import make_las_get_curve_data_task
from cx_backend.models.errors import TaskValidationError
from cx_backend.models.sessions import InMemorySessionStore


class LasGetCurveDataValidationTests(unittest.TestCase):
    def test_rejects_request_that_includes_index_curve(self) -> None:
        import pandas as pd

        session_store = InMemorySessionStore(ttl_seconds=60, max_sessions=5)
        session = ParsedLasSession(
            file_name="example.las",
            well_name="Well A",
            index_curve="DEPT",
            depth_unit="m",
            row_count=3,
            curve_count=2,
            valid_curves=["GR"],
            curves=[],
            preview_rows=[],
            numeric_df=pd.DataFrame({"DEPT": [1000.0, 1000.5, 1001.0], "GR": [80.0, 81.0, 79.0]}),
            curve_meta={"DEPT": ("m", "Depth"), "GR": ("gAPI", "Gamma Ray")},
        )
        session_id = session_store.create(session)
        task = make_las_get_curve_data_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            with self.assertRaises(TaskValidationError) as raised:
                task({"sessionId": session_id, "curveMnemonics": ["DEPT"]})

        self.assertEqual(raised.exception.code, "INDEX_CURVE_NOT_ALLOWED")


if __name__ == "__main__":
    unittest.main()
