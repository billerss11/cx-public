import * as XLSX from 'xlsx';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { composeRuntimeViewConfigForWell } from '@/stores/viewConfigOwnership.js';
import { usePlotElementsStore } from '@/stores/plotElementsStore.js';
import { pinia } from '@/stores/pinia.js';
import { DEFAULT_LINE_COLOR, DEFAULT_BOX_COLOR, DEFAULT_BOX_FONT_COLOR, MARKER_DEFAULT_COLORS } from '@/constants/index.js';
import { clamp, cloneSnapshot, generateCasingId } from '@/utils/general.js';
import { t, translateEnum } from './i18n.js';
import { normalizeMarkerType, normalizeMarkerSide } from './domain.js';
import { showAlert } from './alerts.js';
import { buildProjectSavePayload } from './exportPayload.mjs';
import { finishEditingAllHotTables, getHotTableInstance } from '@/composables/useHotTableRegistry.js';

const projectDataStore = useProjectDataStore(pinia);
const viewConfigStore = useViewConfigStore(pinia);
const projectStore = useProjectStore(pinia);
const plotElementsStore = usePlotElementsStore(pinia);
const getPlotElement = (...args) => plotElementsStore.getPlotElement(...args);

export const EXCEL_EXPORT_SCOPE_ACTIVE_WELL = 'active-well';
export const EXCEL_EXPORT_SCOPE_ALL_WELLS = 'all-wells';

const EXPORT_TABLE_STATE_KEY_MAP = Object.freeze({
    casing: 'casingData',
    line: 'horizontalLines',
    box: 'annotationBoxes',
    plug: 'cementPlugs',
    marker: 'markers',
    fluid: 'annulusFluids'
});
// Export Functions
// ============================================================================

function getExportSnapshot() {
    return cloneSnapshot({
        casingData: projectDataStore.casingData,
        tubingData: projectDataStore.tubingData,
        drillStringData: projectDataStore.drillStringData,
        horizontalLines: projectDataStore.horizontalLines,
        annotationBoxes: projectDataStore.annotationBoxes,
        userAnnotations: projectDataStore.userAnnotations,
        cementPlugs: projectDataStore.cementPlugs,
        annulusFluids: projectDataStore.annulusFluids,
        markers: projectDataStore.markers,
        topologySources: projectDataStore.topologySources,
        physicsIntervals: projectDataStore.physicsIntervals,
        trajectory: projectDataStore.trajectory,
        config: viewConfigStore.config
    });
}

function isMeaningfulValue(value) {
    return value !== null && value !== undefined && value !== '';
}

function rowHasAnyValue(row, fields) {
    return fields.some(field => isMeaningfulValue(row[field]));
}

function toNumberOrBlank(value) {
    if (!isMeaningfulValue(value)) return '';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
}

function toStringOrBlank(value) {
    if (!isMeaningfulValue(value)) return '';
    return String(value);
}

function getTableDataForExport(type, exportSnapshot = {}, options = {}) {
    const preferLiveTableRows = options.preferLiveTableRows === true;
    const liveTableRows = preferLiveTableRows
        ? getHotTableInstance(type)?.getSourceData?.()
        : null;
    if (Array.isArray(liveTableRows)) {
        return liveTableRows;
    }

    const snapshotKey = EXPORT_TABLE_STATE_KEY_MAP[type];
    const snapshotRows = snapshotKey ? exportSnapshot[snapshotKey] : null;
    return Array.isArray(snapshotRows) ? snapshotRows : [];
}

export { buildProjectSavePayload };

function sanitizeSheetNameToken(value, fallback = 'Well') {
    const token = String(value ?? '').trim().replace(/[\\/?*:[\]]/g, '_');
    return token || fallback;
}

function truncateSheetName(value, maxLength = 31) {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength);
}

