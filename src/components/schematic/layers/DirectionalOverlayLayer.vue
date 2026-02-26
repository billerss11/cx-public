<script setup>
import { computed } from 'vue';
import {
  clamp,
  formatDepthValue,
  getHorizontalAnchor,
  getLineStyle,
  parseOptionalNumber,
  wrapTextToLines
} from '@/utils/general.js';
import {
  resolveAnchoredHorizontalCallout,
  resolveConfiguredIntervalCalloutStandoffPx,
  resolveVerticalLabelCollisions
} from '@/utils/labelLayout.js';
import { t } from '@/app/i18n.js';
import { isOpenHoleRow } from '@/app/domain.js';
import { getStackAtDepth as getPhysicsStackAtDepth } from '@/composables/usePhysics.js';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';
import {
  DIRECTIONAL_EPSILON,
  toFiniteNumber,
  isFinitePoint,
  buildDirectionalProjector,
  resolveScreenFrameAtMD,
  normalizeXExaggeration
} from './directionalProjection.js';

const ANNOTATION_SIDE_PADDING_PX = 12;
const ANNOTATION_WELL_GAP_PX = 8;
const ANNOTATION_MIN_WIDTH_PX = 60;
const ANNOTATION_MIN_HEIGHT_PX = 18;
const CASING_ARROW_MODE_NORMAL_LOCKED = 'normal-locked';
const CASING_ARROW_MODE_DIRECT_TO_ANCHOR = 'direct-to-anchor';

const props = defineProps({
  trajectoryPoints: {
    type: Array,
    default: () => []
  },
  physicsContext: {
    type: Object,
    default: null
  },
  casingData: {
    type: Array,
    default: () => []
  },
  horizontalLines: {
    type: Array,
    default: () => []
  },
  annulusFluids: {
    type: Array,
    default: () => []
  },
  cementPlugs: {
    type: Array,
    default: () => []
  },
  annotationBoxes: {
    type: Array,
    default: () => []
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
  minXData: {
    type: Number,
    required: true
  },
  maxXData: {
    type: Number,
    required: true
  },
  minYData: {
    type: Number,
    required: true
  },
  maxYData: {
    type: Number,
    required: true
  },
  totalMd: {
    type: Number,
    default: 0
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  maxProjectedRadius: {
    type: Number,
    default: 0
  },
  xExaggeration: {
    type: Number,
    default: 1
  },
  xOrigin: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits([
  'select-pipe',
  'hover-pipe',
  'leave-pipe',
  'select-equipment',
  'hover-equipment',
  'leave-equipment',
  'select-line',
  'hover-line',
  'leave-line',
  'select-fluid',
  'hover-fluid',
  'leave-fluid',
  'select-box',
  'hover-box',
  'leave-box'
]);

function normalizePipeType(pipeType) {
  const normalized = String(pipeType ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function resolvePipeEntity(pipeType, rowIndex) {
  const normalizedType = normalizePipeType(pipeType);
  const normalizedRowIndex = Number(rowIndex);
  if (!Number.isInteger(normalizedRowIndex)) return null;
  return {
    pipeType: normalizedType,
    rowIndex: normalizedRowIndex
  };
}

function handlePipeLabelHover(pipeType, rowIndex, event) {
  const entity = resolvePipeEntity(pipeType, rowIndex);
  if (!entity) return;
  emit('hover-pipe', entity, event);
}

function handlePipeLabelLeave(pipeType, rowIndex) {
  const entity = resolvePipeEntity(pipeType, rowIndex);
  if (!entity) return;
  emit('leave-pipe', entity);
}

function handlePipeLabelSelect(pipeType, rowIndex) {
  const entity = resolvePipeEntity(pipeType, rowIndex);
  if (!entity) return;
  emit('select-pipe', entity);
}

function handleEquipmentHover(item, event) {
  const equipmentIndex = Number(item?.equipmentIndex);
  if (!Number.isInteger(equipmentIndex)) return;
  emit('hover-equipment', equipmentIndex, event);
}

function handleEquipmentLeave(item) {
  const equipmentIndex = Number(item?.equipmentIndex);
  if (!Number.isInteger(equipmentIndex)) return;
  emit('leave-equipment', equipmentIndex);
}

function handleEquipmentSelect(item) {
  const equipmentIndex = Number(item?.equipmentIndex);
  if (!Number.isInteger(equipmentIndex)) return;
  emit('select-equipment', equipmentIndex);
}

function handleDepthHover(item, event) {
  const entity = resolvePipeEntity('casing', item?.casingIndex);
  if (!entity) return;
  emit('hover-pipe', entity, event);
}

function handleDepthLeave(item) {
  const entity = resolvePipeEntity('casing', item?.casingIndex);
  if (!entity) return;
  emit('leave-pipe', entity);
}

function handleDepthSelect(item) {
  const entity = resolvePipeEntity('casing', item?.casingIndex);
  if (!entity) return;
  emit('select-pipe', entity);
}

function resolveTransientPipeTypeFromOperationPhase(operationPhase) {
  const normalized = String(operationPhase ?? '').trim().toLowerCase();
  return normalized === 'drilling' ? 'drillString' : 'tubing';
}

function resolvePipeLabelDataKey(pipeType, rowIndex) {
  const entity = resolvePipeEntity(pipeType, rowIndex);
  if (!entity) return null;
  return `${entity.pipeType}:${entity.rowIndex}`;
}

function handleLineHover(item, event) {
  const lineIndex = Number(item?.lineIndex);
  if (!Number.isInteger(lineIndex)) return;
  emit('hover-line', lineIndex, event);
}

function handleLineLeave(item) {
  const lineIndex = Number(item?.lineIndex);
  if (!Number.isInteger(lineIndex)) return;
  emit('leave-line', lineIndex);
}

function handleLineSelect(item) {
  const lineIndex = Number(item?.lineIndex);
  if (!Number.isInteger(lineIndex)) return;
  emit('select-line', lineIndex);
}

function handleFluidHover(item, event) {
  const fluidIndex = Number(item?.fluidIndex);
  if (!Number.isInteger(fluidIndex)) return;
  emit('hover-fluid', fluidIndex, event);
}

function handleFluidLeave(item) {
  const fluidIndex = Number(item?.fluidIndex);
  if (!Number.isInteger(fluidIndex)) return;
  emit('leave-fluid', fluidIndex);
}

function handleFluidSelect(item) {
  const fluidIndex = Number(item?.fluidIndex);
  if (!Number.isInteger(fluidIndex)) return;
  emit('select-fluid', fluidIndex);
}

function handleBoxHover(item, event) {
  const boxIndex = Number(item?.boxIndex);
  if (!Number.isInteger(boxIndex)) return;
  emit('hover-box', boxIndex, event);
}

function handleBoxLeave(item) {
  const boxIndex = Number(item?.boxIndex);
  if (!Number.isInteger(boxIndex)) return;
  emit('leave-box', boxIndex);
}

function handleBoxSelect(item) {
  const boxIndex = Number(item?.boxIndex);
  if (!Number.isInteger(boxIndex)) return;
  emit('select-box', boxIndex);
}

const project = computed(() => {
  const trajectoryPoints = Array.isArray(props.trajectoryPoints) ? props.trajectoryPoints : [];
  const xExaggeration = normalizeXExaggeration(props.xExaggeration);
  const xOrigin = toFiniteNumber(props.xOrigin, 0);
  return buildDirectionalProjector(trajectoryPoints, props.xScale, props.yScale, {
    xExaggeration,
    xOrigin
  });
});

const plotBounds = computed(() => {
  const left = Number(props.xScale(props.minXData));
  const right = Number(props.xScale(props.maxXData));
  const top = Number(props.yScale(props.minYData));
  const bottom = Number(props.yScale(props.maxYData));

  if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
    return null;
  }

  const xMin = Math.min(left, right);
  const xMax = Math.max(left, right);
  const yMin = Math.min(top, bottom);
  const yMax = Math.max(top, bottom);

  return {
    left: xMin,
    right: xMax,
    top: yMin,
    bottom: yMax,
    width: Math.max(1, xMax - xMin),
    height: Math.max(1, yMax - yMin)
  };
});

const frameContext = computed(() => ({
  project: project.value,
  totalMD: Math.max(0, Number(props.totalMd)),
  diameterScale: Number(props.diameterScale),
  maxProjectedRadius: Number(props.maxProjectedRadius)
}));

const resolvedPhysicsContext = computed(() => {
  if (props.physicsContext?.__physicsContext) return props.physicsContext;
  if (props.physicsContext?.value?.__physicsContext) return props.physicsContext.value;
  return null;
});

const sourceCasingRowsByIndex = computed(() => {
  const map = new Map();
  const rows = Array.isArray(props.casingData) ? props.casingData : [];
  rows.forEach((row, index) => {
    map.set(index, row);
  });
  return map;
});

const activeTransientPipeRows = computed(() => {
  const context = resolvedPhysicsContext.value;
  if (!context) return [];
  const isDrilling = String(context.operationPhase ?? '').trim().toLowerCase() === 'drilling';
  const rows = isDrilling
    ? context.drillStringRows
    : context.tubingRows;
  return Array.isArray(rows) ? rows : [];
});

const normalizedFluidRowsByIndex = computed(() => {
  const map = new Map();
  const rows = Array.isArray(resolvedPhysicsContext.value?.fluidRows)
    ? resolvedPhysicsContext.value.fluidRows
    : [];
  rows.forEach((row) => {
    const index = Number(row?.__index);
    if (!Number.isInteger(index)) return;
    map.set(index, row);
  });
  return map;
});

function resolveDirectionalLabelXRatio(value) {
  const parsed = toFiniteNumber(value, null);
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, -1, 1);
}

function resolveDirectionalLabelXPixelFromRatio(ratio, bounds) {
  if (!Number.isFinite(ratio) || !bounds) return null;
  return bounds.left + (((ratio + 1) / 2) * bounds.width);
}

function resolveDirectionalIntervalCalloutStandoff(bounds) {
  const width = Math.max(1, Number(bounds?.width) || 0);
  const adaptive = width * LAYOUT_CONSTANTS.INTERVAL_CALLOUT_DIRECTIONAL_STANDOFF_RATIO;
  return clamp(
    adaptive,
    LAYOUT_CONSTANTS.INTERVAL_CALLOUT_DIRECTIONAL_STANDOFF_MIN_PX,
    LAYOUT_CONSTANTS.INTERVAL_CALLOUT_DIRECTIONAL_STANDOFF_MAX_PX
  );
}

function resolveDirectionalIntervalCalloutXNudge(value) {
  const parsed = toFiniteNumber(value, null);
  if (!Number.isFinite(parsed)) return 0;
  // Keep fine tuning as a constrained nudge around anchored placement.
  return clamp(parsed, -1, 1) * LAYOUT_CONSTANTS.INTERVAL_CALLOUT_X_NUDGE_MAX_PX;
}

function normalizeDirectionalCasingArrowMode(value) {
  return String(value ?? '').trim().toLowerCase() === CASING_ARROW_MODE_DIRECT_TO_ANCHOR
    ? CASING_ARROW_MODE_DIRECT_TO_ANCHOR
    : CASING_ARROW_MODE_NORMAL_LOCKED;
}

function buildArrowHeadPoints(from, tip, length = 6, halfWidth = 3) {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= DIRECTIONAL_EPSILON) return '';

  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;

  const baseX = tip[0] - (ux * length);
  const baseY = tip[1] - (uy * length);
  const p1 = `${tip[0]},${tip[1]}`;
  const p2 = `${baseX + (px * halfWidth)},${baseY + (py * halfWidth)}`;
  const p3 = `${baseX - (px * halfWidth)},${baseY - (py * halfWidth)}`;
  return `${p1} ${p2} ${p3}`;
}

function buildHorizontalLabelPlacementCandidate({
  side,
  anchorLeft,
  anchorRight,
  boxWidth,
  bounds,
  labelHorizontalOffset
}) {
  const anchor = side === 'right' ? anchorRight : anchorLeft;
  if (!isFinitePoint(anchor)) return null;

  const preferredX = side === 'right'
    ? anchor[0] + labelHorizontalOffset
    : anchor[0] - labelHorizontalOffset;
  const rawBoxX = preferredX - (boxWidth / 2);
  const minBoxX = bounds.left + 5;
  const maxBoxX = bounds.right - boxWidth - 5;
  const overflowLeft = Math.max(0, minBoxX - rawBoxX);
  const overflowRight = Math.max(0, rawBoxX - maxBoxX);

  return {
    side,
    anchor,
    preferredX,
    overflow: overflowLeft + overflowRight
  };
}

function resolveOverflowAwareSide({
  preferredSide,
  anchorLeft,
  anchorRight,
  boxWidth,
  bounds,
  labelHorizontalOffset
}) {
  const primary = buildHorizontalLabelPlacementCandidate({
    side: preferredSide,
    anchorLeft,
    anchorRight,
    boxWidth,
    bounds,
    labelHorizontalOffset
  });
  const fallbackSide = preferredSide === 'right' ? 'left' : 'right';
  const fallback = buildHorizontalLabelPlacementCandidate({
    side: fallbackSide,
    anchorLeft,
    anchorRight,
    boxWidth,
    bounds,
    labelHorizontalOffset
  });

  if (!primary) return fallback;
  if (!fallback || primary.overflow <= DIRECTIONAL_EPSILON) return primary;
  return fallback.overflow < primary.overflow ? fallback : primary;
}

function normalizeScreenVector(x, y, fallbackX, fallbackY) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= DIRECTIONAL_EPSILON) {
    const fallbackLength = Math.hypot(fallbackX, fallbackY);
    if (!Number.isFinite(fallbackLength) || fallbackLength <= DIRECTIONAL_EPSILON) {
      return { x: 1, y: 0 };
    }
    return { x: fallbackX / fallbackLength, y: fallbackY / fallbackLength };
  }
  return { x: x / length, y: y / length };
}

function buildSweptDirection(outward, tangent, angleDegrees) {
  const radians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const x = (outward.x * cos) + (tangent.x * sin);
  const y = (outward.y * cos) + (tangent.y * sin);
  return normalizeScreenVector(x, y, outward.x, outward.y);
}

function measureBoxOverflow(rawBoxX, rawBoxY, boxWidth, boxHeight, bounds) {
  const minBoxX = bounds.left + 5;
  const maxBoxX = bounds.right - boxWidth - 5;
  const minBoxY = bounds.top;
  const maxBoxY = bounds.bottom - boxHeight;
  const overflowLeft = Math.max(0, minBoxX - rawBoxX);
  const overflowRight = Math.max(0, rawBoxX - maxBoxX);
  const overflowTop = Math.max(0, minBoxY - rawBoxY);
  const overflowBottom = Math.max(0, rawBoxY - maxBoxY);
  return overflowLeft + overflowRight + overflowTop + overflowBottom;
}

function resolveRayBoxIntersection(origin, direction, box) {
  if (!isFinitePoint(origin)) return null;
  const dx = Number(direction?.x);
  const dy = Number(direction?.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.hypot(dx, dy) <= DIRECTIONAL_EPSILON) return null;

  const boxX = Number(box?.x);
  const boxY = Number(box?.y);
  const boxWidth = Number(box?.width);
  const boxHeight = Number(box?.height);
  if (!Number.isFinite(boxX) ||
    !Number.isFinite(boxY) ||
    !Number.isFinite(boxWidth) ||
    !Number.isFinite(boxHeight) ||
    boxWidth <= 0 ||
    boxHeight <= 0) {
    return null;
  }

  const minX = boxX;
  const maxX = boxX + boxWidth;
  const minY = boxY;
  const maxY = boxY + boxHeight;
  const candidates = [];
  const pushCandidate = (t, x, y) => {
    if (!Number.isFinite(t) || t <= DIRECTIONAL_EPSILON) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX - DIRECTIONAL_EPSILON || x > maxX + DIRECTIONAL_EPSILON) return;
    if (y < minY - DIRECTIONAL_EPSILON || y > maxY + DIRECTIONAL_EPSILON) return;
    candidates.push({ t, point: [x, y] });
  };

  if (Math.abs(dx) > DIRECTIONAL_EPSILON) {
    const leftT = (minX - origin[0]) / dx;
    pushCandidate(leftT, minX, origin[1] + (leftT * dy));
    const rightT = (maxX - origin[0]) / dx;
    pushCandidate(rightT, maxX, origin[1] + (rightT * dy));
  }

  if (Math.abs(dy) > DIRECTIONAL_EPSILON) {
    const topT = (minY - origin[1]) / dy;
    pushCandidate(topT, origin[0] + (topT * dx), minY);
    const bottomT = (maxY - origin[1]) / dy;
    pushCandidate(bottomT, origin[0] + (bottomT * dx), maxY);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0].point;
}

