import { computed, unref } from 'vue';
import { MARKER_DEFAULT_COLORS } from '@/constants/index.js';
import { normalizeMarkerType, normalizeMarkerSide } from '@/app/domain.js';
import * as Physics from '@/composables/usePhysics.js';

const EPSILON = 1e-6;
const EQUIPMENT_DEPTH_TOLERANCE = 0.5;

function normalizeEquipmentType(type) {
    const normalized = String(type ?? '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'packer') return 'Packer';
    if (normalized === 'safety valve' || normalized === 'safety_valve' || normalized === 'safety-valve') {
        return 'Safety Valve';
    }
    return String(type ?? '').trim();
}

function resolveEquipmentSourceIndex(row) {
    const sourceIndex = Number(row?.sourceIndex ?? row?.__index);
    return Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : null;
}

function resolveScannerInput(projectData) {
    if (!projectData || typeof projectData !== 'object') {
        return { context: null, markerRows: [] };
    }

    const context = projectData.__physicsContext
        ? projectData
        : Physics.createContext(projectData);
    const markerRows = Array.isArray(projectData.markers)
        ? projectData.markers
        : (Array.isArray(context?.state?.markers) ? context.state.markers : []);

    return { context, markerRows };
}

function resolveMarkerBaseRadius(marker, depth, context) {
    const attachToId = String(marker?.attachToId ?? '').trim();
    const attachToRow = String(marker?.attachToRow ?? '').trim();
    if (attachToId || attachToRow) {
        const target = Physics.resolveCasingReference(
            attachToRow,
            context.casingRefMap,
            context.casingRows,
            attachToId
        );
        if (
            target &&
            Number.isFinite(target.outerRadius) &&
            Physics.isDepthWithinInclusive(depth, Number(target.top), Number(target.bottom))
        ) {
            return target.outerRadius;
        }
    }

    const activeSteel = context.casingRows
        .filter((row) => !row.isOpenHole && Physics.isDepthWithinInclusive(depth, Number(row.top), Number(row.bottom)))
        .sort((a, b) => a.od - b.od);

    return activeSteel.length > 0 ? activeSteel[0].outerRadius : null;
}

function collectActiveMarkers(depth, context, markerRows = []) {
    if (!Array.isArray(markerRows) || markerRows.length === 0) return [];

    const active = [];
    markerRows.forEach((marker, markerIndex) => {
        if (marker?.show === false) return;

        const top = Number(marker?.top);
        const bottom = Number(marker?.bottom);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom < top) return;
        if (!Physics.isDepthWithinInclusive(depth, top, bottom)) return;

        const normalizedType = String(normalizeMarkerType(marker?.type)).toLowerCase();
        const type = normalizedType.includes('leak') ? 'leak' : (normalizedType.includes('perf') ? 'perforation' : null);
        if (!type) return;

        const baseRadius = resolveMarkerBaseRadius(marker, depth, context);
        if (!Number.isFinite(baseRadius) || baseRadius <= 0) return;

        const normalizedSide = String(normalizeMarkerSide(marker?.side)).toLowerCase();
        const left = normalizedSide.includes('left') || normalizedSide.includes('both');
        const right = normalizedSide.includes('right') || normalizedSide.includes('both');
        const showLeft = left || (!left && !right);
        const showRight = right || (!left && !right);

        const color = marker.color || (
            type === 'leak'
                ? (MARKER_DEFAULT_COLORS.leak || MARKER_DEFAULT_COLORS.Leak || 'firebrick')
                : (MARKER_DEFAULT_COLORS.perforation || MARKER_DEFAULT_COLORS.Perforation || 'black')
        );

        const scale = Number(marker.scale);
        active.push({
            markerIndex,
            type,
            color,
            scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
            baseRadius,
            showLeft,
            showRight
        });
    });

    return active;
}

function resolveRenderableLayers(depth, context) {
    const stack = Physics.getStackAtDepth(depth, context);
    if (!Array.isArray(stack)) return [];

    return stack
        .filter((layer) => {
            const inner = Number(layer?.innerRadius);
            const outer = Number(layer?.outerRadius);
            return Number.isFinite(inner) && Number.isFinite(outer) && outer > inner + EPSILON;
        })
        .sort((a, b) => Number(b.outerRadius) - Number(a.outerRadius));
}

function normalizePipeType(pipeType) {
    const normalized = String(pipeType ?? '').trim().toLowerCase();
    if (normalized === 'tubing') return 'tubing';
    if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
        return 'drillString';
    }
    return 'casing';
}

