"""Contract tests for enhanced LAS parse response fields."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.parser import build_parse_response


class LasEnhancedParseResponseTests(unittest.TestCase):
    def test_parse_response_includes_metadata_and_info_panels(self) -> None:
        parsed = ParsedLasSession(
            file_name="example.las",
            well_name="Well A",
            index_curve="DEPT",
            depth_unit="m",
            row_count=3,
            curve_count=2,
            valid_curves=["GR"],
            curves=[
                {
                    "mnemonic": "GR",
                    "unit": "gAPI",
                    "description": "Gamma Ray",
                    "dataPoints": 3,
                    "minValue": 80.0,
                    "maxValue": 90.0,
                    "isNumeric": True,
                }
            ],
            preview_rows=[{"DEPT": 1000.0, "GR": 80.0}],
            numeric_df=pd.DataFrame({"DEPT": [1000.0, 1000.5, 1001.0], "GR": [80.0, 85.0, 90.0]}),
            curve_meta={"DEPT": ("m", "Depth"), "GR": ("gAPI", "Gamma Ray")},
        )

        result = build_parse_response(session_id="session-1", parsed=parsed)

        self.assertEqual(result["sessionId"], "session-1")
        self.assertIn("fileSizeBytes", result)
        self.assertIn("fileSizeDisplay", result)
        self.assertIn("overview", result)
        self.assertIn("wellInformation", result)
        self.assertIn("curveRanges", result)
        self.assertIn("dataPreview", result)

    def test_parse_response_reports_first_curve_numeric_parse_diagnostics(self) -> None:
        parsed = ParsedLasSession(
            file_name="example.las",
            well_name="Well A",
            index_curve="TIME",
            depth_unit="ms",
            row_count=3,
            curve_count=3,
            valid_curves=["GR"],
            curves=[
                {
                    "mnemonic": "TIME",
                    "unit": "ms",
                    "description": "Clock Time",
                    "dataPoints": 3,
                    "minValue": None,
                    "maxValue": None,
                    "isNumeric": False,
                    "rawNonNullCount": 3,
                    "numericNonNullCount": 0,
                    "numericParseRatio": 0.0,
                },
                {
                    "mnemonic": "BDTI",
                    "unit": "h",
                    "description": "Bit time",
                    "dataPoints": 3,
                    "minValue": 0.0,
                    "maxValue": 1.0,
                    "isNumeric": True,
                    "rawNonNullCount": 3,
                    "numericNonNullCount": 3,
                    "numericParseRatio": 1.0,
                },
                {
                    "mnemonic": "GR",
                    "unit": "gAPI",
                    "description": "Gamma Ray",
                    "dataPoints": 3,
                    "minValue": 80.0,
                    "maxValue": 90.0,
                    "isNumeric": True,
                    "rawNonNullCount": 3,
                    "numericNonNullCount": 3,
                    "numericParseRatio": 1.0,
                },
            ],
            preview_rows=[{"TIME": "00:00:00.000", "BDTI": 0.0, "GR": 80.0}],
            numeric_df=pd.DataFrame(
                {
                    "TIME": [None, None, None],
                    "BDTI": [0.0, 0.5, 1.0],
                    "GR": [80.0, 85.0, 90.0],
                }
            ),
            curve_meta={"TIME": ("ms", "Clock Time"), "BDTI": ("h", "Bit time"), "GR": ("gAPI", "Gamma Ray")},
            first_curve_raw_head_sample=["", "", ""],
            first_curve_raw_non_null_sample=[],
            first_curve_numeric_head_sample=[None, None, None],
        )

        result = build_parse_response(session_id="session-1", parsed=parsed)
        diagnostics = result["indexSelectionDiagnostics"]

        self.assertEqual(diagnostics["selectedIndexCurve"], "TIME")
        self.assertEqual(diagnostics["firstCurve"]["mnemonic"], "TIME")
        self.assertFalse(diagnostics["firstCurveRejected"])
        self.assertEqual(diagnostics["firstCurve"]["numericParseRatio"], 0.0)
        self.assertEqual(diagnostics["firstCurve"]["numericNonNullCount"], 0)
        self.assertEqual(diagnostics["firstCurve"]["rawHeadSample"], ["", "", ""])
        self.assertEqual(diagnostics["firstCurve"]["rawNonNullSample"], [])
        self.assertEqual(diagnostics["firstCurve"]["numericHeadSample"], [None, None, None])
        self.assertIsNone(diagnostics["indexNormalization"])
        self.assertEqual(diagnostics["rejectionReasonCode"], "NOT_REJECTED")


if __name__ == "__main__":
    unittest.main()
