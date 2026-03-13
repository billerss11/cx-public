import { describe, expect, it } from 'vitest';
import {
  createEquipmentDefinitionRegistry,
  normalizeEquipmentTypeKey,
  resolveEquipmentTypeLabel,
  resolveEquipmentDefinition,
  resolveEquipmentDefinitionByKey,
  resolveEquipmentEditorFields,
  resolveEquipmentHostConfig,
  resolveEquipmentInspectorFields,
  resolveEquipmentRenderConfig,
  resolveEquipmentTypeDefaults,
  resolveEquipmentTypeSealByVolume
} from '@/topology/equipmentDefinitions/index.js';

describe('equipment definition registry', () => {
  it('normalizes known equipment labels to canonical keys', () => {
    expect(normalizeEquipmentTypeKey('Packer')).toBe('packer');
    expect(normalizeEquipmentTypeKey('Safety valve')).toBe('safety-valve');
    expect(normalizeEquipmentTypeKey('safety_valve')).toBe('safety-valve');
    expect(normalizeEquipmentTypeKey('Bridge Plug')).toBe('bridge-plug');
  });

  it('resolves canonical equipment labels from type variants', () => {
    expect(resolveEquipmentTypeLabel('packer')).toBe('Packer');
    expect(resolveEquipmentTypeLabel('bridge_plug')).toBe('Bridge Plug');
    expect(resolveEquipmentTypeLabel('safety-valve')).toBe('Safety Valve');
    expect(resolveEquipmentTypeLabel('Custom Tool')).toBe('Custom Tool');
    expect(resolveEquipmentTypeLabel('')).toBe('');
  });

  it('resolves definitions with schema and hook contracts', () => {
    const packer = resolveEquipmentDefinition('Packer');
    expect(packer?.schema?.key).toBe('packer');
    expect(typeof packer?.validate).toBe('function');
    expect(typeof packer?.resolveSealContext).toBe('function');

    const safetyValve = resolveEquipmentDefinitionByKey('safety-valve');
    expect(safetyValve?.schema?.label).toBe('Safety Valve');
  });

  it('resolves defaults and seal-by-volume maps from definitions', () => {
    const defaults = resolveEquipmentTypeDefaults('Safety Valve');
    expect(defaults?.defaultActuationState).toBe('closed');
    expect(defaults?.defaultIntegrityStatus).toBe('intact');

    const sealByVolume = resolveEquipmentTypeSealByVolume('Safety Valve');
    expect(sealByVolume?.BORE).toBe(true);
    expect(sealByVolume?.ANNULUS_A).toBe(false);

    const bridgeDefaults = resolveEquipmentTypeDefaults('Bridge Plug');
    expect(bridgeDefaults?.defaultActuationState).toBe('static');
    expect(bridgeDefaults?.defaultIntegrityStatus).toBe('intact');

    const bridgeSealByVolume = resolveEquipmentTypeSealByVolume('Bridge Plug');
    expect(bridgeSealByVolume?.BORE).toBe(true);
    expect(bridgeSealByVolume?.ANNULUS_A).toBe(false);
  });

  it('returns null defaults for unknown definitions', () => {
    expect(resolveEquipmentTypeDefaults('Unknown Tool')).toBe(null);
    expect(resolveEquipmentTypeSealByVolume('Unknown Tool')).toBe(null);
  });

  it('resolves optional inspector field extensions safely', () => {
    expect(resolveEquipmentInspectorFields('Packer')).toEqual([]);
    expect(resolveEquipmentInspectorFields('Unknown Tool')).toEqual([]);
  });

  it('resolves render and host metadata from the shared contract', () => {
    expect(resolveEquipmentRenderConfig('Bridge Plug')?.family).toBe('packerLike');
    expect(resolveEquipmentRenderConfig('Safety Valve')?.family).toBe('inlineValve');

    expect(resolveEquipmentHostConfig('Packer')?.allowedHostTypes).toEqual(['tubing', 'casing']);
    expect(resolveEquipmentHostConfig('Safety Valve')?.allowedHostTypes).toEqual(['tubing']);
  });

  it('resolves definition-driven editor field extensions safely', () => {
    const editorFields = resolveEquipmentEditorFields('Packer', {
      rowData: {
        type: 'Packer'
      }
    });

    expect(editorFields.some((field) => field.field === 'state.actuationState')).toBe(true);
    expect(editorFields.some((field) => field.field === 'state.integrityStatus')).toBe(true);
    expect(editorFields.some((field) => field.field === 'properties.boreSeal')).toBe(true);
    expect(editorFields.some((field) => field.field === 'properties.annularSeal')).toBe(true);
  });

  it('supports isolated test registries with injected definitions', () => {
    const registry = createEquipmentDefinitionRegistry([
      Object.freeze({
        schema: Object.freeze({
          key: 'test-inline-valve',
          label: 'Test Inline Valve',
          matchTokens: Object.freeze(['test inline valve'])
        }),
        defaults: Object.freeze({
          state: Object.freeze({}),
          properties: Object.freeze({})
        }),
        host: Object.freeze({
          allowedHostTypes: Object.freeze(['tubing'])
        }),
        engineering: Object.freeze({}),
        render: Object.freeze({
          family: 'inlineValve'
        }),
        ui: Object.freeze({
          inspectorFields: Object.freeze([]),
          editorFields: Object.freeze([])
        })
      })
    ]);

    expect(registry.normalizeTypeKey('Test Inline Valve')).toBe('test-inline-valve');
    expect(registry.resolveDefinition('test-inline-valve')?.render?.family).toBe('inlineValve');
  });
});