function resolveDirectArrowStartPoint(anchor, boxX, boxY, boxWidth, boxHeight) {
  if (!isFinitePoint(anchor)) return null;
  const center = [boxX + (boxWidth / 2), boxY + (boxHeight / 2)];
  return resolveRayBoxIntersection(
    center,
    {
      x: anchor[0] - center[0],
      y: anchor[1] - center[1]
    },
    {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight
    }
  );
}

function applyVerticalCollisionSweepBySide(labels, bounds, options = {}) {
  if (!Array.isArray(labels) || labels.length <= 1 || !bounds) return;

  const groups = { left: [], right: [] };
  labels.forEach((label) => {
    if (!label) return;
    const side = label.side === 'left' ? 'left' : 'right';
    groups[side].push(label);
  });

  const paddingY = Math.max(0, toFiniteNumber(options.paddingY, 0));
  const gapY = Math.max(0, toFiniteNumber(options.gapY, 0));

  ['left', 'right'].forEach((side) => {
    const group = groups[side];
    if (group.length <= 1) return;

    const resolvedCenters = resolveVerticalLabelCollisions(
      group.map((item) => ({
        idealCenterY: item.boxY + (item.boxHeight / 2),
        boxHeight: item.boxHeight
      })),
      {
        top: bounds.top,
        bottom: bounds.bottom,
        paddingY,
        gapY
      }
    );

    group.forEach((item, index) => {
      const centerY = Number(resolvedCenters[index]);
      if (!Number.isFinite(centerY)) return;
      item.boxY = clamp(
        centerY - (item.boxHeight / 2),
        bounds.top,
        bounds.bottom - item.boxHeight
      );
    });
  });
}

function resolveCasingLabelArrowStartPoint({
  anchor,
  boxX,
  boxY,
  boxWidth,
  boxHeight,
  isLabelOnRight,
  labelDepth,
  totalMd,
  frameContextValue,
  casingArrowMode
}) {
  if (!isFinitePoint(anchor)) return null;

  let arrowStartPoint = null;
  if (casingArrowMode === CASING_ARROW_MODE_DIRECT_TO_ANCHOR) {
    arrowStartPoint = resolveDirectArrowStartPoint(anchor, boxX, boxY, boxWidth, boxHeight);
  } else if (totalMd > DIRECTIONAL_EPSILON) {
    const frame = resolveScreenFrameAtMD(clamp(labelDepth, 0, totalMd), frameContextValue);
    if (frame) {
      const sideSign = isLabelOnRight ? 1 : -1;
      let outward = normalizeScreenVector(
        Number(frame.normal?.x) * sideSign,
        Number(frame.normal?.y) * sideSign,
        sideSign,
        0
      );
      const boxCenterX = boxX + (boxWidth / 2);
      const boxCenterY = boxY + (boxHeight / 2);
      const toBoxX = boxCenterX - anchor[0];
      const toBoxY = boxCenterY - anchor[1];
      if (((outward.x * toBoxX) + (outward.y * toBoxY)) < 0) {
        outward = { x: -outward.x, y: -outward.y };
      }
      arrowStartPoint = resolveRayBoxIntersection(
        anchor,
        outward,
        {
          x: boxX,
          y: boxY,
          width: boxWidth,
          height: boxHeight
        }
      );
    }
  }

  if (!isFinitePoint(arrowStartPoint)) {
    arrowStartPoint = resolveDirectArrowStartPoint(anchor, boxX, boxY, boxWidth, boxHeight);
  }
  return arrowStartPoint;
}