function resolvePipeRowsByType(context, pipeType) {
    const normalized = normalizePipeType(pipeType);
    if (normalized === 'casing') return Array.isArray(context?.casingRows) ? context.casingRows : [];
    if (normalized === 'tubing') return Array.isArray(context?.tubingRows) ? context.tubingRows : [];
    if (normalized === 'drillString') return Array.isArray(context?.drillStringRows) ? context.drillStringRows : [];
    return [];
}

function resolveActivePipeLabelRows(depth, context, layers) {
    if (!context || !Array.isArray(layers)) return [];

    const unique = [];
    const seenPipeKey = new Set();
    layers
        .filter((layer) => layer?.material === 'steel')
        .forEach((layer) => {
            const sourceType = String(layer?.source?.type ?? '').trim().toLowerCase();
            if (sourceType !== 'pipe') return;

            const pipeType = normalizePipeType(layer?.source?.pipeType ?? layer?.pipeType);
            const sourceIndexValue = Number(layer?.source?.sourceIndex ?? layer?.source?.index);
            if (!Number.isInteger(sourceIndexValue) || sourceIndexValue < 0) return;

            const sourceRows = resolvePipeRowsByType(context, pipeType);
            const row = sourceRows[sourceIndexValue];
            if (!row) return;

            const top = Number(row?.top);
            const bottom = Number(row?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Physics.isDepthWithinInclusive(depth, top, bottom)) return;

            const radius = Number(layer?.outerRadius ?? row?.outerRadius ?? (Number(row?.od) / 2));
            if (!Number.isFinite(radius) || radius <= EPSILON) return;

            const pipeKey = `${pipeType}:${sourceIndexValue}`;
            if (seenPipeKey.has(pipeKey)) return;
            seenPipeKey.add(pipeKey);

            unique.push({ row, radius, pipeType });
        });

    return unique;
}

function resolveMaxOuterRadius(layers, markers) {
    const maxStackOuterRadius = (Array.isArray(layers) ? layers : []).reduce((max, layer) => {
        const outer = Number(layer?.outerRadius);
        return Number.isFinite(outer) ? Math.max(max, outer) : max;
    }, 0);
    const maxMarkerRadius = (Array.isArray(markers) ? markers : []).reduce((max, marker) => {
        const radius = Number(marker?.baseRadius);
        return Number.isFinite(radius) ? Math.max(max, radius) : max;
    }, 0);
    return Math.max(maxStackOuterRadius, maxMarkerRadius);
}

function resolveLayerCollections(layers) {
    const materialLayers = Array.isArray(layers) ? layers : [];
    return {
        casings: materialLayers.filter((layer) => layer?.material === 'steel' && String(layer?.pipeType ?? '').toLowerCase() === 'casing'),
        cements: materialLayers.filter((layer) => layer?.material === 'cement'),
        tubings: materialLayers.filter((layer) => layer?.material === 'steel' && String(layer?.pipeType ?? '').toLowerCase() === 'tubing'),
        drillStrings: materialLayers.filter((layer) => layer?.material === 'steel' && String(layer?.pipeType ?? '').toLowerCase() === 'drillstring')
    };
}

