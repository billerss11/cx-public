import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readAnalysisWorkspaceSource() {
  return readFileSync(resolve(process.cwd(), 'src/views/AnalysisWorkspace.vue'), 'utf8');
}

describe('AnalysisWorkspace camera well-switch contract', () => {
  it('resets camera views when switching between non-empty active well ids', () => {
    const source = readAnalysisWorkspaceSource();
    const watchContract = /watch\(activeWellId,\s*\(wellId,\s*previousWellId\)\s*=>\s*\{[\s\S]*if \(wellId && previousWellId && wellId !== previousWellId\) \{[\s\S]*viewConfigStore\.resetCameraViewsForWellSwitch\(\);/s;

    expect(source).toContain('watch(activeWellId, (wellId, previousWellId) => {');
    expect(source).toContain('if (wellId && previousWellId && wellId !== previousWellId) {');
    expect(source).toContain('viewConfigStore.resetCameraViewsForWellSwitch();');
    expect(watchContract.test(source)).toBe(true);
  });
});
