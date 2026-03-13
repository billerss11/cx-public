import { describe, expect, it } from 'vitest';
import {
  classifyStoreMutation,
  mergeRenderInvalidation,
  normalizeRenderInvalidation,
  shouldSkipRender
} from '@/app/renderers/invalidation.js';

describe('render invalidation classifier', () => {
  it('marks interaction hover/lock changes as selection-only invalidation', () => {
    const result = classifyStoreMutation({
      section: 'interaction',
      keys: ['hoveredEntity', 'lockedEntity']
    });

    expect(result).toEqual({
      geometryDirty: false,
      stylingDirty: false,
      annotationDirty: false,
      selectionOnly: true,
      skipRender: true
    });
  });

  it('marks geometry sections as full geometry/style/annotation invalidation', () => {
    const result = classifyStoreMutation({
      section: 'equipmentData',
      keys: ['0.depth']
    });

    expect(result.geometryDirty).toBe(true);
    expect(result.stylingDirty).toBe(true);
    expect(result.annotationDirty).toBe(true);
    expect(result.selectionOnly).toBe(false);
  });

  it('skips rendering for analysis-only store sections', () => {
    const result = classifyStoreMutation({
      section: 'topologySources',
      keys: ['0.label']
    });
    expect(shouldSkipRender(result)).toBe(true);
    expect(result.geometryDirty).toBe(false);
    expect(result.stylingDirty).toBe(false);
    expect(result.annotationDirty).toBe(false);
  });

  it('treats equipment edits as geometry invalidation', () => {
    const result = classifyStoreMutation({
      section: 'equipmentData',
      keys: ['0.label']
    });

    expect(shouldSkipRender(result)).toBe(false);
    expect(result.geometryDirty).toBe(true);
    expect(result.stylingDirty).toBe(true);
    expect(result.annotationDirty).toBe(true);
  });

  it('prefers non-selection invalidation when merging selection-only with geometry changes', () => {
    const selectionOnly = normalizeRenderInvalidation({ selectionOnly: true });
    const geometryChange = normalizeRenderInvalidation({
      geometryDirty: true,
      stylingDirty: true,
      annotationDirty: true,
      selectionOnly: false,
      skipRender: false
    });

    const merged = mergeRenderInvalidation(selectionOnly, geometryChange);
    expect(merged.selectionOnly).toBe(false);
    expect(merged.geometryDirty).toBe(true);
    expect(merged.stylingDirty).toBe(true);
    expect(merged.annotationDirty).toBe(true);
    expect(merged.skipRender).toBe(false);
  });
});
