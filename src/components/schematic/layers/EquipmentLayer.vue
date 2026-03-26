<script setup>
import { computed } from 'vue';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';
import { clamp, parseOptionalNumber, resolveXPosition } from '@/utils/general.js';
import {
  applyDeterministicSmartLabelLayout,
  resolveSmartLabelAutoScale,
  resolveSmartLabelFontSize
} from '@/utils/smartLabels.js';
import { applyPreviewToArrowedBoxLabel } from '@/utils/diagramLabelPreview.js';
import { resolveEquipmentTypeSemantics } from './equipmentModelShared.js';

const DEFAULT_PACKER_HEIGHT = 15;
const ORPHAN_COLOR = 'red';
const ORPHAN_DASH_STYLE = '4 2';
const ORPHAN_MIN_RADIUS = 0.8;
const SAFETY_VALVE_MIN_HALF_HEIGHT = 3;

const props = defineProps({
  equipment: {
    type: Array,
    default: () => [],
  },
  xScale: {
    type: Function,
    required: true,
  },
  yScale: {
    type: Function,
    required: true,
  },
  diameterScale: {
    type: Number,
    default: 1,
  },
  xHalf: {
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

const emit = defineEmits(['select-equipment', 'hover-equipment', 'leave-equipment', 'start-label-drag']);

function handleSelect(shape) {
  const equipmentIndex = Number(shape?.equipmentIndex);
  if (!Number.isInteger(equipmentIndex) || equipmentIndex < 0) return;
  emit('select-equipment', equipmentIndex);
}

function handleHover(shape, event) {
  const equipmentIndex = Number(shape?.equipmentIndex);
  if (!Number.isInteger(equipmentIndex) || equipmentIndex < 0) return;
  emit('hover-equipment', equipmentIndex, event);
}

function handleLeave() {
  emit('leave-equipment');
}

function resolveSafetyValveHalfHeight(innerRadius, scale) {
  const leftX = props.xScale(-innerRadius);
  const rightX = props.xScale(innerRadius);
  const tubingInnerDiameterPx = Math.abs(rightX - leftX);
  const rawHalfHeight = (tubingInnerDiameterPx * 0.3) * scale;
  const maxHalfHeight = tubingInnerDiameterPx / 2;
  if (!Number.isFinite(rawHalfHeight) || rawHalfHeight <= 0) return SAFETY_VALVE_MIN_HALF_HEIGHT;
  return Math.max(SAFETY_VALVE_MIN_HALF_HEIGHT, Math.min(maxHalfHeight, rawHalfHeight));
}

function estimateLineWidth(text, fontSize) {
  return Array.from(String(text ?? '')).reduce((total, ch) => (
    total + (ch.charCodeAt(0) > 255 ? fontSize * 0.95 : fontSize * 0.58)
  ), 0);
}

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

function handleLabelPointerDown(label, event) {
  const rowId = String(label?.rowId ?? '').trim();
  if (!rowId) return;
  emit('start-label-drag', {
    previewId: label.id,
    entityType: 'equipment',
    rowId,
    centerX: label.boxX + (label.boxWidth / 2),
    centerY: label.boxY + (label.boxHeight / 2),
    xField: 'labelXPos',
    yField: 'manualLabelDepth',
    xRange: resolveScaleRange(props.xScale),
    depthRange: resolveScaleRange(props.yScale)
  }, event);
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

function resolveEquipmentAnchorDataX(equipmentRow) {
  const sealInnerDiameter = Number(equipmentRow?.sealInnerDiameter);
  if (Number.isFinite(sealInnerDiameter) && sealInnerDiameter > 0) {
    return -((sealInnerDiameter * props.diameterScale) / 2);
  }

  const tubingParentOD = Number(equipmentRow?.tubingParentOD);
  if (Number.isFinite(tubingParentOD) && tubingParentOD > 0) {
    return -((tubingParentOD * props.diameterScale) / 2);
  }
  return 0;
}

const equipmentShapes = computed(() => {
  const shapes = [];

  props.equipment.forEach((equip, index) => {
    const equipmentIndex = Number.isInteger(Number(equip?.sourceIndex)) && Number(equip.sourceIndex) >= 0
      ? Number(equip.sourceIndex)
      : index;
    const semantics = resolveEquipmentTypeSemantics(equip?.type);
    if (semantics.isPackerLike) {
      const isOrphaned = equip.isOrphaned === true;
      const y = props.yScale(equip.depth);
      const height = DEFAULT_PACKER_HEIGHT * equip.scale;
      const sealInnerDiameter = Number(equip.sealInnerDiameter ?? equip.tubingParentOD);
      const sealOuterDiameter = Number(equip.sealOuterDiameter ?? equip.parentInnerDiameter);
      const hasResolvedSealGeometry = Number.isFinite(sealInnerDiameter)
        && Number.isFinite(sealOuterDiameter)
        && sealOuterDiameter > sealInnerDiameter;
      const childOuterRadius = hasResolvedSealGeometry
        ? (sealInnerDiameter / 2) * props.diameterScale
        : ORPHAN_MIN_RADIUS * props.diameterScale;

      if (isOrphaned) {
        // Render orphaned packer in an error state
        const orphanWidth = (childOuterRadius * 0.5) + 5; // Arbitrary visible width

        // Left side
        const leftBoxX = props.xScale(-childOuterRadius - orphanWidth);
        shapes.push({
          type: 'rect',
          id: `equip-${index}-left-orphan`,
          equipmentIndex,
          x: leftBoxX,
          y: y - height / 2,
          width: orphanWidth,
          height,
          color: ORPHAN_COLOR,
          isOrphaned: true,
        });

        // Right side
        const rightBoxX = props.xScale(childOuterRadius);
        shapes.push({
          type: 'rect',
          id: `equip-${index}-right-orphan`,
          equipmentIndex,
          x: rightBoxX,
          y: y - height / 2,
          width: orphanWidth,
          height,
          color: ORPHAN_COLOR,
          isOrphaned: true,
        });
      } else {
        if (!hasResolvedSealGeometry) return;
        const parentInnerRadius = (sealOuterDiameter / 2) * props.diameterScale;
        if (parentInnerRadius <= childOuterRadius) return;

        // Left side
        const leftBoxX = props.xScale(-parentInnerRadius);
        const leftBoxWidth = props.xScale(-childOuterRadius) - leftBoxX;
        shapes.push({
          type: 'rect',
          id: `equip-${index}-left-box`,
          equipmentIndex,
          x: leftBoxX,
          y: y - height / 2,
          width: leftBoxWidth,
          height,
          color: equip.color,
        });
        shapes.push({
          type: 'line',
          id: `equip-${index}-left-cross1`,
          equipmentIndex,
          x1: leftBoxX,
          y1: y - height / 2,
          x2: leftBoxX + leftBoxWidth,
          y2: y + height / 2,
          color: equip.color,
        });
        shapes.push({
          type: 'line',
          id: `equip-${index}-left-cross2`,
          equipmentIndex,
          x1: leftBoxX,
          y1: y + height / 2,
          x2: leftBoxX + leftBoxWidth,
          y2: y - height / 2,
          color: equip.color,
        });

        // Right side
        const rightBoxX = props.xScale(childOuterRadius);
        const rightBoxWidth = props.xScale(parentInnerRadius) - rightBoxX;
        shapes.push({
          type: 'rect',
          id: `equip-${index}-right-box`,
          equipmentIndex,
          x: rightBoxX,
          y: y - height / 2,
          width: rightBoxWidth,
          height,
          color: equip.color,
        });
        shapes.push({
          type: 'line',
          id: `equip-${index}-right-cross1`,
          equipmentIndex,
          x1: rightBoxX,
          y1: y - height / 2,
          x2: rightBoxX + rightBoxWidth,
          y2: y + height / 2,
          color: equip.color,
        });
        shapes.push({
          type: 'line',
          id: `equip-${index}-right-cross2`,
          equipmentIndex,
          x1: rightBoxX,
          y1: y + height / 2,
          x2: rightBoxX + rightBoxWidth,
          y2: y - height / 2,
          color: equip.color,
        });
      }
    } else if (semantics.isInlineValve) {
      const isOrphaned = equip.tubingParentIndex === null;
      const tubingID = Number(equip.tubingParentID);
      if (!Number.isFinite(tubingID)) return; // SSV must be in a tubing

      const innerRadius = (tubingID / 2) * props.diameterScale;
      const y = props.yScale(equip.depth);
      const halfHeight = resolveSafetyValveHalfHeight(innerRadius, equip.scale);

      const leftX = props.xScale(-innerRadius);
      const rightX = props.xScale(innerRadius);

      const cx = props.xScale(0);
      const rx = rightX - cx;
      const crossFactor = 0.7;

      shapes.push({
        type: 'ellipse',
        id: `equip-${index}-ssv-ellipse`,
        equipmentIndex,
        cx,
        cy: y,
        rx,
        ry: halfHeight,
        color: isOrphaned ? ORPHAN_COLOR : equip.color,
        isOrphaned,
      });
      shapes.push({
        type: 'line',
        id: `equip-${index}-ssv-cross1`,
        equipmentIndex,
        x1: cx - rx * crossFactor,
        y1: y - halfHeight * crossFactor,
        x2: cx + rx * crossFactor,
        y2: y + halfHeight * crossFactor,
        color: isOrphaned ? ORPHAN_COLOR : equip.color,
        isOrphaned,
      });
      shapes.push({
        type: 'line',
        id: `equip-${index}-ssv-cross2`,
        equipmentIndex,
        x1: cx + rx * crossFactor,
        y1: y - halfHeight * crossFactor,
        x2: cx - rx * crossFactor,
        y2: y + halfHeight * crossFactor,
        color: isOrphaned ? ORPHAN_COLOR : equip.color,
        isOrphaned,
      });
    }
  });

  return shapes;
});

const equipmentLabels = computed(() => {
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
  const defaultLabelXData = smartLabelsEnabled
    ? (props.xHalf * LAYOUT_CONSTANTS.DEFAULT_RIGHT_LABEL_X_RATIO)
    : (-props.xHalf * LAYOUT_CONSTANTS.DEFAULT_CASING_LABEL_X_RATIO);
  const availableTrackHeight = Math.max(1, plotBottom - plotTop);
  const visibleRows = (Array.isArray(props.equipment) ? props.equipment : []).filter((row) => row?.showLabel !== false);
  const smartAutoScale = smartLabelsEnabled
    ? resolveSmartLabelAutoScale({
      totalPreferredLabelHeight: visibleRows.length * 26,
      availableTrackHeight
    })
    : 1;

  const labels = (Array.isArray(props.equipment) ? props.equipment : [])
    .map((equipmentRow, index) => {
      if (equipmentRow?.showLabel === false) return null;

      const equipmentIndex = Number.isInteger(Number(equipmentRow?.sourceIndex)) && Number(equipmentRow.sourceIndex) >= 0
        ? Number(equipmentRow.sourceIndex)
        : index;
      if (!Number.isInteger(equipmentIndex) || equipmentIndex < 0) return null;

      const labelText = String(equipmentRow?.label ?? equipmentRow?.type ?? '').trim();
      if (!labelText) return null;

      const anchorDepth = parseOptionalNumber(equipmentRow?.depth);
      if (!Number.isFinite(anchorDepth)) return null;

      const manualDepth = parseOptionalNumber(equipmentRow?.manualLabelDepth);
      const labelDepth = Number.isFinite(manualDepth) ? manualDepth : anchorDepth;
      const labelCenterY = clamp(
        props.yScale(labelDepth),
        plotTop + 10,
        Math.max(plotTop + 10, plotBottom - 10)
      );
      const anchorY = clamp(props.yScale(anchorDepth), plotTop, plotBottom);

      const fontSizeRaw = Number(equipmentRow?.labelFontSize);
      const baseFontSize = Number.isFinite(fontSizeRaw) ? clamp(fontSizeRaw, 8, 20) : 11;
      const fontSize = resolveSmartLabelFontSize(baseFontSize, {
        manualScale: verticalLabelScale,
        autoScale: smartLabelsEnabled ? smartAutoScale : 1,
        minPx: 8,
        maxPx: 40
      });
      const boxWidth = clamp(estimateLineWidth(labelText, fontSize) + 16, 90, 240);
      const boxHeight = clamp(fontSize + 12, 20, 44);

      const manualX = resolveXPosition(equipmentRow?.labelXPos, props.xHalf);
      const labelXData = manualX !== null && manualX !== undefined ? manualX : defaultLabelXData;
      const labelCenterX = props.xScale(labelXData);
      const boxX = clamp(labelCenterX - (boxWidth / 2), plotLeft + 5, plotRight - boxWidth - 5);
      const boxY = clamp(labelCenterY - (boxHeight / 2), plotTop, plotBottom - boxHeight);

      const anchorX = props.xScale(resolveEquipmentAnchorDataX(equipmentRow));
      const boxCenterX = boxX + (boxWidth / 2);
      const boxCenterY = boxY + (boxHeight / 2);
      const isLabelLeft = boxCenterX <= anchorX;
      const arrowStartX = isLabelLeft ? boxX + boxWidth : boxX;
      const arrow = buildArrowGeometry(arrowStartX, boxCenterY, anchorX, anchorY);

      return {
        id: `equipment-label-${equipmentIndex}`,
        equipmentIndex,
        rowId: String(equipmentRow?.rowId ?? '').trim() || null,
        boxX,
        boxY,
        boxWidth,
        boxHeight,
        textX: boxX + (boxWidth / 2),
        textY: boxY + (boxHeight / 2),
        text: labelText,
        fontSize,
        anchorX,
        anchorY,
        isPositionPinned: Number.isFinite(manualDepth) || (manualX !== null && manualX !== undefined),
        arrow
      };
    })
    .filter(Boolean);

  if (!smartLabelsEnabled || labels.length <= 1) return labels;
  const laidOut = applyDeterministicSmartLabelLayout(
    labels.map((label) => ({
      id: label.id,
      side: 'right',
      preferredCenterY: label.boxY + (label.boxHeight / 2),
      centerY: label.boxY + (label.boxHeight / 2),
      boxY: label.boxY,
      boxX: label.boxX,
      boxWidth: label.boxWidth,
      boxHeight: label.boxHeight,
      baseFontPx: label.fontSize,
      fontSize: label.fontSize,
      isPositionPinned: label.isPositionPinned === true,
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

  return labels.map((label) => {
    const candidate = layoutById.get(label.id);
    if (!candidate) return label;

    const nextBoxX = clamp(candidate.boxX, plotLeft + 5, plotRight - candidate.boxWidth - 5);
    const nextBoxY = clamp(candidate.boxY, plotTop, plotBottom - candidate.boxHeight);
    const nextCenterY = nextBoxY + (candidate.boxHeight / 2);
    const nextCenterX = nextBoxX + (candidate.boxWidth / 2);
    const isLabelLeft = nextCenterX <= label.anchorX;
    const nextArrowStartX = isLabelLeft ? nextBoxX + candidate.boxWidth : nextBoxX;
    const nextArrow = buildArrowGeometry(nextArrowStartX, nextCenterY, label.anchorX, label.anchorY);

    return {
      ...label,
      boxX: nextBoxX,
      boxY: nextBoxY,
      boxWidth: candidate.boxWidth,
      boxHeight: candidate.boxHeight,
      textX: nextBoxX + (candidate.boxWidth / 2),
      textY: nextCenterY,
      fontSize: candidate.fontSize,
      arrow: nextArrow || label.arrow
    };
  }).map((label) => applyPreviewToArrowedBoxLabel(
    label,
    props.dragPreviewId,
    props.dragPreviewOffset,
    { buildArrowGeometry }
  ));
});

</script>

<template>
  <g class="equipment-layer">
    <template v-for="shape in equipmentShapes" :key="shape.id">
      <rect
        v-if="shape.type === 'rect'"
        class="equipment-hit-target equipment-hit-target--rect"
        :x="shape.x"
        :y="shape.y"
        :width="shape.width"
        :height="shape.height"
        @mousemove="handleHover(shape, $event)"
        @mouseleave="handleLeave"
        @click.stop="handleSelect(shape)"
      />
      <rect
        v-if="shape.type === 'rect'"
        class="equipment-shape"
        :data-equipment-index="shape.equipmentIndex"
        :x="shape.x"
        :y="shape.y"
        :width="shape.width"
        :height="shape.height"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        fill="none"
        pointer-events="none"
      />
      <line
        v-if="shape.type === 'line'"
        class="equipment-hit-target equipment-hit-target--line"
        :x1="shape.x1"
        :y1="shape.y1"
        :x2="shape.x2"
        :y2="shape.y2"
        @mousemove="handleHover(shape, $event)"
        @mouseleave="handleLeave"
        @click.stop="handleSelect(shape)"
      />
      <line
        v-if="shape.type === 'line'"
        class="equipment-shape"
        :data-equipment-index="shape.equipmentIndex"
        :x1="shape.x1"
        :y1="shape.y1"
        :x2="shape.x2"
        :y2="shape.y2"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        pointer-events="none"
      />
      <polygon
        v-if="shape.type === 'polygon'"
        class="equipment-hit-target equipment-hit-target--polygon"
        :points="shape.points"
        @mousemove="handleHover(shape, $event)"
        @mouseleave="handleLeave"
        @click.stop="handleSelect(shape)"
      />
      <polygon
        v-if="shape.type === 'polygon'"
        class="equipment-shape"
        :data-equipment-index="shape.equipmentIndex"
        :points="shape.points"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        fill="none"
        pointer-events="none"
      />
      <ellipse
        v-if="shape.type === 'ellipse'"
        class="equipment-hit-target equipment-hit-target--ellipse"
        :cx="shape.cx"
        :cy="shape.cy"
        :rx="shape.rx"
        :ry="shape.ry"
        @mousemove="handleHover(shape, $event)"
        @mouseleave="handleLeave"
        @click.stop="handleSelect(shape)"
      />
      <ellipse
        v-if="shape.type === 'ellipse'"
        class="equipment-shape"
        :data-equipment-index="shape.equipmentIndex"
        :cx="shape.cx"
        :cy="shape.cy"
        :rx="shape.rx"
        :ry="shape.ry"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        fill="none"
        pointer-events="none"
      />
      <circle
        v-if="shape.type === 'circle'"
        class="equipment-hit-target equipment-hit-target--circle"
        :cx="shape.cx"
        :cy="shape.cy"
        :r="shape.r"
        @mousemove="handleHover(shape, $event)"
        @mouseleave="handleLeave"
        @click.stop="handleSelect(shape)"
      />
      <circle
        v-if="shape.type === 'circle'"
        class="equipment-shape"
        :data-equipment-index="shape.equipmentIndex"
        :cx="shape.cx"
        :cy="shape.cy"
        :r="shape.r"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        fill="none"
        pointer-events="none"
      />
    </template>

    <g
      v-for="label in equipmentLabels"
      :key="label.id"
      class="equipment-layer__label-group"
      :data-equipment-index="label.equipmentIndex"
      @mousemove="handleHover(label, $event)"
      @mouseleave="handleLeave"
      @click="handleSelect(label)"
      @pointerdown.stop.prevent="handleLabelPointerDown(label, $event)"
    >
      <line
        class="equipment-layer__label-arrow-line"
        :x1="label.arrow.lineX1"
        :y1="label.arrow.lineY1"
        :x2="label.arrow.lineX2"
        :y2="label.arrow.lineY2"
      />
      <polygon
        class="equipment-layer__label-arrow-head"
        :points="label.arrow.arrowPoints"
      />
      <rect
        class="equipment-layer__label-box"
        :x="label.boxX"
        :y="label.boxY"
        :width="label.boxWidth"
        :height="label.boxHeight"
        rx="5"
      />
      <text
        class="equipment-layer__label-text"
        :x="label.textX"
        :y="label.textY"
        text-anchor="middle"
        dominant-baseline="middle"
        :style="{ fontSize: `${label.fontSize}px` }"
      >
        {{ label.text }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.equipment-shape {
  stroke-width: 1;
  pointer-events: none;
}

.equipment-hit-target {
  cursor: pointer;
}

.equipment-hit-target--rect,
.equipment-hit-target--polygon,
.equipment-hit-target--ellipse,
.equipment-hit-target--circle {
  fill: rgba(0, 0, 0, 0);
  stroke: transparent;
  stroke-width: 12;
}

.equipment-hit-target--line {
  stroke: transparent;
  stroke-width: 16;
  stroke-linecap: round;
  pointer-events: stroke;
}

.equipment-layer__label-group {
  pointer-events: auto;
  cursor: pointer;
}

.equipment-layer__label-arrow-line {
  stroke: var(--color-ink-strong);
  stroke-width: 1.5;
}

.equipment-layer__label-arrow-head {
  fill: var(--color-ink-strong);
  stroke: none;
}

.equipment-layer__label-box {
  fill: var(--color-cross-core-fill);
  stroke: var(--color-ink-strong);
  stroke-width: 1.4;
}

.equipment-layer__label-text {
  fill: var(--color-ink-strong);
  font-weight: 700;
}
</style>
