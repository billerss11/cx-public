<script setup>
import { computed } from 'vue';
import { clamp, getHorizontalAnchor, resolveXPosition } from '@/utils/general.js';
import { resolveConfiguredIntervalCalloutStandoffPx } from '@/utils/labelLayout.js';

function resolveAnnotationBandWidthScale(value, fallback = 1.0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(1.0, Math.max(0.1, fallback));
  }
  return Math.min(1.0, Math.max(0.1, parsed));
}

const props = defineProps({
  boxes: {
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
  config: {
    type: Object,
    default: () => ({})
  },
  xHalf: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['select-box', 'hover-box', 'leave-box']);

const annotationSegments = computed(() => {
  const rows = Array.isArray(props.boxes) ? props.boxes : [];
  const plotLeftBoundary = props.xScale(-props.xHalf);
  const leftAxisClearance = 36;
  const minLeftBandX = plotLeftBoundary + leftAxisClearance;
  const configuredStandoffPx = resolveConfiguredIntervalCalloutStandoffPx(
    props.config?.intervalCalloutStandoffPx
  );
  const standoffPx = Number.isFinite(configuredStandoffPx) ? configuredStandoffPx : 0;

  return rows
    .map((box, index) => {
      if (box?.show === false) return null;

      const topDepth = Number(box?.topDepth);
      const bottomDepth = Number(box?.bottomDepth);
      if (!Number.isFinite(topDepth) || !Number.isFinite(bottomDepth) || bottomDepth <= topDepth) return null;

      const topY = props.yScale(topDepth);
      const bottomY = props.yScale(bottomDepth);
      const boxHeight = bottomY - topY;
      if (!Number.isFinite(boxHeight) || boxHeight <= 0) return null;

      const fillColor = box.color || 'var(--color-default-box)';
      const textColor = box.fontColor || fillColor;
      const boxOpacityRaw = Number(box.opacity);
      const boxOpacity = Number.isFinite(boxOpacityRaw) ? boxOpacityRaw : 0.35;
      const manualX = resolveXPosition(box.labelXPos, props.xHalf);
      const sideSign = Number.isFinite(manualX) ? (manualX >= 0 ? 1 : -1) : -1;
      const centerX = props.xScale(0);
      const leftBandStartX = Math.min(centerX, minLeftBandX);
      const rightBandStartX = clamp(centerX + standoffPx, centerX, props.width - 40);
      const leftSideBandStartX = clamp(centerX - standoffPx, leftBandStartX + 40, centerX);
      const availableBandWidth = sideSign > 0
        ? Math.max(0, props.width - rightBandStartX)
        : Math.max(0, leftSideBandStartX - leftBandStartX);
      const bandWidthScale = resolveAnnotationBandWidthScale(box.bandWidth, 1.0);
      const bandWidth = clamp(
        availableBandWidth * bandWidthScale,
        40,
        Math.max(40, availableBandWidth)
      );
      const bandX = sideSign > 0
        ? rightBandStartX
        : Math.max(leftBandStartX, leftSideBandStartX - bandWidth);

      const centerDepth = (topDepth + bottomDepth) / 2;
      let textAnchor;
      let labelX;
      if (manualX !== null && manualX !== undefined) {
        textAnchor = getHorizontalAnchor(manualX, props.xHalf, sideSign > 0 ? 'start' : 'end');
        labelX = clamp(props.xScale(manualX), bandX + 8, bandX + bandWidth - 8);
      } else {
        textAnchor = sideSign > 0 ? 'start' : 'end';
        labelX = sideSign > 0 ? bandX + 10 : bandX + bandWidth - 10;
      }

      const baseFontSizeRaw = Number(box.fontSize);
      const baseFontSize = Number.isFinite(baseFontSizeRaw) ? baseFontSizeRaw : 12;
      const detailLines = (box.showDetails && box.detail)
        ? box.detail.toString().split(/\n|\r?\n/).map((line) => line.trim()).filter(Boolean)
        : [];
      const textSegments = [];
      if (box.label) {
        textSegments.push({ text: box.label, fontSize: baseFontSize, fontWeight: 'bold' });
      }
      detailLines.forEach((line) => {
        textSegments.push({ text: line, fontSize: Math.max(10, baseFontSize - 2), fontWeight: 'normal' });
      });
      if (textSegments.length === 0) {
        textSegments.push({ text: 'Annotation', fontSize: baseFontSize, fontWeight: 'bold' });
      }
      const spacing = Math.max(baseFontSize + 4, 16);
      const startY = props.yScale(centerDepth) - ((textSegments.length - 1) * spacing) / 2;
      const labels = textSegments.map((segment, labelIndex) => ({
        id: `annotation-${index}-label-${labelIndex}`,
        x: labelX,
        y: clamp(startY + labelIndex * spacing, topY + 12, bottomY - 4),
        text: segment.text,
        fontSize: segment.fontSize,
        fontWeight: segment.fontWeight
      }));

      return {
        id: `annotation-${index}`,
        index,
        x: bandX,
        y: topY,
        width: bandWidth,
        height: boxHeight,
        fillColor,
        textColor,
        boxOpacity,
        textAnchor,
        labels
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="annotation-layer">
    <g
      v-for="segment in annotationSegments"
      :key="segment.id"
      class="annotation-layer__group"
      :data-box-index="segment.index"
      @click="emit('select-box', segment.index)"
      @mousemove="emit('hover-box', segment.index, $event)"
      @mouseleave="emit('leave-box', segment.index)"
    >
      <rect
        class="annotation-layer__fill"
        :x="segment.x"
        :y="segment.y"
        :width="segment.width"
        :height="segment.height"
        :fill="segment.fillColor"
        :opacity="segment.boxOpacity"
        :stroke="segment.textColor"
      />

      <text
        v-for="label in segment.labels"
        :key="label.id"
        class="annotation-layer__text"
        :x="label.x"
        :y="label.y"
        :text-anchor="segment.textAnchor"
        :fill="segment.textColor"
        :style="{ fontSize: `${label.fontSize}px`, fontWeight: label.fontWeight }"
      >
        {{ label.text }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.annotation-layer__group {
  cursor: pointer;
}

.annotation-layer__fill {
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.annotation-layer__text {
  dominant-baseline: middle;
}
</style>
