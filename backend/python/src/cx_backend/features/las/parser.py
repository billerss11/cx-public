"""Parsing and response builders for LAS backend tasks."""

from __future__ import annotations

import io
import math

from cx_backend.features.las.models import ParsedLasSession
from cx_backend.features.las.normalize import (
    build_curve_ranges,
    build_curve_summaries,
    build_data_overview,
    build_data_preview,
    build_well_information,
    choose_index_curve,
    curve_meta_from_las,
    format_file_size,
    normalize_column_names,
    normalize_requested_curves,
    preview_records,
    safe_well_name,
)
from cx_backend.models.errors import TaskExecutionError, TaskValidationError

STAT_LABELS: dict[str, str] = {
    "count": "Data Points",
    "mean": "Mean",
    "std": "Std Dev",
    "min": "Minimum",
    "25%": "Q1 (25%)",
    "50%": "Median (50%)",
    "75%": "Q3 (75%)",
    "max": "Maximum",
    "completeness_%": "Data Complete",
    "outliers_count": "Outliers",
    "outliers_%": "Outlier Rate",
}
STAT_ORDER: tuple[str, ...] = (
    "count",
    "mean",
    "std",
    "min",
    "25%",
    "50%",
    "75%",
    "max",
    "completeness_%",
    "outliers_count",
    "outliers_%",
)


def load_las_dependencies() -> tuple[object, object]:
    try:
        import lasio
        import pandas as pd
    except ImportError as exc:
        raise TaskExecutionError(
            "Required LAS backend dependencies are unavailable.",
            code="MISSING_BACKEND_DEPENDENCY",
        ) from exc
    return lasio, pd


def parse_las_file_content(file_name: str, content: bytes, preview_rows: int) -> ParsedLasSession:
    """Parse LAS file bytes into a normalized in-memory session."""

    lasio, pd = load_las_dependencies()
    if not content:
        raise TaskExecutionError("Input file is empty.", code="LAS_PARSE_EMPTY_FILE")

    try:
        try:
            las_text = content.decode("utf-8")
        except UnicodeDecodeError:
            las_text = content.decode("latin-1")
        las_file = lasio.read(io.StringIO(las_text))
    except Exception as exc:
        raise TaskExecutionError(f"Unable to parse LAS file: {exc}", code="LAS_PARSE_FAILED") from exc

    try:
        las_df = las_file.df()
    except Exception as exc:
        raise TaskExecutionError(
            f"LAS parsed but data table load failed: {exc}",
            code="LAS_PARSE_DATAFRAME_FAILED",
        ) from exc

    if las_df.empty:
        raise TaskExecutionError("LAS file contains no data rows.", code="LAS_PARSE_NO_ROWS")

    raw_df = las_df.reset_index().copy()
    raw_df.columns = normalize_column_names(list(raw_df.columns))
    numeric_df = raw_df.apply(pd.to_numeric, errors="coerce")
    try:
        index_curve = choose_index_curve(numeric_df=numeric_df, initial_name=raw_df.columns[0])
    except ValueError as exc:
        raise TaskExecutionError(str(exc), code="LAS_PARSE_NO_INDEX") from exc

    curve_meta = curve_meta_from_las(las_file)
    summaries, valid_curves = build_curve_summaries(
        raw_df=raw_df,
        numeric_df=numeric_df,
        index_curve=index_curve,
        curve_meta=curve_meta,
    )
    preview = preview_records(
        numeric_df=numeric_df,
        index_curve=index_curve,
        valid_curves=valid_curves,
        preview_rows=preview_rows,
        pd_module=pd,
    )

    well_name = safe_well_name(las_file)
    curve_count = int(len(getattr(las_file, "curves", [])))
    return ParsedLasSession(
        file_name=file_name,
        well_name=well_name,
        index_curve=index_curve,
        depth_unit=curve_meta.get(index_curve, (None, None))[0],
        row_count=int(raw_df.shape[0]),
        curve_count=curve_count,
        valid_curves=valid_curves,
        curves=summaries,
        preview_rows=preview,
        numeric_df=numeric_df,
        curve_meta=curve_meta,
        file_size_bytes=len(content),
        overview=build_data_overview(
            numeric_df=numeric_df,
            index_curve=index_curve,
            curve_count=curve_count,
            well_name=well_name,
        ),
        well_information=build_well_information(las_file),
        curve_ranges=build_curve_ranges(summaries),
        data_preview=build_data_preview(
            numeric_df=numeric_df,
            index_curve=index_curve,
            preview_rows=preview_rows,
            pd_module=pd,
        ),
    )


