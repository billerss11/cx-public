"""Contract tests for stdio host JSON output safety."""

from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from cx_backend.host.stdio_host import serialize_json_line


class StdioJsonOutputContractTests(unittest.TestCase):
    def test_serialize_json_line_converts_non_finite_numbers_to_null(self) -> None:
        payload = {
            "ok": True,
            "result": {
                "a": math.nan,
                "b": [1.0, math.inf, -math.inf],
            },
        }

        line = serialize_json_line(payload)
        self.assertNotIn("NaN", line)
        self.assertNotIn("Infinity", line)

        decoded = json.loads(line)
        self.assertIsNone(decoded["result"]["a"])
        self.assertEqual(decoded["result"]["b"], [1.0, None, None])

    def test_serialize_json_line_converts_scalar_like_values(self) -> None:
        class ScalarLike:
            def __init__(self, value: int) -> None:
                self._value = value

            def item(self) -> int:
                return self._value

        payload = {
            "ok": True,
            "result": {
                "rowCount": ScalarLike(31),
                "curveCount": ScalarLike(8),
            },
        }

        line = serialize_json_line(payload)
        decoded = json.loads(line)
        self.assertEqual(decoded["result"]["rowCount"], 31)
        self.assertEqual(decoded["result"]["curveCount"], 8)

    def test_serialize_json_line_falls_back_to_string_for_unknown_objects(self) -> None:
        class UnknownValue:
            pass

        payload = {
            "ok": True,
            "result": {
                "unknown": UnknownValue(),
            },
        }

        line = serialize_json_line(payload)
        decoded = json.loads(line)
        self.assertEqual(decoded["result"]["unknown"], str(payload["result"]["unknown"]))


if __name__ == "__main__":
    unittest.main()
