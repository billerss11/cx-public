import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
    DEFAULT_LINE_COLOR,
    DEFAULT_BOX_COLOR,
    DEFAULT_BOX_FONT_COLOR,
    MARKER_DEFAULT_COLORS,
    DEFAULT_CEMENT_COLOR
} from '@/constants/index.js';
import { parseOptionalNumber, generateCasingId, toBoolean } from '@/utils/general.js';
import { normalizeLineStyle, normalizeMarkerType, normalizeMarkerSide } from '@/app/domain.js';

const SCHEMAS = {
    casing: {
        sheet: 'Casing',
        required: ['Label', 'OD', 'Weight', 'Grade', 'Top', 'Bottom'],
        optional: [
            'TOC',
            'BOC',
            'Color',
            'ID Override',
            'Hole Size',
            'Label X',
            'Label Depth',
            'Casing Label Font Size',
            'Depth Label Font Size',
            'Depth Label X Offset',
            'Show Top',
            'Show Bottom'
        ]
    },
    trajectory: {
        sheet: 'Trajectory',
        required: ['MD', 'Inc', 'Azi'],
        optional: ['Comment']
    },
    horizons: {
        sheet: 'Horizons',
        required: ['Depth', 'Label'],
        optional: ['Color', 'Font Color', 'Font Size', 'Line Style', 'Label X', 'Show']
    },
    callouts: {
        sheet: 'Callouts',
        required: ['Top', 'Bottom', 'Label'],
        optional: ['Detail', 'Color', 'Font Color', 'Font Size', 'Label X', 'Band Width', 'Opacity', 'Show Details', 'Show']
    },
    markers: {
        sheet: 'Markers',
        required: ['Type', 'Depth', 'Host Casing Label'],
        optional: ['Label', 'Side', 'Color', 'Scale', 'Show']
    }
};

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function parseRequiredNumber(row, key, context) {
    const value = parseOptionalNumber(row[key]);
    if (!Number.isFinite(value)) {
        throw new Error(`${context}: invalid numeric value for '${key}'.`);
    }
    return value;
}

function getHeaderRow(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    if (!rows.length || !Array.isArray(rows[0])) return [];
    return rows[0].map(header => toTrimmedString(header));
}

function validateHeaders(headers, schema) {
    if (!headers.length) {
        throw new Error(`Sheet '${schema.sheet}' is empty.`);
    }
    const allowed = new Set([...schema.required, ...schema.optional]);
    const missing = schema.required.filter(key => !headers.includes(key));
    if (missing.length) {
        throw new Error(`Sheet '${schema.sheet}' is missing required columns: ${missing.join(', ')}.`);
    }
    const extra = headers.filter(key => key && !allowed.has(key));
    if (extra.length) {
        throw new Error(`Sheet '${schema.sheet}' has unsupported columns: ${extra.join(', ')}.`);
    }
}

function readRows(workbook, schema, { required = false } = {}) {
    const sheet = workbook.Sheets[schema.sheet];
    if (!sheet) {
        if (required) {
            throw new Error(`Missing required sheet: '${schema.sheet}'.`);
        }
        return [];
    }
    const headers = getHeaderRow(sheet);
    validateHeaders(headers, schema);
    return XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
}

function buildCasingLabelMap(casingData) {
    const map = new Map();
    casingData.forEach((row, index) => {
        const label = toTrimmedString(row.label);
        if (!label || map.has(label)) return;
        map.set(label, generateCasingId(row, index));
    });
    return map;
}

