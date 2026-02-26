import {
    ACTUATION_CLOSED,
    INTEGRITY_INTACT,
    NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE
} from './constants.js';
import { buildSealByVolumeDefaults } from './utils.js';

const safetyValveDefinition = Object.freeze({
    schema: Object.freeze({
        key: NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE,
        label: 'Safety Valve',
        matchTokens: Object.freeze(['safety valve', 'safety_valve', 'safety-valve']),
        defaults: Object.freeze({
            sealByVolume: Object.freeze(buildSealByVolumeDefaults({
                bore: true,
                annulus: false
            })),
            annularSeal: false,
            boreSeal: true,
            defaultActuationState: ACTUATION_CLOSED,
            defaultIntegrityStatus: INTEGRITY_INTACT
        })
    })
});

export default safetyValveDefinition;

