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


if __name__ == "__main__":
    unittest.main()
