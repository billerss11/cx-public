import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dispatchSchematicInteraction } = vi.hoisted(() => ({
  dispatchSchematicInteraction: vi.fn()
}));

vi.mock('@/app/selection.js', () => ({
  dispatchSchematicInteraction
}));

import { usePlotEntityHandlers } from '@/composables/usePlotEntityHandlers.js';

describe('usePlotEntityHandlers', () => {
  beforeEach(() => {
    dispatchSchematicInteraction.mockReset();
  });

  it('suppresses select dispatch when a finished label drag consumes the click', () => {
    const handlers = usePlotEntityHandlers({
      type: 'line',
      consumeSelectClick: () => true
    });

    handlers.handleSelect(2);

    expect(dispatchSchematicInteraction).not.toHaveBeenCalled();
  });

  it('dispatches select when no drag-finish click needs to be consumed', () => {
    const handlers = usePlotEntityHandlers({
      type: 'line',
      consumeSelectClick: () => false
    });

    handlers.handleSelect(2);

    expect(dispatchSchematicInteraction).toHaveBeenCalledWith('select', { type: 'line', id: 2 });
  });
});
