"""Unit tests for LAS index datetime-text normalization."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.parser import _normalize_index_curve_series


class LasTimeIndexNormalizationTests(unittest.TestCase):
    def test_converts_datetime_text_index_to_elapsed_ms(self) -> None:
        raw_series = pd.Series(
            [
                "03/08/2015-00:00:05",
                "03/08/2015-00:00:10",
                "03/08/2015-00:00:15",
            ]
        )
        numeric_series = pd.to_numeric(raw_series, errors="coerce")

        normalized, diagnostics = _normalize_index_curve_series(
            raw_series=raw_series,
            numeric_series=numeric_series,
            unit_hint="ms",
            pd_module=pd,
        )

        self.assertIsNotNone(diagnostics)
        self.assertTrue(bool(diagnostics.get("applied")))
        self.assertEqual(diagnostics.get("reasonCode"), "DATETIME_ELAPSED_CONVERSION_APPLIED")
        self.assertEqual(diagnostics.get("outputUnit"), "ms")
        self.assertEqual(float(normalized.iloc[0]), 0.0)
        self.assertEqual(float(normalized.iloc[1]), 5000.0)
        self.assertEqual(float(normalized.iloc[2]), 10000.0)

    def test_skips_conversion_when_index_is_already_numeric(self) -> None:
        raw_series = pd.Series([0.0, 5.0, 10.0])
        numeric_series = pd.to_numeric(raw_series, errors="coerce")

        normalized, diagnostics = _normalize_index_curve_series(
            raw_series=raw_series,
            numeric_series=numeric_series,
            unit_hint="ms",
            pd_module=pd,
        )

        self.assertIsNotNone(diagnostics)
        self.assertFalse(bool(diagnostics.get("applied")))
        self.assertEqual(diagnostics.get("reasonCode"), "INDEX_ALREADY_NUMERIC")
        self.assertEqual(float(normalized.iloc[0]), 0.0)
        self.assertEqual(float(normalized.iloc[1]), 5.0)
        self.assertEqual(float(normalized.iloc[2]), 10.0)

    def test_prefers_explicit_dmy_strategy_when_it_parses_more_rows(self) -> None:
        raw_series = pd.Series(
            [
                "13/08/2015-00:00:05",
                "13/08/2015-00:00:10",
                "13/08/2015-00:00:15",
            ]
        )
        numeric_series = pd.to_numeric(raw_series, errors="coerce")

        normalized, diagnostics = _normalize_index_curve_series(
            raw_series=raw_series,
            numeric_series=numeric_series,
            unit_hint="ms",
            pd_module=pd,
        )

        self.assertIsNotNone(diagnostics)
        self.assertTrue(bool(diagnostics.get("applied")))
        self.assertEqual(diagnostics.get("datetimeParseStrategy"), "dmy_dash_seconds")
        by_strategy = diagnostics.get("datetimeParsedCountByStrategy", {})
        self.assertEqual(by_strategy.get("mdy_dash_seconds"), 0)
        self.assertEqual(by_strategy.get("dmy_dash_seconds"), 3)
        self.assertEqual(float(normalized.iloc[0]), 0.0)
        self.assertEqual(float(normalized.iloc[1]), 5000.0)
        self.assertEqual(float(normalized.iloc[2]), 10000.0)

    def test_skips_conversion_when_datetime_parse_ratio_is_low(self) -> None:
        raw_series = pd.Series(
            [
                "03/08/2015-00:00:05",
                "NOT_A_TIME",
                "ALSO_NOT_A_TIME",
            ]
        )
        numeric_series = pd.to_numeric(raw_series, errors="coerce")

        normalized, diagnostics = _normalize_index_curve_series(
            raw_series=raw_series,
            numeric_series=numeric_series,
            unit_hint="ms",
            pd_module=pd,
        )

        self.assertIsNotNone(diagnostics)
        self.assertFalse(bool(diagnostics.get("applied")))
        self.assertEqual(diagnostics.get("reasonCode"), "DATETIME_PARSE_RATIO_TOO_LOW")
        self.assertTrue(pd.isna(normalized.iloc[0]))
        self.assertTrue(pd.isna(normalized.iloc[1]))
        self.assertTrue(pd.isna(normalized.iloc[2]))


if __name__ == "__main__":
    unittest.main()
