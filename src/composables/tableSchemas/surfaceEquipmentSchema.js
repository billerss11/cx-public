import {
    SURFACE_CHANNEL_LABELS,
    SURFACE_COMPONENT_TYPES,
    SURFACE_STATUS_OPTIONS,
    SURFACE_CROSSOVER_DIRECTION_OPTIONS,
    sortSurfaceComponentsByChannel
} from '@/surface/model.js';
import { resolveAvailableSurfaceChannels } from '@/surface/channelAvailability.js';

function resolveFallbackTranslator(tf) {
    return typeof tf === 'function'
        ? tf
        : (_key, fallback) => fallback;
}

function buildChannelLabels(domainState) {
    const available = resolveAvailableSurfaceChannels({
        casingData: domainState.casingData,
        tubingData: domainState.tubingData
    });
    return available.map((key) => SURFACE_CHANNEL_LABELS[key] ?? key);
}

function channelKeyToLabel(key) {
    const trimmed = String(key ?? '').trim();
    return SURFACE_CHANNEL_LABELS[trimmed] ?? (trimmed || '');
}

function channelLabelToKey(label) {
    const normalizedLabel = String(label ?? '').trim();
    if (!normalizedLabel) return null;
    const entry = Object.entries(SURFACE_CHANNEL_LABELS).find(([, v]) => v === normalizedLabel);
    return entry ? entry[0] : normalizedLabel;
}

export function buildSurfaceEquipmentTableSchema(domainState, options = {}) {
    const tf = resolveFallbackTranslator(options?.tf);

    return {
        getData: () => domainState.surfaceComponents,
        prepareData: (rows) => {
            const sorted = sortSurfaceComponentsByChannel(rows);
            return sorted.map((row) => ({
                ...row,
                channelDisplay: channelKeyToLabel(row.channelKey),
                connectedToDisplay: channelKeyToLabel(row.connectedTo)
            }));
        },
        mapRowsForStore: (rows) => rows.map((row) => {
            const { channelDisplay, connectedToDisplay, ...rest } = row;
            if (channelDisplay) {
                rest.channelKey = channelLabelToKey(channelDisplay);
            }
            if (connectedToDisplay) {
                rest.connectedTo = channelLabelToKey(connectedToDisplay);
            }
            return rest;
        }),
        colHeaders: () => [
            tf('table.surface_equipment.channel', 'Channel'),
            tf('table.surface_equipment.sequence', 'Seq'),
            tf('table.surface_equipment.label', 'Label'),
            tf('table.surface_equipment.component_type', 'Type'),
            tf('table.surface_equipment.status', 'Status'),
            tf('table.surface_equipment.connected_to', 'Connected To'),
            tf('table.surface_equipment.direction', 'Direction'),
            tf('table.surface_equipment.show', 'Show')
        ],
        columns: () => {
            const channelLabels = buildChannelLabels(domainState);

            return [
                {
                    data: 'channelDisplay',
                    type: 'dropdown',
                    source: [...channelLabels],
                    strict: false,
                    allowInvalid: true,
                    width: 120
                },
                { data: 'sequence', type: 'numeric', width: 50 },
                { data: 'label', type: 'text', width: 180 },
                {
                    data: 'componentType',
                    type: 'dropdown',
                    source: [...SURFACE_COMPONENT_TYPES],
                    strict: true,
                    width: 100
                },
                {
                    data: 'status',
                    type: 'dropdown',
                    source: [...SURFACE_STATUS_OPTIONS],
                    strict: true,
                    width: 120
                },
                {
                    data: 'connectedToDisplay',
                    type: 'dropdown',
                    source: [...channelLabels],
                    strict: false,
                    allowInvalid: true,
                    width: 120
                },
                {
                    data: 'crossoverDirection',
                    type: 'dropdown',
                    source: [...SURFACE_CROSSOVER_DIRECTION_OPTIONS],
                    strict: true,
                    width: 100
                },
                { data: 'show', type: 'checkbox', className: 'htCenter', width: 50 }
            ];
        },
        requiredFields: ['channelDisplay', 'label', 'componentType'],
        numericFields: new Set(['sequence']),
        afterChangeIgnoreSources: ['loadData', 'normalize'],
        cellsExtra: (row, col, prop) => {
            const rows = domainState.surfaceComponents;
            const rowData = Array.isArray(rows) ? rows[row] : null;
            if (!rowData) return {};

            if (prop === 'status' && rowData.componentType === 'outlet') {
                return { readOnly: true, className: 'htDimmed htCenter' };
            }
            if (prop === 'connectedToDisplay' && rowData.componentType !== 'crossover') {
                return { className: 'htDimmed' };
            }
            if (prop === 'crossoverDirection' && rowData.componentType !== 'crossover') {
                return { className: 'htDimmed' };
            }
            return {};
        },
        buildDefaultRow: () => ({
            channelKey: 'TUBING_INNER',
            sequence: 1,
            label: tf('defaults.new_surface_component', 'New Valve'),
            componentType: 'valve',
            status: 'open',
            connectedTo: null,
            crossoverDirection: null,
            show: true
        })
    };
}
