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
import {
  DEFAULT_DIRECTIONAL_LABEL_SCALE,
  normalizeDirectionalLabelScale,
  resolveDirectionalLabelFontSize
} from '@/utils/directionalLabelScale.js';
import {
  applyDeterministicSmartLabelLayout,
  resolveSmartLabelAutoScale,
  resolveSmartLabelFontSize
} from '@/utils/smartLabels.js';
import { applyPreviewToArrowedBoxLabel } from '@/utils/diagramLabelPreview.js';
import { applyPreviewToDirectionalLineLabel } from '@/utils/diagramLabelPreview.js';
import { applyPreviewToDirectionalLineOverlay } from '@/utils/diagramLabelPreview.js';
import { t } from '@/app/i18n.js';
import { isOpenHoleRow } from '@/app/domain.js';
import { getStackAtDepth as getPhysicsStackAtDepth } from '@/composables/usePhysics.js';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';
import {
  resolveDirectionalLayerVisualRadii,
  resolveDirectionalMaxVisualRadiusPx,
  resolveDirectionalPipeVisualGeometry,
  resolveDirectionalVisualInsetPadding
} from '@/utils/directionalSizing.js';
import {
  resolveDirectionalLineLabelPlacement,
  resolveDirectionalLineOffsetFromPoints,
  resolveDirectionalLinePointFromOffset
} from '@/utils/directionalLineLabelGeometry.js';
import {
  DIRECTIONAL_EPSILON,
  toFiniteNumber,
  isFinitePoint,
  buildDirectionalProjector,
  resolveMDFromTVD,
  resolveScreenFrameAtMD,
  normalizeXExaggeration
} from './directionalProjection.js';
import { resolveDirectionalReferenceHorizonDepthMeta } from '@/utils/referenceHorizons.js';
import { resolveDirectionalIntervalDepthMeta } from '@/utils/referenceIntervals.js';

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
  visualSizing: {
    type: Object,
    default: null
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
  'leave-box',
  'start-label-drag'
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

function resolveLineSegmentInPlot(center, direction, bounds) {
  const cx = Number(center?.[0]);
  const cy = Number(center?.[1]);
  const dx = Number(direction?.x);
  const dy = Number(direction?.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) <= DIRECTIONAL_EPSILON && Math.abs(dy) <= DIRECTIONAL_EPSILON) return null;

  const left = Math.min(bounds.left, bounds.right);
  const right = Math.max(bounds.left, bounds.right);
  const top = Math.min(bounds.top, bounds.bottom);
  const bottom = Math.max(bounds.top, bounds.bottom);
  const intersections = [];

  function pushUnique(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const epsilon = 1e-3;
    const duplicate = intersections.some((point) => (
      Math.abs(point.x - x) <= epsilon &&
      Math.abs(point.y - y) <= epsilon
    ));
    if (!duplicate) intersections.push({ x, y });
  }

  if (Math.abs(dx) > DIRECTIONAL_EPSILON) {
    const tLeft = (left - cx) / dx;
    const yLeft = cy + (tLeft * dy);
    if (yLeft >= top - DIRECTIONAL_EPSILON && yLeft <= bottom + DIRECTIONAL_EPSILON) {
      pushUnique(left, clamp(yLeft, top, bottom));
    }

    const tRight = (right - cx) / dx;
    const yRight = cy + (tRight * dy);
    if (yRight >= top - DIRECTIONAL_EPSILON && yRight <= bottom + DIRECTIONAL_EPSILON) {
      pushUnique(right, clamp(yRight, top, bottom));
    }
  }

  if (Math.abs(dy) > DIRECTIONAL_EPSILON) {
    const tTop = (top - cy) / dy;
    const xTop = cx + (tTop * dx);
    if (xTop >= left - DIRECTIONAL_EPSILON && xTop <= right + DIRECTIONAL_EPSILON) {
      pushUnique(clamp(xTop, left, right), top);
    }

    const tBottom = (bottom - cy) / dy;
    const xBottom = cx + (tBottom * dx);
    if (xBottom >= left - DIRECTIONAL_EPSILON && xBottom <= right + DIRECTIONAL_EPSILON) {
      pushUnique(clamp(xBottom, left, right), bottom);
    }
  }

  if (intersections.length < 2) return null;

  let bestPair = null;
  let bestDistanceSq = -1;
  for (let leftIndex = 0; leftIndex < intersections.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < intersections.length; rightIndex += 1) {
      const dxPair = intersections[rightIndex].x - intersections[leftIndex].x;
      const dyPair = intersections[rightIndex].y - intersections[leftIndex].y;
      const distanceSq = (dxPair * dxPair) + (dyPair * dyPair);
      if (distanceSq > bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestPair = [intersections[leftIndex], intersections[rightIndex]];
      }
    }
  }

  if (!bestPair) return null;
  return {
    startX: bestPair[0].x,
    startY: bestPair[0].y,
    endX: bestPair[1].x,
    endY: bestPair[1].y
  };
}

function resolveLineSegmentYAtX(segment, x, fallback = null) {
  const x1 = Number(segment?.x1 ?? segment?.startX);
  const y1 = Number(segment?.y1 ?? segment?.startY);
  const x2 = Number(segment?.x2 ?? segment?.endX);
  const y2 = Number(segment?.y2 ?? segment?.endY);
  const targetX = Number(x);
  const fallbackY = Number(fallback);
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2) || !Number.isFinite(targetX)) {
    return Number.isFinite(fallbackY) ? fallbackY : null;
  }
  if (Math.abs(x2 - x1) <= DIRECTIONAL_EPSILON) {
    return (y1 + y2) / 2;
  }
  const t = clamp((targetX - x1) / (x2 - x1), 0, 1);
  return y1 + (t * (y2 - y1));
}

function resolveDirectionalHorizonLabelAngleDegrees(line) {
  if (line?.activeMode !== 'md') return null;
  const x1 = Number(line?.x1);
  const y1 = Number(line?.y1);
  const x2 = Number(line?.x2);
  const y2 = Number(line?.y2);
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return null;
  if (Math.abs(x2 - x1) <= DIRECTIONAL_EPSILON && Math.abs(y2 - y1) <= DIRECTIONAL_EPSILON) return null;
  let angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return angle;
}

function resolveDirectionalHorizonLabelTransform(line) {
  const angle = resolveDirectionalHorizonLabelAngleDegrees(line);
  if (!Number.isFinite(angle)) return null;
  const centerX = Number(line?.boxX) + (Number(line?.boxWidth) / 2);
  const centerY = Number(line?.boxY) + (Number(line?.boxHeight) / 2);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null;
  return `rotate(${angle} ${centerX} ${centerY})`;
}

function resolvePreviewTransform(id) {
  if (String(id ?? '').trim() !== String(props.dragPreviewId ?? '').trim()) return null;
  const offsetX = Number(props.dragPreviewOffset?.x);
  const offsetY = Number(props.dragPreviewOffset?.y);
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null;
  return `translate(${offsetX} ${offsetY})`;
}

function resolveDepthShiftPreviewTransform(id) {
  if (String(id ?? '').trim() !== String(props.dragPreviewId ?? '').trim()) return null;
  const offsetY = Number(props.dragPreviewOffset?.y);
  if (!Number.isFinite(offsetY)) return null;
  return `translate(0 ${offsetY})`;
}

function applyDirectionalArrowPreview(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => applyPreviewToArrowedBoxLabel(
    item,
    props.dragPreviewId,
    props.dragPreviewOffset,
    { buildArrowHeadPoints }
  ));
}

function applyDirectionalHorizonLinePreview(items = [], bounds) {
  const safeBounds = bounds ?? plotBounds.value;
  const trajectory = Array.isArray(props.trajectoryPoints) ? props.trajectoryPoints : [];

  return (Array.isArray(items) ? items : []).map((item) => {
    const previewOptions = {
      resolveDepthFromPreviewY: (screenY) => {
        if (item?.activeMode !== 'md') return null;
        const tvd = Number(props.yScale.invert(screenY));
        if (!Number.isFinite(tvd)) return null;
        return resolveMDFromTVD(tvd, trajectory);
      },
      resolveSegmentAtDepth: (md) => {
        if (item?.activeMode !== 'md') return null;
        const frame = resolveScreenFrameAtMD(md, frameContext.value);
        if (!frame?.center || !frame?.normal || !safeBounds) return null;
        const segment = resolveLineSegmentInPlot(frame.center, frame.normal, safeBounds);
        if (!segment) return null;
        return {
          centerlineAnchorX: frame.center[0],
          centerlineAnchorY: frame.center[1],
          x1: segment.startX,
          y1: segment.startY,
          x2: segment.endX,
          y2: segment.endY
        };
      }
    };

    const activePreviewId = String(props.dragPreviewId ?? '').trim();
    if (activePreviewId === `${item?.id}:label`) {
      return applyPreviewToDirectionalLineLabel(
        item,
        props.dragPreviewId,
        props.dragPreviewOffset,
        {
          previewId: `${item?.id}:label`,
          bounds: item?.lineBounds ?? safeBounds
        }
      );
    }

    return applyPreviewToDirectionalLineOverlay(
      item,
      props.dragPreviewId,
      props.dragPreviewOffset,
      previewOptions
    );
  });
}

