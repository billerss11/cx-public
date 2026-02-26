<script setup>
import { computed } from 'vue';
import { clamp } from '@/utils/general.js';
import {
  DIRECTIONAL_EPSILON,
  isFinitePoint,
  resolveScreenFrameAtMD,
} from './directionalProjection.js';

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
  projector: {
    type: Function,
    required: true,
  },
  totalMd: {
    type: Number,
    default: 0,
  },
  diameterScale: {
    type: Number,
    default: 1,
  },
});

const emit = defineEmits(['select-equipment', 'hover-equipment', 'leave-equipment']);

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

const frameContext = computed(() => ({
  project: props.projector,
  totalMD: Number(props.totalMd),
  diameterScale: Number(props.diameterScale),
  maxProjectedRadius: 0,
}));

function normalizeEquipmentType(type) {
  const normalized = String(type ?? '').trim().toLowerCase();
  if (normalized === 'packer') return 'packer';
  if (normalized === 'safety valve' || normalized === 'safety_valve' || normalized === 'safety-valve') {
    return 'safety-valve';
  }
  return '';
}

function resolveSafetyValveHalfHeight(startPoint, endPoint, scale) {
  const tubingInnerDiameterPx = Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]);
  const rawHalfHeight = (tubingInnerDiameterPx * 0.3) * scale;
  const maxHalfHeight = tubingInnerDiameterPx / 2;
  if (!Number.isFinite(rawHalfHeight) || rawHalfHeight <= 0) return SAFETY_VALVE_MIN_HALF_HEIGHT;
  return Math.max(SAFETY_VALVE_MIN_HALF_HEIGHT, Math.min(maxHalfHeight, rawHalfHeight));
}

const equipmentShapes = computed(() => {
  const shapes = [];

  props.equipment.forEach((equip, index) => {
    const equipmentIndex = Number.isInteger(Number(equip?.sourceIndex)) && Number(equip.sourceIndex) >= 0
      ? Number(equip.sourceIndex)
      : index;
    const md = clamp(equip.depth, 0, props.totalMd);
    const frame = resolveScreenFrameAtMD(md, frameContext.value);
    if (!frame) return;
    const equipmentType = normalizeEquipmentType(equip?.type);

    if (equipmentType === 'packer') {
      const isOrphaned = equip.isOrphaned === true;
      const sealInnerDiameter = Number(equip.sealInnerDiameter ?? equip.tubingParentOD);
      const sealOuterDiameter = Number(equip.sealOuterDiameter ?? equip.parentInnerDiameter);
      const hasResolvedSealGeometry = Number.isFinite(sealInnerDiameter)
        && Number.isFinite(sealOuterDiameter)
        && sealOuterDiameter > sealInnerDiameter + DIRECTIONAL_EPSILON;
      const childOuterRadius = hasResolvedSealGeometry
        ? (sealInnerDiameter / 2) * props.diameterScale
        : ORPHAN_MIN_RADIUS * props.diameterScale;
      const height = DEFAULT_PACKER_HEIGHT * equip.scale;

      if (isOrphaned) {
        const orphanWidth = (childOuterRadius * 0.5) + 5; // Arbitrary visible width

        [-1, 1].forEach((sideSign) => {
          const side = sideSign === -1 ? 'left' : 'right';
          const startPt = props.projector(md, sideSign * childOuterRadius);
          const endPt = props.projector(md, sideSign * (childOuterRadius + orphanWidth));
          if (!isFinitePoint(startPt) || !isFinitePoint(endPt)) return;

          const startPtEnd = [ startPt[0] + (frame.tangent.x * height), startPt[1] + (frame.tangent.y * height) ];
          const endPtEnd = [ endPt[0] + (frame.tangent.x * height), endPt[1] + (frame.tangent.y * height) ];

          shapes.push({
            type: 'polygon',
            id: `equip-${index}-orphan-${side}`,
            equipmentIndex,
            points: [startPt, endPt, endPtEnd, startPtEnd].map((p) => p.join(',')).join(' '),
            color: ORPHAN_COLOR,
            isOrphaned: true,
          });
        });
      } else {
        if (!hasResolvedSealGeometry) return;
        const parentInnerRadius = (sealOuterDiameter / 2) * props.diameterScale;
        if (parentInnerRadius <= childOuterRadius + DIRECTIONAL_EPSILON) return;

        [-1, 1].forEach((sideSign) => {
          const side = sideSign === -1 ? 'left' : 'right';
          const innerStart = props.projector(md, sideSign * childOuterRadius);
          const outerStart = props.projector(md, sideSign * parentInnerRadius);
          if (!isFinitePoint(innerStart) || !isFinitePoint(outerStart)) return;

          const innerEnd = [ innerStart[0] + (frame.tangent.x * height), innerStart[1] + (frame.tangent.y * height) ];
          const outerEnd = [ outerStart[0] + (frame.tangent.x * height), outerStart[1] + (frame.tangent.y * height) ];

          shapes.push({
            type: 'polygon',
            id: `equip-${index}-box-${side}`,
            equipmentIndex,
            points: [outerStart, innerStart, innerEnd, outerEnd].map((p) => p.join(',')).join(' '),
            color: equip.color,
          });
          shapes.push({
            type: 'line',
            id: `equip-${index}-cross1-${side}`,
            equipmentIndex,
            points: [outerStart, innerEnd],
            color: equip.color,
          });
          shapes.push({
            type: 'line',
            id: `equip-${index}-cross2-${side}`,
            equipmentIndex,
            points: [innerStart, outerEnd],
            color: equip.color,
          });
        });
      }
    } else if (equipmentType === 'safety-valve') {
      const isOrphaned = equip.tubingParentIndex === null;
      const tubingID = Number(equip.tubingParentID);
      if (!Number.isFinite(tubingID)) return;

      const innerRadius = (tubingID / 2) * props.diameterScale;
      const p1 = props.projector(md, -innerRadius);
      const p2 = props.projector(md, innerRadius);
      if (!isFinitePoint(p1) || !isFinitePoint(p2)) return;
      const halfHeight = resolveSafetyValveHalfHeight(p1, p2, equip.scale);
      const center = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const normalDx = p2[0] - p1[0];
      const normalDy = p2[1] - p1[1];
      const normalLength = Math.hypot(normalDx, normalDy);
      if (normalLength <= DIRECTIONAL_EPSILON) return;

      const normalUnit = [normalDx / normalLength, normalDy / normalLength];
      const tangentLength = Math.hypot(frame.tangent.x, frame.tangent.y);
      if (tangentLength <= DIRECTIONAL_EPSILON) return;
      const tangentUnit = [frame.tangent.x / tangentLength, frame.tangent.y / tangentLength];
      const halfWidth = normalLength / 2;
      const crossFactor = 0.7;
      const crossHalfWidth = halfWidth * crossFactor;
      const crossHalfHeight = halfHeight * crossFactor;

      const diagonalOffsetA = [
        (normalUnit[0] * crossHalfWidth) + (tangentUnit[0] * crossHalfHeight),
        (normalUnit[1] * crossHalfWidth) + (tangentUnit[1] * crossHalfHeight)
      ];
      const diagonalOffsetB = [
        (normalUnit[0] * crossHalfWidth) - (tangentUnit[0] * crossHalfHeight),
        (normalUnit[1] * crossHalfWidth) - (tangentUnit[1] * crossHalfHeight)
      ];

      shapes.push({
        type: 'ellipse',
        id: `equip-${index}-ssv-ellipse`,
        equipmentIndex,
        cx: center[0],
        cy: center[1],
        rx: halfWidth,
        ry: halfHeight,
        rotation: (Math.atan2(normalDy, normalDx) * 180) / Math.PI,
        color: isOrphaned ? ORPHAN_COLOR : equip.color,
        isOrphaned
      });
      shapes.push({
        type: 'line',
        id: `equip-${index}-ssv-cross1`,
        equipmentIndex,
        points: [
          [center[0] - diagonalOffsetA[0], center[1] - diagonalOffsetA[1]],
          [center[0] + diagonalOffsetA[0], center[1] + diagonalOffsetA[1]]
        ],
        color: isOrphaned ? ORPHAN_COLOR : equip.color,
        isOrphaned
      });
      shapes.push({
        type: 'line',
        id: `equip-${index}-ssv-cross2`,
        equipmentIndex,
        points: [
          [center[0] - diagonalOffsetB[0], center[1] - diagonalOffsetB[1]],
          [center[0] + diagonalOffsetB[0], center[1] + diagonalOffsetB[1]]
        ],
        color: isOrphaned ? ORPHAN_COLOR : equip.color,
        isOrphaned
      });
    }
  });

  return shapes;
});
</script>

