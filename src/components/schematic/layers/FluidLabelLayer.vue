<script setup>
import { computed } from 'vue';
import { getStackAtDepth as getPhysicsStackAtDepth } from '@/composables/usePhysics.js';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';
import { clamp, parseOptionalNumber, wrapTextToLines } from '@/utils/general.js';
import { resolveAnchoredHorizontalCallout } from '@/utils/labelLayout.js';

const props = defineProps({
  fluids: {
    type: Array,
    default: () => []
  },
  physicsContext: {
    type: Object,
    default: null
  },
  config: {
    type: Object,
    default: () => ({})
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
  diameterScale: {
    type: Number,
    default: 1
  }
});

const emit = defineEmits(['select-fluid', 'hover-fluid', 'leave-fluid']);

function resolveFluidLayerAtDepth(depth, fluidIndex, physicsContext) {
  if (!Number.isFinite(depth) || !Number.isInteger(fluidIndex)) return null;
  const stack = getPhysicsStackAtDepth(depth, physicsContext);
  if (!Array.isArray(stack) || stack.length === 0) return null;
  return stack.find((layer) => (
    layer?.material === 'fluid' &&
    Number(layer?.source?.index) === fluidIndex
  )) || null;
}

function buildArrowGeometry(startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 1e-6) return null;

  const ux = dx / distance;
  const uy = dy / distance;
  const arrowLength = 6;
  const arrowHalfWidth = 3;
  const baseX = endX - (ux * arrowLength);
  const baseY = endY - (uy * arrowLength);
  const px = -uy;
  const py = ux;

  return {
    lineX1: startX,
    lineY1: startY,
    lineX2: baseX,
    lineY2: baseY,
    arrowPoints: [
      `${endX},${endY}`,
      `${baseX + (px * arrowHalfWidth)},${baseY + (py * arrowHalfWidth)}`,
      `${baseX - (px * arrowHalfWidth)},${baseY - (py * arrowHalfWidth)}`
    ].join(' ')
  };
}

function resolveIntervalCalloutStandoff(plotLeft, plotRight) {
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const adaptive = plotWidth * LAYOUT_CONSTANTS.INTERVAL_CALLOUT_VERTICAL_STANDOFF_RATIO;
  return clamp(
    adaptive,
    LAYOUT_CONSTANTS.INTERVAL_CALLOUT_VERTICAL_STANDOFF_MIN_PX,
    LAYOUT_CONSTANTS.INTERVAL_CALLOUT_VERTICAL_STANDOFF_MAX_PX
  );
}

function resolveIntervalCalloutXNudge(value) {
  const parsed = parseOptionalNumber(value);
  if (!Number.isFinite(parsed)) return 0;
  // Keep inspector fine-tune behavior, but restrict it to a small nudge.
  return clamp(parsed, -1, 1) * LAYOUT_CONSTANTS.INTERVAL_CALLOUT_X_NUDGE_MAX_PX;
}

function resolvePreferredFluidCalloutSide({
  anchorLeftX,
  anchorRightX,
  plotLeft,
  plotRight,
  boxWidth,
  standoffPx
}) {
  if (!Number.isFinite(anchorRightX)) return 'left';
  if (!Number.isFinite(anchorLeftX)) return 'right';

  const minBoxX = plotLeft + 5;
  const maxBoxX = plotRight - boxWidth - 5;
  const rightRawBoxX = anchorRightX + standoffPx;
  const leftRawBoxX = anchorLeftX - standoffPx - boxWidth;
  const rightOverflow = Math.max(0, minBoxX - rightRawBoxX) + Math.max(0, rightRawBoxX - maxBoxX);
  const leftOverflow = Math.max(0, minBoxX - leftRawBoxX) + Math.max(0, leftRawBoxX - maxBoxX);
  return rightOverflow <= leftOverflow ? 'right' : 'left';
}

