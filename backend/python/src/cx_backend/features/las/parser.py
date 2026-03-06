"""Parsing and response builders for LAS backend tasks."""

from __future__ import annotations

from bisect import bisect_left
import io
import math
from pathlib import Path
import warnings

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
DEFAULT_DEPTH_EPSILON = 1e-9
MIN_DATETIME_PARSE_RATIO = 0.8
TIME_UNIT_FACTORS_FROM_MS: dict[str, tuple[str, float]] = {
    "ms": ("ms", 1.0),
    "millisecond": ("ms", 1.0),
    "milliseconds": ("ms", 1.0),
    "s": ("s", 1000.0),
    "sec": ("s", 1000.0),
    "secs": ("s", 1000.0),
    "second": ("s", 1000.0),
    "seconds": ("s", 1000.0),
    "min": ("min", 60000.0),
    "mins": ("min", 60000.0),
    "minute": ("min", 60000.0),
    "minutes": ("min", 60000.0),
    "h": ("h", 3600000.0),
    "hr": ("h", 3600000.0),
    "hrs": ("h", 3600000.0),
    "hour": ("h", 3600000.0),
    "hours": ("h", 3600000.0),
}


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
    first_curve_name = str(raw_df.columns[0]) if int(raw_df.shape[1]) > 0 else None
    first_curve_raw_series = raw_df[first_curve_name] if first_curve_name else None
    curve_meta = curve_meta_from_las(las_file)
    try:
        index_curve = choose_index_curve(
            numeric_df=numeric_df,
            initial_name=first_curve_name or "",
        )
    except ValueError as exc:
        raise TaskExecutionError(str(exc), code="LAS_PARSE_NO_INDEX") from exc
    normalized_index_series, index_normalization = _normalize_index_curve_series(
        raw_series=raw_df[index_curve],
        numeric_series=numeric_df[index_curve],
        unit_hint=curve_meta.get(index_curve, (None, None))[0],
        pd_module=pd,
    )
    numeric_df[index_curve] = normalized_index_series
    first_curve_numeric_series = numeric_df[first_curve_name] if first_curve_name else None

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
        index_normalization=index_normalization,
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
        first_curve_raw_head_sample=_sample_series_values(first_curve_raw_series),
        first_curve_raw_non_null_sample=_sample_series_values_non_null(
            first_curve_raw_series,
            pd_module=pd,
        ),
        first_curve_numeric_head_sample=_sample_series_values(first_curve_numeric_series),
    )


def _resolve_time_unit_factor(unit_hint: str | None) -> tuple[str, float]:
    normalized_hint = str(unit_hint or "").strip().lower()
    if normalized_hint in TIME_UNIT_FACTORS_FROM_MS:
        return TIME_UNIT_FACTORS_FROM_MS[normalized_hint]
    return ("ms", 1.0)


