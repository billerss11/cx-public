import {
    DEFAULT_BOX_COLOR,
    DEFAULT_BOX_FONT_COLOR,
    DEFAULT_CEMENT_COLOR,
    FLUID_PLACEMENT_DEFAULT_OPTION
} from '@/constants/index.js';
import { normalizeHatchStyle } from '@/app/domain.js';
import { showAlert } from '@/app/alerts.js';
import { runWithWorkerFallback } from '@/app/workerFallback.js';
import { t, translateEnum } from '@/app/i18n.js';
import {
    clearSelection,
    hidePlotTooltip,
    syncSelectionIndicators
} from '@/app/selection.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import { pinia } from '@/stores/pinia.js';
import {
    cloneSnapshot,
    generateCasingId,
    parseOptionalNumber,
    toBoolean
} from '@/utils/general.js';
import { withDefaultPipeComponentType } from '@/utils/pipeRows.js';
import { normalizeUserAnnotations } from '@/utils/userAnnotations.js';
import {
    createEmptyWellData,
    ensureProjectSchemaV3,
    isProjectPayloadLike
} from '@/utils/migrations/v2_to_v3.js';
import { useProjectStore } from '@/stores/projectStore.js';
import {
    getImporterModule,
    getImporterWorkerModule
} from './runtime/context.js';
import {
    applySampleTranslations,
    translateEnumValuesInState
} from './languageOrchestration.js';

const projectStore = useProjectStore(pinia);

function getSampleCasingData() {
    return [
        { label: t('sample.casing.conductor'), od: 20, weight: 94, idOverride: null, manualHoleSize: null, grade: 'H40', top: 1400, bottom: 2000, toc: null, boc: null, labelXPos: null, manualLabelDepth: null, casingLabelFontSize: null, depthLabelFontSize: null, depthLabelOffset: null, showTop: true, showBottom: true, __i18n: { label: 'sample.casing.conductor' } },
        { label: t('sample.casing.surface'), od: 13.375, weight: 54.5, idOverride: null, manualHoleSize: null, grade: 'J55', top: 1400, bottom: 3500, toc: 1800, boc: null, labelXPos: null, manualLabelDepth: null, casingLabelFontSize: null, depthLabelFontSize: null, depthLabelOffset: null, showTop: true, showBottom: true, __i18n: { label: 'sample.casing.surface' } },
        { label: t('sample.casing.intermediate'), od: 9.625, weight: 40, idOverride: null, manualHoleSize: null, grade: 'L80', top: 1400, bottom: 9000, toc: 3000, boc: null, labelXPos: null, manualLabelDepth: 4800, casingLabelFontSize: null, depthLabelFontSize: null, depthLabelOffset: null, showTop: true, showBottom: true, __i18n: { label: 'sample.casing.intermediate' } },
        { label: t('sample.casing.production'), od: 7, weight: 29, idOverride: null, manualHoleSize: null, grade: 'P110', top: 8000, bottom: 12500, toc: 7900, boc: null, labelXPos: null, manualLabelDepth: null, casingLabelFontSize: null, depthLabelFontSize: null, depthLabelOffset: null, showTop: true, showBottom: true, __i18n: { label: 'sample.casing.production' } },
        { label: t('sample.casing.open_hole'), od: 4.5, weight: 0, idOverride: null, manualHoleSize: null, grade: 'OH', top: 12500, bottom: 14000, toc: null, boc: null, labelXPos: null, manualLabelDepth: null, casingLabelFontSize: null, depthLabelFontSize: null, depthLabelOffset: null, showTop: true, showBottom: true, __i18n: { label: 'sample.casing.open_hole' } }
    ];
}

function getSampleLinesData() {
    return [
        { depth: 2500, label: t('sample.line.mudline'), color: 'steelblue', fontColor: 'steelblue', fontSize: 11, lineStyle: translateEnum('lineStyle', 'Dash-dot'), labelXPos: 0.9, show: true, __i18n: { label: 'sample.line.mudline' } },
        { depth: 5000, label: t('sample.line.top'), color: 'seagreen', fontColor: 'seagreen', fontSize: 11, lineStyle: translateEnum('lineStyle', 'Dash-dot'), labelXPos: 0.9, show: true, __i18n: { label: 'sample.line.top' } },
        { depth: 8500, label: t('sample.line.target'), color: 'tomato', fontColor: 'tomato', fontSize: 11, lineStyle: translateEnum('lineStyle', 'Dash-dot'), labelXPos: 0.9, show: true, __i18n: { label: 'sample.line.target' } }
    ];
}

