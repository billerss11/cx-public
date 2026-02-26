export const NORMALIZED_EQUIPMENT_TYPE_PACKER = 'packer';
export const NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE = 'safety-valve';

export const ACTUATION_STATIC = 'static';
export const ACTUATION_OPEN = 'open';
export const ACTUATION_CLOSED = 'closed';

export const INTEGRITY_INTACT = 'intact';
export const INTEGRITY_FAILED_OPEN = 'failed_open';
export const INTEGRITY_FAILED_CLOSED = 'failed_closed';
export const INTEGRITY_LEAKING = 'leaking';

export const EQUIPMENT_ACTUATION_STATE_OPTIONS = Object.freeze([
    '',
    ACTUATION_STATIC,
    ACTUATION_OPEN,
    ACTUATION_CLOSED
]);

export const EQUIPMENT_INTEGRITY_STATUS_OPTIONS = Object.freeze([
    '',
    INTEGRITY_INTACT,
    INTEGRITY_FAILED_OPEN,
    INTEGRITY_FAILED_CLOSED,
    INTEGRITY_LEAKING
]);

export const EQUIPMENT_SEAL_OVERRIDE_OPTIONS = Object.freeze(['', 'true', 'false']);