function resolveRadialCasingLabelPlacement({
  center,
  sideOrder,
  anchorsBySide,
  frame,
  distance,
  boxWidth,
  boxHeight,
  bounds
}) {
  if (!isFinitePoint(center) || !frame) return null;

  const normal = normalizeScreenVector(frame.normal?.x, frame.normal?.y, 1, 0);
  const tangent = normalizeScreenVector(frame.tangent?.x, frame.tangent?.y, 0, 1);
  const sweepAngles = [0, 20, -20, 40, -40, 60, -60, 80, -80];
  const centerClearance = Math.max(12, Math.min(32, (boxWidth * 0.2)));

  let best = null;
  sideOrder.forEach((side, sideIndex) => {
    const anchor = anchorsBySide[side];
    if (!isFinitePoint(anchor)) return;
    const sideSign = side === 'right' ? 1 : -1;
    const outward = { x: normal.x * sideSign, y: normal.y * sideSign };

    sweepAngles.forEach((angle) => {
      const direction = buildSweptDirection(outward, tangent, angle);
      const labelCenterX = anchor[0] + (direction.x * distance);
      const labelCenterY = anchor[1] + (direction.y * distance);
      const rawBoxX = labelCenterX - (boxWidth / 2);
      const rawBoxY = labelCenterY - (boxHeight / 2);
      const overflow = measureBoxOverflow(rawBoxX, rawBoxY, boxWidth, boxHeight, bounds);

      const dx = Math.max(0, Math.abs(center[0] - labelCenterX) - (boxWidth / 2));
      const dy = Math.max(0, Math.abs(center[1] - labelCenterY) - (boxHeight / 2));
      const centerDistanceToBox = Math.hypot(dx, dy);
      const overlapPenalty = Math.max(0, centerClearance - centerDistanceToBox);
      const sidePenalty = sideIndex * 25;
      const sweepPenalty = Math.abs(angle) * 0.08;
      const score = (overflow * 12) + (overlapPenalty * 4) + sidePenalty + sweepPenalty;

      if (!best || score < best.score) {
        best = {
          side,
          anchor,
          centerX: labelCenterX,
          centerY: labelCenterY,
          score
        };
      }
    });
  });

  return best;
}

function resolveAutoCasingLabelDepth({
  exposedTop,
  rowBottom,
  fallbackDepth,
  projectFn,
  placedLabelCenters
}) {
  const top = Math.min(exposedTop, rowBottom);
  const bottom = Math.max(exposedTop, rowBottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top + DIRECTIONAL_EPSILON) {
    return fallbackDepth;
  }

  const span = bottom - top;
  const centerDepth = clamp(fallbackDepth, top, bottom);
  const sampleCount = clamp(Math.round(span / 350), 6, 16);
  const candidates = new Set([centerDepth]);
  for (let index = 0; index <= sampleCount; index += 1) {
    const ratio = index / sampleCount;
    candidates.add(top + (span * ratio));
  }

  let bestDepth = centerDepth;
  let bestScore = Number.NEGATIVE_INFINITY;
  const effectiveCenters = Array.isArray(placedLabelCenters) ? placedLabelCenters : [];
  const edgePadding = Math.max(40, span * 0.08);
  const halfSpan = Math.max(1, span / 2);

  candidates.forEach((candidateDepth) => {
    const depth = clamp(candidateDepth, top, bottom);
    const center = projectFn(depth, 0);
    if (!isFinitePoint(center)) return;

    const nearestGapPx = effectiveCenters.reduce((nearest, point) => (
      Math.min(nearest, Math.abs(center[1] - point[1]))
    ), Number.POSITIVE_INFINITY);
    const spacingScore = Number.isFinite(nearestGapPx) ? nearestGapPx : 24;

    const edgeDistance = Math.min(depth - top, bottom - depth);
    const edgeScore = clamp(edgeDistance / edgePadding, 0, 1) * 18;
    const centerBias = (1 - Math.min(1, Math.abs(depth - centerDepth) / halfSpan)) * 8;
    const score = spacingScore + edgeScore + centerBias;

    if (score > bestScore) {
      bestScore = score;
      bestDepth = depth;
    }
  });

  return bestDepth;
}

const depthAnnotations = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = plotBounds.value;
  const totalMd = Math.max(0, Number(props.totalMd));
  if (!physicsContext || !bounds || totalMd <= DIRECTIONAL_EPSILON) return [];

  const units = props.config?.units === 'm' ? 'm' : 'ft';

  const items = [];
  const rows = Array.isArray(physicsContext.casingRows) ? physicsContext.casingRows : [];
  const minCasingTop = rows.reduce((minDepth, row) => {
    const top = Number(row?.top);
    if (!Number.isFinite(top)) return minDepth;
    return Math.min(minDepth, top);
  }, Number.POSITIVE_INFINITY);

  rows.forEach((row) => {
    const sourceRow = sourceCasingRowsByIndex.value.get(Number(row?.__index)) || {};
    const depthLabelFontSizeRaw = Number(sourceRow?.depthLabelFontSize);
    const depthLabelFontSize = Number.isFinite(depthLabelFontSizeRaw)
      ? clamp(depthLabelFontSizeRaw, 8, 20)
      : 9;
    const depthLabelOffsetRaw = Number(sourceRow?.depthLabelOffset);
    const depthLabelOffset = Number.isFinite(depthLabelOffsetRaw)
      ? clamp(depthLabelOffsetRaw, 10, 120)
      : 35;
    const showTop = sourceRow.showTop !== false;
    const showBottom = sourceRow.showBottom !== false;
    const topDepth = Number(row?.top);
    const shouldShowTopDepth = showTop &&
      Number.isFinite(topDepth) &&
      (!Number.isFinite(minCasingTop) || topDepth > minCasingTop);
    const depths = [];
    if (shouldShowTopDepth) depths.push(topDepth);
    if (showBottom) depths.push(Number(row?.bottom));

    depths.forEach((depthValue, depthIndex) => {
      if (!Number.isFinite(depthValue)) return;
      const md = clamp(depthValue, 0, totalMd);
      const frame = resolveScreenFrameAtMD(md, frameContext.value);
      if (!frame) return;

      const rowOD = Number(row?.od);
      if (!Number.isFinite(rowOD) || rowOD <= 0) return;
      const halfWidth = (rowOD * Number(props.diameterScale)) / 2;
      const anchor = project.value(md, halfWidth);
      if (!isFinitePoint(anchor)) return;

      const outward = frame.normal;
      const lineEnd = [
        anchor[0] + (outward.x * depthLabelOffset),
        anchor[1] + (outward.y * depthLabelOffset)
      ];
      const labelText = `${formatDepthValue(depthValue)} ${units}`;
      const boxWidth = clamp(labelText.length * (depthLabelFontSize * 0.58) + 10, 52, 180);
      const boxHeight = clamp(depthLabelFontSize + 10, 16, 32);
      const placeRight = outward.x >= 0;

      let boxX = placeRight ? lineEnd[0] - 4 : lineEnd[0] - boxWidth + 4;
      let boxY = lineEnd[1] - (boxHeight / 2);
      boxX = clamp(boxX, bounds.left + 2, bounds.right - boxWidth - 2);
      boxY = clamp(boxY, bounds.top + 2, bounds.bottom - boxHeight - 2);

      const arrowTargetX = placeRight ? boxX : boxX + boxWidth;
      const arrowTargetY = clamp(lineEnd[1], boxY + 2, boxY + boxHeight - 2);
      const arrowHeadPoints = buildArrowHeadPoints(anchor, [arrowTargetX, arrowTargetY], 6, 3);
      if (!arrowHeadPoints) return;

      items.push({
        id: `depth-${row.__index}-${depthIndex}-${md.toFixed(3)}`,
        casingIndex: Number(row.__index),
        lineX1: anchor[0],
        lineY1: anchor[1],
        lineX2: arrowTargetX,
        lineY2: arrowTargetY,
        arrowHeadPoints,
        boxX,
        boxY,
        boxWidth,
        boxHeight,
        text: labelText,
        textX: placeRight ? boxX + 6 : boxX + boxWidth - 6,
        textY: boxY + (boxHeight / 2),
        textAnchor: placeRight ? 'start' : 'end',
        fontSize: depthLabelFontSize
      });
    });
  });

  return items;
});

function resolvePipeLabelFontSize(sourceRow, pipeType) {
  const raw = pipeType === 'casing'
    ? Number(sourceRow?.casingLabelFontSize)
    : Number(sourceRow?.labelFontSize);
  return Number.isFinite(raw) ? clamp(raw, 8, 20) : 11;
}

function buildPipeLabelLines(row, sourceRow, units, pipeType) {
  const lines = [];
  const label = String(sourceRow?.label ?? '').trim();
  if (label) lines.push(label);

  if (pipeType === 'casing' && isOpenHoleRow(row)) {
    lines.push(`${Number(row?.od).toFixed(3)}" ${t('common.open_hole')}`);
    return lines;
  }

  const od = Number(row?.od);
  if (!Number.isFinite(od) || od <= 0) return lines;

  const weight = Number.isFinite(Number(row?.weight)) ? Number(row.weight).toFixed(1) : '?';
  const grade = String(row?.grade ?? '').trim() || '?';
  lines.push(`${od.toFixed(3)}" ${weight}# ${grade}`);

  const hasCementInterval = pipeType === 'casing' &&
    Number.isFinite(Number(row?.toc)) &&
    Number.isFinite(Number(row?.boc)) &&
    Number(row.toc) < Number(row.boc);
  if (hasCementInterval) {
    lines.push(t('tooltip.toc_at', {
      value: formatDepthValue(row.toc),
      units
    }));
  }

  if (lines.length === 0 && pipeType === 'casing') {
    lines.push(t('common.unnamed_casing'));
  }

  return lines;
}