function getSampleBoxesData() {
    return [
        {
            topDepth: 12000,
            bottomDepth: 12300,
            label: t('sample.box.reservoir'),
            color: 'lightsteelblue',
            fontColor: 'steelblue',
            fontSize: 12,
            labelXPos: -0.5,
            bandWidth: 1.0,
            opacity: 0.35,
            detail: t('sample.box.detail'),
            showDetails: true,
            show: true,
            __i18n: { label: 'sample.box.reservoir', detail: 'sample.box.detail' }
        },
        {
            topDepth: 6000,
            bottomDepth: 8000,
            label: t('sample.box.producer'),
            color: 'lightgray',
            fontColor: 'seagreen',
            fontSize: 12,
            labelXPos: -0.5,
            bandWidth: 1.0,
            opacity: 0.4,
            detail: t('sample.box.detail2'),
            showDetails: true,
            show: true,
            __i18n: { label: 'sample.box.producer', detail: 'sample.box.detail2' }
        }
    ];
}

function getSamplePlugsData(casingData = []) {
    const casingIds = casingData.map((row, index) => generateCasingId(row, index));
    return [
        { top: 10000, bottom: 12500, type: translateEnum('plugType', 'Cement'), targetMode: translateEnum('targetMode', 'Auto (innermost)'), attachToRow: casingIds[3] ?? casingIds[0] ?? null, label: t('sample.plug.label1'), color: 'lightgray', hatchStyle: translateEnum('hatchStyle', 'none'), manualWidth: null, show: true, __i18n: { label: 'sample.plug.label1' } },
        { top: 13000, bottom: 13100, type: translateEnum('plugType', 'Cement'), targetMode: translateEnum('targetMode', 'Auto (innermost)'), attachToRow: casingIds[3] ?? casingIds[0] ?? null, label: t('sample.plug.label2'), color: 'lightgray', hatchStyle: translateEnum('hatchStyle', 'none'), manualWidth: null, show: true, __i18n: { label: 'sample.plug.label2' } }
    ];
}

function getSampleMarkersData(casingData = []) {
    const casingIds = casingData.map((row, index) => generateCasingId(row, index));
    return [
        {
            top: 12000,
            bottom: 12400,
            type: translateEnum('markerType', 'Perforation'),
            attachToRow: casingIds[3] ?? casingIds[0] ?? null,
            side: translateEnum('markerSide', 'Both sides'),
            color: 'black',
            scale: 1.0,
            label: t('sample.marker.perf'),
            show: true,
            __i18n: { label: 'sample.marker.perf' }
        },
        {
            top: 8000,
            bottom: 8100,
            type: translateEnum('markerType', 'Leak'),
            attachToRow: casingIds[2] ?? casingIds[0] ?? null,
            side: translateEnum('markerSide', 'Both sides'),
            color: 'maroon',
            scale: 1.0,
            label: t('sample.marker.leak'),
            show: true,
            __i18n: { label: 'sample.marker.leak' }
        }
    ];
}

function getDefaultTrajectoryRows() {
    return [{ md: 0, inc: 0, azi: 0, comment: t('tooltip.surface') }];
}

function getTrajectoryComment(row) {
    const rawComment =
        row?.comment ??
        row?.comments ??
        row?.Comment ??
        row?.Comments ??
        row?.note ??
        row?.Note ??
        row?.notes ??
        row?.Notes;
    return rawComment === null || rawComment === undefined ? '' : String(rawComment);
}