function emitDragStartPayload(entityType, item, event, options = {}) {
  const rowId = String(item?.rowId ?? '').trim();
  if (!rowId) return;
  const bounds = options.bounds ?? plotBounds.value;
  emit('start-label-drag', {
    previewId: String(options.previewId ?? item.id ?? '').trim() || item.id,
    entityType,
    rowId,
    dragKind: options.dragKind ?? null,
    resolveDepthMode: options.resolveDepthMode ?? null,
    centerX: Number.isFinite(Number(options.centerX)) ? Number(options.centerX) : item.boxX + (item.boxWidth / 2),
    centerY: Number.isFinite(Number(options.centerY)) ? Number(options.centerY) : item.boxY + (item.boxHeight / 2),
    xField: options.xField ?? item.xField,
    offsetField: typeof options.offsetField === 'string' ? options.offsetField : null,
    startOffsetPx: Number.isFinite(Number(options.startOffsetPx)) ? Number(options.startOffsetPx) : null,
    yField: options.yField ?? item.yField,
    tvdField: options.tvdField ?? item.tvdField ?? null,
    clearYField: options.clearYField ?? null,
    clearLegacyField: typeof options.clearLegacyField === 'string' ? options.clearLegacyField : null,
    anchorX: Number.isFinite(Number(options.anchorX)) ? Number(options.anchorX) : null,
    boxX: Number.isFinite(Number(options.boxX)) ? Number(options.boxX) : null,
    boxWidth: Number.isFinite(Number(options.boxWidth)) ? Number(options.boxWidth) : null,
    textAnchor: typeof options.textAnchor === 'string' ? options.textAnchor : null,
    x1: Number.isFinite(Number(options.x1)) ? Number(options.x1) : null,
    y1: Number.isFinite(Number(options.y1)) ? Number(options.y1) : null,
    x2: Number.isFinite(Number(options.x2)) ? Number(options.x2) : null,
    y2: Number.isFinite(Number(options.y2)) ? Number(options.y2) : null,
    entries: options.entries ?? null,
    bounds: bounds
      ? {
        left: bounds.left,
        right: bounds.right,
        width: bounds.width
      }
      : null
  }, event);
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

const directionalLabelBounds = computed(() => {
  const bounds = plotBounds.value;
  if (!bounds) return null;

  const visualInsetPadding = resolveDirectionalVisualInsetPadding({
    visualMaxRadiusPx: resolveDirectionalMaxVisualRadiusPx(props.visualSizing, Number(props.maxProjectedRadius)),
    formationThicknessPx: props.visualSizing?.formationThicknessPx
  });
  const horizontalPad = Math.max(0, Number(visualInsetPadding?.horizontal) || 0);

  return {
    left: bounds.left - horizontalPad,
    right: bounds.right + horizontalPad,
    top: bounds.top,
    bottom: bounds.bottom,
    width: bounds.width + (horizontalPad * 2),
    height: bounds.height
  };
});

const referenceHorizonBounds = computed(() => directionalLabelBounds.value);

const frameContext = computed(() => ({
  project: project.value,
  totalMD: Math.max(0, Number(props.totalMd)),
  diameterScale: Number(props.diameterScale),
  maxProjectedRadius: resolveDirectionalMaxVisualRadiusPx(props.visualSizing, Number(props.maxProjectedRadius))
}));

const directionalLabelScale = computed(() => normalizeDirectionalLabelScale(
  props.config?.directionalLabelScale,
  DEFAULT_DIRECTIONAL_LABEL_SCALE
));

const smartLabelsEnabled = computed(() => props.config?.smartLabelsEnabled !== false);

const directionalSmartLabelAutoScale = computed(() => {
  if (smartLabelsEnabled.value !== true) return 1;
  const bounds = plotBounds.value;
  const context = resolvedPhysicsContext.value;
  if (!bounds || !context) return 1;

  const casingRows = Array.isArray(context.casingRows) ? context.casingRows : [];
  const transientRows = Array.isArray(activeTransientPipeRows.value) ? activeTransientPipeRows.value : [];
  const equipmentRows = Array.isArray(context.equipment) ? context.equipment : [];
  const fluidRows = Array.isArray(props.annulusFluids) ? props.annulusFluids : [];
  const lineRows = Array.isArray(props.horizontalLines) ? props.horizontalLines : [];
  const boxRows = Array.isArray(props.annotationBoxes) ? props.annotationBoxes : [];
  const depthCount = casingRows.reduce((count, row) => {
    const sourceRow = sourceCasingRowsByIndex.value.get(Number(row?.__index)) || {};
    const showTop = sourceRow.showTop !== false;
    const showBottom = sourceRow.showBottom !== false;
    return count + (showTop ? 1 : 0) + (showBottom ? 1 : 0);
  }, 0);

  const totalPreferredLabelHeight =
    (casingRows.length * 30) +
    (transientRows.length * 24) +
    (equipmentRows.length * 24) +
    (fluidRows.length * 28) +
    (lineRows.length * 24) +
    (boxRows.length * 28) +
    (depthCount * 20);

  return resolveSmartLabelAutoScale({
    totalPreferredLabelHeight,
    availableTrackHeight: bounds.height
  });
});

function resolveDirectionalOverlayFontSize(baseSize, fallbackSize = 11) {
  const safeBase = Number.isFinite(Number(baseSize))
    ? Number(baseSize)
    : fallbackSize;
  if (smartLabelsEnabled.value !== true) {
    return resolveDirectionalLabelFontSize(safeBase, {
      fallbackSize,
      scale: directionalLabelScale.value
    });
  }
  return resolveSmartLabelFontSize(safeBase, {
    manualScale: directionalLabelScale.value,
    autoScale: directionalSmartLabelAutoScale.value,
    minPx: 8,
    maxPx: 40
  });
}

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

function resolvePipeVisualGeometry(row, pipeType = null) {
  if (!row || typeof row !== 'object') return null;
  return resolveDirectionalPipeVisualGeometry(
    {
      ...row,
      pipeType: pipeType ?? row?.pipeType ?? 'casing'
    },
    props.visualSizing,
    Number(props.diameterScale)
  );
}

function resolveDirectionalLabelXRatio(value) {
  const parsed = toFiniteNumber(value, null);
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, -1, 1);
}

function resolveDirectionalLabelXPixelFromRatio(ratio, bounds) {
  if (!Number.isFinite(ratio) || !bounds) return null;
  return bounds.left + (((ratio + 1) / 2) * bounds.width);
}

function resolveDirectionalManualLabelMd(manualMd, manualTvd, totalMd, trajectoryPoints = []) {
  const directMd = toFiniteNumber(manualMd, null);
  if (Number.isFinite(directMd)) {
    return Number.isFinite(totalMd) && totalMd > DIRECTIONAL_EPSILON
      ? clamp(directMd, 0, totalMd)
      : directMd;
  }

  const directTvd = toFiniteNumber(manualTvd, null);
  if (!Number.isFinite(directTvd)) return null;
  const derivedMd = resolveMDFromTVD(directTvd, trajectoryPoints);
  if (!Number.isFinite(derivedMd)) return null;
  return Number.isFinite(totalMd) && totalMd > DIRECTIONAL_EPSILON
    ? clamp(derivedMd, 0, totalMd)
    : derivedMd;
}

