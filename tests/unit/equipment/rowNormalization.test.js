import { describe, expect, it } from 'vitest';
import {
  normalizeEquipmentRow,
  resolveLegacyEquipmentRowFields
} from '@/equipment/rowNormalization.js';

describe('equipment row normalization', () => {
  it('normalizes legacy rows into canonical type/state/property fields', () => {
    const normalized = normalizeEquipmentRow({
      rowId: 'eq-bridge',
      type: 'Bridge Plug',
      actuationState: 'open',
      integrityStatus: 'intact',
      boreSeal: 'true',
      annularSeal: 'false',
      sealByVolume: {
        ANNULUS_A: true
      }
    });

    expect(normalized.typeKey).toBe('bridge-plug');
    expect(normalized.variantKey).toBeNull();
    expect(normalized.state).toEqual({
      actuationState: 'open',
      integrityStatus: 'intact'
    });
    expect(normalized.properties).toEqual({
      boreSeal: 'true',
      annularSeal: 'false',
      sealByVolume: {
        ANNULUS_A: true
      }
    });
    expect(normalized.type).toBe('Bridge Plug');
  });

  it('hydrates canonical-only rows back into legacy compatibility fields', () => {
    const normalized = normalizeEquipmentRow({
      rowId: 'eq-safety',
      typeKey: 'safety-valve',
      state: {
        actuationState: 'closed',
        integrityStatus: 'intact'
      },
      properties: {
        boreSeal: 'true',
        annularSeal: '',
        sealByVolume: {
          TUBING_INNER: true
        }
      }
    });

    expect(resolveLegacyEquipmentRowFields(normalized)).toEqual({
      type: 'Safety Valve',
      actuationState: 'closed',
      integrityStatus: 'intact',
      boreSeal: 'true',
      annularSeal: '',
      sealByVolume: {
        TUBING_INNER: true
      }
    });
  });

  it('prefers canonical values when legacy and canonical fields disagree', () => {
    const normalized = normalizeEquipmentRow({
      rowId: 'eq-mixed',
      type: 'Packer',
      typeKey: 'bridge-plug',
      actuationState: 'open',
      state: {
        actuationState: 'closed',
        integrityStatus: 'failed_closed'
      },
      boreSeal: 'false',
      properties: {
        boreSeal: 'true',
        annularSeal: 'false',
        sealByVolume: {}
      }
    });

    expect(normalized.typeKey).toBe('bridge-plug');
    expect(normalized.type).toBe('Bridge Plug');
    expect(normalized.state).toEqual({
      actuationState: 'closed',
      integrityStatus: 'failed_closed'
    });
    expect(normalized.properties.boreSeal).toBe('true');
  });
});