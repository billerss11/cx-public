import { parseOptionalNumber } from '@/utils/general.js';
import { normalizeRowId } from '@/utils/rowIdentity.js';
import { buildPipeReferenceMap, resolvePipeHostReference } from '@/utils/pipeReference.js';
import { normalizeEquipmentAttachHostType } from '@/utils/equipmentAttachReference.js';
import { NODE_KIND_BORE, TOPOLOGY_VOLUME_KINDS, normalizeSourceVolumeKind } from '@/topology/topologyTypes.js';
import { TOPOLOGY_WARNING_CODES, createTopologyValidationWarning } from '@/topology/warningCatalog.js';
import {
    ACTUATION_STATIC,
    INTEGRITY_INTACT,
    NORMALIZED_EQUIPMENT_TYPE_PACKER
} from './constants.js';
import { buildSealByVolumeDefaults } from './utils.js';

const WARNING_MISSING_ATTACH_TARGET = TOPOLOGY_WARNING_CODES.EQUIPMENT_MISSING_ATTACH_TARGET;
const WARNING_UNRESOLVED_ATTACH_TARGET = TOPOLOGY_WARNING_CODES.EQUIPMENT_UNRESOLVED_ATTACH_TARGET;
const WARNING_INVALID_HOST_DEPTH = TOPOLOGY_WARNING_CODES.EQUIPMENT_INVALID_HOST_DEPTH;

const SUPPRESS_NO_SEAL_WARNING_CODES = Object.freeze([
    WARNING_MISSING_ATTACH_TARGET,
    WARNING_UNRESOLVED_ATTACH_TARGET,
    WARNING_INVALID_HOST_DEPTH
]);

function createValidationWarning(code, message, row = {}) {
    return createTopologyValidationWarning(code, message, {
        rowId: String(row?.rowId ?? '').trim() || undefined
    });
}

function resolveBoundaryDepth(row = {}) {
    return parseOptionalNumber(row?.depth ?? row?.md ?? row?.measuredDepth);
}

function isDepthInsideHostRange(depth, top, bottom, epsilon = 1e-6) {
    if (!Number.isFinite(depth) || !Number.isFinite(top) || !Number.isFinite(bottom)) return false;
    const minDepth = Math.min(top, bottom) - epsilon;
    const maxDepth = Math.max(top, bottom) + epsilon;
    return depth >= minDepth && depth <= maxDepth;
}

function resolvePipeReferenceValidationMap(options = {}) {
    if (options?.pipeReferenceMap && typeof options.pipeReferenceMap === 'object') {
        return options.pipeReferenceMap;
    }
    return buildPipeReferenceMap(options?.casingRows, options?.tubingRows);
}

function resolveRuntimeAttachWarning(row = {}) {
    const warningCode = String(row?.attachWarningCode ?? '').trim();
    if (!warningCode || !SUPPRESS_NO_SEAL_WARNING_CODES.includes(warningCode)) return null;

    if (warningCode === WARNING_MISSING_ATTACH_TARGET) {
        return createValidationWarning(
            WARNING_MISSING_ATTACH_TARGET,
            'Packer attach target is required. Select a tubing or casing host row.',
            row
        );
    }
    if (warningCode === WARNING_UNRESOLVED_ATTACH_TARGET) {
        return createValidationWarning(
            WARNING_UNRESOLVED_ATTACH_TARGET,
            'Packer attach target does not resolve to an existing host row.',
            row
        );
    }
    if (warningCode === WARNING_INVALID_HOST_DEPTH) {
        return createValidationWarning(
            WARNING_INVALID_HOST_DEPTH,
            'Packer depth does not overlap the selected attach host depth range.',
            row
        );
    }
    return null;
}

function resolveAttachValidationWarnings(row = {}, options = {}) {
    const warnings = [];
    const runtimeAttachWarning = resolveRuntimeAttachWarning(row);
    if (runtimeAttachWarning) {
        warnings.push(runtimeAttachWarning);
        return warnings;
    }

    const rawHostType = String(row?.attachToHostType ?? '').trim();
    const normalizedHostType = normalizeEquipmentAttachHostType(rawHostType);
    const attachToId = normalizeRowId(row?.attachToId);
    const attachToDisplay = String(row?.attachToDisplay ?? '').trim();
    const attachToRow = String(row?.attachToRow ?? '').trim();
    const hasAttachContractInput = Boolean(rawHostType || attachToId || attachToDisplay || attachToRow);

    if (!hasAttachContractInput) return warnings;

    if (!normalizedHostType || !attachToId) {
        warnings.push(createValidationWarning(
            WARNING_MISSING_ATTACH_TARGET,
            'Packer attach target is required. Select a tubing or casing host row.',
            row
        ));
        return warnings;
    }

    const pipeReferenceMap = resolvePipeReferenceValidationMap(options);
    const resolvedHost = resolvePipeHostReference(
        attachToRow || attachToDisplay,
        pipeReferenceMap,
        {
            preferredId: attachToId,
            hostType: normalizedHostType
        }
    );

    if (!resolvedHost) {
        warnings.push(createValidationWarning(
            WARNING_UNRESOLVED_ATTACH_TARGET,
            'Packer attach target does not resolve to an existing host row.',
            row
        ));
        return warnings;
    }

    const depth = resolveBoundaryDepth(row);
    if (!Number.isFinite(depth)) return warnings;

    const hostTop = Number(resolvedHost?.row?.top);
    const hostBottom = Number(resolvedHost?.row?.bottom);
    if (isDepthInsideHostRange(depth, hostTop, hostBottom)) return warnings;

    warnings.push(createValidationWarning(
        WARNING_INVALID_HOST_DEPTH,
        'Packer depth does not overlap the selected attach host depth range.',
        row
    ));

    return warnings;
}

function resolveSealByVolumeFromResolvedHost(row = {}) {
    const resolvedNodeKind = normalizeSourceVolumeKind(row?.sealNodeKind);
    const sealByVolume = buildSealByVolumeDefaults({
        bore: false,
        annulus: false
    });
    if (!resolvedNodeKind || resolvedNodeKind === NODE_KIND_BORE) return sealByVolume;
    if (!TOPOLOGY_VOLUME_KINDS.includes(resolvedNodeKind)) return sealByVolume;

    sealByVolume[resolvedNodeKind] = true;
    return sealByVolume;
}

function validate(row = {}, context = {}) {
    const options = context?.options ?? {};
    return resolveAttachValidationWarnings(row, options);
}

function resolveSealContext(row = {}) {
    return {
        defaultSealByVolume: resolveSealByVolumeFromResolvedHost(row),
        resolvedBoreSeal: false,
        resolvedAnnularSeal: false,
        applyAnnularOverride: false
    };
}

const packerDefinition = Object.freeze({
    schema: Object.freeze({
        key: NORMALIZED_EQUIPMENT_TYPE_PACKER,
        label: 'Packer',
        matchTokens: Object.freeze(['packer']),
        defaults: Object.freeze({
            sealByVolume: Object.freeze(buildSealByVolumeDefaults({
                bore: false,
                annulus: true
            })),
            annularSeal: true,
            boreSeal: false,
            defaultActuationState: ACTUATION_STATIC,
            defaultIntegrityStatus: INTEGRITY_INTACT
        })
    }),
    suppressNoSealWarningCodes: SUPPRESS_NO_SEAL_WARNING_CODES,
    validate,
    resolveSealContext,
    ui: Object.freeze({
        inspectorFields: Object.freeze([])
    })
});

export default packerDefinition;