function resolveDirectionalManualLabelScreenY(manualTvd, yScaleFn, bounds, fallbackY) {
  const tvd = toFiniteNumber(manualTvd, null);
  if (Number.isFinite(tvd) && typeof yScaleFn === 'function') {
    const screenY = Number(yScaleFn(tvd));
    if (Number.isFinite(screenY)) {
      return clamp(screenY, bounds.top + 5, bounds.bottom - 5);
    }
  }
  return fallbackY;
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
    const baseDepthLabelFontSize = Number.isFinite(depthLabelFontSizeRaw)
      ? clamp(depthLabelFontSizeRaw, 8, 20)
      : 9;
    const depthLabelFontSize = resolveDirectionalOverlayFontSize(baseDepthLabelFontSize, 9);
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

      const halfWidth = Number(resolvePipeVisualGeometry(row, 'casing')?.outerRadius);
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
      const isTopAnnotation = depthIndex === 0 && shouldShowTopDepth;
      const manualXRatio = isTopAnnotation
        ? resolveDirectionalLabelXRatio(sourceRow?.directionalTopLabelXPos)
        : resolveDirectionalLabelXRatio(sourceRow?.directionalBottomLabelXPos);
      const manualLabelDepth = isTopAnnotation
        ? toFiniteNumber(sourceRow?.directionalTopManualLabelDepth, null)
        : toFiniteNumber(sourceRow?.directionalBottomManualLabelDepth, null);

      if (Number.isFinite(manualXRatio) && Number.isFinite(manualLabelDepth)) {
        const manualMd = clamp(manualLabelDepth, 0, totalMd);
        const manualFrame = resolveScreenFrameAtMD(manualMd, frameContext.value);
        if (!manualFrame) return;
        const boxCenterX = resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds);
        const boxCenterY = manualFrame.center[1];
        const boxX = clamp(boxCenterX - (boxWidth / 2), bounds.left + 2, bounds.right - boxWidth - 2);
        const boxY = clamp(boxCenterY - (boxHeight / 2), bounds.top + 2, bounds.bottom - boxHeight - 2);
        const boxEdgeX = (boxX + (boxWidth / 2)) <= anchor[0] ? boxX + boxWidth : boxX;
        const lineY = boxY + (boxHeight / 2);
        const arrowHeadPoints = buildArrowHeadPoints(anchor, [boxEdgeX, lineY], 6, 3);
        if (!arrowHeadPoints) return;

        items.push({
          id: `depth-${row.__index}-${depthIndex}-${md.toFixed(3)}`,
          casingIndex: Number(row.__index),
          rowId: String(sourceRow?.rowId ?? '').trim() || null,
          xField: isTopAnnotation ? 'directionalTopLabelXPos' : 'directionalBottomLabelXPos',
          yField: isTopAnnotation ? 'directionalTopManualLabelDepth' : 'directionalBottomManualLabelDepth',
          lineX1: anchor[0],
          lineY1: anchor[1],
          lineX2: boxEdgeX,
          lineY2: lineY,
          arrowHeadPoints,
          boxX,
          boxY,
          boxWidth,
          boxHeight,
          text: labelText,
          textX: boxX + (boxWidth / 2),
          textY: lineY,
          textAnchor: 'middle',
          fontSize: depthLabelFontSize,
          isPositionPinned: true
        });
        return;
      }

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
        rowId: String(sourceRow?.rowId ?? '').trim() || null,
        xField: isTopAnnotation ? 'directionalTopLabelXPos' : 'directionalBottomLabelXPos',
        yField: isTopAnnotation ? 'directionalTopManualLabelDepth' : 'directionalBottomManualLabelDepth',
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
        fontSize: depthLabelFontSize,
        isPositionPinned: false
      });
    });
  });

  return items;
});

function resolvePipeLabelFontSize(sourceRow, pipeType) {
  const raw = pipeType === 'casing'
    ? Number(sourceRow?.casingLabelFontSize)
    : Number(sourceRow?.labelFontSize);
  const baseFontSize = Number.isFinite(raw) ? clamp(raw, 8, 20) : 11;
  return resolveDirectionalOverlayFontSize(baseFontSize, 11);
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
  visualSizing,
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
    const halfWidth = Number(
      resolveDirectionalPipeVisualGeometry(
        {
          ...row,
          pipeType
        },
        visualSizing,
        diameterScale
      )?.outerRadius
    );
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

    const manualDepth = toFiniteNumber(
      sourceRow?.directionalManualLabelDepth,
      toFiniteNumber(sourceRow?.manualLabelDepth, null)
    );
    const manualLabelTvd = toFiniteNumber(sourceRow?.directionalManualLabelTvd, null);
    const hasManualDepth = Number.isFinite(manualDepth) || Number.isFinite(manualLabelTvd);
    const resolvedManualMd = resolveDirectionalManualLabelMd(
      manualDepth,
      manualLabelTvd,
      totalMd,
      props.trajectoryPoints
    );
    const labelDepth = Number.isFinite(resolvedManualMd)
      ? (constrainManualDepthToInterval
        ? clamp(resolvedManualMd, rowTop, rowBottom)
        : resolvedManualMd)
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

    const manualXRatio = resolveDirectionalLabelXRatio(sourceRow?.directionalLabelXPos ?? sourceRow?.labelXPos);
    const manualX = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds)
      : null;
    const hasManualPosition = Number.isFinite(manualDepth) || Number.isFinite(manualLabelTvd) || Number.isFinite(manualXRatio);

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
    let preferredY = resolveDirectionalManualLabelScreenY(
      manualLabelTvd,
      props.yScale,
      bounds,
      center[1]
    );
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
      rowId: String(sourceRow?.rowId ?? '').trim() || null,
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
      lines,
      isPositionPinned: hasManualPosition
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
      rowId: item.rowId,
      xField: 'directionalLabelXPos',
      yField: 'directionalManualLabelDepth',
      tvdField: 'directionalManualLabelTvd',
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
      textRows,
      isPositionPinned: item.isPositionPinned === true
    };
  }).filter(Boolean);
}

const casingLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = directionalLabelBounds.value ?? plotBounds.value;
  if (!physicsContext || !bounds) return [];

  return buildDirectionalPipeLabelOverlays({
    rows: Array.isArray(physicsContext.casingRows) ? physicsContext.casingRows : [],
    bounds,
    totalMd: Math.max(0, Number(props.totalMd)),
    units: props.config?.units === 'm' ? 'm' : 'ft',
    casingArrowMode: normalizeDirectionalCasingArrowMode(props.config?.directionalCasingArrowMode),
    frameContextValue: frameContext.value,
    projectFn: project.value,
    visualSizing: props.visualSizing,
    diameterScale: Number(props.diameterScale),
    pipeType: 'casing',
    constrainManualDepthToInterval: true,
    sourceRowsByIndex: sourceCasingRowsByIndex.value
  });
});

const transientPipeLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = directionalLabelBounds.value ?? plotBounds.value;
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
    visualSizing: props.visualSizing,
    diameterScale: Number(props.diameterScale),
    pipeType: transientPipeType,
    constrainManualDepthToInterval: false
  });
});