def _normalize_index_curve_series(
    raw_series: object,
    numeric_series: object,
    *,
    unit_hint: str | None,
    pd_module: object,
) -> tuple[object, dict[str, object] | None]:
    input_numeric_non_null_count = int(numeric_series.notna().sum())
    raw_non_null_count = int(raw_series.dropna().shape[0])
    raw_text_series = raw_series.astype("string")
    raw_non_empty_text = raw_text_series.dropna().str.strip()
    raw_non_empty_text = raw_non_empty_text[raw_non_empty_text != ""]
    raw_non_empty_count = int(raw_non_empty_text.shape[0])

    if input_numeric_non_null_count > 0:
        return numeric_series, {
            "applied": False,
            "reasonCode": "INDEX_ALREADY_NUMERIC",
            "inputNumericNonNullCount": input_numeric_non_null_count,
            "rawNonNullCount": raw_non_null_count,
            "rawNonEmptyCount": raw_non_empty_count,
        }
    if raw_non_empty_count <= 0:
        return numeric_series, {
            "applied": False,
            "reasonCode": "INDEX_HAS_NO_NON_EMPTY_TEXT",
            "inputNumericNonNullCount": input_numeric_non_null_count,
            "rawNonNullCount": raw_non_null_count,
            "rawNonEmptyCount": raw_non_empty_count,
        }

    datetime_parse_specs: list[tuple[str, dict[str, object]]] = [
        ("dmy_dash_seconds", {"format": "%d/%m/%Y-%H:%M:%S"}),
        ("dmy_dash_fractional", {"format": "%d/%m/%Y-%H:%M:%S.%f"}),
        ("mdy_dash_seconds", {"format": "%m/%d/%Y-%H:%M:%S"}),
        ("mdy_dash_fractional", {"format": "%m/%d/%Y-%H:%M:%S.%f"}),
        ("iso_space_seconds", {"format": "%Y-%m-%d %H:%M:%S"}),
        ("iso_space_fractional", {"format": "%Y-%m-%d %H:%M:%S.%f"}),
        ("iso_slash_seconds", {"format": "%Y/%m/%d %H:%M:%S"}),
        ("iso_slash_fractional", {"format": "%Y/%m/%d %H:%M:%S.%f"}),
        ("default", {}),
        ("dayfirst", {"dayfirst": True}),
    ]
    parsed_counts_by_strategy: dict[str, int] = {}
    best_label = ""
    best_parsed_count = -1
    best_negative_steps = math.inf
    datetime_series = numeric_series

    for label, parse_kwargs in datetime_parse_specs:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            candidate_series = pd_module.to_datetime(
                raw_text_series,
                errors="coerce",
                **parse_kwargs,
            )
        parsed_count = int(candidate_series.notna().sum())
        parsed_counts_by_strategy[label] = parsed_count
        negative_steps = _count_datetime_negative_steps(candidate_series, pd_module=pd_module)
        if parsed_count > best_parsed_count:
            best_label = label
            best_parsed_count = parsed_count
            best_negative_steps = negative_steps
            datetime_series = candidate_series
            continue
        if parsed_count == best_parsed_count and negative_steps < best_negative_steps:
            best_label = label
            best_negative_steps = negative_steps
            datetime_series = candidate_series

    parsed_non_null_count = best_parsed_count
    datetime_parse_ratio = (
        float(parsed_non_null_count) / float(raw_non_empty_count)
        if raw_non_empty_count > 0
        else 0.0
    )

    if parsed_non_null_count <= 0:
        return numeric_series, {
            "applied": False,
            "reasonCode": "DATETIME_PARSE_FAILED",
            "inputNumericNonNullCount": input_numeric_non_null_count,
            "rawNonNullCount": raw_non_null_count,
            "rawNonEmptyCount": raw_non_empty_count,
            "datetimeParsedCount": parsed_non_null_count,
            "datetimeParseRatio": datetime_parse_ratio,
            "datetimeParseStrategy": best_label,
            "datetimeParsedCountByStrategy": parsed_counts_by_strategy,
        }

    if datetime_parse_ratio < MIN_DATETIME_PARSE_RATIO:
        return numeric_series, {
            "applied": False,
            "reasonCode": "DATETIME_PARSE_RATIO_TOO_LOW",
            "inputNumericNonNullCount": input_numeric_non_null_count,
            "rawNonNullCount": raw_non_null_count,
            "rawNonEmptyCount": raw_non_empty_count,
            "datetimeParsedCount": parsed_non_null_count,
            "datetimeParseRatio": datetime_parse_ratio,
            "datetimeParseStrategy": best_label,
            "datetimeParsedCountByStrategy": parsed_counts_by_strategy,
            "minimumParseRatio": MIN_DATETIME_PARSE_RATIO,
        }

    origin = datetime_series.dropna().iloc[0]
    elapsed_ms_series = (datetime_series - origin) / pd_module.Timedelta(milliseconds=1)
    output_unit, factor_from_ms = _resolve_time_unit_factor(unit_hint)
    normalized_series = elapsed_ms_series / factor_from_ms
    origin_iso = origin.isoformat() if hasattr(origin, "isoformat") else str(origin)

    return normalized_series, {
        "applied": True,
        "reasonCode": "DATETIME_ELAPSED_CONVERSION_APPLIED",
        "inputNumericNonNullCount": input_numeric_non_null_count,
        "rawNonNullCount": raw_non_null_count,
        "rawNonEmptyCount": raw_non_empty_count,
        "datetimeParsedCount": parsed_non_null_count,
        "datetimeParseRatio": datetime_parse_ratio,
        "datetimeParseStrategy": best_label,
        "datetimeParsedCountByStrategy": parsed_counts_by_strategy,
        "minimumParseRatio": MIN_DATETIME_PARSE_RATIO,
        "originIso": origin_iso,
        "outputUnit": output_unit,
        "millisecondsPerOutputUnit": factor_from_ms,
    }


