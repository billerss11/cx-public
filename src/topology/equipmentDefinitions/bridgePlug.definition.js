import { normalizeSourceVolumeKind } from '@/topology/topologyTypes.js';
import {
    ACTUATION_STATIC,
    INTEGRITY_INTACT,
    NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG
} from './constants.js';
import packerDefinition from './packer.definition.js';
import { buildSealByVolumeDefaults } from './utils.js';

function rewritePackerWarningMessage(message) {
    const source = String(message ?? '').trim();
    if (!source) return source;
    return source.replace(/\bPacker\b/g, 'Bridge plug');
}

function validate(row = {}, context = {}) {
    const warnings = packerDefinition?.validate?.(row, context);
    if (!Array.isArray(warnings)) return [];
    return warnings.map((warning) => ({
        ...warning,
        message: rewritePackerWarningMessage(warning?.message)
    }));
}

function resolveSealContext(row = {}) {
    const resolvedSealNodeKind = normalizeSourceVolumeKind(row?.sealNodeKind);
    const hasResolvedHost = Boolean(resolvedSealNodeKind);
    return {
        defaultSealByVolume: buildSealByVolumeDefaults({
            bore: false,
            annulus: false
        }),
        resolvedBoreSeal: hasResolvedHost,
        resolvedAnnularSeal: false,
        applyAnnularOverride: false
    };
}

const bridgePlugDefinition = Object.freeze({
    schema: Object.freeze({
        key: NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG,
        label: 'Bridge Plug',
        matchTokens: Object.freeze(['bridge plug', 'bridge_plug', 'bridge-plug']),
        defaults: Object.freeze({
            sealByVolume: Object.freeze(buildSealByVolumeDefaults({
                bore: true,
                annulus: false
            })),
            annularSeal: false,
            boreSeal: true,
            defaultActuationState: ACTUATION_STATIC,
            defaultIntegrityStatus: INTEGRITY_INTACT
        })
    }),
    suppressNoSealWarningCodes: packerDefinition?.suppressNoSealWarningCodes ?? [],
    validate,
    resolveSealContext,
    ui: Object.freeze({
        inspectorFields: Object.freeze([])
    })
});

export default bridgePlugDefinition;
