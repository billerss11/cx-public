"""Normalization helpers for LAS parsing and response shaping."""

from __future__ import annotations

import math
from collections.abc import Iterable

SECTION_NOTES: dict[str, str] = {
    "version": "LAS file version and format information",
    "well": "Basic well identification and location data",
    "parameter": "Logging parameters, tool settings, and operational data",
    "curves": "Curve definitions and metadata (data shown in Curve Details tab)",
    "other": "Additional metadata and comments",
}
MAX_PREVIEW_HEAD_COLUMNS = 12
MAX_PREVIEW_DESCRIBE_COLUMNS = 12
MAX_PREVIEW_DESCRIBE_ROWS = 50000


def safe_well_name(las_file: object) -> str:
    try:
        if hasattr(las_file, "sections") and "Well" in las_file.sections:
            for item in las_file.sections["Well"]:
                mnemonic = str(getattr(item, "mnemonic", "")).strip().upper()
                if mnemonic == "WELL":
                    value = getattr(item, "value", "")
                    if value:
                        return str(value)

        well_section = getattr(las_file, "well", None)
        if well_section is not None and hasattr(well_section, "WELL"):
            value = well_section.WELL.value
            if value:
                return str(value)
    except Exception:
        pass
    return "Unknown"


def normalize_column_names(columns: list[object]) -> list[str]:
    seen: dict[str, int] = {}
    normalized: list[str] = []
    for raw_name in columns:
        base = str(raw_name).strip() or "column"
        index = seen.get(base, 0)
        seen[base] = index + 1
        normalized.append(base if index == 0 else f"{base}_{index}")
    return normalized


def choose_index_curve(numeric_df: object, initial_name: str) -> str:
    # Ground rule: the first LAS curve is the default index curve.
    if initial_name in numeric_df.columns:
        return initial_name

    columns = list(numeric_df.columns)
    if columns:
        return str(columns[0])

    raise ValueError("No columns available to determine LAS index curve.")


def curve_meta_from_las(las_file: object) -> dict[str, tuple[str | None, str | None]]:
    metadata: dict[str, tuple[str | None, str | None]] = {}
    for curve in getattr(las_file, "curves", []):
        mnemonic = str(getattr(curve, "mnemonic", "")).strip()
        if not mnemonic:
            continue
        unit = str(getattr(curve, "unit", "")).strip() or None
        description = str(getattr(curve, "descr", "")).strip() or None
        metadata[mnemonic] = (unit, description)
    return metadata


def build_curve_summaries(
    raw_df: object,
    numeric_df: object,
    index_curve: str,
    curve_meta: dict[str, tuple[str | None, str | None]],
) -> tuple[list[dict[str, object]], list[str]]:
    summaries: list[dict[str, object]] = []
    valid_curves: list[str] = []

    for column_name in numeric_df.columns:
        raw_series = raw_df[column_name]
        numeric_series = numeric_df[column_name]

        raw_non_null = raw_series.dropna()
        numeric_non_null = numeric_series.dropna()
        raw_count = int(raw_non_null.shape[0])
        numeric_count = int(numeric_non_null.shape[0])
        is_numeric = raw_count == 0 or numeric_count / max(raw_count, 1) >= 0.8
        numeric_parse_ratio = float(numeric_count / raw_count) if raw_count > 0 else 1.0
        data_points = numeric_count if is_numeric else raw_count

        min_value = float(numeric_non_null.min()) if numeric_count > 0 else None
        max_value = float(numeric_non_null.max()) if numeric_count > 0 else None
        unit, description = curve_meta.get(column_name, (None, None))

        summaries.append({
            "mnemonic": column_name,
            "unit": unit,
            "description": description,
            "dataPoints": data_points,
            "minValue": min_value,
            "maxValue": max_value,
            "isNumeric": is_numeric,
            "rawNonNullCount": raw_count,
            "numericNonNullCount": numeric_count,
            "numericParseRatio": numeric_parse_ratio,
        })

        if column_name == index_curve:
            continue
        if numeric_count == 0:
            continue
        if min_value == max_value:
            continue
        if min_value == 0.0 and max_value == 0.0:
            continue
        valid_curves.append(column_name)

    return summaries, valid_curves


def preview_records(
    numeric_df: object,
    index_curve: str,
    valid_curves: list[str],
    preview_rows: int,
    pd_module: object,
) -> list[dict[str, object]]:
    columns = [index_curve, *valid_curves[:6]]
    preview = numeric_df[columns].head(preview_rows)
    return preview.where(pd_module.notna(preview), None).to_dict(orient="records")