function buildUniqueSheetName(desiredName, usedSheetNames) {
    const safeUsedNames = usedSheetNames ?? new Set();
    const seed = truncateSheetName(sanitizeSheetNameToken(desiredName, 'Sheet'));
    if (!safeUsedNames.has(seed)) {
        safeUsedNames.add(seed);
        return seed;
    }

    let suffix = 2;
    while (suffix < 10000) {
        const suffixToken = `_${suffix}`;
        const baseLength = 31 - suffixToken.length;
        const candidate = `${seed.slice(0, Math.max(1, baseLength))}${suffixToken}`;
        if (!safeUsedNames.has(candidate)) {
            safeUsedNames.add(candidate);
            return candidate;
        }
        suffix += 1;
    }

    const fallback = `${seed.slice(0, 28)}_dup`;
    safeUsedNames.add(fallback);
    return fallback;
}

function buildWorkbookSheetData(exportSnapshot = {}, options = {}) {
    const tableOptions = {
        preferLiveTableRows: options.preferLiveTableRows === true
    };

    const casingRows = getTableDataForExport('casing', exportSnapshot, tableOptions);
    const lineRows = getTableDataForExport('line', exportSnapshot, tableOptions);
    const boxRows = getTableDataForExport('box', exportSnapshot, tableOptions);
    const markerRows = getTableDataForExport('marker', exportSnapshot, tableOptions);

    const casingFields = [
        'label',
        'od',
        'weight',
        'idOverride',
        'manualHoleSize',
        'grade',
        'top',
        'bottom',
        'toc',
        'boc',
        'labelXPos',
        'manualLabelDepth',
        'casingLabelFontSize',
        'depthLabelFontSize',
        'depthLabelOffset',
        'showTop',
        'showBottom'
    ];
    const lineFields = ['depth', 'label', 'color', 'fontColor', 'fontSize', 'labelXPos', 'lineStyle', 'show'];
    const boxFields = ['topDepth', 'bottomDepth', 'label', 'color', 'fontColor', 'fontSize', 'labelXPos', 'bandWidth', 'opacity', 'detail', 'showDetails', 'show'];
    const markerFields = ['top', 'type', 'attachToRow', 'side', 'color', 'scale', 'label', 'show'];

    const casingSheetData = [
        [
            'Label',
            'OD',
            'Weight',
            'Grade',
            'Top',
            'Bottom',
            'TOC',
            'BOC',
            'ID Override',
            'Hole Size',
            'Label X',
            'Label Depth',
            'Casing Label Font Size',
            'Depth Label Font Size',
            'Depth Label X Offset',
            'Show Top',
            'Show Bottom'
        ],
        ...casingRows
            .filter(row => rowHasAnyValue(row, casingFields))
            .map(row => [
                toStringOrBlank(row.label),
                toNumberOrBlank(row.od),
                toNumberOrBlank(row.weight),
                toStringOrBlank(row.grade),
                toNumberOrBlank(row.top),
                toNumberOrBlank(row.bottom),
                toNumberOrBlank(row.toc),
                toNumberOrBlank(row.boc),
                toNumberOrBlank(row.idOverride),
                toNumberOrBlank(row.manualHoleSize),
                toNumberOrBlank(row.labelXPos),
                toNumberOrBlank(row.manualLabelDepth),
                toNumberOrBlank(row.casingLabelFontSize),
                toNumberOrBlank(row.depthLabelFontSize),
                toNumberOrBlank(row.depthLabelOffset),
                row.showTop !== false,
                row.showBottom !== false
            ])
    ];

    const linesSheetData = [
        ['Depth', 'Label', 'Color', 'Font Color', 'Font Size', 'Line Style', 'Label X', 'Show'],
        ...lineRows
            .filter(row => rowHasAnyValue(row, lineFields))
            .map(row => [
                toNumberOrBlank(row.depth),
                toStringOrBlank(row.label),
                toStringOrBlank(row.color || DEFAULT_LINE_COLOR),
                toStringOrBlank(row.fontColor || row.color || DEFAULT_LINE_COLOR),
                toNumberOrBlank(row.fontSize),
                toStringOrBlank(translateEnum('lineStyle', row.lineStyle || 'Solid')),
                toNumberOrBlank(row.labelXPos),
                Boolean(row.show)
            ])
    ];

    const boxesSheetData = [
        ['Top', 'Bottom', 'Label', 'Detail', 'Color', 'Font Color', 'Font Size', 'Label X', 'Band Width', 'Opacity', 'Show Details', 'Show'],
        ...boxRows
            .filter(row => rowHasAnyValue(row, boxFields))
            .map(row => [
                toNumberOrBlank(row.topDepth),
                toNumberOrBlank(row.bottomDepth),
                toStringOrBlank(row.label),
                toStringOrBlank(row.detail),
                toStringOrBlank(row.color || DEFAULT_BOX_COLOR),
                toStringOrBlank(row.fontColor || row.color || DEFAULT_BOX_FONT_COLOR),
                toNumberOrBlank(row.fontSize),
                toNumberOrBlank(row.labelXPos),
                toNumberOrBlank(row.bandWidth),
                toNumberOrBlank(row.opacity),
                Boolean(row.showDetails),
                Boolean(row.show)
            ])
    ];

    const casingIdToLabel = new Map(
        casingRows.map((row, index) => [generateCasingId(row, index), toStringOrBlank(row.label)])
    );

    const markersSheetData = [
        ['Type', 'Depth', 'Host Casing Label', 'Label', 'Side', 'Color', 'Scale', 'Show'],
        ...markerRows
            .filter(row => rowHasAnyValue(row, markerFields))
            .map(row => [
                toStringOrBlank(translateEnum('markerType', normalizeMarkerType(row.type))),
                toNumberOrBlank(row.top),
                toStringOrBlank(casingIdToLabel.get(String(row.attachToRow ?? '').trim())),
                toStringOrBlank(row.label),
                toStringOrBlank(translateEnum('markerSide', normalizeMarkerSide(row.side))),
                toStringOrBlank(row.color || MARKER_DEFAULT_COLORS['射孔'] || MARKER_DEFAULT_COLORS.Perforation),
                toNumberOrBlank(row.scale ?? 1.0),
                Boolean(row.show)
            ])
    ];

    const trajectorySheetData = [
        ['MD', 'Inc', 'Azi', 'Comment'],
        ...(exportSnapshot.trajectory || []).map(row => [
            toNumberOrBlank(row.md),
            toNumberOrBlank(row.inc),
            toNumberOrBlank(row.azi),
            toStringOrBlank(row.comment)
        ])
    ];

    return {
        casingSheetData,
        linesSheetData,
        boxesSheetData,
        markersSheetData,
        trajectorySheetData
    };
}