function normalizeTrajectorySurveys(rows = []) {
    return rows
        .map((row) => {
            const md = parseOptionalNumber(
                row?.md ??
                row?.MD ??
                row?.measured_depth ??
                row?.measuredDepth ??
                row?.MeasuredDepth ??
                row?.['Measured Depth'] ??
                row?.['MD (Depth)']
            );
            const inc = parseOptionalNumber(
                row?.inc ??
                row?.INC ??
                row?.Inc ??
                row?.inclination ??
                row?.Inclination ??
                row?.deviation ??
                row?.Deviation ??
                row?.['Inc (Dev)']
            );
            const azi = parseOptionalNumber(
                row?.azi ??
                row?.AZI ??
                row?.Azi ??
                row?.azimuth ??
                row?.Azimuth ??
                row?.direction ??
                row?.Direction ??
                row?.['Azi (Dir)']
            );
            if (!Number.isFinite(md) || !Number.isFinite(inc) || !Number.isFinite(azi)) {
                return null;
            }
            return {
                md,
                inc,
                azi,
                comment: getTrajectoryComment(row)
            };
        })
        .filter(Boolean);
}

function normalizeLegacyTrajectoryPoints(rows = []) {
    return rows
        .map((row) => {
            const x = parseOptionalNumber(
                row?.x ??
                row?.X ??
                row?.offset ??
                row?.Offset ??
                row?.['X (Offset)'] ??
                row?.OffsetX
            );
            const tvd = parseOptionalNumber(
                row?.tvd ??
                row?.TVD ??
                row?.depth ??
                row?.Depth ??
                row?.['TVD (Depth)'] ??
                row?.['True Vertical Depth']
            );
            if (!Number.isFinite(x) || !Number.isFinite(tvd)) return null;
            return {
                x,
                tvd,
                comment: getTrajectoryComment(row)
            };
        })
        .filter(Boolean);
}

function convertLegacyTrajectoryPointsToSurveys(points = []) {
    const EPSILON = 1e-6;
    if (!Array.isArray(points) || points.length < 2) return [];

    const surveys = [{
        md: 0,
        inc: 0,
        azi: 0,
        comment: points[0].comment
    }];
    let cumulativeMD = 0;

    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const curr = points[i];
        const deltaX = Number(curr.x) - Number(prev.x);
        const deltaTVD = Number(curr.tvd) - Number(prev.tvd);
        const deltaMD = Math.hypot(deltaX, deltaTVD);
        if (!Number.isFinite(deltaMD) || deltaMD <= EPSILON) continue;

        cumulativeMD += deltaMD;
        const cosineInc = Math.max(-1, Math.min(1, deltaTVD / deltaMD));
        const inc = (Math.acos(cosineInc) * 180) / Math.PI;
        const azi = Math.abs(deltaX) <= EPSILON
            ? surveys[surveys.length - 1].azi
            : (deltaX >= 0 ? 90 : 270);

        surveys.push({
            md: cumulativeMD,
            inc,
            azi,
            comment: curr.comment
        });
    }

    return surveys;
}

function normalizeTrajectoryRows(rows = []) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const surveys = normalizeTrajectorySurveys(sourceRows);
    if (surveys.length >= 2) return surveys;
    if (surveys.length === 1) return surveys;

    const legacyPoints = normalizeLegacyTrajectoryPoints(sourceRows);
    const converted = convertLegacyTrajectoryPointsToSurveys(legacyPoints);
    if (converted.length > 0) return converted;

    return getDefaultTrajectoryRows();
}

function resolveLegacyBoxLabelXFromAlignment(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) return -0.5;
    if (token.includes('right') || token.includes('右')) return 0.5;
    if (token.includes('center') || token.includes('centre') || token.includes('middle') || token.includes('中')) return 0;
    return -0.5;
}

function normalizeAnnotationBandWidth(value, fallback = 1.0) {
    const parsed = parseOptionalNumber(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return Number.isFinite(fallback) && fallback > 0 ? Math.min(1.0, Math.max(0.1, fallback)) : 1.0;
    }
    return Math.min(1.0, Math.max(0.1, parsed));
}