<template>
  <g class="directional-equipment-layer">
    <template v-for="shape in equipmentShapes" :key="shape.id">
      <polygon
        v-if="shape.type === 'polygon'"
        class="equipment-hit-target equipment-hit-target--polygon"
        :data-equipment-index="shape.equipmentIndex"
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
        :data-equipment-index="shape.equipmentIndex"
        :cx="shape.cx"
        :cy="shape.cy"
        :rx="shape.rx"
        :ry="shape.ry"
        :transform="`rotate(${shape.rotation} ${shape.cx} ${shape.cy})`"
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
        :transform="`rotate(${shape.rotation} ${shape.cx} ${shape.cy})`"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        fill="none"
        pointer-events="none"
      />
      <line
        v-if="shape.type === 'line'"
        class="equipment-hit-target equipment-hit-target--line"
        :data-equipment-index="shape.equipmentIndex"
        :x1="shape.points[0][0]"
        :y1="shape.points[0][1]"
        :x2="shape.points[1][0]"
        :y2="shape.points[1][1]"
        @mousemove="handleHover(shape, $event)"
        @mouseleave="handleLeave"
        @click.stop="handleSelect(shape)"
      />
      <line
        v-if="shape.type === 'line'"
        class="equipment-shape"
        :data-equipment-index="shape.equipmentIndex"
        :x1="shape.points[0][0]"
        :y1="shape.points[0][1]"
        :x2="shape.points[1][0]"
        :y2="shape.points[1][1]"
        :stroke="shape.color"
        :stroke-dasharray="shape.isOrphaned ? ORPHAN_DASH_STYLE : null"
        pointer-events="none"
      />
    </template>
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

.equipment-hit-target--polygon {
  fill: rgba(0, 0, 0, 0);
  stroke: transparent;
  stroke-width: 14;
  stroke-linejoin: round;
}

.equipment-hit-target--ellipse {
  fill: rgba(0, 0, 0, 0);
  stroke: transparent;
  stroke-width: 12;
}

.equipment-hit-target--line {
  stroke: transparent;
  stroke-width: 20;
  stroke-linecap: round;
  pointer-events: stroke;
}

.plot-highlight.equipment-shape {
  stroke: var(--p-primary-700) !important;
  stroke-width: 2px !important;
  filter:
    drop-shadow(0 0 10px color-mix(in srgb, var(--color-accent-primary) 78%, transparent))
    drop-shadow(0 0 18px color-mix(in srgb, var(--color-accent-primary) 52%, transparent));
}
</style>
