import { describe, expect, it, vi } from 'vitest';
import { focusHandsontableRow } from '@/composables/useTableHelpers.js';

describe('focusHandsontableRow', () => {
  it('scrolls and selects the full target row when row exists', () => {
    const instance = {
      countRows: vi.fn(() => 4),
      countCols: vi.fn(() => 6),
      scrollViewportTo: vi.fn(),
      selectCell: vi.fn(),
      render: vi.fn()
    };

    const focused = focusHandsontableRow(instance, 2);

    expect(focused).toBe(true);
    expect(instance.scrollViewportTo).toHaveBeenCalledWith(2, 0);
    expect(instance.selectCell).toHaveBeenCalledWith(2, 0, 2, 5, true, false);
    expect(instance.render).toHaveBeenCalledTimes(1);
  });

  it('returns false when row index is out of range', () => {
    const instance = {
      countRows: vi.fn(() => 2),
      countCols: vi.fn(() => 6),
      scrollViewportTo: vi.fn(),
      selectCell: vi.fn(),
      render: vi.fn()
    };

    const focused = focusHandsontableRow(instance, 8);

    expect(focused).toBe(false);
    expect(instance.scrollViewportTo).not.toHaveBeenCalled();
    expect(instance.selectCell).not.toHaveBeenCalled();
    expect(instance.render).not.toHaveBeenCalled();
  });
});

