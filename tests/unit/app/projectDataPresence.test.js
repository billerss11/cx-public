import { describe, expect, it } from 'vitest';
import {
  PROJECT_DATA_CONTENT_ARRAY_KEYS,
  PROJECT_DATA_CONTENT_OBJECT_KEYS,
  hasProjectDataContent
} from '@/app/projectDataPresence.js';

describe('projectDataPresence', () => {
  it('includes v7 surface array datasets in the shared content-key contract', () => {
    expect(PROJECT_DATA_CONTENT_ARRAY_KEYS).toContain('surfacePaths');
    expect(PROJECT_DATA_CONTENT_ARRAY_KEYS).toContain('surfaceTransfers');
    expect(PROJECT_DATA_CONTENT_ARRAY_KEYS).toContain('surfaceOutlets');
  });

  it('includes v7 surface object datasets in the shared content-key contract', () => {
    expect(PROJECT_DATA_CONTENT_OBJECT_KEYS).toContain('surfaceTemplate');
  });

  it('treats non-empty surface array data as existing project content', () => {
    expect(hasProjectDataContent({
      surfacePaths: [{ rowId: 'surface-path-1' }]
    })).toBe(true);
  });

  it('treats non-empty surface object data as existing project content', () => {
    expect(hasProjectDataContent({
      surfaceTemplate: {
        templateId: 'surface-template-1'
      }
    })).toBe(true);
  });

  it('treats empty project data as empty', () => {
    expect(hasProjectDataContent({
      surfacePaths: [],
      surfaceTransfers: [],
      surfaceOutlets: [],
      surfaceTemplate: {}
    })).toBe(false);
  });
});