function appendWorkbookSheets(wb, exportSnapshot = {}, options = {}) {
    const sheetData = buildWorkbookSheetData(exportSnapshot, options);
    const usedSheetNames = options.usedSheetNames ?? new Set();
    const prefixToken = options.sheetPrefix
        ? sanitizeSheetNameToken(options.sheetPrefix, 'Well')
        : '';

    const entries = [
        { baseName: 'Casing', data: sheetData.casingSheetData },
        { baseName: 'Horizons', data: sheetData.linesSheetData },
        { baseName: 'Callouts', data: sheetData.boxesSheetData },
        { baseName: 'Markers', data: sheetData.markersSheetData },
        { baseName: 'Trajectory', data: sheetData.trajectorySheetData }
    ];

    entries.forEach(({ baseName, data }) => {
        const desiredName = prefixToken ? `${prefixToken}_${baseName}` : baseName;
        const sheetName = buildUniqueSheetName(desiredName, usedSheetNames);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), sheetName);
    });
}

function buildExportSnapshotFromWell(well, projectConfig = {}) {
    return cloneSnapshot({
        casingData: well?.data?.casingData || [],
        tubingData: well?.data?.tubingData || [],
        drillStringData: well?.data?.drillStringData || [],
        horizontalLines: well?.data?.horizontalLines || [],
        annotationBoxes: well?.data?.annotationBoxes || [],
        userAnnotations: well?.data?.userAnnotations || [],
        cementPlugs: well?.data?.cementPlugs || [],
        annulusFluids: well?.data?.annulusFluids || [],
        markers: well?.data?.markers || [],
        trajectory: well?.data?.trajectory || [],
        config: composeRuntimeViewConfigForWell(well?.config || {}, projectConfig)
    });
}