export function parseStrictExcelProject(fileBuffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const casingRows = readRows(workbook, SCHEMAS.casing, { required: true });
    const casingData = casingRows.map((row, index) => {
        const top = parseRequiredNumber(row, 'Top', `Casing row ${index + 2}`);
        const bottom = parseRequiredNumber(row, 'Bottom', `Casing row ${index + 2}`);
        return {
            label: toTrimmedString(row.Label),
            od: parseRequiredNumber(row, 'OD', `Casing row ${index + 2}`),
            weight: parseRequiredNumber(row, 'Weight', `Casing row ${index + 2}`),
            grade: toTrimmedString(row.Grade),
            top,
            bottom,
            toc: parseOptionalNumber(row.TOC),
            boc: parseOptionalNumber(row.BOC),
            color: toTrimmedString(row.Color) || null,
            idOverride: parseOptionalNumber(row['ID Override']),
            manualHoleSize: parseOptionalNumber(row['Hole Size']),
            labelXPos: parseOptionalNumber(row['Label X']),
            manualLabelDepth: parseOptionalNumber(row['Label Depth']),
            casingLabelFontSize: parseOptionalNumber(row['Casing Label Font Size']),
            depthLabelFontSize: parseOptionalNumber(row['Depth Label Font Size']),
            depthLabelOffset: parseOptionalNumber(row['Depth Label X Offset']),
            showTop: toBoolean(row['Show Top'], true),
            showBottom: toBoolean(row['Show Bottom'], true)
        };
    }).filter(row => row.bottom > row.top);

    const casingLabelMap = buildCasingLabelMap(casingData);

    const lineRows = readRows(workbook, SCHEMAS.horizons);
    const horizontalLines = lineRows.map((row, index) => ({
        depth: parseRequiredNumber(row, 'Depth', `Horizons row ${index + 2}`),
        label: toTrimmedString(row.Label),
        color: toTrimmedString(row.Color) || DEFAULT_LINE_COLOR,
        fontColor: toTrimmedString(row['Font Color']) || toTrimmedString(row.Color) || DEFAULT_LINE_COLOR,
        fontSize: parseOptionalNumber(row['Font Size']) ?? 11,
        lineStyle: normalizeLineStyle(row['Line Style'] || 'Solid'),
        labelXPos: parseOptionalNumber(row['Label X']),
        show: toBoolean(row.Show, true)
    }));

    const calloutRows = readRows(workbook, SCHEMAS.callouts);
    const annotationBoxes = calloutRows.map((row, index) => ({
        topDepth: parseRequiredNumber(row, 'Top', `Callouts row ${index + 2}`),
        bottomDepth: parseRequiredNumber(row, 'Bottom', `Callouts row ${index + 2}`),
        label: toTrimmedString(row.Label),
        detail: toTrimmedString(row.Detail),
        color: toTrimmedString(row.Color) || DEFAULT_BOX_COLOR,
        fontColor: toTrimmedString(row['Font Color']) || DEFAULT_BOX_FONT_COLOR,
        fontSize: parseOptionalNumber(row['Font Size']) ?? 12,
        labelXPos: parseOptionalNumber(row['Label X']),
        bandWidth: parseOptionalNumber(row['Band Width']) ?? 1.0,
        opacity: parseOptionalNumber(row.Opacity) ?? 0.25,
        showDetails: toBoolean(row['Show Details'], true),
        show: toBoolean(row.Show, true)
    })).filter(row => row.bottomDepth > row.topDepth);

    const markerRows = readRows(workbook, SCHEMAS.markers);
    const markers = markerRows.map((row, index) => {
        const depth = parseRequiredNumber(row, 'Depth', `Markers row ${index + 2}`);
        const hostLabel = toTrimmedString(row['Host Casing Label']);
        const attachToRow = casingLabelMap.get(hostLabel) ?? null;
        const type = normalizeMarkerType(row.Type);
        return {
            top: depth,
            bottom: depth + 1,
            type,
            attachToRow,
            side: normalizeMarkerSide(row.Side || 'Both sides'),
            color: toTrimmedString(row.Color) || MARKER_DEFAULT_COLORS[type] || 'black',
            scale: parseOptionalNumber(row.Scale) ?? 1,
            label: toTrimmedString(row.Label),
            show: toBoolean(row.Show, true)
        };
    });

    const trajectoryRows = readRows(workbook, SCHEMAS.trajectory);
    const trajectory = trajectoryRows.map((row, index) => ({
        md: parseRequiredNumber(row, 'MD', `Trajectory row ${index + 2}`),
        inc: parseRequiredNumber(row, 'Inc', `Trajectory row ${index + 2}`),
        azi: parseRequiredNumber(row, 'Azi', `Trajectory row ${index + 2}`),
        comment: toTrimmedString(row.Comment)
    }));

    return {
        casingData,
        trajectory,
        horizontalLines,
        annotationBoxes,
        markers,
        cementPlugs: [],
        annulusFluids: []
    };
}

export function parseTrajectoryCSV(csvString) {
    const parsed = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => toTrimmedString(header)
    });

    if (parsed.errors?.length) {
        throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }

    const headers = parsed.meta?.fields ?? [];
    const required = ['MD', 'Inc', 'Azi'];
    const optional = ['Comment'];
    const missing = required.filter(key => !headers.includes(key));
    if (missing.length) {
        throw new Error(`CSV must include columns: ${required.join(', ')}.`);
    }
    const allowed = new Set([...required, ...optional]);
    const extra = headers.filter(key => key && !allowed.has(key));
    if (extra.length) {
        throw new Error(`CSV has unsupported columns: ${extra.join(', ')}.`);
    }

    return parsed.data.map((row, index) => ({
        md: parseRequiredNumber(row, 'MD', `CSV row ${index + 2}`),
        inc: parseRequiredNumber(row, 'Inc', `CSV row ${index + 2}`),
        azi: parseRequiredNumber(row, 'Azi', `CSV row ${index + 2}`),
        comment: toTrimmedString(row.Comment)
    }));
}

export function useImporter() {
    return {
        parseStrictExcelProject,
        parseTrajectoryCSV
    };
}

export default {
    useImporter,
    parseStrictExcelProject,
    parseTrajectoryCSV
};
