import { describe, expect, it } from 'vitest';
import { resolveEquipmentRulePresentation } from '@/topology/equipmentRules.js';

describe('equipment rule presentation helper', () => {
  it('summarizes default packer behavior as annulus-focused at the resolved host interval', () => {
    const presentation = resolveEquipmentRulePresentation({
      rowId: 'eq-packer',
      type: 'Packer',
      depth: 1200,
      attachToHostType: 'tubing',
      attachToId: 'tbg-1',
      sealNodeKind: 'ANNULUS_A',
      show: true
    }, {
      tubingRows: [{ rowId: 'tbg-1', top: 0, bottom: 3000 }]
    });

    expect(presentation.effectiveActuationState).toBe('static');
    expect(presentation.effectiveIntegrityStatus).toBe('intact');
    expect(presentation.summary.sealedVolumeKeys).toEqual(['ANNULUS_A']);
    expect(presentation.summary.primaryBehavior).toBe('blocking');
    expect(presentation.fieldBehavior['properties.annularSeal']).toMatchObject({
      emphasis: 'primary',
      isRelevant: true
    });
    expect(presentation.fieldBehavior['properties.boreSeal']).toMatchObject({
      emphasis: 'advanced',
      isRelevant: true
    });
    expect(presentation.summary.notes).toContain('attach_resolution_controls_annulus_target');
  });

  it('summarizes default safety valve behavior as bore-focused', () => {
    const presentation = resolveEquipmentRulePresentation({
      rowId: 'eq-valve',
      type: 'Safety Valve',
      depth: 1200,
      show: true
    });

    expect(presentation.summary.sealedVolumeKeys).toEqual(['BORE']);
    expect(presentation.summary.primaryBehavior).toBe('blocking');
    expect(presentation.fieldBehavior['properties.boreSeal']).toMatchObject({
      emphasis: 'primary',
      isRelevant: true
    });
    expect(presentation.fieldBehavior['properties.annularSeal']).toMatchObject({
      emphasis: 'advanced',
      isRelevant: true
    });
  });

  it('marks generic annular override as superseded when a per-volume override takes priority', () => {
    const presentation = resolveEquipmentRulePresentation({
      rowId: 'eq-volume-override',
      type: 'Packer',
      depth: 1200,
      attachToHostType: 'casing',
      attachToId: 'csg-1',
      sealNodeKind: 'ANNULUS_B',
      properties: {
        boreSeal: '',
        annularSeal: 'false',
        sealByVolume: {
          ANNULUS_B: true
        }
      },
      show: true
    }, {
      casingRows: [{ rowId: 'csg-1', top: 0, bottom: 3000 }]
    });

    expect(presentation.sealBehaviorByVolume.ANNULUS_B).toMatchObject({
      hasSealPath: true,
      source: 'per_volume_override'
    });
    expect(presentation.fieldBehavior['properties.annularSeal']).toMatchObject({
      hasSupersededVolumes: true,
      supersededVolumeKeys: ['ANNULUS_B']
    });
    expect(presentation.summary.notes).toContain('per_volume_override_supersedes_generic_annular');
  });

  it('reports leaking/open communication when integrity overrides a closed actuation state', () => {
    const presentation = resolveEquipmentRulePresentation({
      rowId: 'eq-leaking',
      type: 'Safety Valve',
      depth: 1200,
      state: {
        actuationState: 'closed',
        integrityStatus: 'leaking'
      },
      show: true
    });

    expect(presentation.effectiveActuationState).toBe('closed');
    expect(presentation.effectiveIntegrityStatus).toBe('leaking');
    expect(presentation.summary.primaryBehavior).toBe('communicating');
    expect(presentation.summary.behaviorState).toBe('leaking');
  });

  it('reports blocked behavior when integrity overrides an open actuation state to failed closed', () => {
    const presentation = resolveEquipmentRulePresentation({
      rowId: 'eq-failed-closed',
      type: 'Safety Valve',
      depth: 1200,
      state: {
        actuationState: 'open',
        integrityStatus: 'failed_closed'
      },
      show: true
    });

    expect(presentation.summary.primaryBehavior).toBe('blocking');
    expect(presentation.summary.behaviorState).toBe('failed_closed');
  });

  it('marks bridge plug as bore-focused and keeps annular controls secondary', () => {
    const presentation = resolveEquipmentRulePresentation({
      rowId: 'eq-bridge',
      type: 'Bridge Plug',
      depth: 1200,
      attachToHostType: 'tubing',
      attachToId: 'tbg-1',
      sealNodeKind: 'ANNULUS_A',
      show: true
    }, {
      tubingRows: [{ rowId: 'tbg-1', top: 0, bottom: 3000 }]
    });

    expect(presentation.summary.sealedVolumeKeys).toEqual(['BORE']);
    expect(presentation.summary.notes).toContain('bridge_plug_is_bore_focused');
    expect(presentation.fieldBehavior['properties.boreSeal']).toMatchObject({
      emphasis: 'read_only',
      isRelevant: false
    });
    expect(presentation.fieldBehavior['properties.annularSeal']).toMatchObject({
      emphasis: 'advanced',
      isRelevant: false
    });
  });
});
