"""Contract tests for LAS curve-data CSV export task."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.tasks import make_las_export_curve_data_csv_task
from cx_backend.models.errors import TaskValidationError
from cx_backend.models.sessions import InMemorySessionStore


def create_session_store() -> tuple[InMemorySessionStore[ParsedLasSession], str]:
    session_store = InMemorySessionStore(ttl_seconds=60, max_sessions=5)
    session = ParsedLasSession(
        file_name="example.las",
        well_name="Well A",
        index_curve="DEPT",
        depth_unit="m",
        row_count=3,
        curve_count=3,
        valid_curves=["GR", "RHOB"],
        curves=[],
        preview_rows=[],
        numeric_df=pd.DataFrame(
            {
                "DEPT": [1000.0, 1000.5, 1001.0],
                "GR": [80.0, 81.0, 79.0],
                "RHOB": [2.4, 2.41, 2.39],
            }
        ),
        curve_meta={"DEPT": ("m", "Depth"), "GR": ("gAPI", "Gamma Ray"), "RHOB": ("g/cc", "Density")},
    )
    session_id = session_store.create(session)
    return session_store, session_id


class LasExportCurveDataCsvTaskTests(unittest.TestCase):
    def test_writes_selected_curves_csv_and_returns_file_metadata(self) -> None:
        session_store, session_id = create_session_store()
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir).resolve()
            output_path = temp_root / "curves-export"
            task = make_las_export_curve_data_csv_task(
                session_store=session_store,
                allowed_roots=[temp_root],
            )

            with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
                result = task(
                    {
                        "sessionId": session_id,
                        "curveMnemonics": ["GR", "RHOB"],
                        "outputFilePath": str(output_path),
                    }
                )

            expected_path = output_path.with_suffix(".csv")
            self.assertEqual(result["outputFilePath"], str(expected_path))
            self.assertEqual(result["fileName"], "curves-export.csv")
            self.assertEqual(result["indexCurve"], "DEPT")
            self.assertEqual(result["curveMnemonics"], ["GR", "RHOB"])
            self.assertTrue(expected_path.exists())

            exported = pd.read_csv(expected_path)
            self.assertEqual(list(exported.columns), ["DEPT", "GR", "RHOB"])
            self.assertEqual(int(exported.shape[0]), 3)

    def test_rejects_output_path_outside_allowed_roots(self) -> None:
        session_store, session_id = create_session_store()
        with tempfile.TemporaryDirectory() as allowed_dir, tempfile.TemporaryDirectory() as blocked_dir:
            allowed_root = Path(allowed_dir).resolve()
            blocked_path = Path(blocked_dir).resolve() / "blocked.csv"
            task = make_las_export_curve_data_csv_task(
                session_store=session_store,
                allowed_roots=[allowed_root],
            )

            with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
                with self.assertRaises(TaskValidationError) as raised:
                    task(
                        {
                            "sessionId": session_id,
                            "curveMnemonics": ["GR"],
                            "outputFilePath": str(blocked_path),
                        }
                    )

            self.assertEqual(raised.exception.code, "OUTPUT_PATH_NOT_ALLOWED")


if __name__ == "__main__":
    unittest.main()
