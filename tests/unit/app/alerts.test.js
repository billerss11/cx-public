import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showAlert } from '@/app/alerts.js';

describe('showAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="alertContainer"></div>';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('treats warn severity as a warning-styled alias', () => {
    showAlert('Heads up', 'warn');

    const alert = document.querySelector('.app-alert');
    expect(alert).not.toBeNull();
    expect(alert?.classList.contains('is-warning')).toBe(true);
  });
});