const equipmentLabelOverlays = computed(() => {
  const physicsContext = resolvedPhysicsContext.value;
  const bounds = directionalLabelBounds.value ?? plotBounds.value;
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

    const manualDepth = toFiniteNumber(row?.directionalManualLabelDepth, toFiniteNumber(row?.manualLabelDepth, null));
    const manualLabelTvd = toFiniteNumber(row?.directionalManualLabelTvd, null);
    const labelMd = resolveDirectionalManualLabelMd(
      manualDepth,
      manualLabelTvd,
      totalMd,
      props.trajectoryPoints
    ) ?? anchorMd;
    const center = project.value(labelMd, 0);
    const centerPoint = isFinitePoint(center) ? center : anchor;

    const baseLabelFontSize = Number.isFinite(Number(row?.labelFontSize))
      ? clamp(Number(row.labelFontSize), 8, 20)
      : 11;
    const labelFontSize = resolveDirectionalOverlayFontSize(baseLabelFontSize, 11);
    const lineHeight = labelFontSize + 2;
    const boxWidth = clamp(estimateLineWidth(labelText, labelFontSize) + 16, 90, 260);
    const boxHeight = (lineHeight) + (labelPaddingY * 2);

    const manualXRatio = resolveDirectionalLabelXRatio(row?.directionalLabelXPos ?? row?.labelXPos);
    const manualX = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds)
      : null;
    const hasManualPosition = Number.isFinite(manualDepth) || Number.isFinite(manualLabelTvd) || Number.isFinite(manualXRatio);
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
    const preferredY = resolveDirectionalManualLabelScreenY(
      manualLabelTvd,
      props.yScale,
      bounds,
      centerPoint[1]
    );
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
      rowId: String(row?.rowId ?? '').trim() || null,
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
      lines: [labelText],
      isPositionPinned: hasManualPosition
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
      rowId: item.rowId,
      xField: 'directionalLabelXPos',
      yField: 'directionalManualLabelDepth',
      tvdField: 'directionalManualLabelTvd',
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
      textRows,
      isPositionPinned: item.isPositionPinned === true
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

    const manualDepth = toFiniteNumber(plug?.directionalManualLabelDepth, null);
    const manualLabelTvd = toFiniteNumber(plug?.directionalManualLabelTvd, null);
    const manualXRatio = resolveDirectionalLabelXRatio(plug?.directionalLabelXPos);
    const md = resolveDirectionalManualLabelMd(
      manualDepth,
      manualLabelTvd,
      totalMd,
      props.trajectoryPoints
    ) ?? (
      Number.isFinite(manualDepth)
        ? clamp(manualDepth, 0, totalMd)
        : clamp((top + bottom) / 2, 0, totalMd)
    );
    const center = project.value(md, 0);
    if (!isFinitePoint(center)) return;
    const x = Number.isFinite(manualXRatio)
      ? clamp(resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds), bounds.left + 5, bounds.right - 5)
      : clamp(center[0], bounds.left + 5, bounds.right - 5);
    const y = resolveDirectionalManualLabelScreenY(
      manualLabelTvd,
      props.yScale,
      bounds,
      clamp(center[1], bounds.top + 5, bounds.bottom - 5)
    );

    items.push({
      id: `plug-label-${plugIndex}`,
      rowId: String(plug?.rowId ?? '').trim() || null,
      xField: 'directionalLabelXPos',
      yField: 'directionalManualLabelDepth',
      tvdField: 'directionalManualLabelTvd',
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
    const directionalManualDepth = parseOptionalNumber(fluid?.directionalManualLabelDepth) ??
      parseOptionalNumber(normalizedFluid?.directionalManualLabelDepth);
    const directionalManualTvd = parseOptionalNumber(fluid?.directionalManualLabelTvd) ??
      parseOptionalNumber(normalizedFluid?.directionalManualLabelTvd);
    const manualXRatio = resolveDirectionalLabelXRatio(fluid?.directionalLabelXPos ?? normalizedFluid?.directionalLabelXPos);
    const labelDepth = Number.isFinite(manualDepth)
      ? clamp(manualDepth, top, bottom)
      : ((top + bottom) / 2);
    const md = resolveDirectionalManualLabelMd(
      directionalManualDepth,
      directionalManualTvd,
      totalMd,
      props.trajectoryPoints
    ) ?? clamp(labelDepth, 0, totalMd);

    const fluidLayer = resolveFluidLayerAtDepth(labelDepth, fluidIndex, physicsContext);
    if (!fluidLayer) return;

    const visualRadii = resolveDirectionalLayerVisualRadii(
      fluidLayer,
      props.visualSizing,
      Number(props.diameterScale)
    );
    const innerRadius = Number(visualRadii?.innerRadius);
    const outerRadius = Number(visualRadii?.outerRadius);
    if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius) return;

    const midOffset = (innerRadius + outerRadius) / 2;
    if (!Number.isFinite(midOffset) || midOffset <= 0) return;

    const leftAnchor = project.value(md, -midOffset);
    const rightAnchor = project.value(md, midOffset);
    const centerAnchor = project.value(md, 0);
    if (!isFinitePoint(leftAnchor) || !isFinitePoint(rightAnchor) || !isFinitePoint(centerAnchor)) return;

    const baseFontSize = Number.isFinite(Number(fluid?.fontSize))
      ? clamp(Number(fluid.fontSize), 8, 20)
      : 11;
    const fontSize = resolveDirectionalOverlayFontSize(baseFontSize, 11);
    const textColor = fluid?.textColor || 'var(--color-ink-strong)';
    const strokeColor = fluid?.color || 'var(--color-default-fluid-stroke)';
    const wrappedLines = wrapTextToLines(label, 220, fontSize);
    const lineHeight = fontSize + 6;
    const labelHeight = (wrappedLines.length * lineHeight) + 12;
    const estimatedWidth = resolveLabelWidth(wrappedLines, fontSize);

    const standoffPx = resolveDirectionalIntervalCalloutStandoff(bounds);
    if ((Number.isFinite(directionalManualDepth) || Number.isFinite(directionalManualTvd)) && Number.isFinite(manualXRatio)) {
      const boxCenterX = resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds);
      const boxCenterY = resolveDirectionalManualLabelScreenY(
        directionalManualTvd,
        props.yScale,
        bounds,
        clamp(centerAnchor[1], bounds.top + 10, bounds.bottom - 10)
      );
      const boxX = clamp(boxCenterX - (estimatedWidth / 2), bounds.left + 5, bounds.right - estimatedWidth - 5);
      const boxY = clamp(boxCenterY - (labelHeight / 2), bounds.top + 5, bounds.bottom - labelHeight - 5);
      const sideAnchor = centerAnchor;
      const textX = boxX + (estimatedWidth / 2);
      const textY = boxY + (labelHeight / 2);
      const firstLineOffset = -((wrappedLines.length - 1) * lineHeight) / 2;
      const textLines = wrappedLines.map((lineText, index) => ({
        id: `fluid-label-${fluidIndex}-text-${index}`,
        text: lineText,
        x: textX,
        dy: index === 0 ? firstLineOffset : lineHeight
      }));
      const arrowStartX = (boxX + (estimatedWidth / 2)) <= sideAnchor[0] ? boxX + estimatedWidth : boxX;
      const arrowStartY = boxY + (labelHeight / 2);
      const arrowPoints = buildArrowHeadPoints([arrowStartX, arrowStartY], sideAnchor, 6, 3);
      if (!arrowPoints) return;

      items.push({
        id: `fluid-label-${fluidIndex}`,
        fluidIndex,
        rowId: String(fluid?.rowId ?? normalizedFluid?.rowId ?? '').trim() || null,
        xField: 'directionalLabelXPos',
        yField: 'directionalManualLabelDepth',
        tvdField: 'directionalManualLabelTvd',
        strokeColor,
        textColor,
        side: (boxX + (estimatedWidth / 2)) <= sideAnchor[0] ? 'left' : 'right',
        fontSize,
        textAnchor: 'middle',
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
        arrowPoints,
        isPositionPinned: true
      });
      return;
    }

    const legacyManualXRatio = resolveDirectionalLabelXRatio(fluid?.labelXPos);
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
    const labelYPixel = resolveDirectionalManualLabelScreenY(
      directionalManualTvd,
      props.yScale,
      bounds,
      clamp(centerAnchor[1], bounds.top + 10, bounds.bottom - 10)
    );
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
      rowId: String(fluid?.rowId ?? normalizedFluid?.rowId ?? '').trim() || null,
      xField: 'directionalLabelXPos',
      yField: 'directionalManualLabelDepth',
      tvdField: 'directionalManualLabelTvd',
      strokeColor,
      textColor,
      side: calloutPlacement.side === 'left' ? 'left' : 'right',
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
      arrowPoints,
      isPositionPinned: Number.isFinite(directionalManualDepth) || Number.isFinite(directionalManualTvd) || Number.isFinite(manualXRatio) || Number.isFinite(legacyManualXRatio)
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
    resolveDirectionalMaxVisualRadiusPx(props.visualSizing, Number(props.maxProjectedRadius)) + 4,
    2,
    2
  );

  return boxes.map((box, boxIndex) => {
    if (box?.show === false) return null;
    const intervalDepthMeta = resolveDirectionalIntervalDepthMeta(box, props.trajectoryPoints);
    const activeMode = intervalDepthMeta.mode;
    const topDepth = toFiniteNumber(intervalDepthMeta.topMd, null);
    const bottomDepth = toFiniteNumber(intervalDepthMeta.bottomMd, null);
    if (!Number.isFinite(topDepth) || !Number.isFinite(bottomDepth) || bottomDepth <= topDepth) return null;

    const verticalBounds = resolveAnnotationBandVerticalBounds(
      topDepth,
      bottomDepth,
      totalMd,
      frameContext.value,
      bounds
    );
    if (!verticalBounds) return null;

    const manualXRatio = resolveDirectionalLabelXRatio(box?.directionalLabelXPos ?? box?.labelXPos);
    const manualLabelDepth = toFiniteNumber(box?.directionalManualLabelDepth, null);
    const manualLabelTvd = toFiniteNumber(box?.directionalManualLabelTvd, null);
    const defaultSideSign = Number.isFinite(manualXRatio) && manualXRatio >= 0 ? 1 : -1;
    const midpointFrame = resolveScreenFrameAtMD(verticalBounds.midMD, frameContext.value);
    if (!midpointFrame?.center) return null;
    const centerlineX = Number(midpointFrame.center[0]);
    if (!Number.isFinite(centerlineX)) return null;

    function resolveSideBandMetrics(sideSign) {
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
      const autoBandXRaw = sideSign > 0 ? bandStartX : bandStartX - bandWidth;
      const autoBandX = clamp(
        autoBandXRaw,
        bounds.left + ANNOTATION_SIDE_PADDING_PX,
        bounds.right - ANNOTATION_SIDE_PADDING_PX - bandWidth
      );

      return {
        sideSign,
        availableBandWidth,
        bandWidth,
        minBandX: bounds.left + ANNOTATION_SIDE_PADDING_PX,
        maxBandX: bounds.right - ANNOTATION_SIDE_PADDING_PX - bandWidth,
        baseBandX: autoBandX,
        autoBandCenterX: autoBandX + (bandWidth / 2)
      };
    }

    const leftSideMetrics = resolveSideBandMetrics(-1);
    const rightSideMetrics = resolveSideBandMetrics(1);
    function resolveAutoSideMetrics() {
      if (!leftSideMetrics && !rightSideMetrics) return null;
      if (!leftSideMetrics) return rightSideMetrics;
      if (!rightSideMetrics) return leftSideMetrics;
      return rightSideMetrics.availableBandWidth >= leftSideMetrics.availableBandWidth
        ? rightSideMetrics
        : leftSideMetrics;
    }

    const defaultSideMetrics = defaultSideSign > 0
      ? (rightSideMetrics ?? leftSideMetrics)
      : (leftSideMetrics ?? rightSideMetrics);
    if (!defaultSideMetrics) return null;

    const legacyManualCenterX = Number.isFinite(manualXRatio)
      ? clamp(
        resolveDirectionalLabelXPixelFromRatio(manualXRatio, bounds),
        defaultSideMetrics.minBandX + (defaultSideMetrics.bandWidth / 2),
        defaultSideMetrics.maxBandX + (defaultSideMetrics.bandWidth / 2)
      )
      : defaultSideMetrics.autoBandCenterX;
    const legacyCenterlineOffsetPx = legacyManualCenterX - centerlineX;
    const storedCenterlineOffsetPx = toFiniteNumber(box?.directionalCenterlineOffsetPx, null);
    const autoSideMetrics = resolveAutoSideMetrics();
    const centerlineOffsetPx = Number.isFinite(storedCenterlineOffsetPx)
      ? storedCenterlineOffsetPx
      : (Number.isFinite(manualXRatio)
        ? legacyCenterlineOffsetPx
        : (autoSideMetrics ? autoSideMetrics.autoBandCenterX - centerlineX : legacyCenterlineOffsetPx));
    const sideSign = centerlineOffsetPx >= 0 ? 1 : -1;
    const sideMetrics = sideSign > 0
      ? (rightSideMetrics ?? leftSideMetrics)
      : (leftSideMetrics ?? rightSideMetrics);
    if (!sideMetrics) return null;

    const lines = resolveAnnotationLines(box);
    const fontSizeRaw = toFiniteNumber(box?.fontSize, null);
    const baseFontSize = clamp(Number.isFinite(fontSizeRaw) ? fontSizeRaw : 12, 9, 20);
    const fontSize = resolveDirectionalOverlayFontSize(baseFontSize, 12);
    const lineHeight = fontSize + 5;
    const minContentBandHeight = Math.max(
      ANNOTATION_MIN_HEIGHT_PX,
      (lines.length * lineHeight) + 6
    );
    const bandHeight = clamp(
      Math.max(minContentBandHeight, verticalBounds.bottomY - verticalBounds.topY),
      minContentBandHeight,
      bounds.bottom - bounds.top
    );
    const bandCenterY = (verticalBounds.topY + verticalBounds.bottomY) / 2;
    const bandY = clamp(
      bandCenterY - (bandHeight / 2),
      bounds.top,
      bounds.bottom - bandHeight
    );
    const fillColor = box?.color || 'var(--color-default-box)';
    const textColor = box?.fontColor || fillColor;
    const boxOpacity = clamp(toFiniteNumber(box?.opacity, 0.35), 0.05, 1.0);

    const desiredBandCenterX = centerlineX + centerlineOffsetPx;
    const minBandCenterX = sideMetrics.minBandX + (sideMetrics.bandWidth / 2);
    const maxBandCenterX = sideMetrics.maxBandX + (sideMetrics.bandWidth / 2);
    const baseBandCenterX = sideMetrics.baseBandX + (sideMetrics.bandWidth / 2);
    const resolvedBandCenterX = sideSign > 0
      ? clamp(desiredBandCenterX, baseBandCenterX, maxBandCenterX)
      : clamp(desiredBandCenterX, minBandCenterX, baseBandCenterX);

    const hasManualVerticalPosition = activeMode === 'md'
      ? Number.isFinite(manualLabelDepth)
      : Number.isFinite(manualLabelTvd);
    let resolvedBandX = resolvedBandCenterX - (sideMetrics.bandWidth / 2);
    let resolvedBandY = bandY;
    const textAnchor = 'middle';
    const textX = resolvedBandX + (sideMetrics.bandWidth / 2);
    if (hasManualVerticalPosition) {
      const manualFrame = activeMode === 'md' && Number.isFinite(manualLabelDepth)
        ? resolveScreenFrameAtMD(clamp(manualLabelDepth, 0, totalMd), frameContext.value)
        : null;
      resolvedBandY = clamp(
        resolveDirectionalManualLabelScreenY(
          activeMode === 'tvd' ? manualLabelTvd : null,
          props.yScale,
          bounds,
          manualFrame?.center?.[1] ?? bandCenterY
        ) - (bandHeight / 2),
        bounds.top,
        bounds.bottom - bandHeight
      );
    }
    const textBlockHeight = (lines.length - 1) * lineHeight;
    const startY = clamp(
      (resolvedBandY + (bandHeight / 2)) - (textBlockHeight / 2),
      resolvedBandY + fontSize + 2,
      resolvedBandY + bandHeight - textBlockHeight - 3
    );
    const textLines = lines.map((lineText, idx) => ({
      id: `annotation-${boxIndex}-text-${idx}`,
      text: lineText,
      x: textX,
      y: clamp(startY + (idx * lineHeight), resolvedBandY + fontSize + 2, resolvedBandY + bandHeight - 3),
      fontWeight: idx === 0 ? 'bold' : 'normal'
    }));

    return {
      id: `annotation-${boxIndex}`,
      boxIndex,
      rowId: String(box?.rowId ?? '').trim() || null,
      topDepth,
      bottomDepth,
      manualLabelDepth: activeMode === 'md' ? manualLabelDepth : manualLabelTvd,
      activeMode,
      resolveDepthMode: activeMode === 'md' ? 'projected-y' : 'tvd-y',
      depthRangeMin: activeMode === 'md' ? 0 : Math.min(props.minYData, props.maxYData),
      depthRangeMax: activeMode === 'md' ? props.totalMd : Math.max(props.minYData, props.maxYData),
      topField: activeMode === 'md' ? 'directionalTopDepthMd' : 'directionalTopDepthTvd',
      bottomField: activeMode === 'md' ? 'directionalBottomDepthMd' : 'directionalBottomDepthTvd',
      xField: 'directionalCenterlineOffsetPx',
      yField: activeMode === 'md' ? 'directionalManualLabelDepth' : 'directionalManualLabelTvd',
      tvdField: activeMode === 'md' ? 'directionalManualLabelTvd' : null,
      boxX: resolvedBandX,
      boxY: resolvedBandY,
      boxWidth: sideMetrics.bandWidth,
      boxHeight: bandHeight,
      fillColor,
      textColor,
      boxOpacity,
      textAnchor,
      centerlineOffsetPx,
      side: sideSign > 0 ? 'right' : 'left',
      fontSize,
      textLines,
      isPositionPinned: hasManualVerticalPosition || Number.isFinite(centerlineOffsetPx)
    };
  }).filter(Boolean);
});

