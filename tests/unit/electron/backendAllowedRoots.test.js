import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { getDefaultAllowedFileRoots } = require('../../../electron/backendAllowedRoots.js');

describe('backend allowed file roots defaults', () => {
  it('returns all Windows drive roots when platform is win32', () => {
    const value = getDefaultAllowedFileRoots('win32');
    const roots = value.split(';');

    expect(roots).toHaveLength(26);
    expect(roots[0]).toBe('A:\\');
    expect(roots[25]).toBe('Z:\\');
  });

  it('returns slash root for non-Windows platforms', () => {
    expect(getDefaultAllowedFileRoots('linux')).toBe('/');
    expect(getDefaultAllowedFileRoots('darwin')).toBe('/');
  });
});