function normalizeAnnotationBoxRow(row = {}) {
    const rawTop = parseOptionalNumber(row.topDepth ?? row.top_depth ?? row.TopDepth ?? row.Top);
    const rawBottom = parseOptionalNumber(row.bottomDepth ?? row.bottom_depth ?? row.BottomDepth ?? row.Bottom);
    const labelXPos = parseOptionalNumber(row.labelXPos ?? row.label_x_pos ?? row.labelX ?? row['Label X']);
    const fallbackLabelX = resolveLegacyBoxLabelXFromAlignment(row.alignment ?? row.Alignment);
    const bandWidth = normalizeAnnotationBandWidth(
        row.bandWidth ?? row.band_width ?? row.BandWidth ?? row['Band Width'],
        1.0
    );
    return {
        topDepth: Number.isFinite(rawTop) ? rawTop : 0,
        bottomDepth: Number.isFinite(rawBottom) ? rawBottom : 0,
        label: row.label || row.Label || '',
        color: row.color || row.Color || DEFAULT_BOX_COLOR,
        fontColor: row.fontColor || row.font_color || row.FontColor || row.color || row.Color || DEFAULT_BOX_FONT_COLOR,
        fontSize: parseOptionalNumber(row.fontSize ?? row.font_size ?? row['Font size']) ?? 12,
        labelXPos: Number.isFinite(labelXPos) ? labelXPos : fallbackLabelX,
        bandWidth,
        opacity: parseOptionalNumber(row.opacity ?? row.Opacity) ?? 0.35,
        detail: row.detail || row.Detail || row.Details || row.comments || row.Comments || '',
        showDetails: toBoolean(row.showDetails ?? row.show_details ?? row.ShowDetails, false),
        show: toBoolean(row.show ?? row.Show, true),
        __i18n: row.__i18n && typeof row.__i18n === 'object' ? { ...row.__i18n } : undefined
    };
}

function normalizeAnnotationBoxes(rows = []) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => normalizeAnnotationBoxRow(row))
        .filter((row) => Number.isFinite(row.topDepth) && Number.isFinite(row.bottomDepth) && row.bottomDepth > row.topDepth);
}

function normalizeAnnulusFluidRow(row) {
    const top = parseFloat(row.top ?? row.Top ?? 0);
    const bottom = parseFloat(row.bottom ?? row.Bottom ?? 0);
    const placement = String(row.placement ?? row.Placement ?? FLUID_PLACEMENT_DEFAULT_OPTION).trim() || FLUID_PLACEMENT_DEFAULT_OPTION;
    const manualOD = parseOptionalNumber(row.manualOD ?? row.manual_od ?? row['Manual OD']);
    const rawManualDepth = parseOptionalNumber(row.manualDepth ?? row.manual_depth ?? row['Label depth']);
    const manualDepth = Number.isFinite(rawManualDepth) && Number.isFinite(top) && Number.isFinite(bottom) && rawManualDepth >= top && rawManualDepth <= bottom
        ? rawManualDepth
        : null;

    return {
        placement,
        manualOD: Number.isFinite(manualOD) ? manualOD : null,
        top,
        bottom,
        label: row.label || row.Label || '',
        color: row.color || row.Color || row['Fill color'] || DEFAULT_CEMENT_COLOR,
        hatchStyle: normalizeHatchStyle(row.hatch_style || row.hatchStyle || row.HatchStyle || row['Hatch style'] || 'none'),
        textColor: row.text_color || row.textColor || row.TextColor || row['Text color'] || 'black',
        fontSize: parseOptionalNumber(row.font_size ?? row.fontSize ?? row['Font size']) ?? 11,
        labelXPos: parseOptionalNumber(row.label_x ?? row.labelX ?? row.labelXPos ?? row['Label X']),
        manualDepth,
        show: toBoolean(row.show ?? row.Show, true)
    };
}

function normalizeAnnulusFluids(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => normalizeAnnulusFluidRow(row))
        .filter((row) => row.bottom > row.top);
}

const IMPORT_MODE_REPLACE_ACTIVE = 'replace-active';
const IMPORT_MODE_APPEND_NEW_WELL = 'append-new-well';

function resolveImportMode(options = {}) {
    return options?.mode === IMPORT_MODE_APPEND_NEW_WELL
        ? IMPORT_MODE_APPEND_NEW_WELL
        : IMPORT_MODE_REPLACE_ACTIVE;
}

