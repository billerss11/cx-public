import {
    ACTUATION_CLOSED,
    INTEGRITY_INTACT,
    NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE
} from '@/equipment/definitions/constants.js';
import { buildSealByVolumeDefaults } from '@/equipment/definitions/utils.js';
import { buildDefaultEquipmentEditorFields } from '@/equipment/editorFieldContracts.js';

const defaults = Object.freeze({
    sealByVolume: Object.freeze(buildSealByVolumeDefaults({
        bore: true,
        annulus: false
    })),
    annularSeal: false,
    boreSeal: true,
    defaultActuationState: ACTUATION_CLOSED,
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

const safetyValveDefinition = Object.freeze({
    schema: Object.freeze({
        key: NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE,
        label: 'Safety Valve',
        matchTokens: Object.freeze(['safety valve', 'safety_valve', 'safety-valve']),
        defaults
    }),
    defaults,
    host: Object.freeze({
        allowedHostTypes: Object.freeze(['tubing']),
        usesAttachReference: false,
        attachmentStrategy: null,
        defaultAttachTargetStrategy: null
    }),
    engineering: Object.freeze({
        resolveConnections: () => []
    }),
    render: Object.freeze({
        family: 'inlineValve'
    }),
    ui: Object.freeze({
        inspectorFields: Object.freeze([]),
        editorFields: buildDefaultEquipmentEditorFields({
            fieldOverrides: {
                'properties.boreSeal': {
                    disclosureLevel: 'core',
                    helperTextKey: 'ui.equipment_editor.help.safety_valve.bore_seal'
                },
                'properties.annularSeal': {
                    disclosureLevel: 'advanced',
                    helperTextKey: 'ui.equipment_editor.help.safety_valve.annular_seal'
                }
            }
        })
    })
});

export default safetyValveDefinition;
