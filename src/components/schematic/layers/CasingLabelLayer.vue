<script setup>
import { computed } from 'vue';
import { LAYOUT_CONSTANTS, PHYSICS_CONSTANTS } from '@/constants/index.js';
import { clamp, estimateCasingID, parseOptionalNumber, resolveXPosition } from '@/utils/general.js';
import { t } from '@/app/i18n.js';
import { isOpenHoleRow } from '@/app/domain.js';

const props = defineProps({
  pipeData: {
    type: Array,
    default: () => []
  },
  xScale: {
    type: Function,
    required: true
  },
  yScale: {
    type: Function,
    required: true
  },
  xHalf: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  unitsLabel: {
    type: String,
    default: 'ft'
  },
  diameterScale: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['select-pipe', 'hover-pipe', 'leave-pipe']);

function normalizePipeType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function serializePipeEntity(pipeType, rowIndex) {
  const normalizedType = normalizePipeType(pipeType);
  const normalizedRowIndex = Number(rowIndex);
  if (!Number.isInteger(normalizedRowIndex) || normalizedRowIndex < 0) return null;
  return `${normalizedType}:${normalizedRowIndex}`;
}

function normalizeCasingRows(rows = [], diameterScale = 1) {
  return rows
    .map((row, index) => {
      const od = parseOptionalNumber(row?.od);
      const top = parseOptionalNumber(row?.top);
      const bottom = parseOptionalNumber(row?.bottom);
      if (!Number.isFinite(od) || od <= 0) return null;
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

      const weight = parseOptionalNumber(row?.weight) ?? 0;
      const overrideId = parseOptionalNumber(row?.idOverride);
      const estimatedId = estimateCasingID(od, weight);
      const finalId = Number.isFinite(overrideId) && overrideId > 0 ? overrideId : estimatedId;
      const safeFinalId = Number.isFinite(finalId) && finalId > 0
        ? Math.min(finalId, od)
        : od * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;

      const toc = parseOptionalNumber(row?.toc);
      const bocRaw = parseOptionalNumber(row?.boc);
      const boc = Number.isFinite(bocRaw) ? bocRaw : bottom;
      const pipeType = normalizePipeType(row?.pipeType);
      const sourceIndex = Number(row?.sourceIndex);
      const rowIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : index;

      return {
        index,
        rowIndex,
        row,
        pipeType,
        od,
        weight,
        grade: String(row?.grade ?? ''),
        top,
        bottom,
        cementTOC: toc,
        cementBOC: boc,
        cementValid: Number.isFinite(toc) && Number.isFinite(boc) && toc < boc,
        isOpenHole: pipeType === 'casing' && isOpenHoleRow(row),
        plotXLeft: -((od * diameterScale) / 2)
      };
    })
    .filter(Boolean);
}

function estimateLineWidth(text, fontSize) {
  return Array.from(String(text ?? '')).reduce((total, ch) => (
    total + (ch.charCodeAt(0) > 255 ? fontSize * 0.95 : fontSize * 0.58)
  ), 0);
}

function buildArrowGeometry(startX, startY, endX, endY) {
  const direction = startX <= endX ? 1 : -1;
  const arrowLength = 6;
  const arrowHalfHeight = 3;
  const backX = endX - (direction * arrowLength);
  return {
    lineX1: startX,
    lineY1: startY,
    lineX2: backX,
    lineY2: endY,
    arrowPoints: [
      `${endX},${endY}`,
      `${backX},${endY - arrowHalfHeight}`,
      `${backX},${endY + arrowHalfHeight}`
    ].join(' ')
  };
}

function resolveLabelFontSize(row, pipeType) {
  const configured = pipeType === 'casing'
    ? Number(row?.casingLabelFontSize)
    : Number(row?.labelFontSize);
  return Number.isFinite(configured) ? clamp(configured, 8, 20) : 11;
}

function buildPipeLabelLines(currentRow, unitsLabel) {
  const lines = [];
  const labelText = String(currentRow.row?.label ?? '').trim();
  if (labelText) lines.push(labelText);

  if (currentRow.isOpenHole) {
    lines.push(`${currentRow.od.toFixed(3)}" ${t('common.open_hole')}`);
    return lines;
  }

  const grade = String(currentRow.grade ?? '').trim() || '?';
  lines.push(`${currentRow.od.toFixed(3)}" ${currentRow.weight.toFixed(1)}# ${grade}`);

  const isCasing = currentRow.pipeType === 'casing';
  if (isCasing && currentRow.cementValid && Number.isFinite(currentRow.cementTOC)) {
    lines.push(t('tooltip.toc_at', {
      value: currentRow.cementTOC.toLocaleString(),
      units: unitsLabel
    }));
  }

  return lines;
}

function resolveAutoLabelDepth(row, allRows) {
  if (row.pipeType !== 'casing') {
    return (row.top + row.bottom) / 2;
  }

  let exposedTop = row.top;
  const largerRow = allRows.find((candidate) => (
    candidate.pipeType === 'casing' &&
    candidate.rowIndex !== row.rowIndex &&
    candidate.od > row.od &&
    Number.isFinite(candidate.bottom) &&
    candidate.bottom > row.top &&
    candidate.bottom < row.bottom
  ));
  if (largerRow) {
    exposedTop = Math.max(exposedTop, largerRow.bottom);
  }

  return (exposedTop + row.bottom) / 2;
}

const labels = computed(() => {
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  const xRange = typeof props.xScale?.range === 'function' ? props.xScale.range() : [];
  const yRange = typeof props.yScale?.range === 'function' ? props.yScale.range() : [];
  const rawLeft = Number(xRange[0]);
  const rawRight = Number(xRange[xRange.length - 1]);
  const rawTop = Number(yRange[0]);
  const rawBottom = Number(yRange[yRange.length - 1]);
  const plotLeft = Math.min(rawLeft, rawRight);
  const plotRight = Math.max(rawLeft, rawRight);
  const plotTop = Math.min(rawTop, rawBottom);
  const plotBottom = Math.max(rawTop, rawBottom);
  if (!Number.isFinite(plotLeft) ||
    !Number.isFinite(plotRight) ||
    !Number.isFinite(plotTop) ||
    !Number.isFinite(plotBottom)) {
    return [];
  }

  const normalizedRows = normalizeCasingRows(props.pipeData, diameterScale)
    .filter((row) => row.pipeType === 'casing' || row.row?.showLabel !== false);
  if (normalizedRows.length === 0) return [];

  const sortedRows = [...normalizedRows].sort((a, b) => b.od - a.od);
  const defaultLabelXData = -props.xHalf * LAYOUT_CONSTANTS.DEFAULT_CASING_LABEL_X_RATIO;
  const labelPaddingX = 8;
  const labelPaddingY = 5;

  return sortedRows.map((currentRow) => {
    const labelFontSize = resolveLabelFontSize(currentRow.row, currentRow.pipeType);
    const lineHeight = labelFontSize + 2;
    const midpoint = resolveAutoLabelDepth(currentRow, sortedRows);
    const lines = buildPipeLabelLines(currentRow, props.unitsLabel);
    if (lines.length === 0) return null;

    const manualDepth = parseOptionalNumber(currentRow.row?.manualLabelDepth);
    const labelDepth = Number.isFinite(manualDepth) ? manualDepth : midpoint;
    const shouldClampToInterval = currentRow.pipeType === 'casing';
    const anchorDepth = shouldClampToInterval
      ? clamp(labelDepth, currentRow.top, currentRow.bottom)
      : labelDepth;
    const labelCenterY = clamp(
      props.yScale(labelDepth),
      plotTop + 10,
      Math.max(plotTop + 10, plotBottom - 10)
    );
    const arrowTargetY = clamp(props.yScale(anchorDepth), plotTop, plotBottom);

    const manualX = resolveXPosition(currentRow.row?.labelXPos, props.xHalf);
    const labelXData = manualX !== null && manualX !== undefined ? manualX : defaultLabelXData;
    const labelCenterX = props.xScale(labelXData);

    const maxLineWidth = lines.reduce((max, line) => Math.max(max, estimateLineWidth(line, labelFontSize)), 0);
    const boxWidth = clamp(maxLineWidth + labelPaddingX * 2, 100, 260);
    const boxHeight = lines.length * lineHeight + labelPaddingY * 2;
    const minBoxX = plotLeft + 5;
    const maxBoxX = Math.max(minBoxX, plotRight - boxWidth - 5);
    const boxX = clamp(labelCenterX - boxWidth / 2, minBoxX, maxBoxX);
    const minBoxY = plotTop;
    const maxBoxY = Math.max(minBoxY, plotBottom - boxHeight);
    const boxY = clamp(labelCenterY - boxHeight / 2, minBoxY, maxBoxY);

    const adjustedCenterX = boxX + boxWidth / 2;
    const adjustedCenterY = boxY + boxHeight / 2;
    const arrowTargetX = props.xScale(currentRow.plotXLeft);
    const labelIsLeft = adjustedCenterX <= arrowTargetX;
    const arrowStartX = labelIsLeft ? boxX + boxWidth : boxX;
    const arrow = buildArrowGeometry(arrowStartX, adjustedCenterY, arrowTargetX, arrowTargetY);
    const pipeKey = serializePipeEntity(currentRow.pipeType, currentRow.rowIndex);
    if (!pipeKey) return null;

    const textLines = lines.map((line, lineIndex) => ({
      id: `${currentRow.pipeType}-${currentRow.rowIndex}-${lineIndex}`,
      text: line,
      x: boxX + boxWidth / 2,
      y: boxY + labelPaddingY + (lineIndex + 0.7) * lineHeight
    }));

    return {
      id: `pipe-label-${currentRow.pipeType}-${currentRow.rowIndex}`,
      pipeType: currentRow.pipeType,
      rowIndex: currentRow.rowIndex,
      pipeKey,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      fontSize: labelFontSize,
      textLines,
      arrow
    };
  }).filter(Boolean);
});
</script>

<template>
  <g class="casing-label-layer">
    <g
      v-for="label in labels"
      :key="label.id"
      class="casing-label-layer__group"
      :data-pipe-key="label.pipeKey"
      :data-casing-index="label.pipeType === 'casing' ? label.rowIndex : null"
      @click="emit('select-pipe', { pipeType: label.pipeType, rowIndex: label.rowIndex })"
      @mousemove="emit('hover-pipe', { pipeType: label.pipeType, rowIndex: label.rowIndex }, $event)"
      @mouseleave="emit('leave-pipe', { pipeType: label.pipeType, rowIndex: label.rowIndex })"
    >
      <line
        class="casing-label-layer__arrow-line"
        :x1="label.arrow.lineX1"
        :y1="label.arrow.lineY1"
        :x2="label.arrow.lineX2"
        :y2="label.arrow.lineY2"
      />
      <polygon class="casing-label-layer__arrow-head" :points="label.arrow.arrowPoints" />

      <rect
        class="casing-label-layer__box"
        :x="label.boxX"
        :y="label.boxY"
        :width="label.boxWidth"
        :height="label.boxHeight"
        :rx="5"
      />

      <text
        v-for="line in label.textLines"
        :key="line.id"
        class="casing-label-layer__text"
        :x="line.x"
        :y="line.y"
        text-anchor="middle"
        :style="{ fontSize: `${label.fontSize}px` }"
      >
        {{ line.text }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.casing-label-layer__group {
  pointer-events: auto;
  cursor: pointer;
}

.casing-label-layer__arrow-line {
  stroke: var(--color-ink-strong);
  stroke-width: 1.5;
}

.casing-label-layer__arrow-head {
  fill: var(--color-ink-strong);
  stroke: none;
}

.casing-label-layer__box {
  fill: var(--color-cross-core-fill);
  stroke: var(--color-ink-strong);
  stroke-width: 1.5;
}

.casing-label-layer__text {
  fill: var(--color-ink-strong);
  font-weight: 700;
  dominant-baseline: alphabetic;
}
</style>
