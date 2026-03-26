<script setup>
import { computed } from 'vue';
import {
  clamp,
  formatDepthValue,
  getHorizontalAnchor,
  getLineStyle,
  parseOptionalNumber,
  resolveXPosition,
  wrapTextToLines
} from '@/utils/general.js';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';
import {
  applyDeterministicSmartLabelLayout,
  resolveSmartLabelAutoScale,
  resolveSmartLabelFontSize
} from '@/utils/smartLabels.js';

const props = defineProps({
  lines: {
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
  verticalLabelScale: {
    type: Number,
    default: 1
  },
  smartLabelsEnabled: {
    type: Boolean,
    default: true
  },
  unitsLabel: {
    type: String,
    default: 'ft'
  },
  dragPreviewId: {
    type: String,
    default: null
  },
  dragPreviewOffset: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
});

const emit = defineEmits(['select-line', 'hover-line', 'leave-line', 'start-label-drag']);

function resolveScaleRange(scale) {
  const domain = typeof scale?.domain === 'function' ? scale.domain() : [];
  const start = Number(domain[0]);
  const end = Number(domain[domain.length - 1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    min: Math.min(start, end),
    max: Math.max(start, end)
  };
}

function resolvePreviewTransform(id) {
  if (String(id ?? '').trim() !== String(props.dragPreviewId ?? '').trim()) return null;
  const offsetY = Number(props.dragPreviewOffset?.y);
  if (!Number.isFinite(offsetY)) return null;
  return `translate(0 ${offsetY})`;
}

function handleLabelPointerDown(segment, event) {
  const rowId = String(segment?.rowId ?? '').trim();
  if (!rowId) return;
  emit('start-label-drag', {
    previewId: segment.id,
    entityType: 'line',
    dragKind: 'depth-shift',
    rowId,
    centerX: segment.boxX + (segment.boxWidth / 2),
    centerY: segment.y,
    entries: [
      {
        field: 'depth',
        value: segment.depthValue,
        min: resolveScaleRange(props.yScale)?.min,
        max: resolveScaleRange(props.yScale)?.max
      },
      ...(Number.isFinite(segment.manualLabelDepth)
        ? [{
          field: 'manualLabelDepth',
          value: segment.manualLabelDepth,
          min: resolveScaleRange(props.yScale)?.min,
          max: resolveScaleRange(props.yScale)?.max
        }]
        : [])
    ]
  }, event);
}

const lineSegments = computed(() => {
  const rows = Array.isArray(props.lines) ? props.lines : [];
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

  const smartLabelsEnabled = props.smartLabelsEnabled === true;
  const verticalLabelScale = Number.isFinite(Number(props.verticalLabelScale))
    ? Math.max(0.1, Number(props.verticalLabelScale))
    : 1;
  const visibleRows = rows.filter((row) => row?.show !== false);
  const smartAutoScale = smartLabelsEnabled
    ? resolveSmartLabelAutoScale({
      totalPreferredLabelHeight: visibleRows.length * 24,
      availableTrackHeight: Math.max(1, plotBottom - plotTop)
    })
    : 1;

  const segments = rows
    .map((line, index) => {
      if (line?.show === false) return null;

      const depthValue = Number(line?.depth);
      if (!Number.isFinite(depthValue)) return null;

      const fullW = props.xHalf * LAYOUT_CONSTANTS.DEFAULT_HORIZONTAL_LINE_HALF_WIDTH_RATIO;
      const lineColor = line.color || 'var(--color-default-line)';
      const fontColor = line.fontColor || lineColor;
      const fontSizeRaw = Number(line.fontSize);
      const baseFontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 11;
      const fontSize = resolveSmartLabelFontSize(baseFontSize, {
        manualScale: verticalLabelScale,
        autoScale: smartLabelsEnabled ? smartAutoScale : 1,
        minPx: 8,
        maxPx: 40
      });

      const depthText = `${formatDepthValue(depthValue)} ${props.unitsLabel}`;
      const displayText = line.label ? `${line.label} ${depthText}` : depthText;
      const manualLabelX = resolveXPosition(line.labelXPos, props.xHalf);
      const manualLabelDepth = parseOptionalNumber(line?.manualLabelDepth);
      const defaultLabelX = smartLabelsEnabled
        ? 0
        : (props.xHalf * LAYOUT_CONSTANTS.DEFAULT_RIGHT_LABEL_X_RATIO);
      const labelXData = manualLabelX !== null && manualLabelX !== undefined ? manualLabelX : defaultLabelX;
      let textAnchor = getHorizontalAnchor(
        labelXData,
        props.xHalf,
        smartLabelsEnabled ? 'middle' : 'start'
      );
      const labelXPixelRaw = props.xScale(labelXData);
      const labelXPixel = clamp(labelXPixelRaw, plotLeft + 10, plotRight - 10);
      const maxLabelWidth = 220;
      const wrappedLines = wrapTextToLines(displayText, maxLabelWidth, fontSize);
      const lineHeight = fontSize + 6;
      const labelHeight = wrappedLines.length * lineHeight + 12;
      const estimatedWidth = Math.max(
        80,
        Math.min(maxLabelWidth, Math.max(...wrappedLines.map((text) => text.length)) * fontSize * 0.6 + 16)
      );

      let boxXPixel;
      if (textAnchor === 'end') {
        boxXPixel = labelXPixel - estimatedWidth + 5;
      } else if (textAnchor === 'middle') {
        boxXPixel = labelXPixel - estimatedWidth / 2;
      } else {
        boxXPixel = labelXPixel - 5;
        textAnchor = 'start';
      }
      boxXPixel = clamp(boxXPixel, plotLeft + 5, plotRight - estimatedWidth - 5);
      const labelDepthValue = Number.isFinite(manualLabelDepth) ? manualLabelDepth : depthValue;
      const labelY = clamp(props.yScale(labelDepthValue), plotTop + 10, plotBottom - 10);

      const textX = (() => {
        if (textAnchor === 'end') return boxXPixel + estimatedWidth - 6;
        if (textAnchor === 'middle') return boxXPixel + estimatedWidth / 2;
        return boxXPixel + 6;
      })();

      const firstLineOffset = -((wrappedLines.length - 1) * lineHeight) / 2;
      const textLines = wrappedLines.map((lineText, lineIndex) => ({
        id: `line-${index}-label-${lineIndex}`,
        text: lineText,
        x: textX,
        y: labelY + (lineIndex === 0 ? firstLineOffset : firstLineOffset + lineIndex * lineHeight),
        fontSize
      }));

      return {
        id: `line-${index}`,
        index,
        depthValue,
        manualLabelDepth,
        lineColor,
        fontColor,
        lineStyle: getLineStyle(line.lineStyle),
        x1: props.xScale(-fullW),
        x2: props.xScale(fullW),
        y: clamp(props.yScale(depthValue), plotTop, plotBottom),
        rowId: String(line?.rowId ?? '').trim() || null,
        boxX: boxXPixel,
        boxY: labelY - labelHeight / 2,
        boxWidth: estimatedWidth,
        boxHeight: labelHeight,
        textAnchor,
        fontSize,
        side: textAnchor === 'start' ? 'right' : (textAnchor === 'end' ? 'left' : 'center'),
        isPositionPinned: (manualLabelX !== null && manualLabelX !== undefined) || Number.isFinite(manualLabelDepth),
        textLines
      };
    })
    .filter(Boolean);

  if (!smartLabelsEnabled || segments.length <= 1) return segments;
  const laidOut = applyDeterministicSmartLabelLayout(
    segments.map((segment) => ({
      id: segment.id,
      side: segment.side,
      preferredCenterY: segment.boxY + (segment.boxHeight / 2),
      centerY: segment.boxY + (segment.boxHeight / 2),
      boxY: segment.boxY,
      boxX: segment.boxX,
      boxWidth: segment.boxWidth,
      boxHeight: segment.boxHeight,
      baseFontPx: segment.fontSize,
      fontSize: segment.fontSize,
      isPositionPinned: segment.isPositionPinned === true,
      canSwapSide: false
    })),
    {
      bounds: {
        top: plotTop,
        bottom: plotBottom,
        left: plotLeft,
        right: plotRight
      },
      initialGap: 6,
      shrinkStep: 0.5,
      maxMovePasses: 3,
      maxShrinkPasses: 6
    }
  );
  const layoutById = new Map(laidOut.map((item) => [item.id, item]));

  return segments.map((segment) => {
    const candidate = layoutById.get(segment.id);
    if (!candidate) return segment;

    const nextBoxWidth = candidate.boxWidth;
    const nextBoxHeight = candidate.boxHeight;
    const nextBoxX = clamp(candidate.boxX, plotLeft + 5, plotRight - nextBoxWidth - 5);
    const nextBoxY = clamp(candidate.boxY, plotTop + 5, plotBottom - nextBoxHeight - 5);
    const nextTextX = segment.textAnchor === 'end'
      ? nextBoxX + nextBoxWidth - 6
      : (segment.textAnchor === 'middle' ? nextBoxX + (nextBoxWidth / 2) : nextBoxX + 6);
    const nextTextY = nextBoxY + (nextBoxHeight / 2);
    const nextLineHeight = candidate.fontSize + 6;
    const textSegments = segment.textLines.map((line) => line.text);
    const firstLineOffset = -((textSegments.length - 1) * nextLineHeight) / 2;
    const nextTextLines = textSegments.map((text, index) => ({
      id: segment.textLines[index]?.id ?? `${segment.id}-${index}`,
      text,
      x: nextTextX,
      y: nextTextY + (index === 0 ? firstLineOffset : firstLineOffset + (index * nextLineHeight)),
      fontSize: candidate.fontSize
    }));

    return {
      ...segment,
      boxX: nextBoxX,
      boxY: nextBoxY,
      boxWidth: nextBoxWidth,
      boxHeight: nextBoxHeight,
      fontSize: candidate.fontSize,
      textLines: nextTextLines
    };
  });
});
</script>

<template>
  <g class="horizontal-line-layer">
    <g
      v-for="segment in lineSegments"
      :key="segment.id"
      class="horizontal-line-layer__group"
      :data-line-index="segment.index"
      :transform="resolvePreviewTransform(segment.id)"
      @click="emit('select-line', segment.index)"
      @mousemove="emit('hover-line', segment.index, $event)"
      @mouseleave="emit('leave-line', segment.index)"
      @pointerdown.stop.prevent="handleLabelPointerDown(segment, $event)"
    >
      <line
        class="horizontal-line-layer__hit-path"
        :x1="segment.x1"
        :y1="segment.y"
        :x2="segment.x2"
        :y2="segment.y"
      />

      <line
        class="horizontal-line-layer__path"
        :x1="segment.x1"
        :y1="segment.y"
        :x2="segment.x2"
        :y2="segment.y"
        :stroke="segment.lineColor"
        :stroke-dasharray="segment.lineStyle"
      />

      <g class="horizontal-line-layer__label-group">
        <rect
          class="horizontal-line-layer__label-bg"
          :x="segment.boxX"
          :y="segment.boxY"
          :width="segment.boxWidth"
          :height="segment.boxHeight"
          :stroke="segment.fontColor"
        />

        <text
          v-for="line in segment.textLines"
          :key="line.id"
          class="horizontal-line-layer__label-text"
          :x="line.x"
          :y="line.y"
          :text-anchor="segment.textAnchor"
          :fill="segment.fontColor"
          :style="{ fontSize: `${line.fontSize}px` }"
        >
          {{ line.text }}
        </text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.horizontal-line-layer__group {
  cursor: pointer;
}

.horizontal-line-layer__label-group {
  cursor: grab;
}

.horizontal-line-layer__path {
  stroke-width: 2;
}

.horizontal-line-layer__hit-path {
  stroke: transparent;
  stroke-width: 14;
  pointer-events: stroke;
}

.horizontal-line-layer__label-bg {
  fill: var(--color-surface-elevated);
  rx: 4;
  opacity: 0.92;
}

.horizontal-line-layer__label-text {
  dominant-baseline: middle;
}
</style>
