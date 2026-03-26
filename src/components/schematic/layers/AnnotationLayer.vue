<script setup>
import { computed } from 'vue';
import { clamp, getHorizontalAnchor, parseOptionalNumber, resolveXPosition } from '@/utils/general.js';
import {
  resolveConfiguredIntervalCalloutStandoffPx
} from '@/utils/labelLayout.js';
import {
  applyDeterministicSmartLabelLayout,
  resolveSmartLabelAutoScale,
  resolveSmartLabelFontSize
} from '@/utils/smartLabels.js';

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
  },
  verticalLabelScale: {
    type: Number,
    default: 1
  },
  smartLabelsEnabled: {
    type: Boolean,
    default: true
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

const emit = defineEmits(['select-box', 'hover-box', 'leave-box', 'start-label-drag']);

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

function handleAnnotationPointerDown(segment, event) {
  const rowId = String(segment?.rowId ?? '').trim();
  if (!rowId) return;
  const depthRange = resolveScaleRange(props.yScale);
  emit('start-label-drag', {
    previewId: segment.id,
    entityType: 'box',
    dragKind: 'depth-shift',
    rowId,
    centerX: segment.x + (segment.width / 2),
    centerY: segment.y + (segment.height / 2),
    entries: [
      {
        field: 'topDepth',
        value: segment.topDepth,
        min: depthRange?.min,
        max: depthRange?.max
      },
      {
        field: 'bottomDepth',
        value: segment.bottomDepth,
        min: depthRange?.min,
        max: depthRange?.max
      },
      ...(Number.isFinite(segment.manualLabelDepth)
        ? [{
          field: 'manualLabelDepth',
          value: segment.manualLabelDepth,
          min: depthRange?.min,
          max: depthRange?.max
        }]
        : [])
    ]
  }, event);
}

const annotationSegments = computed(() => {
  const rows = Array.isArray(props.boxes) ? props.boxes : [];
  const yRange = typeof props.yScale?.range === 'function' ? props.yScale.range() : [];
  const rawTop = Number(yRange[0]);
  const rawBottom = Number(yRange[yRange.length - 1]);
  const plotTop = Math.min(rawTop, rawBottom);
  const plotBottom = Math.max(rawTop, rawBottom);
  if (!Number.isFinite(plotTop) || !Number.isFinite(plotBottom)) return [];
  const plotLeftBoundary = props.xScale(-props.xHalf);
  const leftAxisClearance = 36;
  const minLeftBandX = plotLeftBoundary + leftAxisClearance;
  const configuredStandoffPx = resolveConfiguredIntervalCalloutStandoffPx(
    props.config?.intervalCalloutStandoffPx
  );
  const standoffPx = Number.isFinite(configuredStandoffPx) ? configuredStandoffPx : 0;
  const smartLabelsEnabled = props.smartLabelsEnabled === true;
  const verticalLabelScale = Number.isFinite(Number(props.verticalLabelScale))
    ? Math.max(0.1, Number(props.verticalLabelScale))
    : 1;
  const visibleRows = rows.filter((row) => row?.show !== false);
  const smartAutoScale = smartLabelsEnabled
    ? resolveSmartLabelAutoScale({
      totalPreferredLabelHeight: visibleRows.length * 30,
      availableTrackHeight: Math.max(1, plotBottom - plotTop)
    })
    : 1;

  const segments = rows
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
      const manualLabelDepth = parseOptionalNumber(box?.manualLabelDepth);
      const hasDirectManualPosition = Number.isFinite(manualLabelDepth) && manualX !== null && manualX !== undefined;
      const sideSign = Number.isFinite(manualX)
        ? (manualX >= 0 ? 1 : -1)
        : (smartLabelsEnabled ? 0 : -1);
      const centerX = props.xScale(0);
      const leftBandStartX = Math.min(centerX, minLeftBandX);
      const rightBandStartX = clamp(centerX + standoffPx, centerX, props.width - 40);
      const leftSideBandStartX = clamp(centerX - standoffPx, leftBandStartX + 40, centerX);
      const availableBandWidth = sideSign > 0
        ? Math.max(0, props.width - rightBandStartX)
        : (sideSign < 0
          ? Math.max(0, leftSideBandStartX - leftBandStartX)
          : Math.max(0, props.width - (leftBandStartX + 20)));
      const bandWidthScale = resolveAnnotationBandWidthScale(box.bandWidth, 1.0);
      const bandWidth = clamp(
        availableBandWidth * bandWidthScale,
        40,
        Math.max(40, availableBandWidth)
      );
      let bandX = sideSign > 0
        ? rightBandStartX
        : (sideSign < 0
          ? Math.max(leftBandStartX, leftSideBandStartX - bandWidth)
          : clamp(centerX - (bandWidth / 2), leftBandStartX, props.width - bandWidth - 10));
      if (hasDirectManualPosition) {
        bandX = clamp(props.xScale(manualX) - (bandWidth / 2), 0, props.width - bandWidth);
      }

      const centerDepth = (topDepth + bottomDepth) / 2;
      let textAnchor;
      let labelX;
      if (hasDirectManualPosition) {
        textAnchor = 'middle';
        labelX = bandX + (bandWidth / 2);
      } else if (manualX !== null && manualX !== undefined) {
        textAnchor = getHorizontalAnchor(manualX, props.xHalf, sideSign > 0 ? 'start' : 'end');
        labelX = clamp(props.xScale(manualX), bandX + 8, bandX + bandWidth - 8);
      } else {
        textAnchor = sideSign > 0 ? 'start' : (sideSign < 0 ? 'end' : 'middle');
        labelX = sideSign > 0
          ? bandX + 10
          : (sideSign < 0 ? bandX + bandWidth - 10 : bandX + (bandWidth / 2));
      }

      const baseFontSizeRaw = Number(box.fontSize);
      const baseFontSize = Number.isFinite(baseFontSizeRaw) ? baseFontSizeRaw : 12;
      const resolvedBaseFontSize = resolveSmartLabelFontSize(baseFontSize, {
        manualScale: verticalLabelScale,
        autoScale: smartLabelsEnabled ? smartAutoScale : 1,
        minPx: 8,
        maxPx: 40
      });
      const detailLines = (box.showDetails && box.detail)
        ? box.detail.toString().split(/\n|\r?\n/).map((line) => line.trim()).filter(Boolean)
        : [];
      const textSegments = [];
      if (box.label) {
        textSegments.push({ text: box.label, fontSize: resolvedBaseFontSize, fontWeight: 'bold' });
      }
      detailLines.forEach((line) => {
        textSegments.push({ text: line, fontSize: Math.max(10, resolvedBaseFontSize - 2), fontWeight: 'normal' });
      });
      if (textSegments.length === 0) {
        textSegments.push({ text: 'Annotation', fontSize: resolvedBaseFontSize, fontWeight: 'bold' });
      }
      const spacing = Math.max(resolvedBaseFontSize + 4, 16);
      const segmentCenterDepth = Number.isFinite(manualLabelDepth) ? manualLabelDepth : centerDepth;
      const segmentCenterY = props.yScale(segmentCenterDepth);
      const bandY = hasDirectManualPosition
        ? clamp(segmentCenterY - (boxHeight / 2), plotTop, plotBottom - boxHeight)
        : topY;
      const startY = clamp(
        segmentCenterY - ((textSegments.length - 1) * spacing) / 2,
        bandY + 12,
        bandY + boxHeight - 4
      );
      const labels = textSegments.map((segment, labelIndex) => ({
        id: `annotation-${index}-label-${labelIndex}`,
        x: labelX,
        y: clamp(startY + labelIndex * spacing, bandY + 12, bandY + boxHeight - 4),
        text: segment.text,
        fontSize: segment.fontSize,
        fontWeight: segment.fontWeight
      }));

      return {
        id: `annotation-${index}`,
        index,
        rowId: String(box?.rowId ?? '').trim() || null,
        topDepth,
        bottomDepth,
        manualLabelDepth,
        x: bandX,
        y: bandY,
        width: bandWidth,
        height: boxHeight,
        fillColor,
        textColor,
        boxOpacity,
        textAnchor,
        side: textAnchor === 'start' ? 'right' : (textAnchor === 'end' ? 'left' : 'center'),
        labels,
        isPositionPinned: hasDirectManualPosition || Number.isFinite(manualX)
      };
    })
    .filter(Boolean);

  if (!smartLabelsEnabled || segments.length <= 1) return segments;
  const laidOut = applyDeterministicSmartLabelLayout(
    segments.map((segment) => ({
      id: segment.id,
      side: segment.side,
      preferredCenterY: segment.y + (segment.height / 2),
      centerY: segment.y + (segment.height / 2),
      boxY: segment.y,
      boxX: segment.x,
      boxWidth: segment.width,
      boxHeight: segment.height,
      baseFontPx: segment.labels[0]?.fontSize ?? 12,
      fontSize: segment.labels[0]?.fontSize ?? 12,
      isPositionPinned: segment.isPositionPinned === true,
      canSwapSide: false
    })),
    {
      bounds: {
        top: plotTop,
        bottom: plotBottom,
        left: 0,
        right: props.width
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

    const nextY = clamp(candidate.boxY, plotTop, plotBottom - candidate.boxHeight);
    const nextHeight = candidate.boxHeight;
    const originalCenter = segment.y + (segment.height / 2);
    const nextCenter = nextY + (nextHeight / 2);
    const heightRatio = segment.height > 0 ? nextHeight / segment.height : 1;
    const baseFont = segment.labels[0]?.fontSize ?? candidate.fontSize;
    const fontRatio = baseFont > 0 ? candidate.fontSize / baseFont : 1;
    const nextLabels = segment.labels.map((label) => {
      const offsetFromCenter = label.y - originalCenter;
      return {
        ...label,
        y: clamp(nextCenter + (offsetFromCenter * heightRatio), nextY + 10, nextY + nextHeight - 4),
        fontSize: Math.max(8, label.fontSize * fontRatio)
      };
    });

    return {
      ...segment,
      y: nextY,
      height: nextHeight,
      labels: nextLabels
    };
  });
});
</script>

<template>
  <g class="annotation-layer">
    <g
      v-for="segment in annotationSegments"
      :key="segment.id"
      class="annotation-layer__group"
      :data-box-index="segment.index"
      :transform="resolvePreviewTransform(segment.id)"
      @click="emit('select-box', segment.index)"
      @mousemove="emit('hover-box', segment.index, $event)"
      @mouseleave="emit('leave-box', segment.index)"
      @pointerdown.stop.prevent="handleAnnotationPointerDown(segment, $event)"
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