function resolveWorkbookExportScope(options = {}) {
    return options?.scope === EXCEL_EXPORT_SCOPE_ALL_WELLS
        ? EXCEL_EXPORT_SCOPE_ALL_WELLS
        : EXCEL_EXPORT_SCOPE_ACTIVE_WELL;
}

export function downloadEditedWorkbook(options = {}) {
    finishEditingAllHotTables();
    const scope = resolveWorkbookExportScope(options);

    const wb = XLSX.utils.book_new();

    if (scope === EXCEL_EXPORT_SCOPE_ALL_WELLS) {
        projectStore.ensureInitialized();
        projectStore.syncActiveWellData();
        const projectPayload = projectStore.serializeProjectPayload();
        const usedSheetNames = new Set();

        (projectPayload.wells || []).forEach((well, index) => {
            const exportSnapshot = buildExportSnapshotFromWell(well, projectPayload.projectConfig);
            appendWorkbookSheets(wb, exportSnapshot, {
                sheetPrefix: well?.name || `Well ${index + 1}`,
                usedSheetNames
            });
        });

        XLSX.writeFile(wb, t('file.edited_excel_all'));
        showAlert(t('alert.export_excel_all'), 'success');
        return;
    }

    const exportSnapshot = getExportSnapshot();
    appendWorkbookSheets(wb, exportSnapshot, {
        preferLiveTableRows: true,
        usedSheetNames: new Set()
    });

    XLSX.writeFile(wb, t('file.edited_excel'));
    showAlert(t('alert.export_excel'), 'success');
}