def normalize_requested_curves(curve_mnemonics: list[object]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_curve in curve_mnemonics:
        curve = str(raw_curve).strip()
        if not curve or curve in seen:
            continue
        seen.add(curve)
        normalized.append(curve)
    return normalized


def format_file_size(size_bytes: int) -> str:
    normalized_size = max(0.0, float(size_bytes))
    for unit in ("B", "KB", "MB", "GB"):
        if normalized_size < 1024.0:
            return f"{normalized_size:.1f} {unit}"
        normalized_size /= 1024.0
    return f"{normalized_size:.1f} TB"


def build_data_overview(numeric_df: object, index_curve: str, curve_count: int, well_name: str) -> dict[str, object]:
    depth_series = numeric_df[index_curve]
    index_is_numeric = bool(depth_series.notna().any())

    min_depth = float(depth_series.min()) if index_is_numeric else None
    max_depth = float(depth_series.max()) if index_is_numeric else None
    index_range = (max_depth - min_depth) if index_is_numeric else None
    index_range_display = f"{index_range:.1f}" if index_range is not None else "N/A"

    return {
        "wellName": well_name,
        "totalCurves": int(curve_count),
        "dataPoints": int(numeric_df.shape[0]),
        "indexCurve": index_curve,
        "indexDtype": str(depth_series.dtype),
        "indexIsNumeric": index_is_numeric,
        "indexMin": min_depth,
        "indexMax": max_depth,
        "indexRange": index_range,
        "indexRangeDisplay": index_range_display,
    }


def build_well_information(las_file: object) -> dict[str, object]:
    sections: dict[str, list[dict[str, object]]] = {}

    raw_sections = getattr(las_file, "sections", None)
    if isinstance(raw_sections, dict):
        for section_name, section_rows in raw_sections.items():
            sections[str(section_name)] = _serialize_section_rows(section_rows)
    else:
        well_rows = _serialize_section_rows(getattr(las_file, "well", []))
        parameter_rows = _serialize_section_rows(getattr(las_file, "params", []))
        if well_rows:
            sections["Well"] = well_rows
        if parameter_rows:
            sections["Parameter"] = parameter_rows

    return {"sections": sections, "sectionNotes": SECTION_NOTES}


def _serialize_section_rows(section_rows: Iterable[object]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in section_rows or []:
        mnemonic = str(getattr(row, "mnemonic", "")).strip()
        if not mnemonic:
            continue
        rows.append({
            "mnemonic": mnemonic,
            "value": getattr(row, "value", None),
            "unit": _normalize_text(getattr(row, "unit", None)),
            "description": _normalize_text(getattr(row, "descr", None)),
        })
    return rows


def _normalize_text(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None


def build_curve_ranges(curves: list[dict[str, object]]) -> list[dict[str, object]]:
    ranges: list[dict[str, object]] = []
    for curve in curves:
        mnemonic = str(curve.get("mnemonic") or "").strip()
        if not mnemonic:
            continue
        min_value = curve.get("minValue")
        max_value = curve.get("maxValue")
        is_numeric = bool(curve.get("isNumeric"))
        range_text = format_curve_range(min_value, max_value, is_numeric)
        ranges.append({
            "curve": mnemonic,
            "unit": curve.get("unit"),
            "range": range_text,
            "dataPoints": int(curve.get("dataPoints") or 0),
            "description": curve.get("description"),
        })
    return ranges


def format_curve_range(min_value: object, max_value: object, is_numeric: bool) -> str:
    if not is_numeric:
        return "[Text data]"
    if min_value is None or max_value is None:
        return "[No valid numeric data]"
    return f"[{float(min_value):.3f} - {float(max_value):.3f}]"


def _build_preview_describe(numeric_df: object) -> dict[str, object]:
    total_columns = int(numeric_df.shape[1])
    if total_columns <= 0:
        return {}

    describe_source = numeric_df
    total_rows = int(describe_source.shape[0])
    if total_rows > MAX_PREVIEW_DESCRIBE_ROWS:
        sampling_step = max(1, math.ceil(total_rows / MAX_PREVIEW_DESCRIBE_ROWS))
        describe_source = describe_source.iloc[::sampling_step]

    if int(describe_source.shape[1]) > MAX_PREVIEW_DESCRIBE_COLUMNS:
        describe_source = describe_source.iloc[:, :MAX_PREVIEW_DESCRIBE_COLUMNS]

    if int(describe_source.shape[0]) <= 0 or int(describe_source.shape[1]) <= 0:
        return {}

    return describe_source.describe().to_dict()


def _preview_head_columns(numeric_df: object, index_curve: str) -> list[str]:
    columns = list(numeric_df.columns)
    if len(columns) <= MAX_PREVIEW_HEAD_COLUMNS:
        return columns

    preview_columns = [index_curve]
    preview_columns.extend(
        column_name for column_name in columns if column_name != index_curve
    )
    return preview_columns[:MAX_PREVIEW_HEAD_COLUMNS]


def build_data_preview(numeric_df: object, index_curve: str, preview_rows: int, pd_module: object) -> dict[str, object]:
    head_columns = _preview_head_columns(numeric_df=numeric_df, index_curve=index_curve)
    head = numeric_df[head_columns].head(preview_rows)
    index_series = numeric_df[index_curve]
    describe = _build_preview_describe(numeric_df)

    return {
        "shape": [int(numeric_df.shape[0]), int(numeric_df.shape[1])],
        "indexCurve": index_curve,
        "indexDtype": str(index_series.dtype),
        "indexSample": index_series.head(10).where(pd_module.notna(index_series.head(10)), None).tolist(),
        "head": head.where(pd_module.notna(head), None).to_dict(orient="records"),
        "describe": describe,
        "columnTypes": {str(col): str(dtype) for col, dtype in numeric_df.dtypes.items()},
    }
