"""Contract tests for LAS statistics and correlation tasks."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.tasks import (
    make_las_get_correlation_matrix_task,
    make_las_get_curve_statistics_task,
)
from cx_backend.models.errors import TaskValidationError
from cx_backend.models.sessions import InMemorySessionStore


def create_session_store() -> tuple[InMemorySessionStore[ParsedLasSession], str]:
    session_store = InMemorySessionStore(ttl_seconds=60, max_sessions=5)
    session = ParsedLasSession(
        file_name="example.las",
        well_name="Well A",
        index_curve="DEPT",
        depth_unit="m",
        row_count=5,
        curve_count=3,
        valid_curves=["GR", "RHOB"],
        curves=[],
        preview_rows=[],
        numeric_df=pd.DataFrame(
            {
                "DEPT": [1000.0, 1000.5, 1001.0, 1001.5, 1002.0],
                "GR": [80.0, 82.0, 81.0, 79.0, 83.0],
                "RHOB": [2.4, 2.45, 2.43, 2.41, 2.44],
            }
        ),
        curve_meta={"DEPT": ("m", "Depth"), "GR": ("gAPI", "Gamma Ray"), "RHOB": ("g/cm3", "Density")},
    )
    session_id = session_store.create(session)
    return session_store, session_id


class LasCurveStatisticsTaskTests(unittest.TestCase):
    def test_rejects_empty_curve_list(self) -> None:
        session_store, session_id = create_session_store()
        task = make_las_get_curve_statistics_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            with self.assertRaises(TaskValidationError) as raised:
                task({"sessionId": session_id, "curveMnemonics": []})

        self.assertEqual(raised.exception.code, "EMPTY_CURVE_LIST")


class LasCorrelationMatrixTaskTests(unittest.TestCase):
    def test_requires_at_least_two_curves(self) -> None:
        session_store, session_id = create_session_store()
        task = make_las_get_correlation_matrix_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            with self.assertRaises(TaskValidationError) as raised:
                task({"sessionId": session_id, "curveMnemonics": ["GR"]})

        self.assertEqual(raised.exception.code, "INSUFFICIENT_CURVE_COUNT")


if __name__ == "__main__":
    unittest.main()