function buildDirectionalPipeLabelOverlays({
  rows,
  bounds,
  totalMd,
  units,
  casingArrowMode,
  frameContextValue,
  projectFn,
  diameterScale,
  pipeType,
  constrainManualDepthToInterval,
  sourceRowsByIndex = null
}) {
  const labelPaddingX = 8;
  const labelPaddingY = 5;
  const labelHorizontalMargin = 10;
  const labelHorizontalOffset = 170;
  const sortedRows = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => Number(b?.od) - Number(a?.od));
  const items = [];
  const placedLabelCenters = [];

  sortedRows.forEach((row) => {
    const rowIndex = Number(row?.__index);
    if (!Number.isInteger(rowIndex)) return;
    const sourceRow = sourceRowsByIndex instanceof Map ? (sourceRowsByIndex.get(rowIndex) || row) : row;
    if (pipeType !== 'casing' && sourceRow?.showLabel === false) return;

    const rowTop = toFiniteNumber(row?.top, null);
    const rowBottom = toFiniteNumber(row?.bottom, null);
    if (!Number.isFinite(rowTop) || !Number.isFinite(rowBottom) || rowBottom <= rowTop) return;

    const labelFontSize = resolvePipeLabelFontSize(sourceRow, pipeType);
    const lineHeight = labelFontSize + 2;
    const halfWidth = (Number(row?.od) * Number(diameterScale)) / 2;
    if (!Number.isFinite(halfWidth) || halfWidth <= DIRECTIONAL_EPSILON) return;

    let exposedTop = rowTop;
    const largerRow = sortedRows.find((candidate) => (
      Number(candidate?.__index) !== rowIndex &&
      Number(candidate?.od) > Number(row?.od) &&
      Number.isFinite(Number(candidate?.bottom)) &&
      Number(candidate.bottom) > rowTop &&
      Number(candidate.bottom) < rowBottom
    ));
    if (largerRow) exposedTop = Math.max(exposedTop, Number(largerRow?.bottom));
    const midpoint = clamp((exposedTop + rowBottom) / 2, rowTop, rowBottom);

    const manualDepth = toFiniteNumber(sourceRow?.manualLabelDepth);
    const hasManualDepth = Number.isFinite(manualDepth);
    const labelDepth = hasManualDepth
      ? (constrainManualDepthToInterval
        ? clamp(manualDepth, rowTop, rowBottom)
        : (totalMd > DIRECTIONAL_EPSILON ? clamp(manualDepth, 0, totalMd) : manualDepth))
      : resolveAutoCasingLabelDepth({
        exposedTop,
        rowBottom,
        fallbackDepth: midpoint,
        projectFn,
        placedLabelCenters
      });

    const anchorLeft = projectFn(labelDepth, -halfWidth);
    const anchorRight = projectFn(labelDepth, halfWidth);
    const center = projectFn(labelDepth, 0);
    const hasLeftAnchor = isFinitePoint(anchorLeft);
    const hasRightAnchor = isFinitePoint(anchorRight);
    if ((!hasLeftAnchor && !hasRightAnchor) || !isFinitePoint(center)) return;

    const lines = buildPipeLabelLines(row, sourceRow, units, pipeType);
    if (lines.length === 0) return;

    const maxLineWidth = lines.reduce((maxWidth, lineText) => (
      Math.max(maxWidth, estimateLineWidth(lineText, labelFontSize))
    ), 0);
    const boxWidth = clamp(maxLineWidth + (labelPaddingX * 2), 100, 280);
    const boxHeight = (lines.length * lineHeight) + (labelPaddingY * 2);

    const manualXRatio = resolveDirectionalLabelXRatio(sourceRow?.labelXPos);
    const manualX = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds)
      : null;

    let preferredSide = 'right';
    if (Number.isFinite(manualX)) {
      preferredSide = manualX >= center[0] ? 'right' : 'left';
    } else if (!hasRightAnchor) {
      preferredSide = 'left';
    } else if (!hasLeftAnchor) {
      preferredSide = 'right';
    } else {
      const leftSpace = Math.max(0, anchorLeft[0] - (bounds.left + labelHorizontalMargin) - (boxWidth / 2));
      const rightSpace = Math.max(0, (bounds.right - labelHorizontalMargin) - anchorRight[0] - (boxWidth / 2));
      preferredSide = rightSpace >= leftSpace ? 'right' : 'left';
    }

    let preferredAnchor = preferredSide === 'right'
      ? (hasRightAnchor ? anchorRight : anchorLeft)
      : (hasLeftAnchor ? anchorLeft : anchorRight);
    if (!isFinitePoint(preferredAnchor)) return;

    let preferredX = Number.isFinite(manualX)
      ? manualX
      : (preferredSide === 'right'
        ? preferredAnchor[0] + labelHorizontalOffset
        : preferredAnchor[0] - labelHorizontalOffset);
    let preferredY = center[1];
    if (!Number.isFinite(manualX)) {
      const sidePlacement = resolveOverflowAwareSide({
        preferredSide,
        anchorLeft: hasLeftAnchor ? anchorLeft : null,
        anchorRight: hasRightAnchor ? anchorRight : null,
        boxWidth,
        bounds,
        labelHorizontalOffset
      });
      if (sidePlacement) {
        preferredSide = sidePlacement.side;
        preferredAnchor = sidePlacement.anchor;
        preferredX = sidePlacement.preferredX;
      }

      if (totalMd > DIRECTIONAL_EPSILON) {
        const md = clamp(labelDepth, 0, totalMd);
        const frame = resolveScreenFrameAtMD(md, frameContextValue);
        const sideOrder = preferredSide === 'right' ? ['right', 'left'] : ['left', 'right'];
        const radialPlacement = resolveRadialCasingLabelPlacement({
          center,
          sideOrder,
          anchorsBySide: {
            left: hasLeftAnchor ? anchorLeft : null,
            right: hasRightAnchor ? anchorRight : null
          },
          frame,
          distance: labelHorizontalOffset,
          boxWidth,
          boxHeight,
          bounds
        });
        if (radialPlacement) {
          preferredSide = radialPlacement.side;
          preferredAnchor = radialPlacement.anchor;
          preferredX = radialPlacement.centerX;
          if (!hasManualDepth) {
            preferredY = radialPlacement.centerY;
          }
        }
      }
    }

    preferredY = clamp(
      preferredY,
      bounds.top + 10 + (boxHeight / 2),
      bounds.bottom - 10 - (boxHeight / 2)
    );
    const boxX = clamp(preferredX - (boxWidth / 2), bounds.left + 5, bounds.right - boxWidth - 5);
    const boxY = clamp(preferredY - (boxHeight / 2), bounds.top, bounds.bottom - boxHeight);

    const boxCenterX = boxX + (boxWidth / 2);
    const validAnchors = [anchorLeft, anchorRight].filter((candidate) => isFinitePoint(candidate));
    if (validAnchors.length === 0) return;
    const nearestAnchor = validAnchors.reduce((best, candidate) => {
      if (!best) return candidate;
      const bestDistance = Math.abs(best[0] - boxCenterX);
      const candidateDistance = Math.abs(candidate[0] - boxCenterX);
      return candidateDistance < bestDistance ? candidate : best;
    }, null);
    const sortedAnchors = [...validAnchors].sort((left, right) => left[0] - right[0]);
    const isLabelOnRight = boxCenterX >= center[0];
    const sideAnchor = isLabelOnRight
      ? sortedAnchors[sortedAnchors.length - 1]
      : sortedAnchors[0];
    const anchor = sideAnchor || nearestAnchor;
    if (!isFinitePoint(anchor)) return;

    items.push({
      id: `${pipeType}-label-${rowIndex}`,
      pipeType,
      rowIndex,
      side: isLabelOnRight ? 'right' : 'left',
      isLabelOnRight,
      anchorX: anchor[0],
      anchorY: anchor[1],
      labelDepth,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      fontSize: labelFontSize,
      lineHeight,
      lines
    });
    placedLabelCenters.push([center[0], center[1]]);
  });

  applyVerticalCollisionSweepBySide(items, bounds, {
    paddingY: 5,
    gapY: 6
  });

  return items.map((item) => {
    const boxCenterX = item.boxX + (item.boxWidth / 2);
    const boxCenterY = item.boxY + (item.boxHeight / 2);
    const anchor = [item.anchorX, item.anchorY];
    const arrowStartPoint = resolveCasingLabelArrowStartPoint({
      anchor,
      boxX: item.boxX,
      boxY: item.boxY,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      isLabelOnRight: item.isLabelOnRight,
      labelDepth: item.labelDepth,
      totalMd,
      frameContextValue,
      casingArrowMode
    });

    const arrowStartX = Number(arrowStartPoint?.[0]);
    const arrowStartY = Number(arrowStartPoint?.[1]);
    const resolvedArrowStartX = Number.isFinite(arrowStartX)
      ? arrowStartX
      : (item.anchorX >= boxCenterX ? item.boxX + item.boxWidth : item.boxX);
    const resolvedArrowStartY = Number.isFinite(arrowStartY)
      ? arrowStartY
      : boxCenterY;
    const arrowPoints = buildArrowHeadPoints(
      [resolvedArrowStartX, resolvedArrowStartY],
      anchor,
      6,
      3
    );
    if (!arrowPoints) return null;

    const dataKey = resolvePipeLabelDataKey(item.pipeType, item.rowIndex);
    if (!dataKey) return null;

    const textRows = item.lines.map((lineText, index) => ({
      id: `${item.id}-text-${index}`,
      text: lineText,
      x: item.boxX + (item.boxWidth / 2),
      y: item.boxY + labelPaddingY + ((index + 0.7) * item.lineHeight)
    }));

    return {
      id: item.id,
      pipeType: item.pipeType,
      rowIndex: item.rowIndex,
      dataKey,
      arrowStartX: resolvedArrowStartX,
      arrowStartY: resolvedArrowStartY,
      arrowEndX: item.anchorX,
      arrowEndY: item.anchorY,
      arrowPoints,
      boxX: item.boxX,
      boxY: item.boxY,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      fontSize: item.fontSize,
      textRows
    };
  }).filter(Boolean);
}

const casingLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = plotBounds.value;
  if (!physicsContext || !bounds) return [];

  return buildDirectionalPipeLabelOverlays({
    rows: Array.isArray(physicsContext.casingRows) ? physicsContext.casingRows : [],
    bounds,
    totalMd: Math.max(0, Number(props.totalMd)),
    units: props.config?.units === 'm' ? 'm' : 'ft',
    casingArrowMode: normalizeDirectionalCasingArrowMode(props.config?.directionalCasingArrowMode),
    frameContextValue: frameContext.value,
    projectFn: project.value,
    diameterScale: Number(props.diameterScale),
    pipeType: 'casing',
    constrainManualDepthToInterval: true,
    sourceRowsByIndex: sourceCasingRowsByIndex.value
  });
});

const transientPipeLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = plotBounds.value;
  if (!physicsContext || !bounds) return [];

  const transientPipeType = resolveTransientPipeTypeFromOperationPhase(physicsContext.operationPhase);
  return buildDirectionalPipeLabelOverlays({
    rows: activeTransientPipeRows.value,
    bounds,
    totalMd: Math.max(0, Number(props.totalMd)),
    units: props.config?.units === 'm' ? 'm' : 'ft',
    casingArrowMode: normalizeDirectionalCasingArrowMode(props.config?.directionalCasingArrowMode),
    frameContextValue: frameContext.value,
    projectFn: project.value,
    diameterScale: Number(props.diameterScale),
    pipeType: transientPipeType,
    constrainManualDepthToInterval: false
  });
});

const equipmentLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = plotBounds.value;
  const totalMd = Math.max(0, Number(props.totalMd));
  if (!physicsContext || !bounds || totalMd <= DIRECTIONAL_EPSILON) return [];

  const labelPaddingY = 5;
  const labelHorizontalOffset = 170;
  const casingArrowMode = normalizeDirectionalCasingArrowMode(props.config?.directionalCasingArrowMode);
  const items = [];

  const rows = Array.isArray(physicsContext.equipment) ? physicsContext.equipment : [];
  rows.forEach((row, index) => {
    if (row?.showLabel === false) return;
    const equipmentIndex = Number.isInteger(Number(row?.sourceIndex)) && Number(row.sourceIndex) >= 0
      ? Number(row.sourceIndex)
      : index;
    if (!Number.isInteger(equipmentIndex)) return;

    const labelText = String(row?.label ?? row?.type ?? '').trim();
    if (!labelText) return;

    const anchorDepth = toFiniteNumber(row?.depth, null);
    if (!Number.isFinite(anchorDepth)) return;
    const anchorMd = clamp(anchorDepth, 0, totalMd);
    const anchor = project.value(anchorMd, 0);
    if (!isFinitePoint(anchor)) return;

    const manualDepth = toFiniteNumber(row?.manualLabelDepth);
    const labelMd = Number.isFinite(manualDepth) ? clamp(manualDepth, 0, totalMd) : anchorMd;
    const center = project.value(labelMd, 0);
    const centerPoint = isFinitePoint(center) ? center : anchor;

    const labelFontSize = Number.isFinite(Number(row?.labelFontSize))
      ? clamp(Number(row.labelFontSize), 8, 20)
      : 11;
    const lineHeight = labelFontSize + 2;
    const boxWidth = clamp(estimateLineWidth(labelText, labelFontSize) + 16, 90, 260);
    const boxHeight = (lineHeight) + (labelPaddingY * 2);

    const manualXRatio = resolveDirectionalLabelXRatio(row?.labelXPos);
    const manualX = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds)
      : null;
    let preferredSide = 'right';
    if (Number.isFinite(manualX)) {
      preferredSide = manualX >= centerPoint[0] ? 'right' : 'left';
    }
    const sidePlacement = resolveOverflowAwareSide({
      preferredSide,
      anchorLeft: anchor,
      anchorRight: anchor,
      boxWidth,
      bounds,
      labelHorizontalOffset
    });

    const preferredX = Number.isFinite(manualX)
      ? manualX
      : (sidePlacement?.preferredX ?? (anchor[0] + (preferredSide === 'right' ? labelHorizontalOffset : -labelHorizontalOffset)));
    const preferredY = centerPoint[1];
    const boxX = clamp(preferredX - (boxWidth / 2), bounds.left + 5, bounds.right - boxWidth - 5);
    const boxY = clamp(
      preferredY - (boxHeight / 2),
      bounds.top,
      bounds.bottom - boxHeight
    );
    const boxCenterX = boxX + (boxWidth / 2);
    const isLabelOnRight = boxCenterX >= anchor[0];

    items.push({
      id: `equipment-label-${equipmentIndex}`,
      equipmentIndex,
      side: isLabelOnRight ? 'right' : 'left',
      isLabelOnRight,
      labelDepth: anchorMd,
      anchorX: anchor[0],
      anchorY: anchor[1],
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      fontSize: labelFontSize,
      lineHeight,
      lines: [labelText]
    });
  });

  applyVerticalCollisionSweepBySide(items, bounds, {
    paddingY: 5,
    gapY: 6
  });

  return items.map((item) => {
    const boxCenterX = item.boxX + (item.boxWidth / 2);
    const boxCenterY = item.boxY + (item.boxHeight / 2);
    const anchor = [item.anchorX, item.anchorY];
    const arrowStartPoint = resolveCasingLabelArrowStartPoint({
      anchor,
      boxX: item.boxX,
      boxY: item.boxY,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      isLabelOnRight: item.isLabelOnRight,
      labelDepth: item.labelDepth,
      totalMd,
      frameContextValue: frameContext.value,
      casingArrowMode
    });

    const arrowStartX = Number(arrowStartPoint?.[0]);
    const arrowStartY = Number(arrowStartPoint?.[1]);
    const resolvedArrowStartX = Number.isFinite(arrowStartX)
      ? arrowStartX
      : (item.anchorX >= boxCenterX ? item.boxX + item.boxWidth : item.boxX);
    const resolvedArrowStartY = Number.isFinite(arrowStartY)
      ? arrowStartY
      : boxCenterY;
    const arrowPoints = buildArrowHeadPoints(
      [resolvedArrowStartX, resolvedArrowStartY],
      anchor,
      6,
      3
    );
    if (!arrowPoints) return null;

    const textRows = item.lines.map((lineText, index) => ({
      id: `${item.id}-text-${index}`,
      text: lineText,
      x: item.boxX + (item.boxWidth / 2),
      y: item.boxY + labelPaddingY + ((index + 0.7) * item.lineHeight)
    }));

    return {
      id: item.id,
      equipmentIndex: item.equipmentIndex,
      arrowStartX: resolvedArrowStartX,
      arrowStartY: resolvedArrowStartY,
      arrowEndX: item.anchorX,
      arrowEndY: item.anchorY,
      arrowPoints,
      boxX: item.boxX,
      boxY: item.boxY,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      fontSize: item.fontSize,
      textRows
    };
  }).filter(Boolean);
});

const plugLabelOverlays = computed(() => {
  const bounds = plotBounds.value;
  const totalMd = Math.max(0, Number(props.totalMd));
  const rows = Array.isArray(props.cementPlugs) ? props.cementPlugs : [];
  if (!bounds || totalMd <= DIRECTIONAL_EPSILON || rows.length === 0) return [];

  const items = [];
  rows.forEach((plug, plugIndex) => {
    if (plug?.show === false) return;
    const label = String(plug?.label ?? '').trim();
    if (!label) return;
    const top = toFiniteNumber(plug?.top, null);
    const bottom = toFiniteNumber(plug?.bottom, null);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;

    const md = clamp((top + bottom) / 2, 0, totalMd);
    const center = project.value(md, 0);
    if (!isFinitePoint(center)) return;
    const x = clamp(center[0], bounds.left + 5, bounds.right - 5);
    const y = clamp(center[1], bounds.top + 5, bounds.bottom - 5);

    items.push({
      id: `plug-label-${plugIndex}`,
      x,
      y,
      text: label
    });
  });
  return items;
});

const fluidLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = plotBounds.value;
  const totalMd = Math.max(0, Number(props.totalMd));
  const fluids = Array.isArray(props.annulusFluids) ? props.annulusFluids : [];
  if (!physicsContext || !bounds || totalMd <= DIRECTIONAL_EPSILON || fluids.length === 0) return [];

  const items = [];
  fluids.forEach((fluid, fluidIndex) => {
    if (fluid?.show === false) return;
    const normalizedFluid = normalizedFluidRowsByIndex.value.get(fluidIndex) || null;

    const label = String(fluid?.label ?? normalizedFluid?.label ?? '').trim();
    if (!label) return;

    const top = parseOptionalNumber(fluid?.top) ?? toFiniteNumber(normalizedFluid?.top, null);
    const bottom = parseOptionalNumber(fluid?.bottom) ?? toFiniteNumber(normalizedFluid?.bottom, null);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;

    const manualDepth = parseOptionalNumber(fluid?.manualDepth) ??
      parseOptionalNumber(normalizedFluid?.manualDepth);
    const labelDepth = Number.isFinite(manualDepth)
      ? clamp(manualDepth, top, bottom)
      : ((top + bottom) / 2);
    const md = clamp(labelDepth, 0, totalMd);

    const fluidLayer = resolveFluidLayerAtDepth(labelDepth, fluidIndex, physicsContext);
    if (!fluidLayer) return;

    const innerRadius = Number(fluidLayer?.innerRadius);
    const outerRadius = Number(fluidLayer?.outerRadius);
    if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius) return;

    const midOffset = ((innerRadius + outerRadius) / 2) * Number(props.diameterScale);
    if (!Number.isFinite(midOffset) || midOffset <= 0) return;

    const leftAnchor = project.value(md, -midOffset);
    const rightAnchor = project.value(md, midOffset);
    const centerAnchor = project.value(md, 0);
    if (!isFinitePoint(leftAnchor) || !isFinitePoint(rightAnchor) || !isFinitePoint(centerAnchor)) return;

    const fontSize = Number.isFinite(Number(fluid?.fontSize)) ? Number(fluid.fontSize) : 11;
    const textColor = fluid?.textColor || 'var(--color-ink-strong)';
    const strokeColor = fluid?.color || 'var(--color-default-fluid-stroke)';
    const wrappedLines = wrapTextToLines(label, 220, fontSize);
    const lineHeight = fontSize + 6;
    const labelHeight = (wrappedLines.length * lineHeight) + 12;
    const estimatedWidth = resolveLabelWidth(wrappedLines, fontSize);

    const standoffPx = resolveDirectionalIntervalCalloutStandoff(bounds);
    const preferredSidePlacement = resolveOverflowAwareSide({
      preferredSide: 'right',
      anchorLeft: leftAnchor,
      anchorRight: rightAnchor,
      boxWidth: estimatedWidth,
      bounds,
      labelHorizontalOffset: standoffPx
    });
    const calloutPlacement = resolveAnchoredHorizontalCallout({
      preferredSide: preferredSidePlacement?.side || 'right',
      centerX: centerAnchor[0],
      anchorLeftX: leftAnchor[0],
      anchorRightX: rightAnchor[0],
      boxWidth: estimatedWidth,
      boundsLeft: bounds.left,
      boundsRight: bounds.right,
      standoffPx,
      nudgePx: resolveDirectionalIntervalCalloutXNudge(fluid?.labelXPos),
      minBoxPadding: 5,
      minConnectorLength: LAYOUT_CONSTANTS.INTERVAL_CALLOUT_DIRECTIONAL_MIN_CONNECTOR_PX
    });
    if (!calloutPlacement) return;

    const sideAnchor = calloutPlacement.side === 'right' ? rightAnchor : leftAnchor;
    if (!isFinitePoint(sideAnchor)) return;

    const textAnchor = calloutPlacement.textAnchor;
    const boxX = calloutPlacement.boxX;
    const labelYPixel = clamp(centerAnchor[1], bounds.top + 10, bounds.bottom - 10);
    const boxY = clamp(labelYPixel - (labelHeight / 2), bounds.top + 5, bounds.bottom - labelHeight - 5);
    const arrowStartX = calloutPlacement.arrowStartX;
    const arrowStartY = boxY + (labelHeight / 2);
    const arrowPoints = buildArrowHeadPoints([arrowStartX, arrowStartY], sideAnchor, 6, 3);
    if (!arrowPoints) return;

    const textX = textAnchor === 'end'
      ? boxX + estimatedWidth - 6
      : (textAnchor === 'middle' ? boxX + (estimatedWidth / 2) : boxX + 6);
    const textY = boxY + (labelHeight / 2);
    const firstLineOffset = -((wrappedLines.length - 1) * lineHeight) / 2;
    const textLines = wrappedLines.map((lineText, index) => ({
      id: `fluid-label-${fluidIndex}-text-${index}`,
      text: lineText,
      x: textX,
      dy: index === 0 ? firstLineOffset : lineHeight
    }));

    items.push({
      id: `fluid-label-${fluidIndex}`,
      fluidIndex,
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
      arrowStartX,
      arrowStartY,
      arrowEndX: sideAnchor[0],
      arrowEndY: sideAnchor[1],
      arrowPoints
    });
  });

  return items;
});

function resolveLabelWidth(lines, fontSize, maxWidth = 220) {
  const longest = lines.reduce((maxLength, line) => Math.max(maxLength, String(line ?? '').length), 0);
  return Math.max(
    80,
    Math.min(maxWidth, (longest * fontSize * 0.6) + 16)
  );
}

function estimateLineWidth(text, fontSize) {
  return Array.from(String(text ?? '')).reduce((total, ch) => (
    total + (ch.charCodeAt(0) > 255 ? fontSize * 0.95 : fontSize * 0.58)
  ), 0);
}

function resolveFluidLayerAtDepth(depth, fluidIndex, physicsContext) {
  if (!Number.isFinite(depth) || !Number.isInteger(fluidIndex)) return null;
  const stack = getPhysicsStackAtDepth(depth, physicsContext);
  if (!Array.isArray(stack) || stack.length === 0) return null;
  return stack.find((layer) => (
    layer?.material === 'fluid' &&
    Number(layer?.source?.index) === fluidIndex
  )) || null;
}

function resolveAnnotationLines(box) {
  const lines = [];
  const label = String(box?.label ?? '').trim();
  if (label) lines.push(label);

  if (box?.showDetails && box?.detail) {
    const detailLines = String(box.detail)
      .split(/\\n|\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    lines.push(...detailLines);
  }

  if (lines.length === 0) lines.push('Annotation');
  return lines;
}

function resolveAnnotationBandWidthScale(value, fallback = 1.0) {
  const parsed = toFiniteNumber(value, null);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(1.0, Math.max(0.1, fallback));
  }
  return Math.min(1.0, Math.max(0.1, parsed));
}

function resolveIntervalCalloutAnnotationStandoffPx(bounds) {
  const configured = resolveConfiguredIntervalCalloutStandoffPx(props.config?.intervalCalloutStandoffPx);
  if (Number.isFinite(configured)) return configured;

  const width = Math.max(1, Number(bounds?.width) || 0);
  const adaptiveFallback = Math.max(ANNOTATION_WELL_GAP_PX, width * 0.02);
  return adaptiveFallback;
}

function resolveAnnotationBandVerticalBounds(topDepth, bottomDepth, totalMd, context, bounds) {
  const topMD = clamp(topDepth, 0, totalMd);
  const bottomMD = clamp(bottomDepth, 0, totalMd);
  if (!Number.isFinite(topMD) || !Number.isFinite(bottomMD) || bottomMD <= topMD + DIRECTIONAL_EPSILON) {
    return null;
  }

  const topFrame = resolveScreenFrameAtMD(topMD, context);
  const bottomFrame = resolveScreenFrameAtMD(bottomMD, context);
  if (!topFrame || !bottomFrame) return null;

  let topY = Math.min(topFrame.center[1], bottomFrame.center[1]);
  let bottomY = Math.max(topFrame.center[1], bottomFrame.center[1]);
  if (!Number.isFinite(topY) || !Number.isFinite(bottomY)) return null;

  if ((bottomY - topY) < ANNOTATION_MIN_HEIGHT_PX) {
    const middleY = (topY + bottomY) / 2;
    topY = middleY - (ANNOTATION_MIN_HEIGHT_PX / 2);
    bottomY = middleY + (ANNOTATION_MIN_HEIGHT_PX / 2);
  }

  const minY = bounds.top + ANNOTATION_SIDE_PADDING_PX;
  const maxY = bounds.bottom - ANNOTATION_SIDE_PADDING_PX;
  topY = clamp(topY, minY, maxY - 1);
  bottomY = clamp(bottomY, topY + 1, maxY);

  return {
    topMD,
    bottomMD,
    topY,
    bottomY,
    midMD: (topMD + bottomMD) / 2
  };
}

const annotationBandOverlays = computed(() => {
  const bounds = plotBounds.value;
  const totalMd = Math.max(0, Number(props.totalMd));
  const boxes = Array.isArray(props.annotationBoxes) ? props.annotationBoxes : [];
  if (!bounds || totalMd <= DIRECTIONAL_EPSILON || boxes.length === 0) return [];
  const boxStandoffPx = resolveIntervalCalloutAnnotationStandoffPx(bounds);

  const wallOffset = Math.max(
    Number(props.maxProjectedRadius) + Number(props.diameterScale),
    Number(props.diameterScale) * 2,
    2
  );

  return boxes.map((box, boxIndex) => {
    if (box?.show === false) return null;
    const topDepth = toFiniteNumber(box?.topDepth, null);
    const bottomDepth = toFiniteNumber(box?.bottomDepth, null);
    if (!Number.isFinite(topDepth) || !Number.isFinite(bottomDepth) || bottomDepth <= topDepth) return null;

    const verticalBounds = resolveAnnotationBandVerticalBounds(
      topDepth,
      bottomDepth,
      totalMd,
      frameContext.value,
      bounds
    );
    if (!verticalBounds) return null;

    const manualXRatio = resolveDirectionalLabelXRatio(box?.labelXPos);
    const sideSign = Number.isFinite(manualXRatio) && manualXRatio >= 0 ? 1 : -1;

    const wallPoint = project.value(verticalBounds.midMD, sideSign * wallOffset);
    if (!isFinitePoint(wallPoint)) return null;

    const clampedWallX = clamp(
      wallPoint[0],
      bounds.left + ANNOTATION_SIDE_PADDING_PX + ANNOTATION_MIN_WIDTH_PX,
      bounds.right - ANNOTATION_SIDE_PADDING_PX - ANNOTATION_MIN_WIDTH_PX
    );
    const bandStartXRaw = sideSign > 0
      ? clampedWallX + boxStandoffPx
      : clampedWallX - boxStandoffPx;
    const bandStartX = clamp(
      bandStartXRaw,
      bounds.left + ANNOTATION_SIDE_PADDING_PX + ANNOTATION_MIN_WIDTH_PX,
      bounds.right - ANNOTATION_SIDE_PADDING_PX - ANNOTATION_MIN_WIDTH_PX
    );
    const availableBandWidth = sideSign > 0
      ? (bounds.right - ANNOTATION_SIDE_PADDING_PX - bandStartX)
      : (bandStartX - (bounds.left + ANNOTATION_SIDE_PADDING_PX));
    if (!Number.isFinite(availableBandWidth) || availableBandWidth <= ANNOTATION_MIN_WIDTH_PX) return null;

    const bandWidthScale = resolveAnnotationBandWidthScale(box?.bandWidth, 1.0);
    const bandWidth = clamp(
      availableBandWidth * bandWidthScale,
      ANNOTATION_MIN_WIDTH_PX,
      availableBandWidth
    );
    const bandXRaw = sideSign > 0 ? bandStartX : bandStartX - bandWidth;
    const bandX = clamp(
      bandXRaw,
      bounds.left + ANNOTATION_SIDE_PADDING_PX,
      bounds.right - ANNOTATION_SIDE_PADDING_PX - bandWidth
    );
    const bandY = verticalBounds.topY;
    const bandHeight = Math.max(1, verticalBounds.bottomY - verticalBounds.topY);

    const lines = resolveAnnotationLines(box);
    const fontSizeRaw = toFiniteNumber(box?.fontSize, null);
    const fontSize = clamp(Number.isFinite(fontSizeRaw) ? fontSizeRaw : 12, 9, 20);
    const lineHeight = fontSize + 5;
    const fillColor = box?.color || 'var(--color-default-box)';
    const textColor = box?.fontColor || fillColor;
    const boxOpacity = clamp(toFiniteNumber(box?.opacity, 0.35), 0.05, 1.0);

    const manualXPixel = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds)
      : null;
    const textAnchor = Number.isFinite(manualXRatio)
      ? getHorizontalAnchor(manualXRatio, 1, sideSign > 0 ? 'start' : 'end')
      : (sideSign > 0 ? 'start' : 'end');
    const textX = Number.isFinite(manualXPixel)
      ? clamp(manualXPixel, bandX + 10, bandX + bandWidth - 10)
      : (sideSign > 0 ? bandX + 10 : bandX + bandWidth - 10);
    const textBlockHeight = (lines.length - 1) * lineHeight;
    const startY = clamp(
      (bandY + (bandHeight / 2)) - (textBlockHeight / 2),
      bandY + fontSize + 2,
      bandY + bandHeight - textBlockHeight - 3
    );
    const textLines = lines.map((lineText, idx) => ({
      id: `annotation-${boxIndex}-text-${idx}`,
      text: lineText,
      x: textX,
      y: clamp(startY + (idx * lineHeight), bandY + fontSize + 2, bandY + bandHeight - 3),
      fontWeight: idx === 0 ? 'bold' : 'normal'
    }));

    return {
      id: `annotation-${boxIndex}`,
      boxIndex,
      boxX: bandX,
      boxY: bandY,
      boxWidth: bandWidth,
      boxHeight: bandHeight,
      fillColor,
      textColor,
      boxOpacity,
      textAnchor,
      fontSize,
      textLines
    };
  }).filter(Boolean);
});

