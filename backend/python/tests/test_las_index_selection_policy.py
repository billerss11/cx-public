"""Contract tests for LAS index curve selection policy."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.normalize import choose_index_curve


class LasIndexSelectionPolicyTests(unittest.TestCase):
    def test_uses_first_curve_as_default_index_even_when_not_numeric(self) -> None:
        numeric_df = pd.DataFrame(
            {
                "TIME": [None, None, None],
                "BDTI": [0.0, 0.5, 1.0],
                "BIT_DEPTH": [1000.0, 1001.0, 1002.0],
            }
        )

        result = choose_index_curve(numeric_df=numeric_df, initial_name="TIME")
        self.assertEqual(result, "TIME")

    def test_falls_back_to_first_available_column_when_initial_name_missing(self) -> None:
        numeric_df = pd.DataFrame(
            {
                "BDTI": [0.0, 0.5, 1.0],
                "BIT_DEPTH": [1000.0, 1001.0, 1002.0],
            }
        )

        result = choose_index_curve(numeric_df=numeric_df, initial_name="TIME")
        self.assertEqual(result, "BDTI")


if __name__ == "__main__":
    unittest.main()
