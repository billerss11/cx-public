<script setup>
import { computed } from 'vue';
import {
  clamp,
  formatDepthValue,
  getHorizontalAnchor,
  getLineStyle,
  resolveXPosition,
  wrapTextToLines
} from '@/utils/general.js';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';

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
  unitsLabel: {
    type: String,
    default: 'ft'
  }
});

const emit = defineEmits(['select-line', 'hover-line', 'leave-line']);

const lineSegments = computed(() => {
  const rows = Array.isArray(props.lines) ? props.lines : [];

  return rows
    .map((line, index) => {
      if (line?.show === false) return null;

      const depthValue = Number(line?.depth);
      if (!Number.isFinite(depthValue)) return null;

      const fullW = props.xHalf * LAYOUT_CONSTANTS.DEFAULT_HORIZONTAL_LINE_HALF_WIDTH_RATIO;
      const lineColor = line.color || 'var(--color-default-line)';
      const fontColor = line.fontColor || lineColor;
      const fontSizeRaw = Number(line.fontSize);
      const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 11;

      const depthText = `${formatDepthValue(depthValue)} ${props.unitsLabel}`;
      const displayText = line.label ? `${line.label} ${depthText}` : depthText;
      const manualLabelX = resolveXPosition(line.labelXPos, props.xHalf);
      const defaultLabelX = props.xHalf * LAYOUT_CONSTANTS.DEFAULT_RIGHT_LABEL_X_RATIO;
      const labelXData = manualLabelX !== null && manualLabelX !== undefined ? manualLabelX : defaultLabelX;
      let textAnchor = getHorizontalAnchor(labelXData, props.xHalf, 'start');
      const labelXPixelRaw = props.xScale(labelXData);
      const labelXPixel = clamp(labelXPixelRaw, 10, props.width - 10);
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
      boxXPixel = clamp(boxXPixel, 5, props.width - estimatedWidth - 5);
      const labelY = props.yScale(depthValue);

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
        lineColor,
        fontColor,
        lineStyle: getLineStyle(line.lineStyle),
        x1: props.xScale(-fullW),
        x2: props.xScale(fullW),
        y: props.yScale(depthValue),
        boxX: boxXPixel,
        boxY: labelY - labelHeight / 2,
        boxWidth: estimatedWidth,
        boxHeight: labelHeight,
        textAnchor,
        textLines
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="horizontal-line-layer">
    <g
      v-for="segment in lineSegments"
      :key="segment.id"
      class="horizontal-line-layer__group"
      :data-line-index="segment.index"
      @click="emit('select-line', segment.index)"
      @mousemove="emit('hover-line', segment.index, $event)"
      @mouseleave="emit('leave-line', segment.index)"
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
</template>

<style scoped>
.horizontal-line-layer__group {
  cursor: pointer;
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