const horizontalLineOverlays = computed(() => {
  const bounds = plotBounds.value;
  const totalMd = Math.max(0, Number(props.totalMd));
  const lines = Array.isArray(props.horizontalLines) ? props.horizontalLines : [];
  if (!bounds || totalMd <= DIRECTIONAL_EPSILON || lines.length === 0) return [];

  const unitsLabel = props.config?.units === 'm' ? 'm' : 'ft';
  return lines.map((line, lineIndex) => {
    if (line?.show === false) return null;
    const depthValue = toFiniteNumber(line?.depth, null);
    if (!Number.isFinite(depthValue)) return null;

    const md = clamp(depthValue, 0, totalMd);
    const frame = resolveScreenFrameAtMD(md, frameContext.value);
    if (!frame) return null;

    const lineY = clamp(frame.center[1], bounds.top, bounds.bottom);
    if (!Number.isFinite(lineY)) return null;

    const lineStyle = getLineStyle(line?.lineStyle);
    const lineColor = line?.color || 'var(--color-default-line)';
    const fontColor = line?.fontColor || lineColor;
    const fontSize = Number.isFinite(Number(line?.fontSize)) ? Number(line.fontSize) : 11;

    const depthText = `${formatDepthValue(depthValue)} ${unitsLabel}`;
    const displayText = line?.label ? `${line.label} ${depthText}` : depthText;
    const manualXRatio = resolveDirectionalLabelXRatio(line?.labelXPos);
    const labelXPixelRaw = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds)
      : (bounds.right - 12);
    const labelXPixel = clamp(labelXPixelRaw, bounds.left + 10, bounds.right - 10);
    const labelYPixel = clamp(lineY, bounds.top + 10, bounds.bottom - 10);
    const textAnchor = getHorizontalAnchor(
      Number.isFinite(manualXRatio) ? manualXRatio : 1,
      1,
      'end'
    );

    const wrappedLines = wrapTextToLines(displayText, 220, fontSize);
    const lineHeight = fontSize + 6;
    const labelHeight = (wrappedLines.length * lineHeight) + 12;
    const estimatedWidth = resolveLabelWidth(wrappedLines, fontSize);

    let boxX;
    if (textAnchor === 'end') boxX = labelXPixel - estimatedWidth + 5;
    else if (textAnchor === 'middle') boxX = labelXPixel - (estimatedWidth / 2);
    else boxX = labelXPixel - 5;
    boxX = clamp(boxX, bounds.left + 5, bounds.right - estimatedWidth - 5);
    const boxY = clamp(labelYPixel - (labelHeight / 2), bounds.top + 5, bounds.bottom - labelHeight - 5);

    const textX = textAnchor === 'end'
      ? boxX + estimatedWidth - 6
      : (textAnchor === 'middle' ? boxX + (estimatedWidth / 2) : boxX + 6);
    const textY = boxY + (labelHeight / 2);
    const firstLineOffset = -((wrappedLines.length - 1) * lineHeight) / 2;
    const textLines = wrappedLines.map((lineText, index) => ({
      id: `line-${lineIndex}-text-${index}`,
      text: lineText,
      x: textX,
      dy: index === 0 ? firstLineOffset : lineHeight
    }));

    return {
      id: `line-${lineIndex}`,
      lineIndex,
      y: lineY,
      x1: bounds.left,
      x2: bounds.right,
      stroke: lineColor,
      strokeDasharray: lineStyle,
      fontColor,
      fontSize,
      textAnchor,
      boxX,
      boxY,
      boxWidth: estimatedWidth,
      boxHeight: labelHeight,
      textX,
      textY,
      textLines
    };
  }).filter(Boolean);
});
</script>

