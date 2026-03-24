import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkspaceProjectActionsSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/workspace/WorkspaceProjectActions.vue'),
    'utf8'
  );
}

describe('WorkspaceProjectActions alert severity contract', () => {
  it('uses canonical warning severity tokens for path-unavailable alerts', () => {
    const source = readWorkspaceProjectActionsSource();

    expect(source).toContain("showAlert(t('alert.project_load_path_unavailable'), 'warning');");
    expect(source).not.toContain("showAlert(t('alert.project_load_path_unavailable'), 'warn');");
  });
});