def _count_datetime_negative_steps(datetime_series: object, *, pd_module: object) -> int:
    non_null = datetime_series.dropna()
    if int(non_null.shape[0]) <= 1:
        return 0
    deltas = non_null.diff().dropna()
    return int((deltas < pd_module.Timedelta(0)).sum())


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
    index_curve: str | None = None,
) -> list[str]:
    raw_curves = request.get("curveMnemonics")
    if not isinstance(raw_curves, list):
        raise TaskValidationError("'curveMnemonics' must be an array.", code="INVALID_CURVE_LIST")

    curve_names = normalize_requested_curves(raw_curves)
    if not curve_names:
        raise TaskValidationError("At least one curve mnemonic is required.", code="EMPTY_CURVE_LIST")
    resolved_index_curve = str(index_curve or parsed.index_curve).strip()
    if resolved_index_curve and resolved_index_curve in curve_names:
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


def _safe_int(value: object) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, parsed)


def _safe_ratio(value: object, numerator: int, denominator: int) -> float:
    try:
        parsed = float(value)
        if math.isfinite(parsed):
            return max(0.0, min(1.0, parsed))
    except (TypeError, ValueError):
        pass

    if denominator <= 0:
        return 1.0
    return max(0.0, min(1.0, float(numerator) / float(denominator)))


def _normalize_sample_value(value: object) -> object:
    if value is None:
        return None
    try:
        if math.isnan(float(value)):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(value, "item"):
        try:
            return value.item()
        except (TypeError, ValueError):
            return value
    return value


def _sample_series_values(series: object, limit: int = 10) -> list[object]:
    if series is None:
        return []
    try:
        values = series.head(limit).tolist()
    except AttributeError:
        return []
    return [_normalize_sample_value(value) for value in values]


def _sample_series_values_non_null(series: object, pd_module: object, limit: int = 10) -> list[object]:
    if series is None:
        return []
    try:
        non_null = series[series.notna()]
        values = non_null.head(limit).tolist()
    except AttributeError:
        return []
    normalized_values = [_normalize_sample_value(value) for value in values]
    return [value for value in normalized_values if not pd_module.isna(value)]


def _build_index_selection_diagnostics(parsed: ParsedLasSession) -> dict[str, object]:
    first_curve_name = str(parsed.numeric_df.columns[0]) if int(parsed.numeric_df.shape[1]) > 0 else None
    selected_index_curve = str(parsed.index_curve or "").strip()
    curve_summaries = {
        str(summary.get("mnemonic", "")).strip(): summary
        for summary in (parsed.curves or [])
        if str(summary.get("mnemonic", "")).strip()
    }
    first_curve_summary = curve_summaries.get(first_curve_name or "", {})

    raw_non_null_count = _safe_int(first_curve_summary.get("rawNonNullCount"))
    numeric_non_null_count = _safe_int(first_curve_summary.get("numericNonNullCount"))
    numeric_parse_ratio = _safe_ratio(
        first_curve_summary.get("numericParseRatio"),
        numeric_non_null_count,
        raw_non_null_count,
    )
    first_curve_rejected = bool(first_curve_name and selected_index_curve and first_curve_name != selected_index_curve)
    if not first_curve_rejected:
        rejection_reason_code = "NOT_REJECTED"
    elif numeric_non_null_count <= 0:
        rejection_reason_code = "FIRST_CURVE_HAS_NO_NUMERIC_VALUES"
    else:
        rejection_reason_code = "FIRST_CURVE_REJECTED_BY_SELECTION_PRIORITY"

    return {
        "selectedIndexCurve": selected_index_curve or None,
        "firstCurve": {
            "mnemonic": first_curve_name,
            "unit": first_curve_summary.get("unit"),
            "rawNonNullCount": raw_non_null_count,
            "numericNonNullCount": numeric_non_null_count,
            "numericParseRatio": numeric_parse_ratio,
            "isNumeric": bool(first_curve_summary.get("isNumeric", False)),
            "rawHeadSample": parsed.first_curve_raw_head_sample or [],
            "rawNonNullSample": parsed.first_curve_raw_non_null_sample or [],
            "numericHeadSample": parsed.first_curve_numeric_head_sample or [],
        },
        "indexNormalization": parsed.index_normalization,
        "firstCurveRejected": first_curve_rejected,
        "rejectionReasonCode": rejection_reason_code,
    }


