import { describe, expect, it } from 'vitest';
import { resolveHierarchyRenameField } from '@/workspace/hierarchyDomainMeta.js';

describe('resolveHierarchyRenameField', () => {
  it('prefers existing label/name/comment source fields used by tree labels', () => {
    expect(resolveHierarchyRenameField('casing', { label: 'Surface' })).toBe('label');
    expect(resolveHierarchyRenameField('casing', { name: 'Segment A' })).toBe('name');
    expect(resolveHierarchyRenameField('casing', { comment: 'Note' })).toBe('comment');
  });

  it('defaults trajectory rename to comment', () => {
    expect(resolveHierarchyRenameField('trajectory', { md: 1000 })).toBe('comment');
    expect(resolveHierarchyRenameField('trajectory', { comment: 'Station' })).toBe('comment');
  });

  it('falls back to label when no display field is currently populated', () => {
    expect(resolveHierarchyRenameField('lines', { depth: 1000 })).toBe('label');
  });
});