function resolveImportedWellName(file, fallback = 'Imported Well') {
    const rawFileName = String(file?.name ?? '').trim();
    const stripped = rawFileName.replace(/\.[^.]+$/, '').trim();
    return stripped || fallback;
}

function resolveProjectFileContext(file) {
    return {
        filePath: String(file?.path ?? '').trim() || null,
        fileName: String(file?.name ?? '').trim()
    };
}

function normalizeProjectFileContext(fileContext = {}) {
    return {
        filePath: String(fileContext?.filePath ?? '').trim() || null,
        fileName: String(fileContext?.fileName ?? '').trim()
    };
}

function resolveImportedWellConfig(baseConfig = {}, trajectoryRows = []) {
    const source = baseConfig && typeof baseConfig === 'object' ? baseConfig : {};
    const nextConfig = {
        ...cloneSnapshot(source),
        operationPhase: 'production'
    };
    if (!nextConfig.viewMode || String(nextConfig.viewMode).trim() === '') {
        nextConfig.viewMode = trajectoryRows.length >= 2 ? 'directional' : 'vertical';
    }
    return nextConfig;
}

function ensureProjectIsReady() {
    projectStore.ensureInitialized();
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
            reject(new Error(t('alert.project_load_failed')));
        };
        reader.onload = (event) => {
            resolve(String(event?.target?.result ?? ''));
        };
        reader.readAsText(file);
    });
}

function normalizeImportedProjectPayload(project = {}) {
    return {
        ...project,
        wells: (project.wells || []).map((well) => ({
            ...well,
            data: {
                ...well.data,
                annotationBoxes: normalizeAnnotationBoxes(well.data?.annotationBoxes || []),
                userAnnotations: normalizeUserAnnotations(well.data?.userAnnotations || []),
                annulusFluids: normalizeAnnulusFluids(well.data?.annulusFluids || []),
                trajectory: normalizeTrajectoryRows(well.data?.trajectory)
            }
        }))
    };
}

function parseProjectJsonContentToV3(content) {
    const fileContent = String(content ?? '');
    if (!fileContent.trim()) {
        throw new Error(t('alert.invalid_project'));
    }

    const parsedPayload = JSON.parse(fileContent);
    if (!isProjectPayloadLike(parsedPayload)) {
        throw new Error(t('alert.invalid_project'));
    }
    const project = ensureProjectSchemaV3(parsedPayload);
    return normalizeImportedProjectPayload(project);
}

async function parseProjectJsonFileToV3(file) {
    if (!file) {
        throw new Error(t('alert.invalid_project'));
    }
    const fileContent = await readFileAsText(file);
    return parseProjectJsonContentToV3(fileContent);
}

function buildSampleWellData() {
    const casingData = getSampleCasingData();
    return {
        casingData: withDefaultPipeComponentType(casingData),
        tubingData: [],
        drillStringData: [],
        equipmentData: [],
        horizontalLines: getSampleLinesData(),
        annotationBoxes: normalizeAnnotationBoxes(getSampleBoxesData()),
        userAnnotations: [],
        cementPlugs: getSamplePlugsData(casingData),
        annulusFluids: [],
        markers: getSampleMarkersData(casingData),
        topologySources: [],
        trajectory: getDefaultTrajectoryRows()
    };
}

function buildResetWellData() {
    return {
        ...createEmptyWellData(),
        trajectory: getDefaultTrajectoryRows()
    };
}

function buildImportedExcelWellData(projectData = {}) {
    const trajectory = normalizeTrajectoryRows(projectData.trajectory);
    return {
        data: {
            casingData: withDefaultPipeComponentType(projectData.casingData || []),
            tubingData: [],
            drillStringData: [],
            equipmentData: [],
            horizontalLines: projectData.horizontalLines || [],
            annotationBoxes: normalizeAnnotationBoxes(projectData.annotationBoxes || []),
            userAnnotations: [],
            cementPlugs: projectData.cementPlugs || [],
            annulusFluids: normalizeAnnulusFluids(projectData.annulusFluids || []),
            markers: projectData.markers || [],
            topologySources: projectData.topologySources || [],
            trajectory
        },
        trajectory
    };
}

