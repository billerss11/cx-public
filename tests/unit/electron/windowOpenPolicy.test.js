import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  resolveWindowOpenHandlerAction
} = require('../../../electron/windowOpenPolicy.js');

describe('window open policy', () => {
  it('allows in-app blank print windows', () => {
    expect(resolveWindowOpenHandlerAction('about:blank')).toEqual({
      action: 'allow'
    });
  });

  it('denies and externalizes non-blank links', () => {
    expect(resolveWindowOpenHandlerAction('https://example.com/docs')).toEqual({
      action: 'deny',
      openExternal: true
    });
  });
});