export function downloadExcelTemplate() {
    const wb = XLSX.utils.book_new();

    const casingSheet = XLSX.utils.aoa_to_sheet([
        [
            'Label',
            'OD',
            'Weight',
            'Grade',
            'Top',
            'Bottom',
            'TOC',
            'BOC',
            'ID Override',
            'Hole Size',
            'Label X',
            'Label Depth',
            'Casing Label Font Size',
            'Depth Label Font Size',
            'Depth Label X Offset',
            'Show Top',
            'Show Bottom'
        ],
        [t('sample.casing.conductor'), 20, 94, 'H40', 0, 1000, 0, 900, '', '', -0.8, '', 11, 9, 35, true, true],
        [t('sample.casing.surface'), 13.375, 54.5, 'J55', 0, 3500, 500, 3400, '', 17.5, -0.8, '', 11, 9, 35, true, true],
        [t('sample.casing.intermediate'), 9.625, 40, 'L80', 0, 9000, 2000, 8800, '', 12.25, -0.8, '', 11, 9, 35, true, true],
        [t('sample.casing.production'), 7, 29, 'P110', 8500, 12500, 8700, 12400, '', 8.5, -0.8, 10000, 11, 9, 35, true, true]
    ]);

    const linesSheet = XLSX.utils.aoa_to_sheet([
        ['Depth', 'Label', 'Color', 'Font Color', 'Font Size', 'Line Style', 'Label X', 'Show'],
        [2500, t('sample.line.mudline'), 'steelblue', 'steelblue', 11, translateEnum('lineStyle', 'Dash-dot'), 0.9, true],
        [5000, t('sample.line.top'), 'seagreen', 'seagreen', 11, translateEnum('lineStyle', 'Dash-dot'), 0.9, true]
    ]);

    const boxesSheet = XLSX.utils.aoa_to_sheet([
        ['Top', 'Bottom', 'Label', 'Detail', 'Color', 'Font Color', 'Font Size', 'Label X', 'Band Width', 'Opacity', 'Show Details', 'Show'],
        [1000, 3000, t('sample.box.reservoir'), t('sample.box.detail'), 'lightsteelblue', 'steelblue', 12, -0.5, 1.0, 0.35, true, true],
        [6000, 8000, t('sample.box.producer'), t('sample.box.detail2'), 'lightgray', 'seagreen', 12, -0.5, 1.0, 0.4, true, true]
    ]);

    const markersSheet = XLSX.utils.aoa_to_sheet([
        ['Type', 'Depth', 'Host Casing Label', 'Label', 'Side', 'Color', 'Scale', 'Show'],
        [translateEnum('markerType', 'Perforation'), 12000, t('sample.casing.production'), t('sample.marker.perf'), translateEnum('markerSide', 'Both sides'), 'black', 1.0, true],
        [translateEnum('markerType', 'Leak'), 8000, t('sample.casing.intermediate'), t('sample.marker.leak'), translateEnum('markerSide', 'Both sides'), 'maroon', 1.0, true]
    ]);

    const trajectorySheet = XLSX.utils.aoa_to_sheet([
        ['MD', 'Inc', 'Azi', 'Comment'],
        [0, 0, 0, ''],
        [1000, 0, 0, ''],
        [3000, 5, 45, ''],
        [6000, 20, 65, ''],
        [9000, 32, 82, '']
    ]);

    XLSX.utils.book_append_sheet(wb, casingSheet, 'Casing');
    XLSX.utils.book_append_sheet(wb, linesSheet, 'Horizons');
    XLSX.utils.book_append_sheet(wb, boxesSheet, 'Callouts');
    XLSX.utils.book_append_sheet(wb, markersSheet, 'Markers');
    XLSX.utils.book_append_sheet(wb, trajectorySheet, 'Trajectory');

    XLSX.writeFile(wb, t('file.template_excel'));
}

function buildPlotFilename(ext, scale = 1) {
    const base = t('file.plot_name');
    const safeScale = Number.isFinite(scale) && scale > 1 ? scale : 1;
    const suffix = safeScale > 1 ? `_${safeScale}x` : '';
    return `${base}${suffix}.${ext}`;
}

const SVG_EXPORT_STYLE_PROPERTIES = Object.freeze([
    'fill',
    'fill-opacity',
    'fill-rule',
    'stroke',
    'stroke-opacity',
    'stroke-width',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'opacity',
    'color',
    'font',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'letter-spacing',
    'word-spacing',
    'text-anchor',
    'dominant-baseline',
    'alignment-baseline',
    'paint-order',
    'white-space',
    'visibility',
    'display',
    'vector-effect',
    'shape-rendering',
    'text-rendering',
    'marker-start',
    'marker-mid',
    'marker-end',
    'rx',
    'ry'
]);

function inlineSvgComputedStyles(sourceNode, targetNode) {
    if (!sourceNode || !targetNode) return;
    const computedStyle = window.getComputedStyle(sourceNode);
    if (!computedStyle) return;

    SVG_EXPORT_STYLE_PROPERTIES.forEach((property) => {
        const value = computedStyle.getPropertyValue(property);
        if (value) {
            targetNode.style.setProperty(property, value);
        }
    });
}

function serializeStyledSvg(svg) {
    if (!svg) return '';
    const clonedSvg = svg.cloneNode(true);
    if (!clonedSvg) return '';

    const sourceNodes = [svg, ...svg.querySelectorAll('*')];
    const clonedNodes = [clonedSvg, ...clonedSvg.querySelectorAll('*')];
    const nodeCount = Math.min(sourceNodes.length, clonedNodes.length);

    for (let index = 0; index < nodeCount; index += 1) {
        inlineSvgComputedStyles(sourceNodes[index], clonedNodes[index]);
    }

    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return new XMLSerializer().serializeToString(clonedSvg);
}

