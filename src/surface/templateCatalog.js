import { createRowId } from '@/utils/rowIdentity.js';
import { sortSurfaceChannelKeys, toSurfaceChannelLabel } from '@/surface/model.js';

function createBarrierItem(label) {
    return {
        rowId: createRowId('surface-path-item'),
        itemType: 'barrier',
        label,
        state: {
            actuationState: 'open',
            integrityStatus: 'intact'
        },
        show: true
    };
}

function createPath(channelKey, label, items = []) {
    return {
        rowId: createRowId('surface-path'),
        channelKey,
        label,
        items,
        show: true
    };
}

function createOutlet(channelKey, label, kind, pathId, anchorItemId = null) {
    return {
        rowId: createRowId('surface-outlet'),
        outletKey: String(label ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-'),
        label,
        channelKey,
        kind,
        pathId,
        anchorItemId,
        show: true
    };
}

function buildStandardProductionTree(availableChannels = []) {
    const sortedChannels = sortSurfaceChannelKeys(availableChannels);
    const surfacePaths = [];
    const surfaceOutlets = [];

    if (sortedChannels.includes('TUBING_INNER')) {
        const lowerMasterValve = createBarrierItem('Lower Master Valve');
        const upperMasterValve = createBarrierItem('Upper Master Valve');
        const tubingPath = createPath('TUBING_INNER', 'Tubing Path', [
            lowerMasterValve,
            upperMasterValve
        ]);
        surfacePaths.push(tubingPath);
        surfaceOutlets.push(createOutlet(
            'TUBING_INNER',
            'Production Outlet',
            'production',
            tubingPath.rowId,
            upperMasterValve.rowId
        ));
    }

    sortedChannels
        .filter((channelKey) => channelKey !== 'TUBING_INNER')
        .forEach((channelKey) => {
            const channelLabel = toSurfaceChannelLabel(channelKey);
            const annulusValve = createBarrierItem(`${channelLabel} Valve`);
            const annulusPath = createPath(channelKey, `${channelLabel} Path`, [annulusValve]);
            surfacePaths.push(annulusPath);
            surfaceOutlets.push(createOutlet(
                channelKey,
                `${channelLabel} Outlet`,
                'annulus',
                annulusPath.rowId,
                annulusValve.rowId
            ));
        });

    return {
        surfaceTemplate: {
            templateKey: 'standard-production-tree',
            label: 'Standard Production Tree'
        },
        surfacePaths,
        surfaceTransfers: [],
        surfaceOutlets
    };
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
        surfacePaths: [],
        surfaceTransfers: [],
        surfaceOutlets: []
    };
}

export default {
    createSurfaceModelFromTemplate
};