function collectActiveEquipment(depth, context) {
    const rows = Array.isArray(context?.equipment) ? context.equipment : [];
    if (rows.length === 0) return [];
    const tubingRows = Array.isArray(context?.tubingRows) ? context.tubingRows : [];
    const casingRows = Array.isArray(context?.casingRows) ? context.casingRows : [];

    return rows
        .map((row) => {
            const equipmentDepth = Number(row?.depth);
            if (!Number.isFinite(equipmentDepth)) return null;
            if (Math.abs(equipmentDepth - depth) > EQUIPMENT_DEPTH_TOLERANCE) return null;

            const sourceIndex = resolveEquipmentSourceIndex(row);
            if (sourceIndex === null) return null;

            const type = normalizeEquipmentType(row?.type);
            if (!type) return null;

            const tubingParentIndex = Number(row?.tubingParentIndex);
            const tubingParentRow = Number.isInteger(tubingParentIndex) && tubingParentIndex >= 0
                ? tubingRows[tubingParentIndex]
                : null;

            const parentCasingIndex = Number(row?.parentCasingIndex);
            const parentCasingRow = Number.isInteger(parentCasingIndex) && parentCasingIndex >= 0
                ? casingRows[parentCasingIndex]
                : null;

            const tubingInnerDiameter = Number(row?.tubingParentID ?? tubingParentRow?.innerDiameter);
            const tubingOuterDiameter = Number(row?.tubingParentOD ?? tubingParentRow?.od);
            const parentInnerDiameter = Number(row?.parentInnerDiameter ?? parentCasingRow?.innerDiameter);
            const resolvedSealInnerDiameter = Number(row?.sealInnerDiameter);
            const resolvedSealOuterDiameter = Number(row?.sealOuterDiameter);
            const hasResolvedSealInnerDiameter = Number.isFinite(resolvedSealInnerDiameter) && resolvedSealInnerDiameter > 0;
            const hasResolvedSealOuterDiameter = Number.isFinite(resolvedSealOuterDiameter) && resolvedSealOuterDiameter > 0;
            const isPacker = type === 'Packer';
            const isExplicitOrphan = Boolean(row?.isOrphaned);
            const packerSealInnerDiameter = hasResolvedSealInnerDiameter
                ? resolvedSealInnerDiameter
                : (isPacker && isExplicitOrphan ? null : tubingOuterDiameter);
            const packerSealOuterDiameter = hasResolvedSealOuterDiameter
                ? resolvedSealOuterDiameter
                : (isPacker && isExplicitOrphan ? null : parentInnerDiameter);
            const hasPackerSealGeometry = Number.isFinite(packerSealInnerDiameter)
                && Number.isFinite(packerSealOuterDiameter)
                && packerSealOuterDiameter > packerSealInnerDiameter + EPSILON;
            const isOrphaned = Boolean(row?.isOrphaned) || (isPacker && !hasPackerSealGeometry);

            return {
                id: `equipment-${sourceIndex}`,
                equipmentIndex: sourceIndex,
                type,
                color: String(row?.color ?? 'black'),
                scale: Number.isFinite(Number(row?.scale)) && Number(row.scale) > 0 ? Number(row.scale) : 1,
                isOrphaned,
                tubingInnerRadius: Number.isFinite(tubingInnerDiameter) && tubingInnerDiameter > 0 ? tubingInnerDiameter / 2 : null,
                tubingOuterRadius: Number.isFinite(tubingOuterDiameter) && tubingOuterDiameter > 0 ? tubingOuterDiameter / 2 : null,
                parentInnerRadius: Number.isFinite(parentInnerDiameter) && parentInnerDiameter > 0 ? parentInnerDiameter / 2 : null,
                sealInnerRadius: Number.isFinite(packerSealInnerDiameter) && packerSealInnerDiameter > 0
                    ? packerSealInnerDiameter / 2
                    : null,
                sealOuterRadius: Number.isFinite(packerSealOuterDiameter) && packerSealOuterDiameter > 0
                    ? packerSealOuterDiameter / 2
                    : null
            };
        })
        .filter(Boolean);
}

export function scanCrossSectionAtDepth(currentDepth, projectData) {
    const depth = Number(currentDepth);
    const { context, markerRows } = resolveScannerInput(projectData);
    const hasPipeRows = Array.isArray(context?.pipeRows) && context.pipeRows.length > 0;
    if (!Number.isFinite(depth) || !hasPipeRows) {
        return {
            depth,
            context,
            layers: [],
            casings: [],
            cements: [],
            tubings: [],
            drillStrings: [],
            markers: [],
            equipment: [],
            pipeLabels: [],
            casingLabels: [],
            maxOuterRadius: 0,
            maxDiameter: 0,
            hasPipeRows: false,
            hasCasingRows: false
        };
    }

    const layers = resolveRenderableLayers(depth, context);
    const markers = collectActiveMarkers(depth, context, markerRows);
    const equipment = collectActiveEquipment(depth, context);
    const pipeLabels = resolveActivePipeLabelRows(depth, context, layers);
    const casingLabels = pipeLabels.filter((entry) => entry?.pipeType === 'casing');
    const maxOuterRadius = resolveMaxOuterRadius(layers, markers);
    const { casings, cements, tubings, drillStrings } = resolveLayerCollections(layers);

    return {
        depth,
        context,
        layers,
        casings,
        cements,
        tubings,
        drillStrings,
        markers,
        equipment,
        pipeLabels,
        casingLabels,
        maxOuterRadius,
        maxDiameter: maxOuterRadius > EPSILON ? maxOuterRadius * 2 : 0,
        hasPipeRows: true,
        hasCasingRows: Array.isArray(context?.casingRows) && context.casingRows.length > 0
    };
}

export function useCrossSectionScanner(depth, projectData) {
    const crossSectionData = computed(() => scanCrossSectionAtDepth(unref(depth), unref(projectData)));
    return { crossSectionData };
}

export default useCrossSectionScanner;