function downloadRaster(format, options = {}) {
    const svg = getPlotElement('schematicSvg');
    if (!svg) return;
    const svgData = serializeStyledSvg(svg);
    if (!svgData) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    
    const width = parseFloat(svg.getAttribute('width')) || 0;
    const height = parseFloat(svg.getAttribute('height')) || 0;
    const safeScale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1;
    canvas.width = Math.round(width * safeScale);
    canvas.height = Math.round(height * safeScale);
    
    img.onload = function() {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(safeScale, safeScale);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        
        canvas.toBlob(function(blob) {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = options.filename || buildPlotFilename('png', options.scale);
            a.click();
            URL.revokeObjectURL(url);
        }, format, options.quality);
        URL.revokeObjectURL(img.src);
    };

    img.onerror = function() {
        URL.revokeObjectURL(img.src);
    };

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(svgBlob);
}

export function downloadPNG(scale = 3) {
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 3;
    const filename = buildPlotFilename('png', safeScale);
    downloadRaster('image/png', { scale: safeScale, filename });
}

export function downloadJPEG(quality = 0.92, scale = 3) {
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 3;
    downloadRaster('image/jpeg', {
        scale: safeScale,
        quality: clamp(quality, 0.5, 1.0),
        filename: buildPlotFilename('jpg', safeScale)
    });
}

export function downloadWebP(quality = 0.9, scale = 3) {
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 3;
    downloadRaster('image/webp', {
        scale: safeScale,
        quality: clamp(quality, 0.5, 1.0),
        filename: buildPlotFilename('webp', safeScale)
    });
}