def _resolve_index_curve(parsed: ParsedLasSession, request: dict[str, object]) -> str:
    raw_index_curve = request.get("indexCurve")
    index_curve = str(raw_index_curve).strip() if raw_index_curve is not None else parsed.index_curve
    if not index_curve:
        index_curve = parsed.index_curve
    if index_curve not in parsed.numeric_df.columns:
        raise TaskValidationError(
            f"Index curve '{index_curve}' does not exist in session data.",
            code="INVALID_INDEX_CURVE",
        )
    return index_curve


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
        "indexSelectionDiagnostics": _build_index_selection_diagnostics(parsed),
    }


def build_curve_data_response(parsed: ParsedLasSession, request: dict[str, object], session_id: str) -> dict[str, object]:
    _, pd = load_las_dependencies()
    index_curve = _resolve_index_curve(parsed=parsed, request=request)
    curve_names = _parse_curve_names(parsed=parsed, request=request, index_curve=index_curve)

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


def _resolve_curve_point_value_at_depth(
    curve_points: list[tuple[float, float | None]],
    *,
    depth: float,
    depth_epsilon: float,
) -> dict[str, object]:
    if len(curve_points) == 0:
        return {
            "value": None,
            "status": "no_data",
            "sourceDepth": None,
            "leftDepth": None,
            "rightDepth": None,
        }

    min_depth = curve_points[0][0]
    max_depth = curve_points[-1][0]
    if depth < (min_depth - depth_epsilon) or depth > (max_depth + depth_epsilon):
        return {
            "value": None,
            "status": "out_of_range",
            "sourceDepth": None,
            "leftDepth": min_depth,
            "rightDepth": max_depth,
        }

    depth_values = [point[0] for point in curve_points]
    insertion_index = bisect_left(depth_values, depth)

    exact_candidate_indexes: list[int] = []
    for candidate_index in (insertion_index, insertion_index - 1):
        if candidate_index < 0 or candidate_index >= len(curve_points):
            continue
        candidate_depth, candidate_value = curve_points[candidate_index]
        if abs(candidate_depth - depth) > depth_epsilon:
            continue
        exact_candidate_indexes.append(candidate_index)

    if len(exact_candidate_indexes) > 0:
        min_exact = min(exact_candidate_indexes)
        max_exact = max(exact_candidate_indexes)

        index = min_exact - 1
        while index >= 0 and abs(curve_points[index][0] - depth) <= depth_epsilon:
            exact_candidate_indexes.insert(0, index)
            index -= 1

        index = max_exact + 1
        while index < len(curve_points) and abs(curve_points[index][0] - depth) <= depth_epsilon:
            exact_candidate_indexes.append(index)
            index += 1

        for candidate_index in exact_candidate_indexes:
            candidate_depth, candidate_value = curve_points[candidate_index]
            if candidate_value is None:
                continue
            return {
                "value": candidate_value,
                "status": "exact",
                "sourceDepth": candidate_depth,
                "leftDepth": candidate_depth,
                "rightDepth": candidate_depth,
            }

        if len(exact_candidate_indexes) > 0:
            exact_depth = curve_points[exact_candidate_indexes[0]][0]
            return {
                "value": None,
                "status": "no_data",
                "sourceDepth": exact_depth,
                "leftDepth": exact_depth,
                "rightDepth": exact_depth,
            }

    left_point = None
    for idx in range(insertion_index - 1, -1, -1):
        if curve_points[idx][1] is None:
            continue
        left_point = curve_points[idx]
        break

    right_point = None
    for idx in range(insertion_index, len(curve_points)):
        if curve_points[idx][1] is None:
            continue
        right_point = curve_points[idx]
        break

    if left_point is not None and right_point is not None:
        left_depth, left_value = left_point
        right_depth, right_value = right_point
        depth_span = right_depth - left_depth
        if abs(depth_span) <= 1e-12:
            interpolated_value = left_value
        else:
            ratio = (depth - left_depth) / depth_span
            interpolated_value = left_value + ((right_value - left_value) * ratio)
        return {
            "value": interpolated_value,
            "status": "interpolated",
            "sourceDepth": None,
            "leftDepth": left_depth,
            "rightDepth": right_depth,
        }

    if left_point is None and right_point is None:
        return {
            "value": None,
            "status": "no_data",
            "sourceDepth": None,
            "leftDepth": None,
            "rightDepth": None,
        }

    if left_point is None:
        return {
            "value": right_point[1],
            "status": "nearest",
            "sourceDepth": right_point[0],
            "leftDepth": None,
            "rightDepth": right_point[0],
        }

    if right_point is None:
        return {
            "value": left_point[1],
            "status": "nearest",
            "sourceDepth": left_point[0],
            "leftDepth": left_point[0],
            "rightDepth": None,
        }

    left_distance = abs(depth - left_point[0])
    right_distance = abs(right_point[0] - depth)
    nearest_point = left_point if left_distance <= right_distance else right_point
    return {
        "value": nearest_point[1],
        "status": "nearest",
        "sourceDepth": nearest_point[0],
        "leftDepth": left_point[0],
        "rightDepth": right_point[0],
    }