function appendImportedWellAndActivate({ data, config, file, defaultName }) {
    const baseName = resolveImportedWellName(file, defaultName);
    const wellName = projectStore.createUniqueWellName(baseName);
    const nextWellId = projectStore.appendWell({
        name: wellName,
        data,
        config
    }, { activate: false, ensureUniqueName: true });
    projectStore.setActiveWell(nextWellId);
}

function loadSampleData(options = {}) {
    const { silent = false } = options;
    ensureProjectIsReady();

    const activeConfig = cloneSnapshot(projectStore.activeWell?.config ?? {});
    const sampleData = buildSampleWellData();
    const sampleConfig = resolveImportedWellConfig(
        {
            ...activeConfig,
            viewMode: 'vertical'
        },
        sampleData.trajectory
    );

    projectStore.replaceActiveWellContent(
        { data: sampleData, config: sampleConfig },
        { requestRender: false }
    );

    translateEnumValuesInState();
    applySampleTranslations();
    projectStore.syncActiveWellData();

    clearSelection('all', { deferSync: true });
    syncSelectionIndicators();
    requestSchematicRender({ immediate: true });
    if (!silent) {
        showAlert(t('alert.sample_loaded'), 'success');
    }
}

function resetData() {
    ensureProjectIsReady();

    const activeConfig = cloneSnapshot(projectStore.activeWell?.config ?? {});
    const resetDataPayload = buildResetWellData();
    const resetConfig = resolveImportedWellConfig(activeConfig, resetDataPayload.trajectory);

    projectStore.replaceActiveWellContent(
        { data: resetDataPayload, config: resetConfig },
        { requestRender: false }
    );
    projectStore.syncActiveWellData();

    clearSelection('all', { deferSync: true });
    syncSelectionIndicators();
    hidePlotTooltip();
    requestSchematicRender({ immediate: true });
    showAlert(t('alert.reset_success'), 'info');
}

async function importExcelWorkbookFile(file, options = {}) {
    if (!file) return false;
    ensureProjectIsReady();
    let importerWorker = null;

    try {
        importerWorker = await getImporterWorkerModule();
        const buffer = await file.arrayBuffer();
        const projectData = await runWithWorkerFallback({
            key: 'import-excel',
            context: 'Excel import worker parse',
            isCancelledError: importerWorker.isImporterWorkerCancelledError,
            runWorker: () => importerWorker.parseStrictExcelProjectInWorker(buffer),
            runFallback: async () => {
                const { parseStrictExcelProject } = await getImporterModule();
                const fallbackBuffer = await file.arrayBuffer();
                return parseStrictExcelProject(fallbackBuffer);
            }
        });

        const imported = buildImportedExcelWellData(projectData);
        const importMode = resolveImportMode(options);

        if (importMode === IMPORT_MODE_APPEND_NEW_WELL) {
            const nextConfig = resolveImportedWellConfig(
                cloneSnapshot(projectStore.activeWell?.config ?? {}),
                imported.trajectory
            );
            appendImportedWellAndActivate({
                data: imported.data,
                config: nextConfig,
                file,
                defaultName: t('common.unnamed')
            });
        } else {
            const nextConfig = resolveImportedWellConfig(
                cloneSnapshot(projectStore.activeWell?.config ?? {}),
                imported.trajectory
            );
            projectStore.replaceActiveWellContent(
                { data: imported.data, config: nextConfig },
                { requestRender: true }
            );
            projectStore.syncActiveWellData();
        }

        showAlert(t('alert.project_loaded'), 'success');
        return true;
    } catch (error) {
        if (importerWorker?.isImporterWorkerCancelledError?.(error)) {
            return false;
        }
        showAlert(error.message, 'danger');
        return false;
    }
}