export function downloadSVG() {
    const svg = getPlotElement('schematicSvg');
    if (!svg) return;
    const svgData = serializeStyledSvg(svg);
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildPlotFilename('svg', 1);
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================

function downloadProjectJson(payload, filename) {
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function buildSafeProjectFilename(baseName = 'project') {
    const safeTitle = String(baseName || 'project')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    return `${safeTitle}_${dateStr}.json`;
}

function normalizeProjectFilename(value, fallback = 'project.json') {
    const fileName = String(value ?? '').trim();
    if (!fileName) return fallback;
    return /\.json$/i.test(fileName) ? fileName : `${fileName}.json`;
}

function resolveFileNameFromPath(filePath) {
    const normalizedPath = String(filePath ?? '').trim();
    if (!normalizedPath) return '';
    const segments = normalizedPath.split(/[\\/]/);
    return String(segments[segments.length - 1] ?? '').trim();
}

function getNativeProjectSaveBridge() {
    if (typeof window === 'undefined') return null;
    const bridge = window.cxApp;
    if (!bridge || typeof bridge !== 'object') return null;
    if (typeof bridge.saveProjectAs !== 'function') return null;
    if (typeof bridge.saveProjectToPath !== 'function') return null;
    return bridge;
}

function isMissingProjectSaveHandlerError(error) {
    const message = String(error?.message ?? '');
    if (!message) return false;
    return (
        message.includes("No handler registered for 'cx:project:save-as'")
        || message.includes("No handler registered for 'cx:project:save-to-path'")
    );
}

function buildProjectSaveContext() {
    projectStore.ensureInitialized();
    finishEditingAllHotTables();
    projectStore.syncActiveWellData();

    const projectSnapshot = projectStore.serializeProjectPayload();
    const projectData = buildProjectSavePayload(projectSnapshot);
    const fallbackFilename = buildSafeProjectFilename(projectData.projectName || 'project');
    const savedFileName = normalizeProjectFilename(projectStore.projectFileName, fallbackFilename);
    return {
        projectData,
        jsonString: JSON.stringify(projectData, null, 2),
        savedFileName
    };
}

async function saveProjectFileAsWithNativeBridge(bridge, saveContext) {
    const result = await bridge.saveProjectAs({
        defaultFileName: saveContext.savedFileName,
        content: saveContext.jsonString
    });
    if (!result || result.canceled === true) {
        return false;
    }

    const filePath = String(result.filePath ?? '').trim();
    const fileName = normalizeProjectFilename(
        result.fileName || resolveFileNameFromPath(filePath),
        saveContext.savedFileName
    );
    projectStore.setProjectFileContext({ filePath, fileName });
    projectStore.markProjectSaved();
    showAlert(t('alert.project_saved', { name: fileName }), 'success');
    return true;
}

async function saveProjectFileToExistingPath(bridge, saveContext) {
    const currentPath = String(projectStore.projectFilePath ?? '').trim();
    if (!currentPath) return false;

    const result = await bridge.saveProjectToPath({
        filePath: currentPath,
        content: saveContext.jsonString
    });
    if (!result || result.canceled === true) {
        return false;
    }

    const savedPath = String(result.filePath ?? '').trim() || currentPath;
    const fileName = normalizeProjectFilename(
        result.fileName || resolveFileNameFromPath(savedPath),
        saveContext.savedFileName
    );
    projectStore.setProjectFileContext({
        filePath: savedPath,
        fileName
    });
    projectStore.markProjectSaved();
    showAlert(t('alert.project_saved', { name: fileName }), 'success');
    return true;
}

function saveProjectFileByDownload(saveContext) {
    downloadProjectJson(saveContext.projectData, saveContext.savedFileName);
    projectStore.setProjectFileContext({
        filePath: null,
        fileName: saveContext.savedFileName
    });
    projectStore.markProjectSaved();
    showAlert(t('alert.project_saved_download', { name: saveContext.savedFileName }), 'success');
    return true;
}

export async function saveProjectFileAs() {
    const saveContext = buildProjectSaveContext();
    const bridge = getNativeProjectSaveBridge();
    try {
        if (bridge) {
            return await saveProjectFileAsWithNativeBridge(bridge, saveContext);
        }
        return saveProjectFileByDownload(saveContext);
    } catch (error) {
        if (bridge && isMissingProjectSaveHandlerError(error)) {
            return saveProjectFileByDownload(saveContext);
        }
        showAlert(`${t('alert.project_save_failed')}: ${error.message}`, 'danger');
        return false;
    }
}

export async function saveProjectFile() {
    const saveContext = buildProjectSaveContext();
    const bridge = getNativeProjectSaveBridge();
    try {
        if (bridge && projectStore.hasProjectFileTarget) {
            return await saveProjectFileToExistingPath(bridge, saveContext);
        }
        if (bridge) {
            return await saveProjectFileAsWithNativeBridge(bridge, saveContext);
        }
        return saveProjectFileByDownload(saveContext);
    } catch (error) {
        if (bridge && isMissingProjectSaveHandlerError(error)) {
            return saveProjectFileByDownload(saveContext);
        }
        showAlert(`${t('alert.project_save_failed')}: ${error.message}`, 'danger');
        return false;
    }
}

export function saveActiveWellProjectFile() {
    projectStore.ensureInitialized();
    finishEditingAllHotTables();
    projectStore.syncActiveWellData();

    const projectSnapshot = projectStore.serializeProjectPayload();
    const activeWell = (projectSnapshot.wells || []).find((well) => well.id === projectSnapshot.activeWellId);
    if (!activeWell) {
        showAlert(t('alert.invalid_project'), 'danger');
        return false;
    }

    const singleWellProject = buildProjectSavePayload({
        projectName: projectSnapshot.projectName || activeWell.name || 'Project',
        projectAuthor: projectSnapshot.projectAuthor || '',
        activeWellId: activeWell.id,
        projectConfig: projectSnapshot.projectConfig,
        wells: [activeWell],
        meta: projectSnapshot.meta
    });

    const filename = buildSafeProjectFilename(activeWell.name || 'well');
    downloadProjectJson(singleWellProject, filename);
    showAlert(t('alert.export_active_well_project'), 'success');
    return true;
}