const fluidLabels = computed(() => {
  const fluids = Array.isArray(props.fluids) ? props.fluids : [];
  const physicsContext = props.physicsContext;
  if (!Array.isArray(fluids) || fluids.length === 0 || !physicsContext?.__physicsContext) return [];
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

  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;

  return fluids.map((fluid, fluidIndex) => {
    if (fluid?.show === false) return null;

    const label = String(fluid?.label ?? '').trim();
    if (!label) return null;

    const top = parseOptionalNumber(fluid?.top);
    const bottom = parseOptionalNumber(fluid?.bottom);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

    const manualDepth = parseOptionalNumber(fluid?.manualDepth);
    const labelDepth = Number.isFinite(manualDepth)
      ? clamp(manualDepth, top, bottom)
      : ((top + bottom) / 2);

    const fluidLayer = resolveFluidLayerAtDepth(labelDepth, fluidIndex, physicsContext);
    if (!fluidLayer) return null;

    const innerRadius = Number(fluidLayer?.innerRadius);
    const outerRadius = Number(fluidLayer?.outerRadius);
    if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius) return null;

    const midRadius = ((innerRadius + outerRadius) / 2) * diameterScale;
    if (!Number.isFinite(midRadius) || midRadius <= 0) return null;

    const centerX = props.xScale(0);
    const anchorLeftX = props.xScale(-midRadius);
    const anchorRightX = props.xScale(midRadius);
    const anchorY = clamp(
      props.yScale(labelDepth),
      plotTop + 8,
      Math.max(plotTop + 8, plotBottom - 8)
    );
    if (!Number.isFinite(centerX) ||
      !Number.isFinite(anchorLeftX) ||
      !Number.isFinite(anchorRightX) ||
      !Number.isFinite(anchorY)) {
      return null;
    }

    const fontSize = Number.isFinite(Number(fluid?.fontSize))
      ? Number(fluid.fontSize)
      : 11;
    const textColor = fluid?.textColor || 'var(--color-ink-strong)';
    const strokeColor = fluid?.color || 'var(--color-default-fluid-stroke)';

    const maxLabelWidth = 220;
    const wrappedLines = wrapTextToLines(label, maxLabelWidth, fontSize);
    const lineHeight = fontSize + 6;
    const labelHeight = (wrappedLines.length * lineHeight) + 12;
    const estimatedWidth = Math.max(
      80,
      Math.min(maxLabelWidth, Math.max(...wrappedLines.map((lineText) => lineText.length)) * fontSize * 0.6 + 16)
    );

    const standoffPx = resolveIntervalCalloutStandoff(plotLeft, plotRight);
    const nudgePx = resolveIntervalCalloutXNudge(fluid?.labelXPos);
    const preferredSide = resolvePreferredFluidCalloutSide({
      anchorLeftX,
      anchorRightX,
      plotLeft,
      plotRight,
      boxWidth: estimatedWidth,
      standoffPx
    });
    const calloutPlacement = resolveAnchoredHorizontalCallout({
      preferredSide,
      centerX,
      anchorLeftX,
      anchorRightX,
      boxWidth: estimatedWidth,
      boundsLeft: plotLeft,
      boundsRight: plotRight,
      standoffPx,
      nudgePx,
      minBoxPadding: 5
    });
    if (!calloutPlacement) return null;

    const textAnchor = calloutPlacement.textAnchor;
    const boxX = calloutPlacement.boxX;
    const targetAnchorX = calloutPlacement.anchorX;

    const boxY = clamp(
      anchorY - (labelHeight / 2),
      plotTop + 5,
      Math.max(plotTop + 5, plotBottom - labelHeight - 5)
    );
    const arrowStartX = calloutPlacement.arrowStartX;
    const arrowStartY = boxY + (labelHeight / 2);
    const arrow = buildArrowGeometry(arrowStartX, arrowStartY, targetAnchorX, anchorY);
    if (!arrow) return null;

    const textX = textAnchor === 'end'
      ? boxX + estimatedWidth - 6
      : (textAnchor === 'middle' ? boxX + (estimatedWidth / 2) : boxX + 6);
    const textY = boxY + (labelHeight / 2);
    const firstLineOffset = -((wrappedLines.length - 1) * lineHeight) / 2;
    const textLines = wrappedLines.map((lineText, lineIndex) => ({
      id: `fluid-label-${fluidIndex}-${lineIndex}`,
      text: lineText,
      x: textX,
      dy: lineIndex === 0 ? firstLineOffset : lineHeight
    }));

    return {
      id: `fluid-label-${fluidIndex}`,
      index: fluidIndex,
      strokeColor,
      textColor,
      fontSize,
      textAnchor,
      boxX,
      boxY,
      boxWidth: estimatedWidth,
      boxHeight: labelHeight,
      textX,
      textY,
      textLines,
      arrow
    };
  }).filter(Boolean);
});
</script>

<template>
  <g class="fluid-label-layer">
    <g
      v-for="label in fluidLabels"
      :key="label.id"
      class="fluid-label-layer__group"
      :data-fluid-index="label.index"
      @click="emit('select-fluid', label.index)"
      @mousemove="emit('hover-fluid', label.index, $event)"
      @mouseleave="emit('leave-fluid', label.index)"
    >
      <line
        class="fluid-label-layer__arrow-line"
        :x1="label.arrow.lineX1"
        :y1="label.arrow.lineY1"
        :x2="label.arrow.lineX2"
        :y2="label.arrow.lineY2"
        :stroke="label.strokeColor"
      />
      <polygon
        class="fluid-label-layer__arrow-head"
        :points="label.arrow.arrowPoints"
        :fill="label.strokeColor"
      />

      <rect
        class="fluid-label-layer__box"
        :x="label.boxX"
        :y="label.boxY"
        :width="label.boxWidth"
        :height="label.boxHeight"
        :stroke="label.strokeColor"
      />

      <text
        class="fluid-label-layer__text"
        :x="label.textX"
        :y="label.textY"
        :text-anchor="label.textAnchor"
        dominant-baseline="middle"
        :style="{ fontSize: `${label.fontSize}px`, fill: label.textColor }"
      >
        <tspan
          v-for="line in label.textLines"
          :key="line.id"
          :x="line.x"
          :dy="line.dy"
        >
          {{ line.text }}
        </tspan>
      </text>
    </g>
  </g>
</template>

<style scoped>
.fluid-label-layer__group {
  cursor: pointer;
}

.fluid-label-layer__arrow-line {
  stroke-width: 1.2;
}

.fluid-label-layer__arrow-head {
  stroke: none;
}

.fluid-label-layer__box {
  fill: var(--color-surface-elevated);
  stroke-width: 1.1;
  rx: 4;
  opacity: 0.95;
}
</style>
