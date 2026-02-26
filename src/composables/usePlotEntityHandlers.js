import { toValue } from 'vue';
import { dispatchSchematicInteraction } from '@/app/selection.js';

function resolveRows(rowsSource) {
  const rows = toValue(rowsSource);
  return Array.isArray(rows) ? rows : [];
}

function resolveUnitsLabel(unitsLabelSource) {
  const units = toValue(unitsLabelSource);
  return units === undefined || units === null ? '' : String(units);
}

function resolveCanInteract(guard) {
  if (typeof guard !== 'function') return true;
  return guard() !== false;
}

export function usePlotEntityHandlers(options = {}) {
  const {
    type,
    rows,
    unitsLabel,
    buildTooltipModel,
    resolveTooltipMeta,
    showTooltip,
    hideTooltip,
    canInteract
  } = options;

  function handleSelect(index) {
    if (!resolveCanInteract(canInteract)) return;
    if (!Number.isInteger(index)) return;
    dispatchSchematicInteraction('select', { type, id: index });
  }

  function handleHover(index, event) {
    if (resolveCanInteract(canInteract) && Number.isInteger(index)) {
      dispatchSchematicInteraction('hover', { type, id: index, preferPayload: true }, event);
    }

    const rowsValue = resolveRows(rows);
    const row = Number.isInteger(index) ? rowsValue[index] : null;
    const tooltipMeta = typeof resolveTooltipMeta === 'function'
      ? resolveTooltipMeta({
        index,
        row,
        rows: rowsValue,
        event,
        type
      })
      : null;
    const model = typeof buildTooltipModel === 'function'
      ? buildTooltipModel(row, resolveUnitsLabel(unitsLabel), tooltipMeta)
      : null;

    if (typeof showTooltip === 'function') {
      showTooltip(model, event);
    }
  }

  function handleLeave() {
    if (resolveCanInteract(canInteract)) {
      dispatchSchematicInteraction('leave', { type });
    }
    if (typeof hideTooltip === 'function') {
      hideTooltip();
    }
  }

  return {
    handleSelect,
    handleHover,
    handleLeave
  };
}
