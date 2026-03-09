import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mainLayoutPath = path.resolve(process.cwd(), 'src/layouts/MainLayout.vue');
const mainLayoutSource = fs.readFileSync(mainLayoutPath, 'utf8');

describe('MainLayout async workspace strategy', () => {
  it('loads non-default workspaces via defineAsyncComponent imports', () => {
    expect(mainLayoutSource).toContain('defineAsyncComponent');
    expect(mainLayoutSource).toContain("() => import('@/views/AnalysisWorkspace.vue')");
    expect(mainLayoutSource).toContain("() => import('@/views/LasWorkspace.vue')");
    expect(mainLayoutSource).toContain("() => import('@/views/SettingsWorkspace.vue')");
  });

  it('keeps design workspace eagerly loaded', () => {
    expect(mainLayoutSource).toContain("import DesignWorkspace from '@/views/DesignWorkspace.vue';");
  });

  it('does not statically import analysis, LAS, or settings workspaces', () => {
    expect(mainLayoutSource).not.toContain("import AnalysisWorkspace from '@/views/AnalysisWorkspace.vue';");
    expect(mainLayoutSource).not.toContain("import LasWorkspace from '@/views/LasWorkspace.vue';");
    expect(mainLayoutSource).not.toContain("import SettingsWorkspace from '@/views/SettingsWorkspace.vue';");
  });
});