def build_curve_values_at_depth_response(parsed: ParsedLasSession, request: dict[str, object], session_id: str) -> dict[str, object]:
    _, pd = load_las_dependencies()
    index_curve = _resolve_index_curve(parsed=parsed, request=request)
    curve_names = _parse_curve_names(parsed=parsed, request=request, index_curve=index_curve)

    depth = _parse_float(request.get("depth"), "depth")
    if depth is None:
        raise TaskValidationError("'depth' is required.", code="MISSING_DEPTH")

    depth_epsilon = _parse_float(request.get("depthEpsilon"), "depthEpsilon")
    if depth_epsilon is None:
        depth_epsilon = DEFAULT_DEPTH_EPSILON
    else:
        depth_epsilon = max(0.0, float(depth_epsilon))

    frame = parsed.numeric_df.loc[:, [index_curve, *curve_names]].copy()
    frame = frame.loc[frame[index_curve].notna()]
    if frame.empty:
        raise TaskValidationError("No depth values are available in this session.", code="EMPTY_CURVE_DATA")
    frame = frame.sort_values(by=index_curve, kind="mergesort")

    rows: list[dict[str, object]] = []
    for curve_name in curve_names:
        curve_points: list[tuple[float, float | None]] = []
        for depth_value, curve_value in frame.loc[:, [index_curve, curve_name]].itertuples(index=False, name=None):
            if pd.isna(depth_value):
                continue
            depth_float = float(depth_value)
            if pd.isna(curve_value):
                curve_points.append((depth_float, None))
            else:
                curve_points.append((depth_float, float(curve_value)))

        resolution = _resolve_curve_point_value_at_depth(
            curve_points,
            depth=float(depth),
            depth_epsilon=depth_epsilon,
        )
        unit, description = parsed.curve_meta.get(curve_name, (None, None))
        rows.append(
            {
                "mnemonic": curve_name,
                "unit": unit,
                "description": description,
                "value": resolution["value"],
                "status": resolution["status"],
                "sourceDepth": resolution["sourceDepth"],
                "leftDepth": resolution["leftDepth"],
                "rightDepth": resolution["rightDepth"],
            }
        )

    return {
        "sessionId": session_id,
        "indexCurve": index_curve,
        "depth": float(depth),
        "depthUnit": parsed.depth_unit,
        "rows": rows,
    }


def build_curve_data_csv_export_response(
    parsed: ParsedLasSession,
    request: dict[str, object],
    session_id: str,
    output_file_path: Path,
) -> dict[str, object]:
    _, pd = load_las_dependencies()
    index_curve = _resolve_index_curve(parsed=parsed, request=request)
    curve_names = _parse_curve_names(parsed=parsed, request=request, index_curve=index_curve)

    frame = parsed.numeric_df.loc[:, [index_curve, *curve_names]].copy()
    frame = frame.sort_values(by=index_curve, kind="mergesort")
    frame = frame.where(pd.notna(frame), "")
    frame.to_csv(output_file_path, index=False)

    file_size_bytes = None
    try:
        file_size_bytes = int(output_file_path.stat().st_size)
    except OSError:
        file_size_bytes = None

    return {
        "sessionId": session_id,
        "outputFilePath": str(output_file_path),
        "fileName": output_file_path.name,
        "indexCurve": index_curve,
        "curveMnemonics": curve_names,
        "rowCount": int(frame.shape[0]),
        "columnCount": int(frame.shape[1]),
        "fileSizeBytes": file_size_bytes,
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