def _parse_float(value: object, field_name: str) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise TaskValidationError(f"'{field_name}' must be a number.", code="INVALID_NUMERIC_FIELD") from exc


def _parse_int(value: object, field_name: str, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise TaskValidationError(f"'{field_name}' must be an integer.", code="INVALID_INTEGER_FIELD") from exc
    return max(minimum, min(parsed, maximum))


def _parse_bool(value: object, field_name: str, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raise TaskValidationError(f"'{field_name}' must be a boolean.", code="INVALID_BOOLEAN_FIELD")


def _parse_curve_names(
    parsed: ParsedLasSession,
    request: dict[str, object],
    *,
    min_count: int = 1,
) -> list[str]:
    raw_curves = request.get("curveMnemonics")
    if not isinstance(raw_curves, list):
        raise TaskValidationError("'curveMnemonics' must be an array.", code="INVALID_CURVE_LIST")

    curve_names = normalize_requested_curves(raw_curves)
    if not curve_names:
        raise TaskValidationError("At least one curve mnemonic is required.", code="EMPTY_CURVE_LIST")
    if parsed.index_curve in curve_names:
        raise TaskValidationError(
            "Index curve cannot be requested as a plotted curve.",
            code="INDEX_CURVE_NOT_ALLOWED",
        )

    missing_curves = [curve for curve in curve_names if curve not in parsed.numeric_df.columns]
    if missing_curves:
        raise TaskValidationError(f"Unknown curves requested: {', '.join(missing_curves)}", code="UNKNOWN_CURVE")
    if len(curve_names) < min_count:
        raise TaskValidationError(
            f"At least {min_count} curves are required for this request.",
            code="INSUFFICIENT_CURVE_COUNT",
        )
    return curve_names


def _fallback_data_preview(parsed: ParsedLasSession) -> dict[str, object]:
    index_series = parsed.numeric_df[parsed.index_curve]
    return {
        "shape": [int(parsed.numeric_df.shape[0]), int(parsed.numeric_df.shape[1])],
        "indexCurve": parsed.index_curve,
        "indexDtype": str(index_series.dtype),
        "indexSample": index_series.head(10).tolist(),
        "head": parsed.preview_rows,
        "describe": {},
        "columnTypes": {str(col): str(dtype) for col, dtype in parsed.numeric_df.dtypes.items()},
    }


def build_parse_response(session_id: str, parsed: ParsedLasSession) -> dict[str, object]:
    file_size_bytes = int(parsed.file_size_bytes or 0)
    overview = parsed.overview or build_data_overview(
        numeric_df=parsed.numeric_df,
        index_curve=parsed.index_curve,
        curve_count=parsed.curve_count,
        well_name=parsed.well_name,
    )
    return {
        "sessionId": session_id,
        "fileName": parsed.file_name,
        "wellName": parsed.well_name,
        "indexCurve": parsed.index_curve,
        "depthUnit": parsed.depth_unit,
        "rowCount": parsed.row_count,
        "curveCount": parsed.curve_count,
        "validCurves": parsed.valid_curves,
        "curves": parsed.curves,
        "previewRows": parsed.preview_rows,
        "fileSizeBytes": file_size_bytes,
        "fileSizeDisplay": format_file_size(file_size_bytes),
        "overview": overview,
        "wellInformation": parsed.well_information or {"sections": {}, "sectionNotes": {}},
        "curveRanges": parsed.curve_ranges or build_curve_ranges(parsed.curves),
        "dataPreview": parsed.data_preview or _fallback_data_preview(parsed),
    }


def build_curve_data_response(parsed: ParsedLasSession, request: dict[str, object], session_id: str) -> dict[str, object]:
    _, pd = load_las_dependencies()
    curve_names = _parse_curve_names(parsed=parsed, request=request)

    raw_index_curve = request.get("indexCurve")
    index_curve = str(raw_index_curve).strip() if raw_index_curve is not None else parsed.index_curve
    if not index_curve:
        index_curve = parsed.index_curve
    if index_curve not in parsed.numeric_df.columns:
        raise TaskValidationError(
            f"Index curve '{index_curve}' does not exist in session data.",
            code="INVALID_INDEX_CURVE",
        )

    depth_min = _parse_float(request.get("depthMin"), "depthMin")
    depth_max = _parse_float(request.get("depthMax"), "depthMax")
    max_points = _parse_int(request.get("maxPoints"), "maxPoints", default=5000, minimum=100, maximum=100000)
    include_nulls = _parse_bool(request.get("includeNulls"), "includeNulls", default=False)

    depth_series = parsed.numeric_df[index_curve]
    mask = depth_series.notna()
    if depth_min is not None:
        mask &= depth_series >= depth_min
    if depth_max is not None:
        mask &= depth_series <= depth_max

    filtered = parsed.numeric_df.loc[mask, [index_curve, *curve_names]].copy()
    if filtered.empty:
        raise TaskValidationError("No data points found for requested depth range.", code="EMPTY_DEPTH_RANGE")

    sampling_step = max(1, math.ceil(len(filtered) / max_points))
    sampled = filtered.iloc[::sampling_step].copy()

    depth_non_null = filtered[index_curve].dropna()
    min_depth = float(depth_non_null.min()) if not depth_non_null.empty else None
    max_depth = float(depth_non_null.max()) if not depth_non_null.empty else None

    series_payload: list[dict[str, object]] = []
    for curve_name in curve_names:
        curve_slice = sampled[[index_curve, curve_name]].copy()
        if not include_nulls:
            curve_slice = curve_slice.dropna(subset=[curve_name])

        points: list[list[float | None]] = []
        for depth_value, curve_value in curve_slice.itertuples(index=False, name=None):
            if pd.isna(depth_value):
                continue
            depth_float = float(depth_value)
            if pd.isna(curve_value):
                points.append([depth_float, None])
            else:
                points.append([depth_float, float(curve_value)])

        value_series = curve_slice[curve_name].dropna()
        unit, description = parsed.curve_meta.get(curve_name, (None, None))
        series_payload.append({
            "mnemonic": curve_name,
            "unit": unit,
            "description": description,
            "dataPoints": len(points),
            "minValue": float(value_series.min()) if not value_series.empty else None,
            "maxValue": float(value_series.max()) if not value_series.empty else None,
            "points": points,
        })

    returned_points = max((int(series["dataPoints"]) for series in series_payload), default=0)
    return {
        "sessionId": session_id,
        "indexCurve": index_curve,
        "depthRange": {
            "minDepth": min_depth,
            "maxDepth": max_depth,
            "totalPoints": int(filtered.shape[0]),
            "returnedPoints": returned_points,
            "samplingStep": sampling_step,
            "depthUnit": parsed.depth_unit,
        },
        "series": series_payload,
    }


def _calculate_curve_summary_stats(subset: object, pd_module: object) -> object:
    stats_df = subset.describe()
    total_rows = int(subset.shape[0])
    valid_counts = subset.count()
    if total_rows <= 0:
        stats_df.loc["completeness_%"] = 0.0
    else:
        stats_df.loc["completeness_%"] = (valid_counts / total_rows) * 100.0

    q1 = subset.quantile(0.25)
    q3 = subset.quantile(0.75)
    iqr = q3 - q1

    outlier_counts: dict[str, int] = {}
    outlier_pcts: dict[str, float] = {}
    for curve_name in subset.columns:
        valid = subset[curve_name].dropna()
        if int(valid.shape[0]) <= 4:
            outlier_counts[curve_name] = 0
            outlier_pcts[curve_name] = 0.0
            continue
        lower = q1[curve_name] - 1.5 * iqr[curve_name]
        upper = q3[curve_name] + 1.5 * iqr[curve_name]
        outlier_mask = (valid < lower) | (valid > upper)
        count = int(outlier_mask.sum())
        outlier_counts[curve_name] = count
        outlier_pcts[curve_name] = (count / int(valid.shape[0])) * 100.0

    stats_df.loc["outliers_count"] = pd_module.Series(outlier_counts)
    stats_df.loc["outliers_%"] = pd_module.Series(outlier_pcts)
    return stats_df


def _format_stat_value(metric_key: str, value: object, pd_module: object) -> str:
    if pd_module.isna(value):
        return "N/A"
    if metric_key in ("mean", "std", "min", "25%", "50%", "75%", "max"):
        return f"{float(value):.3f}"
    if metric_key in ("completeness_%", "outliers_%"):
        return f"{float(value):.1f}%"
    if metric_key in ("count", "outliers_count"):
        return f"{int(value):,}"
    return str(value)


def _format_statistics_rows(stats_df: object, curve_names: list[str], pd_module: object) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for metric_key in STAT_ORDER:
        if metric_key not in stats_df.index:
            continue
        metric_values = {}
        for curve_name in curve_names:
            metric_values[curve_name] = _format_stat_value(metric_key, stats_df.loc[metric_key, curve_name], pd_module)
        rows.append({
            "metricKey": metric_key,
            "metricLabel": STAT_LABELS.get(metric_key, metric_key),
            "values": metric_values,
        })
    return rows


def build_curve_statistics_response(parsed: ParsedLasSession, request: dict[str, object], session_id: str) -> dict[str, object]:
    _, pd = load_las_dependencies()
    curve_names = _parse_curve_names(parsed=parsed, request=request)
    subset = parsed.numeric_df[curve_names].apply(pd.to_numeric, errors="coerce")
    if subset.dropna(how="all").empty:
        raise TaskValidationError("Selected curves contain no numeric data.", code="EMPTY_CURVE_DATA")

    stats_df = _calculate_curve_summary_stats(subset=subset, pd_module=pd)
    return {
        "sessionId": session_id,
        "columns": curve_names,
        "metrics": _format_statistics_rows(stats_df=stats_df, curve_names=curve_names, pd_module=pd),
    }


def build_correlation_matrix_response(parsed: ParsedLasSession, request: dict[str, object], session_id: str) -> dict[str, object]:
    _, pd = load_las_dependencies()
    curve_names = _parse_curve_names(parsed=parsed, request=request, min_count=2)
    max_rows = _parse_int(request.get("maxRows"), "maxRows", default=50000, minimum=1000, maximum=500000)

    subset = parsed.numeric_df[curve_names].apply(pd.to_numeric, errors="coerce")
    subset = subset.dropna(how="all")
    if subset.empty:
        raise TaskValidationError("Selected curves contain no numeric data.", code="EMPTY_CURVE_DATA")

    if int(subset.shape[0]) > max_rows:
        subset = subset.sample(n=max_rows, random_state=42)

    corr = subset.corr()
    matrix = []
    for row_curve in curve_names:
        row_values = []
        for col_curve in curve_names:
            value = corr.loc[row_curve, col_curve]
            row_values.append(None if pd.isna(value) else float(value))
        matrix.append(row_values)

    return {
        "sessionId": session_id,
        "curves": curve_names,
        "matrix": matrix,
        "sampleSize": int(subset.shape[0]),
    }
