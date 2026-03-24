import { createRowId } from '@/utils/rowIdentity.js';
import { sortSurfaceChannelKeys, toSurfaceChannelLabel } from '@/surface/model.js';

function createComponent(channelKey, sequence, componentType, label, options = {}) {
    return {
        rowId: createRowId('surface-component'),
        channelKey,
        sequence,
        componentType,
        label,
        status: options.status ?? null,
        connectedTo: options.connectedTo ?? null,
        crossoverDirection: options.crossoverDirection ?? null,
        show: true
    };
}

function buildStandardProductionTree(availableChannels = []) {
    const sortedChannels = sortSurfaceChannelKeys(availableChannels);
    const components = [];

    if (sortedChannels.includes('TUBING_INNER')) {
        components.push(createComponent('TUBING_INNER', 1, 'valve', 'Lower Master Valve', { status: 'open' }));
        components.push(createComponent('TUBING_INNER', 2, 'valve', 'Upper Master Valve', { status: 'open' }));
        components.push(createComponent('TUBING_INNER', 3, 'outlet', 'Production Outlet'));
    }

    sortedChannels
        .filter((channelKey) => channelKey !== 'TUBING_INNER')
        .forEach((channelKey) => {
            const channelLabel = toSurfaceChannelLabel(channelKey);
            components.push(createComponent(channelKey, 1, 'valve', `${channelLabel} Valve`, { status: 'closed' }));
            components.push(createComponent(channelKey, 2, 'outlet', `${channelLabel} Outlet`));
        });

    return {
        surfaceTemplate: {
            templateKey: 'standard-production-tree',
            label: 'Standard Production Tree'
        },
        surfaceComponents: components
    };
}

export function buildDefaultSurfaceComponents(availableChannels = []) {
    return buildStandardProductionTree(availableChannels).surfaceComponents;
}

export function createSurfaceModelFromTemplate(options = {}) {
    const templateKey = String(options?.templateKey ?? '').trim();
    const availableChannels = Array.isArray(options?.availableChannels) ? options.availableChannels : [];
    if (templateKey === 'standard-production-tree') {
        return buildStandardProductionTree(availableChannels);
    }

    return {
        surfaceTemplate: {
            templateKey: templateKey || 'custom',
            label: 'Custom Surface Model'
        },
        surfaceComponents: []
    };
}

export default {
    createSurfaceModelFromTemplate,
    buildDefaultSurfaceComponents
};
