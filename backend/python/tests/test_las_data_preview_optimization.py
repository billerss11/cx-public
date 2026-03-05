"""Contract tests for LAS data preview performance safeguards."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.features.las.normalize import build_data_preview


class LasDataPreviewOptimizationTests(unittest.TestCase):
    def test_build_data_preview_limits_head_column_count(self) -> None:
        data: dict[str, list[float]] = {"DEPT": [1000.0, 1000.5, 1001.0]}
        for idx in range(18):
            data[f"C{idx:02d}"] = [float(idx), float(idx + 1), float(idx + 2)]

        preview = build_data_preview(
            numeric_df=pd.DataFrame(data),
            index_curve="DEPT",
            preview_rows=2,
            pd_module=pd,
        )

        self.assertEqual(len(preview["head"]), 2)
        self.assertLessEqual(len(preview["head"][0]), 12)
        self.assertIn("DEPT", preview["head"][0])

    def test_build_data_preview_limits_describe_column_count(self) -> None:
        data: dict[str, list[float]] = {"DEPT": [1000.0, 1000.5, 1001.0]}
        for idx in range(18):
            data[f"C{idx:02d}"] = [float(idx), float(idx + 1), float(idx + 2)]

        preview = build_data_preview(
            numeric_df=pd.DataFrame(data),
            index_curve="DEPT",
            preview_rows=2,
            pd_module=pd,
        )

        # Keep describe payload compact for very wide LAS datasets.
        self.assertLessEqual(len(preview.get("describe", {})), 12)


if __name__ == "__main__":
    unittest.main()
