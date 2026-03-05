import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const contractsRoot = path.join(repoRoot, 'backend', 'contracts');
const manifestPath = path.join(contractsRoot, 'manifest.json');

describe('backend contract artifacts', () => {
  it('contains a manifest with task contract versions', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.schemaVersion).toBe('1.0');
    expect(Object.keys(manifest.tasks)).toContain('las.parse_file');
    expect(Object.keys(manifest.tasks)).toContain('las.get_curve_statistics');
    expect(Object.keys(manifest.tasks)).toContain('las.get_correlation_matrix');
  });

  it('references payload schemas that exist on disk', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    for (const taskConfig of Object.values(manifest.tasks)) {
      const schemaPath = path.join(contractsRoot, taskConfig.payloadSchema);
      expect(existsSync(schemaPath)).toBe(true);
    }
  });
});
