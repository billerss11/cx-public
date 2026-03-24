import { normalizeSourceVolumeKind } from '@/topology/topologyTypes.js';
import {
    ACTUATION_STATIC,
    INTEGRITY_INTACT,
    NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG
} from '@/equipment/definitions/constants.js';
import packerDefinition from '@/equipment/definitions/packer.definition.js';
import { buildSealByVolumeDefaults } from '@/equipment/definitions/utils.js';
import { buildDefaultEquipmentEditorFields } from '@/equipment/editorFieldContracts.js';

function rewritePackerWarningMessage(message) {
    const source = String(message ?? '').trim();
    if (!source) return source;
    return source.replace(/\bPacker\b/g, 'Bridge plug');
}

function validate(row = {}, context = {}) {
    const warnings = packerDefinition?.engineering?.validate?.(row, context)
        ?? packerDefinition?.validate?.(row, context);
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

const defaults = Object.freeze({
    sealByVolume: Object.freeze(buildSealByVolumeDefaults({
        bore: true,
        annulus: false
    })),
    annularSeal: false,
    boreSeal: true,
    defaultActuationState: ACTUATION_STATIC,
    defaultIntegrityStatus: INTEGRITY_INTACT,
    state: Object.freeze({
        actuationState: '',
        integrityStatus: ''
    }),
    properties: Object.freeze({
        boreSeal: '',
        annularSeal: '',
        sealByVolume: Object.freeze({})
    })
});

const suppressNoSealWarningCodes = packerDefinition?.engineering?.suppressNoSealWarningCodes
    ?? packerDefinition?.suppressNoSealWarningCodes
    ?? [];

const bridgePlugDefinition = Object.freeze({
    schema: Object.freeze({
        key: NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG,
        label: 'Bridge Plug',
        matchTokens: Object.freeze(['bridge plug', 'bridge_plug', 'bridge-plug']),
        defaults
    }),
    defaults,
    host: Object.freeze({
        allowedHostTypes: Object.freeze(['tubing', 'casing']),
        usesAttachReference: true,
        attachmentStrategy: 'annular-barrier',
        defaultAttachTargetStrategy: 'innermost-overlap'
    }),
    engineering: Object.freeze({
        validate,
        resolveSealContext,
        suppressNoSealWarningCodes,
        resolveConnections: () => []
    }),
    render: Object.freeze({
        family: 'packerLike'
    }),
    ui: Object.freeze({
        inspectorFields: Object.freeze([]),
        editorFields: buildDefaultEquipmentEditorFields({
            omitFields: ['properties.boreSeal', 'properties.annularSeal'],
            fieldOverrides: {
                'properties.sealByVolume': {
                    helperTextKey: 'ui.equipment_editor.help.bridge_plug.seal_by_volume'
                }
            }
        })
    }),

    suppressNoSealWarningCodes,
    validate,
    resolveSealContext
});

export default bridgePlugDefinition;
