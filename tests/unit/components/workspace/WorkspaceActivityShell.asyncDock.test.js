import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shellPath = path.resolve(process.cwd(), 'src/components/workspace/WorkspaceActivityShell.vue');
const shellSource = fs.readFileSync(shellPath, 'utf8');

describe('WorkspaceActivityShell async dock loading', () => {
  it('loads bottom dock via async component import', () => {
    expect(shellSource).toContain('defineAsyncComponent');
    expect(shellSource).toContain(
      "const ResizableBottomDock = defineAsyncComponent(() => import('@/components/workspace/ResizableBottomDock.vue'));"
    );
  });

  it('does not statically import ResizableBottomDock', () => {
    expect(shellSource).not.toContain(
      "import ResizableBottomDock from '@/components/workspace/ResizableBottomDock.vue';"
    );
  });
});
