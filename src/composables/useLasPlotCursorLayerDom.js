import { onBeforeUnmount, unref, watch } from 'vue';
import { formatTimeIndexValue } from '@/utils/lasTimeAxis.js';

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function setDisplay(element, visible) {
  if (!element) return;
  element.style.display = visible ? '' : 'none';
}

function formatDepthLabel(depth, unit) {
  if (!Number.isFinite(Number(depth))) return 'Depth: -';
  const numeric = Number(depth);
  const unitSuffix = String(unit || '').trim();
  return `Depth: ${numeric.toFixed(3)}${unitSuffix ? ` ${unitSuffix}` : ''}`;
}

function formatIndexLabel(depth, model) {
  const timeAxis = model?.depthRange?.timeAxis ?? null;
  if (String(timeAxis?.mode || '').trim() === 'clock' && String(timeAxis?.status || '').trim() === 'ready') {
    return `Time: ${formatTimeIndexValue(depth, timeAxis, { includeMilliseconds: true })}`;
  }
  const depthUnit = model?.depthRange?.depthUnit ?? '';
  return formatDepthLabel(depth, depthUnit);
}

function formatCursorValue(row, samplingStep) {
  const mnemonic = String(row?.mnemonic ?? '').trim();
  const unit = String(row?.unit ?? '').trim();
  const value = Number(row?.value);
  const source = String(row?.source ?? 'sampled').trim();
  const status = String(row?.status ?? 'no_data').trim();
  const hasValue = Number.isFinite(value);
  const approximated = source !== 'exact' && Number.isFinite(Number(samplingStep)) && Number(samplingStep) > 1;
  const valueText = hasValue
    ? `${approximated ? '~' : ''}${value.toFixed(3)}`
    : 'N/A';
  const statusTag = source === 'exact'
    ? status.toUpperCase()
    : 'SAMPLED';
  return `${mnemonic}${unit ? ` (${unit})` : ''}: ${valueText} [${statusTag}]`;
}

function buildTooltipText(options) {
  const depth = Number(unref(options.depth));
  const model = unref(options.plotModelRef);
  const rows = Array.isArray(unref(options.rows)) ? unref(options.rows) : [];
  const locked = unref(options.locked) === true;
  const exactPending = unref(options.exactPending) === true;

  const samplingStep = Number(model?.depthRange?.samplingStep);
  const header = formatIndexLabel(depth, model);
  const mode = locked
    ? (exactPending ? 'Mode: LOCKED (resolving exact...)' : 'Mode: LOCKED')
    : (Number.isFinite(samplingStep) && samplingStep > 1
      ? `Mode: HOVER (sampled, step ${samplingStep})`
      : 'Mode: HOVER');

  const body = rows.map((row) => formatCursorValue(row, samplingStep));
  return [header, mode, ...body].join('\n');
}

function applyLineLayout(line, model, y) {
  if (!line || !model) return;
  const left = Number(model?.plotArea?.left);
  const right = Number(model?.plotArea?.right);
  if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(y)) return;

  line.style.left = `${left}px`;
  line.style.width = `${Math.max(0, right - left)}px`;
  line.style.top = `${y}px`;
}

function applyTooltipLayout(tooltip, overlay, x, y, text) {
  if (!tooltip || !overlay) return;

  if (tooltip.textContent !== text) {
    tooltip.textContent = text;
  }

  const overlayWidth = Number(overlay.clientWidth || 0);
  const overlayHeight = Number(overlay.clientHeight || 0);
  const tooltipWidth = Number(tooltip.offsetWidth || 220);
  const tooltipHeight = Number(tooltip.offsetHeight || 80);

  const left = clamp(x + 12, 4, Math.max(4, overlayWidth - tooltipWidth - 4));
  const top = clamp(y + 12, 4, Math.max(4, overlayHeight - tooltipHeight - 4));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function useLasPlotCursorLayerDom(options = {}) {
  let animationFrameId = null;

  function applyLayout() {
    const overlay = unref(options.overlayRef);
    const line = unref(options.lineRef);
    const tooltip = unref(options.tooltipRef);
    const model = unref(options.plotModelRef);
    const visible = unref(options.visible) === true;
    const y = Number(unref(options.y));
    const x = Number(unref(options.x));

    if (!overlay || !line || !tooltip || !model || !visible) {
      setDisplay(line, false);
      setDisplay(tooltip, false);
      return;
    }

    applyLineLayout(line, model, y);
    setDisplay(line, true);

    const tooltipText = buildTooltipText(options);
    applyTooltipLayout(tooltip, overlay, x, y, tooltipText);
    setDisplay(tooltip, true);
  }

  function scheduleLayout() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(() => {
      animationFrameId = null;
      applyLayout();
    });
  }

  function cancelScheduledLayout() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  watch(
    [
      () => unref(options.overlayRef),
      () => unref(options.lineRef),
      () => unref(options.tooltipRef),
      () => unref(options.plotModelRef),
      () => unref(options.visible),
      () => unref(options.x),
      () => unref(options.y),
      () => unref(options.depth),
      () => unref(options.rows),
      () => unref(options.locked),
      () => unref(options.exactPending)
    ],
    scheduleLayout,
    { immediate: true }
  );

  onBeforeUnmount(() => {
    cancelScheduledLayout();
  });

  return {
    refresh: scheduleLayout,
    refreshNow: applyLayout
  };
}

export default useLasPlotCursorLayerDom;
