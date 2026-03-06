"""Contract tests for LAS get_curve_values_at_depth task."""

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
from cx_backend.features.las.tasks import make_las_get_curve_values_at_depth_task
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
                "DEPT": [1000.0, 1010.0, 1020.0],
                "GR": [80.0, 90.0, 100.0],
                "RHOB": [2.2, 2.3, 2.4],
            }
        ),
        curve_meta={"DEPT": ("m", "Depth"), "GR": ("gAPI", "Gamma Ray"), "RHOB": ("g/cc", "Density")},
    )
    session_id = session_store.create(session)
    return session_store, session_id


class LasCurveValuesAtDepthTaskTests(unittest.TestCase):
    def test_returns_exact_value_when_depth_matches(self) -> None:
        session_store, session_id = create_session_store()
        task = make_las_get_curve_values_at_depth_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            result = task(
                {
                    "sessionId": session_id,
                    "depth": 1010.0,
                    "curveMnemonics": ["GR", "RHOB"],
                }
            )

        by_curve = {row["mnemonic"]: row for row in result["rows"]}
        self.assertEqual(by_curve["GR"]["status"], "exact")
        self.assertEqual(by_curve["GR"]["value"], 90.0)
        self.assertEqual(by_curve["RHOB"]["status"], "exact")
        self.assertEqual(by_curve["RHOB"]["value"], 2.3)

    def test_returns_interpolated_values_between_depth_samples(self) -> None:
        session_store, session_id = create_session_store()
        task = make_las_get_curve_values_at_depth_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            result = task(
                {
                    "sessionId": session_id,
                    "depth": 1015.0,
                    "curveMnemonics": ["GR"],
                }
            )

        self.assertEqual(result["rows"][0]["status"], "interpolated")
        self.assertAlmostEqual(float(result["rows"][0]["value"]), 95.0, places=6)

    def test_returns_out_of_range_when_depth_is_outside_curve_domain(self) -> None:
        session_store, session_id = create_session_store()
        task = make_las_get_curve_values_at_depth_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            result = task(
                {
                    "sessionId": session_id,
                    "depth": 900.0,
                    "curveMnemonics": ["GR"],
                }
            )

        self.assertEqual(result["rows"][0]["status"], "out_of_range")
        self.assertIsNone(result["rows"][0]["value"])

    def test_allows_querying_default_index_curve_when_request_uses_override_index_curve(self) -> None:
        session_store = InMemorySessionStore(ttl_seconds=60, max_sessions=5)
        session = ParsedLasSession(
            file_name="example.las",
            well_name="Well A",
            index_curve="DEPT",
            depth_unit="m",
            row_count=3,
            curve_count=3,
            valid_curves=["GR", "BDTI"],
            curves=[],
            preview_rows=[],
            numeric_df=pd.DataFrame(
                {
                    "DEPT": [1000.0, 1010.0, 1020.0],
                    "BDTI": [0.0, 0.5, 1.0],
                    "GR": [80.0, 90.0, 100.0],
                }
            ),
            curve_meta={"DEPT": ("m", "Depth"), "BDTI": ("h", "Bit Time"), "GR": ("gAPI", "Gamma Ray")},
        )
        session_id = session_store.create(session)
        task = make_las_get_curve_values_at_depth_task(session_store=session_store)

        with patch("cx_backend.features.las.parser.load_las_dependencies", return_value=(object(), pd)):
            result = task(
                {
                    "sessionId": session_id,
                    "depth": 0.5,
                    "indexCurve": "BDTI",
                    "curveMnemonics": ["DEPT"],
                }
            )

        self.assertEqual(result["indexCurve"], "BDTI")
        self.assertEqual(result["rows"][0]["mnemonic"], "DEPT")
        self.assertEqual(result["rows"][0]["status"], "exact")
        self.assertEqual(result["rows"][0]["value"], 1010.0)


if __name__ == "__main__":
    unittest.main()