const horizontalLineOverlays = computed(() => {
  const bounds = plotBounds.value;
  const lineBounds = referenceHorizonBounds.value ?? bounds;
  const totalMd = Math.max(0, Number(props.totalMd));
  const lines = Array.isArray(props.horizontalLines) ? props.horizontalLines : [];
  if (!bounds || !lineBounds || totalMd <= DIRECTIONAL_EPSILON || lines.length === 0) return [];

  const unitsLabel = props.config?.units === 'm' ? 'm' : 'ft';
  return lines.map((line, lineIndex) => {
    if (line?.show === false) return null;
    const depthMeta = resolveDirectionalReferenceHorizonDepthMeta(line);
    const primaryDepth = toFiniteNumber(depthMeta.primaryDepth, null);
    const secondaryDepth = toFiniteNumber(depthMeta.secondaryDepth, null);
    if (!Number.isFinite(primaryDepth)) return null;

    const activeMode = depthMeta.mode;
    const md = activeMode === 'md'
      ? clamp(primaryDepth, 0, totalMd)
      : clamp(toFiniteNumber(line?.directionalDepthMd, line?.depth), 0, totalMd);
    const frame = resolveScreenFrameAtMD(md, frameContext.value);
    if (!frame) return null;

    const lineY = activeMode === 'md'
      ? clamp(frame.center[1], bounds.top, bounds.bottom)
      : clamp(props.yScale(primaryDepth), bounds.top, bounds.bottom);
    if (!Number.isFinite(lineY)) return null;
    const lineSegment = activeMode === 'md'
      ? resolveLineSegmentInPlot(frame.center, frame.normal, lineBounds)
      : null;
    if (activeMode === 'md' && !lineSegment) return null;

    const lineStyle = getLineStyle(line?.lineStyle);
    const lineColor = line?.color || 'var(--color-default-line)';
    const fontColor = line?.fontColor || lineColor;
    const baseFontSize = Number.isFinite(Number(line?.fontSize))
      ? clamp(Number(line.fontSize), 8, 20)
      : 11;
    const fontSize = resolveDirectionalOverlayFontSize(baseFontSize, 11);

    const depthText = `${depthMeta.primaryLabel} ${formatDepthValue(primaryDepth)} ${unitsLabel}`;
    const displayText = line?.label ? `${line.label} ${depthText}` : depthText;
    const manualXRatio = resolveDirectionalLabelXRatio(line?.directionalLabelXPos ?? line?.labelXPos);
    const manualLabelDepth = activeMode === 'md'
      ? null
      : toFiniteNumber(line?.directionalManualLabelDepth, null);
    const legacyLabelXPixelRaw = Number.isFinite(manualXRatio)
      ? resolveDirectionalLabelXPixelFromRatio(manualXRatio, lineBounds)
      : (lineBounds.right - 12);
    const legacyLabelXPixel = clamp(legacyLabelXPixelRaw, lineBounds.left + 10, lineBounds.right - 10);

    const wrappedLines = wrapTextToLines(displayText, 220, fontSize);
    const lineHeight = fontSize + 6;
    const labelHeight = (wrappedLines.length * lineHeight) + 12;
    const estimatedWidth = resolveLabelWidth(wrappedLines, fontSize);
    const placementSegment = activeMode === 'md'
      ? {
        x1: Number(lineSegment.startX),
        y1: Number(lineSegment.startY),
        x2: Number(lineSegment.endX),
        y2: Number(lineSegment.endY)
      }
      : null;
    const centerlineAnchorX = Number(frame.center[0]);
    const centerlineAnchorY = Number(frame.center[1]);
    const legacyLabelAnchorY = activeMode === 'md'
      ? resolveLineSegmentYAtX(lineSegment, legacyLabelXPixel, centerlineAnchorY)
      : null;
    const legacyCenterlineOffsetPx = activeMode === 'md'
      ? resolveDirectionalLineOffsetFromPoints(
        { x: centerlineAnchorX, y: centerlineAnchorY },
        { x: legacyLabelXPixel, y: legacyLabelAnchorY },
        placementSegment
      )
      : null;
    const centerlineOffsetPx = activeMode === 'md'
      ? (
        toFiniteNumber(line?.directionalCenterlineOffsetPx, null) ??
        legacyCenterlineOffsetPx ??
        0
      )
      : null;
    const textAnchor = activeMode === 'md'
      ? 'middle'
      : getHorizontalAnchor(
        Number.isFinite(manualXRatio) ? manualXRatio : 1,
        1,
        'end'
      );
    const labelAnchorPoint = activeMode === 'md'
      ? resolveDirectionalLinePointFromOffset(
        { x: centerlineAnchorX, y: centerlineAnchorY },
        placementSegment,
        centerlineOffsetPx
      )
      : null;
    const labelAnchorX = activeMode === 'md'
      ? Number(labelAnchorPoint?.x)
      : legacyLabelXPixel;
    const labelAnchorY = activeMode === 'md'
      ? Number(labelAnchorPoint?.y)
      : clamp(
        Number.isFinite(manualLabelDepth) ? props.yScale(manualLabelDepth) : lineY,
        bounds.top + 10,
        bounds.bottom - 10
      );
    const mdLabelPlacement = activeMode === 'md'
      ? resolveDirectionalLineLabelPlacement({
        segment: placementSegment,
        anchorX: labelAnchorX,
        anchorY: labelAnchorY,
        boxWidth: estimatedWidth,
        boxHeight: labelHeight,
        textAnchor,
        normalOffsetPx: 0
      })
      : null;
    const boxX = activeMode === 'md'
      ? Number(mdLabelPlacement?.boxX)
      : clamp(
        textAnchor === 'end'
          ? legacyLabelXPixel - estimatedWidth + 5
          : (textAnchor === 'middle' ? legacyLabelXPixel - (estimatedWidth / 2) : legacyLabelXPixel - 5),
        lineBounds.left + 5,
        lineBounds.right - estimatedWidth - 5
      );
    const boxY = activeMode === 'md'
      ? Number(mdLabelPlacement?.boxY)
      : clamp(labelAnchorY - (labelHeight / 2), bounds.top + 5, bounds.bottom - labelHeight - 5);
    if ((activeMode === 'md' && (!Number.isFinite(boxX) || !Number.isFinite(boxY))) || !Number.isFinite(labelAnchorY)) {
      return null;
    }

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
      rowId: String(line?.rowId ?? '').trim() || null,
      depthValue: toFiniteNumber(line?.depth, null),
      manualLabelDepth,
      anchorX: frame.center[0],
      xField: activeMode === 'md' ? null : 'directionalLabelXPos',
      yField: 'directionalManualLabelDepth',
      resolveDepthMode: activeMode === 'md' ? 'projected-y' : 'tvd-y',
      activeMode,
      primaryDepth,
      secondaryDepth,
      y: lineY,
      x1: activeMode === 'md' ? lineSegment.startX : lineBounds.left,
      y1: activeMode === 'md' ? lineSegment.startY : lineY,
      x2: activeMode === 'md' ? lineSegment.endX : lineBounds.right,
      y2: activeMode === 'md' ? lineSegment.endY : lineY,
      stroke: lineColor,
      strokeDasharray: lineStyle,
      fontColor,
      fontSize,
      textAnchor,
      side: activeMode === 'md'
        ? 'center'
        : (textAnchor === 'start' ? 'right' : (textAnchor === 'end' ? 'left' : 'center')),
      centerlineAnchorX,
      centerlineAnchorY,
      centerlineOffsetPx,
      anchorScreenX: labelAnchorX,
      anchorScreenY: labelAnchorY,
      normalOffsetPx: activeMode === 'md' ? 0 : null,
      boxX,
      boxY,
      boxWidth: estimatedWidth,
      boxHeight: labelHeight,
      textX,
      textY,
      textLines,
      lineBounds: {
        left: lineBounds.left,
        right: lineBounds.right,
        width: lineBounds.width
      },
      // Directional reference horizons should stay attached to their line rather than
      // participating in vertical smart-label reflow. Other overlay families route around them.
      isPositionPinned: true
    };
  }).filter(Boolean);
});