async function importTrajectoryCsvFile(file, options = {}) {
    if (!file) return false;
    ensureProjectIsReady();
    let importerWorker = null;

    try {
        importerWorker = await getImporterWorkerModule();
        const csvString = await file.text();
        const trajectory = await runWithWorkerFallback({
            key: 'import-csv-trajectory',
            context: 'Trajectory CSV import worker parse',
            isCancelledError: importerWorker.isImporterWorkerCancelledError,
            runWorker: () => importerWorker.parseTrajectoryCsvInWorker(csvString),
            runFallback: async () => {
                const { parseTrajectoryCSV } = await getImporterModule();
                return parseTrajectoryCSV(csvString);
            }
        });

        const normalizedTrajectory = normalizeTrajectoryRows(trajectory);
        const importMode = resolveImportMode(options);

        if (importMode === IMPORT_MODE_APPEND_NEW_WELL) {
            const data = {
                ...createEmptyWellData(),
                trajectory: normalizedTrajectory
            };
            const config = resolveImportedWellConfig(
                cloneSnapshot(projectStore.activeWell?.config ?? {}),
                normalizedTrajectory
            );
            appendImportedWellAndActivate({
                data,
                config,
                file,
                defaultName: t('ui.trajectory_csv_label')
            });
        } else {
            const nextData = cloneSnapshot(projectStore.activeWell?.data ?? createEmptyWellData());
            nextData.trajectory = normalizedTrajectory;
            const nextConfig = resolveImportedWellConfig(
                cloneSnapshot(projectStore.activeWell?.config ?? {}),
                normalizedTrajectory
            );
            projectStore.replaceActiveWellContent(
                { data: nextData, config: nextConfig },
                { requestRender: true }
            );
            projectStore.syncActiveWellData();
        }

        showAlert(t('alert.csv_loaded'), 'success');
        return true;
    } catch (error) {
        if (importerWorker?.isImporterWorkerCancelledError?.(error)) {
            return false;
        }
        showAlert(error.message, 'danger');
        return false;
    }
}

async function importProjectJsonFile(file) {
    if (!file) return false;
    ensureProjectIsReady();
    try {
        const project = await parseProjectJsonFileToV3(file);
        projectStore.loadProject(project);
        projectStore.setProjectFileContext(resolveProjectFileContext(file));
        projectStore.syncActiveWellData();

        syncSelectionIndicators();
        showAlert(t('alert.project_loaded'), 'success');
        return true;
    } catch (err) {
        console.error('Load failed:', err);
        showAlert(`${t('alert.project_load_failed')}: ${err.message}`, 'danger');
        return false;
    }
}

async function importProjectJsonContent(content, fileContext = {}) {
    ensureProjectIsReady();
    try {
        const project = parseProjectJsonContentToV3(content);
        projectStore.loadProject(project);
        projectStore.setProjectFileContext(normalizeProjectFileContext(fileContext));
        projectStore.syncActiveWellData();

        syncSelectionIndicators();
        showAlert(t('alert.project_loaded'), 'success');
        return true;
    } catch (error) {
        console.error('Load failed:', error);
        showAlert(`${t('alert.project_load_failed')}: ${error.message}`, 'danger');
        return false;
    }
}

function appendSelectedWellsFromProjectPayload(project, selectedWellIds = []) {
    ensureProjectIsReady();
    projectStore.syncActiveWellData();

    const sourceWells = Array.isArray(project?.wells) ? project.wells : [];
    const selectedIds = new Set(
        (Array.isArray(selectedWellIds) ? selectedWellIds : [])
            .map((id) => String(id ?? '').trim())
            .filter(Boolean)
    );

    const targetWells = sourceWells.filter((well) => selectedIds.has(String(well?.id ?? '').trim()));
    let appendedCount = 0;

    targetWells.forEach((well) => {
        const result = projectStore.appendWell({
            name: well?.name,
            data: well?.data,
            config: well?.config
        }, { activate: false, ensureUniqueName: true });
        if (result) {
            appendedCount += 1;
        }
    });

    if (appendedCount > 0) {
        showAlert(t('alert.wells_appended', { count: appendedCount }), 'success');
    }
    return appendedCount;
}

export {
    appendSelectedWellsFromProjectPayload,
    IMPORT_MODE_APPEND_NEW_WELL,
    IMPORT_MODE_REPLACE_ACTIVE,
    importExcelWorkbookFile,
    importProjectJsonContent,
    importProjectJsonFile,
    importTrajectoryCsvFile,
    loadSampleData,
    parseProjectJsonContentToV3,
    parseProjectJsonFileToV3,
    resetData
};
