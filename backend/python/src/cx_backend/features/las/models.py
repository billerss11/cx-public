"""LAS-specific backend models."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ParsedLasSession:
    """In-memory representation of parsed LAS data and metadata."""

    file_name: str
    well_name: str
    index_curve: str
    depth_unit: str | None
    row_count: int
    curve_count: int
    valid_curves: list[str]
    curves: list[dict[str, object]]
    preview_rows: list[dict[str, object]]
    numeric_df: object
    curve_meta: dict[str, tuple[str | None, str | None]]
    file_size_bytes: int | None = None
    overview: dict[str, object] | None = None
    well_information: dict[str, object] | None = None
    curve_ranges: list[dict[str, object]] | None = None
    data_preview: dict[str, object] | None = None
    index_normalization: dict[str, object] | None = None
    first_curve_raw_head_sample: list[object] | None = None
    first_curve_raw_non_null_sample: list[object] | None = None
    first_curve_numeric_head_sample: list[object] | None = None