<template>
  <g class="directional-overlay-layer">
    <g
      v-for="annotation in annotationBandOverlays"
      :key="annotation.id"
      class="directional-overlay-layer__annotation-group"
      :data-box-index="annotation.boxIndex"
      @mousemove="handleBoxHover(annotation, $event)"
      @mouseleave="handleBoxLeave(annotation)"
      @click="handleBoxSelect(annotation)"
    >
      <rect
        class="directional-overlay-layer__annotation-fill"
        :x="annotation.boxX"
        :y="annotation.boxY"
        :width="annotation.boxWidth"
        :height="annotation.boxHeight"
        :fill="annotation.fillColor"
        :opacity="annotation.boxOpacity"
        :stroke="annotation.textColor"
      />
      <text
        v-for="line in annotation.textLines"
        :key="line.id"
        class="directional-overlay-layer__annotation-text"
        :x="line.x"
        :y="line.y"
        :fill="annotation.textColor"
        :text-anchor="annotation.textAnchor"
        dominant-baseline="middle"
        :style="{ fontSize: `${annotation.fontSize}px`, fontWeight: line.fontWeight }"
      >
        {{ line.text }}
      </text>
    </g>

    <text
      v-for="plug in plugLabelOverlays"
      :key="plug.id"
      class="directional-overlay-layer__plug-label"
      :x="plug.x"
      :y="plug.y"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ plug.text }}
    </text>

    <g
      v-for="fluid in fluidLabelOverlays"
      :key="fluid.id"
      class="directional-overlay-layer__fluid-group"
      :data-fluid-index="fluid.fluidIndex"
      @mousemove="handleFluidHover(fluid, $event)"
      @mouseleave="handleFluidLeave(fluid)"
      @click="handleFluidSelect(fluid)"
    >
      <line
        class="directional-overlay-layer__fluid-arrow-hit"
        :x1="fluid.arrowStartX"
        :y1="fluid.arrowStartY"
        :x2="fluid.arrowEndX"
        :y2="fluid.arrowEndY"
      />
      <line
        class="directional-overlay-layer__fluid-arrow-line"
        :x1="fluid.arrowStartX"
        :y1="fluid.arrowStartY"
        :x2="fluid.arrowEndX"
        :y2="fluid.arrowEndY"
        :stroke="fluid.strokeColor"
      />
      <polygon
        class="directional-overlay-layer__fluid-arrow-head"
        :points="fluid.arrowPoints"
        :fill="fluid.strokeColor"
      />
      <rect
        class="directional-overlay-layer__fluid-label-bg"
        :x="fluid.boxX"
        :y="fluid.boxY"
        :width="fluid.boxWidth"
        :height="fluid.boxHeight"
        :stroke="fluid.strokeColor"
      />
      <text
        class="directional-overlay-layer__fluid-label-text"
        :x="fluid.textX"
        :y="fluid.textY"
        :text-anchor="fluid.textAnchor"
        dominant-baseline="middle"
        :style="{ fontSize: `${fluid.fontSize}px`, fill: fluid.textColor }"
      >
        <tspan
          v-for="segment in fluid.textLines"
          :key="segment.id"
          :x="segment.x"
          :dy="segment.dy"
        >
          {{ segment.text }}
        </tspan>
      </text>
    </g>

    <g
      v-for="item in depthAnnotations"
      :key="item.id"
      class="directional-overlay-layer__depth-group"
      :data-pipe-key="`casing:${item.casingIndex}`"
      :data-casing-index="item.casingIndex"
      @mousemove="handleDepthHover(item, $event)"
      @mouseleave="handleDepthLeave(item)"
      @click="handleDepthSelect(item)"
    >
      <line
        class="directional-overlay-layer__depth-line-hit"
        :x1="item.lineX1"
        :y1="item.lineY1"
        :x2="item.lineX2"
        :y2="item.lineY2"
      />
      <line
        class="directional-overlay-layer__depth-line"
        :x1="item.lineX1"
        :y1="item.lineY1"
        :x2="item.lineX2"
        :y2="item.lineY2"
      />
      <polygon
        class="directional-overlay-layer__depth-arrow"
        :points="item.arrowHeadPoints"
      />
      <rect
        class="directional-overlay-layer__depth-box"
        :x="item.boxX"
        :y="item.boxY"
        :width="item.boxWidth"
        :height="item.boxHeight"
        rx="3"
      />
      <text
        class="directional-overlay-layer__depth-text"
        :x="item.textX"
        :y="item.textY"
        :text-anchor="item.textAnchor"
        dominant-baseline="middle"
        :style="{ fontSize: `${item.fontSize}px` }"
      >
        {{ item.text }}
      </text>
    </g>

    <g
      v-for="label in casingLabelOverlays"
      :key="label.id"
      class="directional-overlay-layer__casing-group"
      :data-pipe-key="label.dataKey"
      :data-casing-index="label.pipeType === 'casing' ? label.rowIndex : null"
      @mousemove.stop="handlePipeLabelHover(label.pipeType, label.rowIndex, $event)"
      @mouseleave.stop="handlePipeLabelLeave(label.pipeType, label.rowIndex)"
      @click.stop="handlePipeLabelSelect(label.pipeType, label.rowIndex)"
    >
      <rect
        class="directional-overlay-layer__casing-label-hitbox"
        :x="label.boxX - 5"
        :y="label.boxY - 5"
        :width="label.boxWidth + 10"
        :height="label.boxHeight + 10"
      />
      <line
        class="directional-overlay-layer__casing-arrow-hit"
        :x1="label.arrowStartX"
        :y1="label.arrowStartY"
        :x2="label.arrowEndX"
        :y2="label.arrowEndY"
      />
      <line
        class="directional-overlay-layer__casing-arrow-line"
        :x1="label.arrowStartX"
        :y1="label.arrowStartY"
        :x2="label.arrowEndX"
        :y2="label.arrowEndY"
      />
      <polygon
        class="directional-overlay-layer__casing-arrow-head"
        :points="label.arrowPoints"
      />
      <rect
        class="directional-overlay-layer__casing-label-bg"
        :x="label.boxX"
        :y="label.boxY"
        :width="label.boxWidth"
        :height="label.boxHeight"
      />
      <text
        v-for="textRow in label.textRows"
        :key="textRow.id"
        class="directional-overlay-layer__casing-label-text"
        :x="textRow.x"
        :y="textRow.y"
        text-anchor="middle"
        :style="{ fontSize: `${label.fontSize}px` }"
      >
        {{ textRow.text }}
      </text>
    </g>

    <g
      v-for="label in transientPipeLabelOverlays"
      :key="label.id"
      class="directional-overlay-layer__casing-group"
      :data-pipe-key="label.dataKey"
      @mousemove.stop="handlePipeLabelHover(label.pipeType, label.rowIndex, $event)"
      @mouseleave.stop="handlePipeLabelLeave(label.pipeType, label.rowIndex)"
      @click.stop="handlePipeLabelSelect(label.pipeType, label.rowIndex)"
    >
      <rect
        class="directional-overlay-layer__casing-label-hitbox"
        :x="label.boxX - 5"
        :y="label.boxY - 5"
        :width="label.boxWidth + 10"
        :height="label.boxHeight + 10"
      />
      <line
        class="directional-overlay-layer__casing-arrow-hit"
        :x1="label.arrowStartX"
        :y1="label.arrowStartY"
        :x2="label.arrowEndX"
        :y2="label.arrowEndY"
      />
      <line
        class="directional-overlay-layer__casing-arrow-line"
        :x1="label.arrowStartX"
        :y1="label.arrowStartY"
        :x2="label.arrowEndX"
        :y2="label.arrowEndY"
      />
      <polygon
        class="directional-overlay-layer__casing-arrow-head"
        :points="label.arrowPoints"
      />
      <rect
        class="directional-overlay-layer__casing-label-bg"
        :x="label.boxX"
        :y="label.boxY"
        :width="label.boxWidth"
        :height="label.boxHeight"
      />
      <text
        v-for="textRow in label.textRows"
        :key="textRow.id"
        class="directional-overlay-layer__casing-label-text"
        :x="textRow.x"
        :y="textRow.y"
        text-anchor="middle"
        :style="{ fontSize: `${label.fontSize}px` }"
      >
        {{ textRow.text }}
      </text>
    </g>

    <g
      v-for="label in equipmentLabelOverlays"
      :key="label.id"
      class="directional-overlay-layer__equipment-group"
      :data-equipment-index="label.equipmentIndex"
      @mousemove.stop="handleEquipmentHover(label, $event)"
      @mouseleave.stop="handleEquipmentLeave(label)"
      @click.stop="handleEquipmentSelect(label)"
    >
      <rect
        class="directional-overlay-layer__casing-label-hitbox"
        :x="label.boxX - 5"
        :y="label.boxY - 5"
        :width="label.boxWidth + 10"
        :height="label.boxHeight + 10"
      />
      <line
        class="directional-overlay-layer__casing-arrow-hit"
        :x1="label.arrowStartX"
        :y1="label.arrowStartY"
        :x2="label.arrowEndX"
        :y2="label.arrowEndY"
      />
      <line
        class="directional-overlay-layer__casing-arrow-line"
        :x1="label.arrowStartX"
        :y1="label.arrowStartY"
        :x2="label.arrowEndX"
        :y2="label.arrowEndY"
      />
      <polygon
        class="directional-overlay-layer__casing-arrow-head"
        :points="label.arrowPoints"
      />
      <rect
        class="directional-overlay-layer__casing-label-bg"
        :x="label.boxX"
        :y="label.boxY"
        :width="label.boxWidth"
        :height="label.boxHeight"
      />
      <text
        v-for="textRow in label.textRows"
        :key="textRow.id"
        class="directional-overlay-layer__casing-label-text"
        :x="textRow.x"
        :y="textRow.y"
        text-anchor="middle"
        :style="{ fontSize: `${label.fontSize}px` }"
      >
        {{ textRow.text }}
      </text>
    </g>

    <g
      v-for="line in horizontalLineOverlays"
      :key="line.id"
      class="directional-overlay-layer__line-group"
      :data-line-index="line.lineIndex"
      @mousemove="handleLineHover(line, $event)"
      @mouseleave="handleLineLeave(line)"
      @click="handleLineSelect(line)"
    >
      <line
        class="directional-overlay-layer__line-hit-path"
        :x1="line.x1"
        :y1="line.y"
        :x2="line.x2"
        :y2="line.y"
      />
      <line
        class="directional-overlay-layer__line-path"
        :x1="line.x1"
        :y1="line.y"
        :x2="line.x2"
        :y2="line.y"
        :stroke="line.stroke"
        stroke-width="2"
        :stroke-dasharray="line.strokeDasharray"
      />

      <rect
        class="directional-overlay-layer__line-label-bg"
        :x="line.boxX"
        :y="line.boxY"
        :width="line.boxWidth"
        :height="line.boxHeight"
        :stroke="line.fontColor"
      />

      <text
        class="directional-overlay-layer__line-label-text"
        :x="line.textX"
        :y="line.textY"
        :text-anchor="line.textAnchor"
        dominant-baseline="middle"
        :style="{ fontSize: `${line.fontSize}px`, fill: line.fontColor }"
      >
        <tspan
          v-for="segment in line.textLines"
          :key="segment.id"
          :x="segment.x"
          :dy="segment.dy"
        >
          {{ segment.text }}
        </tspan>
      </text>
    </g>
  </g>
</template>

<style scoped>
.directional-overlay-layer__depth-group,
.directional-overlay-layer__line-group,
.directional-overlay-layer__casing-group,
.directional-overlay-layer__equipment-group,
.directional-overlay-layer__fluid-group,
.directional-overlay-layer__annotation-group {
  pointer-events: auto;
  cursor: pointer;
}

.directional-overlay-layer__annotation-fill {
  stroke-width: 1.3;
  stroke-dasharray: 4,4;
}

.directional-overlay-layer__annotation-text {
  fill: var(--color-ink-strong);
}

.directional-overlay-layer__plug-label {
  font-size: 10px;
  font-weight: 700;
  fill: var(--color-ink-strong);
  pointer-events: none;
}

.directional-overlay-layer__depth-line,
.directional-overlay-layer__casing-arrow-line {
  stroke: var(--color-ink-strong);
  stroke-width: 1.2;
}

.directional-overlay-layer__casing-label-hitbox {
  fill: rgba(0, 0, 0, 0);
  stroke: none;
}

.directional-overlay-layer__fluid-arrow-hit,
.directional-overlay-layer__depth-line-hit,
.directional-overlay-layer__casing-arrow-hit,
.directional-overlay-layer__line-hit-path {
  stroke: transparent;
  pointer-events: stroke;
}

.directional-overlay-layer__fluid-arrow-hit,
.directional-overlay-layer__depth-line-hit,
.directional-overlay-layer__casing-arrow-hit {
  stroke-width: 16;
  stroke-linecap: round;
}

.directional-overlay-layer__line-hit-path {
  stroke-width: 14;
  stroke-linecap: round;
}

.directional-overlay-layer__depth-arrow,
.directional-overlay-layer__casing-arrow-head {
  fill: var(--color-ink-strong);
  stroke: none;
}

.directional-overlay-layer__depth-box,
.directional-overlay-layer__casing-label-bg {
  fill: var(--color-surface-elevated);
  stroke: var(--color-ink-strong);
  stroke-width: 1.2;
  opacity: 0.9;
  rx: 5;
}

.directional-overlay-layer__depth-text,
.directional-overlay-layer__casing-label-text {
  fill: var(--color-ink-strong);
  font-weight: 700;
}

.directional-overlay-layer__fluid-arrow-line {
  stroke-width: 1.2;
}

.directional-overlay-layer__fluid-arrow-head {
  stroke: none;
}

.directional-overlay-layer__fluid-label-bg {
  fill: var(--color-surface-elevated);
  stroke-width: 1.1;
  opacity: 0.95;
  rx: 4;
}

.directional-overlay-layer__line-label-bg {
  fill: var(--color-surface-elevated);
  stroke-width: 1;
  rx: 4;
  opacity: 0.92;
}
</style>