function buildDirectionalSmartLayoutCandidates(overlays) {
  const candidates = [];

  overlays.annotationBandOverlays.forEach((item) => {
    candidates.push({
      id: `annotation:${item.id}`,
      family: 'annotation',
      side: item.side || 'center',
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  overlays.depthAnnotations.forEach((item) => {
    candidates.push({
      id: `depth:${item.id}`,
      family: 'depth',
      side: item.textAnchor === 'start' ? 'right' : 'left',
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  overlays.casingLabelOverlays.forEach((item) => {
    const side = (item.boxX + (item.boxWidth / 2)) >= item.arrowEndX ? 'right' : 'left';
    candidates.push({
      id: `casing:${item.id}`,
      family: 'casing',
      side,
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  overlays.transientPipeLabelOverlays.forEach((item) => {
    const side = (item.boxX + (item.boxWidth / 2)) >= item.arrowEndX ? 'right' : 'left';
    candidates.push({
      id: `transient:${item.id}`,
      family: 'transient',
      side,
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  overlays.equipmentLabelOverlays.forEach((item) => {
    const side = (item.boxX + (item.boxWidth / 2)) >= item.arrowEndX ? 'right' : 'left';
    candidates.push({
      id: `equipment:${item.id}`,
      family: 'equipment',
      side,
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  overlays.fluidLabelOverlays.forEach((item) => {
    candidates.push({
      id: `fluid:${item.id}`,
      family: 'fluid',
      side: item.side || 'right',
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  overlays.horizontalLineOverlays.forEach((item) => {
    candidates.push({
      id: `line:${item.id}`,
      family: 'line',
      side: item.side || 'center',
      preferredCenterY: item.boxY + (item.boxHeight / 2),
      centerY: item.boxY + (item.boxHeight / 2),
      boxY: item.boxY,
      boxX: item.boxX,
      boxWidth: item.boxWidth,
      boxHeight: item.boxHeight,
      baseFontPx: item.fontSize,
      fontSize: item.fontSize,
      isPositionPinned: item.isPositionPinned === true,
      canSwapSide: false
    });
  });

  return candidates;
}

function buildDirectionalLayoutCandidateMap(overlays, bounds) {
  const candidates = buildDirectionalSmartLayoutCandidates(overlays);
  if (candidates.length <= 1) return null;
  const laidOut = applyDeterministicSmartLabelLayout(candidates, {
    bounds,
    initialGap: 6,
    shrinkStep: 0.5,
    maxMovePasses: 3,
    maxShrinkPasses: 6
  });
  return new Map(laidOut.map((candidate) => [candidate.id, candidate]));
}

function applyDirectionalLayoutToDepth(items, candidateMap, bounds) {
  return items.map((item) => {
    const candidate = candidateMap.get(`depth:${item.id}`);
    if (!candidate) return item;

    const nextBoxHeight = candidate.boxHeight;
    const nextBoxWidth = candidate.boxWidth;
    const nextBoxY = clamp(candidate.boxY, bounds.top, bounds.bottom - nextBoxHeight);
    const boxCenterY = nextBoxY + (nextBoxHeight / 2);
    const placeRight = item.textAnchor === 'start';
    const lineX2 = placeRight ? item.boxX : item.boxX + nextBoxWidth;
    const lineY2 = boxCenterY;
    const arrowHeadPoints = buildArrowHeadPoints([item.lineX1, item.lineY1], [lineX2, lineY2], 6, 3);

    return {
      ...item,
      boxY: nextBoxY,
      boxWidth: nextBoxWidth,
      boxHeight: nextBoxHeight,
      lineX2,
      lineY2,
      textX: placeRight ? item.boxX + 6 : item.boxX + nextBoxWidth - 6,
      textY: boxCenterY,
      fontSize: candidate.fontSize,
      arrowHeadPoints: arrowHeadPoints || item.arrowHeadPoints
    };
  });
}

function applyDirectionalLayoutToPipeLike(items, candidateMap, keyPrefix) {
  return items.map((item) => {
    const candidate = candidateMap.get(`${keyPrefix}:${item.id}`);
    if (!candidate) return item;
    const nextBoxHeight = candidate.boxHeight;
    const nextBoxWidth = candidate.boxWidth;
    const nextBoxY = candidate.boxY;
    const nextBoxX = candidate.boxX;
    const boxCenterX = nextBoxX + (nextBoxWidth / 2);
    const boxCenterY = nextBoxY + (nextBoxHeight / 2);
    const lineHeight = candidate.fontSize + 2;
    const textRows = item.textRows.map((textRow, index) => ({
      ...textRow,
      x: nextBoxX + (nextBoxWidth / 2),
      y: nextBoxY + 5 + ((index + 0.7) * lineHeight)
    }));
    const arrowStartX = item.arrowEndX >= boxCenterX ? nextBoxX + nextBoxWidth : nextBoxX;
    const arrowStartY = boxCenterY;
    const arrowPoints = buildArrowHeadPoints(
      [arrowStartX, arrowStartY],
      [item.arrowEndX, item.arrowEndY],
      6,
      3
    );

    return {
      ...item,
      boxX: nextBoxX,
      boxY: nextBoxY,
      boxWidth: nextBoxWidth,
      boxHeight: nextBoxHeight,
      fontSize: candidate.fontSize,
      textRows,
      arrowStartX,
      arrowStartY,
      arrowPoints: arrowPoints || item.arrowPoints
    };
  });
}

function applyDirectionalLayoutToFluid(items, candidateMap) {
  return items.map((item) => {
    const candidate = candidateMap.get(`fluid:${item.id}`);
    if (!candidate) return item;
    const nextBoxHeight = candidate.boxHeight;
    const nextBoxWidth = candidate.boxWidth;
    const nextBoxY = candidate.boxY;
    const nextBoxX = candidate.boxX;
    const textAnchor = item.textAnchor;
    const textX = textAnchor === 'end'
      ? nextBoxX + nextBoxWidth - 6
      : (textAnchor === 'middle' ? nextBoxX + (nextBoxWidth / 2) : nextBoxX + 6);
    const textY = nextBoxY + (nextBoxHeight / 2);
    const textSegments = item.textLines.map((segment) => segment.text);
    const lineHeight = candidate.fontSize + 6;
    const firstLineOffset = -((textSegments.length - 1) * lineHeight) / 2;
    const textLines = textSegments.map((text, index) => ({
      id: item.textLines[index]?.id ?? `${item.id}-text-${index}`,
      text,
      x: textX,
      dy: index === 0 ? firstLineOffset : lineHeight
    }));
    const arrowStartY = textY;
    const arrowPoints = buildArrowHeadPoints(
      [item.arrowStartX, arrowStartY],
      [item.arrowEndX, item.arrowEndY],
      6,
      3
    );

    return {
      ...item,
      boxX: nextBoxX,
      boxY: nextBoxY,
      boxWidth: nextBoxWidth,
      boxHeight: nextBoxHeight,
      fontSize: candidate.fontSize,
      textX,
      textY,
      textLines,
      arrowStartY,
      arrowPoints: arrowPoints || item.arrowPoints
    };
  });
}

function applyDirectionalLayoutToLines(items, candidateMap) {
  return items.map((item) => {
    const candidate = candidateMap.get(`line:${item.id}`);
    if (!candidate) return item;
    const nextBoxHeight = candidate.boxHeight;
    const nextBoxWidth = candidate.boxWidth;
    const nextBoxY = candidate.boxY;
    const nextBoxX = candidate.boxX;
    const textAnchor = item.textAnchor;
    const textX = textAnchor === 'end'
      ? nextBoxX + nextBoxWidth - 6
      : (textAnchor === 'middle' ? nextBoxX + (nextBoxWidth / 2) : nextBoxX + 6);
    const textY = nextBoxY + (nextBoxHeight / 2);
    const textSegments = item.textLines.map((segment) => segment.text);
    const lineHeight = candidate.fontSize + 6;
    const firstLineOffset = -((textSegments.length - 1) * lineHeight) / 2;
    const textLines = textSegments.map((text, index) => ({
      id: item.textLines[index]?.id ?? `${item.id}-text-${index}`,
      text,
      x: textX,
      dy: index === 0 ? firstLineOffset : lineHeight
    }));

    return {
      ...item,
      boxX: nextBoxX,
      boxY: nextBoxY,
      boxWidth: nextBoxWidth,
      boxHeight: nextBoxHeight,
      fontSize: candidate.fontSize,
      textX,
      textY,
      textLines
    };
  });
}

function applyDirectionalLayoutToAnnotations(items, candidateMap) {
  return items.map((item) => {
    const candidate = candidateMap.get(`annotation:${item.id}`);
    if (!candidate) return item;
    const nextBoxHeight = candidate.boxHeight;
    const nextBoxY = candidate.boxY;
    const deltaY = nextBoxY - item.boxY;

    return {
      ...item,
      boxY: nextBoxY,
      boxHeight: nextBoxHeight,
      fontSize: candidate.fontSize,
      textLines: item.textLines.map((line) => ({
        ...line,
        y: line.y + deltaY
      }))
    };
  });
}

const directionalOverlayState = computed(() => {
  const base = {
    annotationBandOverlays: annotationBandOverlays.value,
    plugLabelOverlays: plugLabelOverlays.value,
    fluidLabelOverlays: fluidLabelOverlays.value,
    depthAnnotations: depthAnnotations.value,
    casingLabelOverlays: casingLabelOverlays.value,
    transientPipeLabelOverlays: transientPipeLabelOverlays.value,
    equipmentLabelOverlays: equipmentLabelOverlays.value,
    horizontalLineOverlays: horizontalLineOverlays.value
  };
  const bounds = plotBounds.value;
  const lineBounds = referenceHorizonBounds.value ?? bounds;
  if (smartLabelsEnabled.value !== true || !bounds) {
    return {
      ...base,
      fluidLabelOverlays: applyDirectionalArrowPreview(base.fluidLabelOverlays),
      depthAnnotations: applyDirectionalArrowPreview(base.depthAnnotations),
      casingLabelOverlays: applyDirectionalArrowPreview(base.casingLabelOverlays),
      transientPipeLabelOverlays: applyDirectionalArrowPreview(base.transientPipeLabelOverlays),
      equipmentLabelOverlays: applyDirectionalArrowPreview(base.equipmentLabelOverlays),
      horizontalLineOverlays: applyDirectionalHorizonLinePreview(base.horizontalLineOverlays, lineBounds)
    };
  }
  const candidateMap = buildDirectionalLayoutCandidateMap(base, bounds);
  if (!candidateMap) {
    return {
      ...base,
      fluidLabelOverlays: applyDirectionalArrowPreview(base.fluidLabelOverlays),
      depthAnnotations: applyDirectionalArrowPreview(base.depthAnnotations),
      casingLabelOverlays: applyDirectionalArrowPreview(base.casingLabelOverlays),
      transientPipeLabelOverlays: applyDirectionalArrowPreview(base.transientPipeLabelOverlays),
      equipmentLabelOverlays: applyDirectionalArrowPreview(base.equipmentLabelOverlays),
      horizontalLineOverlays: applyDirectionalHorizonLinePreview(base.horizontalLineOverlays, lineBounds)
    };
  }

  const laidOut = {
    ...base,
    annotationBandOverlays: applyDirectionalLayoutToAnnotations(base.annotationBandOverlays, candidateMap),
    fluidLabelOverlays: applyDirectionalLayoutToFluid(base.fluidLabelOverlays, candidateMap),
    depthAnnotations: applyDirectionalLayoutToDepth(base.depthAnnotations, candidateMap, bounds),
    casingLabelOverlays: applyDirectionalLayoutToPipeLike(base.casingLabelOverlays, candidateMap, 'casing'),
    transientPipeLabelOverlays: applyDirectionalLayoutToPipeLike(base.transientPipeLabelOverlays, candidateMap, 'transient'),
    equipmentLabelOverlays: applyDirectionalLayoutToPipeLike(base.equipmentLabelOverlays, candidateMap, 'equipment'),
    horizontalLineOverlays: applyDirectionalLayoutToLines(base.horizontalLineOverlays, candidateMap)
  };

  return {
    ...laidOut,
    fluidLabelOverlays: applyDirectionalArrowPreview(laidOut.fluidLabelOverlays),
    depthAnnotations: applyDirectionalArrowPreview(laidOut.depthAnnotations),
    casingLabelOverlays: applyDirectionalArrowPreview(laidOut.casingLabelOverlays),
    transientPipeLabelOverlays: applyDirectionalArrowPreview(laidOut.transientPipeLabelOverlays),
    equipmentLabelOverlays: applyDirectionalArrowPreview(laidOut.equipmentLabelOverlays),
    horizontalLineOverlays: applyDirectionalHorizonLinePreview(laidOut.horizontalLineOverlays, lineBounds)
  };
});
</script>

<template>
  <g class="directional-overlay-layer">
    <g
      v-for="annotation in directionalOverlayState.annotationBandOverlays"
      :key="annotation.id"
      class="directional-overlay-layer__annotation-group"
      :data-box-index="annotation.boxIndex"
      :transform="resolveDepthShiftPreviewTransform(annotation.id)"
      @mousemove="handleBoxHover(annotation, $event)"
      @mouseleave="handleBoxLeave(annotation)"
      @click="handleBoxSelect(annotation)"
      @pointerdown.stop.prevent="emitDragStartPayload('box', annotation, $event, {
        dragKind: 'depth-shift',
        resolveDepthMode: annotation.resolveDepthMode,
        entries: [
          { field: annotation.topField, value: annotation.topDepth, min: annotation.depthRangeMin, max: annotation.depthRangeMax },
          { field: annotation.bottomField, value: annotation.bottomDepth, min: annotation.depthRangeMin, max: annotation.depthRangeMax },
          ...(Number.isFinite(annotation.manualLabelDepth)
            ? [{ field: annotation.yField, value: annotation.manualLabelDepth, min: annotation.depthRangeMin, max: annotation.depthRangeMax }]
            : [])
        ]
      })"
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
      v-for="plug in directionalOverlayState.plugLabelOverlays"
      :key="plug.id"
      class="directional-overlay-layer__plug-label"
      :x="plug.x"
      :y="plug.y"
      :transform="resolvePreviewTransform(plug.id)"
      text-anchor="middle"
      dominant-baseline="middle"
      @pointerdown.stop.prevent="emitDragStartPayload('plug', plug, $event, { centerX: plug.x, centerY: plug.y })"
    >
      {{ plug.text }}
    </text>

    <g
      v-for="fluid in directionalOverlayState.fluidLabelOverlays"
      :key="fluid.id"
      class="directional-overlay-layer__fluid-group"
      :data-fluid-index="fluid.fluidIndex"
      @mousemove="handleFluidHover(fluid, $event)"
      @mouseleave="handleFluidLeave(fluid)"
      @click="handleFluidSelect(fluid)"
      @pointerdown.stop.prevent="emitDragStartPayload('fluid', fluid, $event)"
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
      v-for="item in directionalOverlayState.depthAnnotations"
      :key="item.id"
      class="directional-overlay-layer__depth-group"
      :data-pipe-key="`casing:${item.casingIndex}`"
      :data-casing-index="item.casingIndex"
      @mousemove="handleDepthHover(item, $event)"
      @mouseleave="handleDepthLeave(item)"
      @click="handleDepthSelect(item)"
      @pointerdown.stop.prevent="emitDragStartPayload('casing', item, $event)"
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
      v-for="label in directionalOverlayState.casingLabelOverlays"
      :key="label.id"
      class="directional-overlay-layer__casing-group"
      :data-pipe-key="label.dataKey"
      :data-casing-index="label.pipeType === 'casing' ? label.rowIndex : null"
      @mousemove.stop="handlePipeLabelHover(label.pipeType, label.rowIndex, $event)"
      @mouseleave.stop="handlePipeLabelLeave(label.pipeType, label.rowIndex)"
      @click.stop="handlePipeLabelSelect(label.pipeType, label.rowIndex)"
      @pointerdown.stop.prevent="emitDragStartPayload(label.pipeType, label, $event, {
        bounds: directionalLabelBounds
      })"
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
      v-for="label in directionalOverlayState.transientPipeLabelOverlays"
      :key="label.id"
      class="directional-overlay-layer__casing-group"
      :data-pipe-key="label.dataKey"
      @mousemove.stop="handlePipeLabelHover(label.pipeType, label.rowIndex, $event)"
      @mouseleave.stop="handlePipeLabelLeave(label.pipeType, label.rowIndex)"
      @click.stop="handlePipeLabelSelect(label.pipeType, label.rowIndex)"
      @pointerdown.stop.prevent="emitDragStartPayload(label.pipeType, label, $event, {
        bounds: directionalLabelBounds
      })"
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
      v-for="label in directionalOverlayState.equipmentLabelOverlays"
      :key="label.id"
      class="directional-overlay-layer__equipment-group"
      :data-equipment-index="label.equipmentIndex"
      @mousemove.stop="handleEquipmentHover(label, $event)"
      @mouseleave.stop="handleEquipmentLeave(label)"
      @click.stop="handleEquipmentSelect(label)"
      @pointerdown.stop.prevent="emitDragStartPayload('equipment', label, $event, {
        bounds: directionalLabelBounds
      })"
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
      v-for="line in directionalOverlayState.horizontalLineOverlays"
      :key="line.id"
      class="directional-overlay-layer__line-group"
      :data-line-index="line.lineIndex"
      @mousemove="handleLineHover(line, $event)"
      @mouseleave="handleLineLeave(line)"
      @click="handleLineSelect(line)"
      @pointerdown.stop.prevent="emitDragStartPayload('line', line, $event, {
        dragKind: 'depth-shift',
        resolveDepthMode: line.resolveDepthMode,
        centerX: line.anchorX,
        centerY: line.y,
        entries: [
          {
            field: line.activeMode === 'md' ? 'directionalDepthMd' : 'directionalDepthTvd',
            value: line.primaryDepth,
            min: 0,
            max: props.totalMd
          },
          ...(Number.isFinite(line.manualLabelDepth)
            ? [{ field: line.yField, value: line.manualLabelDepth, min: 0, max: props.totalMd }]
            : [])
        ]
      })"
    >
      <line
        class="directional-overlay-layer__line-hit-path"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
      />
      <line
        class="directional-overlay-layer__line-path"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        :stroke="line.stroke"
        stroke-width="2"
        :stroke-dasharray="line.strokeDasharray"
      />

      <g
        class="directional-overlay-layer__line-label-group"
        :transform="resolveDirectionalHorizonLabelTransform(line)"
        @pointerdown.stop.prevent="emitDragStartPayload('line', line, $event, {
          previewId: `${line.id}:label`,
          dragKind: 'line-label-slide',
          xField: line.activeMode === 'md' ? null : line.xField,
          offsetField: line.activeMode === 'md' ? 'directionalCenterlineOffsetPx' : null,
          startOffsetPx: line.activeMode === 'md' ? line.centerlineOffsetPx : null,
          clearYField: line.yField,
          clearLegacyField: line.activeMode === 'md' ? 'directionalLabelXPos' : null,
          anchorX: line.activeMode === 'md' ? null : line.anchorScreenX,
          boxX: line.activeMode === 'md' ? null : line.boxX,
          boxWidth: line.activeMode === 'md' ? null : line.boxWidth,
          textAnchor: line.activeMode === 'md' ? null : line.textAnchor,
          x1: line.activeMode === 'md' ? line.x1 : null,
          y1: line.activeMode === 'md' ? line.y1 : null,
          x2: line.activeMode === 'md' ? line.x2 : null,
          y2: line.activeMode === 'md' ? line.y2 : null,
          centerX: line.boxX + (line.boxWidth / 2),
          centerY: line.boxY + (line.boxHeight / 2),
          bounds: line.lineBounds
        })"
      >
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
  pointer-events: auto;
  cursor: grab;
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
