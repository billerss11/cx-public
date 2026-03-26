<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';
import { clamp, formatDepthValue, parseOptionalNumber } from '@/utils/general.js';
import {
  buildBoxTooltipModel,
  buildEquipmentTooltipModel,
  buildFluidTooltipModel,
  buildLineTooltipModel,
  buildMarkerTooltipModel,
  buildPipeTooltipModel,
  buildPlugTooltipModel
} from '@/composables/useDeclarativePlotTooltip.js';
import { clearSelection, dispatchSchematicInteraction, syncSelectionIndicators } from '@/app/selection.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import {
  hasInteractiveSchematicTarget,
  isSameInteractionEntity,
  normalizePipeType,
  normalizeInteractionEntity,
  resolveTopmostInteractionEntity
} from '@/composables/useSchematicInteraction.js';
import {
  createContext as createPhysicsContext,
  getIntervals as getPhysicsIntervals,
  getStackAtDepth as getPhysicsStackAtDepth
} from '@/composables/usePhysics.js';
import {
  buildDirectionalRenderModelInWorker,
  cancelRenderModelWorkerJobs,
  isRenderModelWorkerCancelledError
} from '@/composables/useRenderModelWorker.js';
import { usePlotEntityHandlers } from '@/composables/usePlotEntityHandlers.js';
import { resolveTrajectoryPointsFromRows } from '@/app/trajectoryMathCore.mjs';
import DirectionalAxisLayer from './layers/DirectionalAxisLayer.vue';
import DirectionalBandLayer from './layers/DirectionalBandLayer.vue';
import DirectionalDecorationLayer from './layers/DirectionalDecorationLayer.vue';
import DirectionalPhysicsDebugLayer from './layers/DirectionalPhysicsDebugLayer.vue';
import DirectionalOverlayLayer from './layers/DirectionalOverlayLayer.vue';
import DirectionalEquipmentLayer from './layers/DirectionalEquipmentLayer.vue';
import DirectionalTopologyOverlayLayer from './layers/DirectionalTopologyOverlayLayer.vue';
import SchematicPlotTooltip from './SchematicPlotTooltip.vue';
import {
  buildMDSamples,
  buildDirectionalProjector,
  isFinitePoint,
  normalizeXExaggeration,
  resolveMDFromTVD,
  resolveProjectedDepthBounds,
  resolveScreenFrameAtMD
} from './layers/directionalProjection.js';
import { useDepthCursorOverlay } from '@/composables/useDepthCursorOverlay.js';
import { useDepthCursorLayerDom } from '@/composables/useDepthCursorLayerDom.js';
import { useCrossSectionDepthInteraction } from '@/composables/useCrossSectionDepthInteraction.js';
import { useMagnifierOverlayDom } from '@/composables/useMagnifierOverlayDom.js';
import { useCameraPanSession } from '@/composables/useCameraPanSession.js';
import { createSchematicPointerMapping } from '@/composables/useSchematicPointerMapping.js';
import { useDiagramLabelDrag } from '@/composables/useDiagramLabelDrag.js';
import { useEntityEditorActions } from '@/composables/useEntityEditorActions.js';
import { resolveDirectionalDepthShiftPatch, resolveDirectionalLabelDragPatch } from '@/utils/diagramLabelDrag.js';
import { resolveDirectionalReferenceHorizonDepthMeta } from '@/utils/referenceHorizons.js';
import { solveOptimalFigureHeight } from '@/utils/autoFitMath.js';
import { buildCameraTransform, clampZoom, invertCameraPoint } from '@/utils/svgTransformMath.js';
import {
  DIRECTIONAL_BASE_SVG_WIDTH,
  DIRECTIONAL_MARGIN,
  buildDirectionalVisualSizing,
  resolveDirectionalMaxVisualRadiusPx,
  resolveDirectionalPlotInsetRange,
  resolveDirectionalSvgWidthFromHeightWithInsets,
  resolveDirectionalVisualInsetPadding
} from '@/utils/directionalSizing.js';
import {
  DEFAULT_MAGNIFIER_ZOOM_LEVEL,
  MAGNIFIER_WINDOW_DEFAULTS,
  normalizeMagnifierZoomLevel
} from '@/constants/index.js';
import { createClientPointerResolver } from '@/composables/useClientPointerResolver.js';
const EPSILON = 1e-6;
const AUTO_FIT_HEIGHT_DELTA_THRESHOLD = 2;
const DIRECTIONAL_VIEWPORT_FIT_MODE_CONTAIN = 'contain';
const DIRECTIONAL_VIEWPORT_FIT_MODE_FILL_WIDTH = 'fill-width';
const baseMargin = DIRECTIONAL_MARGIN;

function normalizeDirectionalViewportFitMode(value) {
  return String(value ?? '').trim().toLowerCase() === DIRECTIONAL_VIEWPORT_FIT_MODE_FILL_WIDTH
    ? DIRECTIONAL_VIEWPORT_FIT_MODE_FILL_WIDTH
    : DIRECTIONAL_VIEWPORT_FIT_MODE_CONTAIN;
}

const props = defineProps({
  projectData: {
    type: Object,
    default: () => ({})
  },
  config: {
    type: Object,
    default: () => ({})
  },
  topologyResult: {
    type: Object,
    default: null
  },
  topologyOverlayOptions: {
    type: Object,
    default: null
  },
  topologyOverlaySelection: {
    type: Object,
    default: null
  },
  readonly: {
    type: Boolean,
    default: false
  },
  analysisRequestId: {
    type: [Number, String],
    default: null
  }
});

const emit = defineEmits(['svg-ready', 'analysis-geometry-ready']);
const magnifierIdToken = Math.random().toString(36).slice(2, 9);
const interactionStore = useInteractionStore();
const viewConfigStore = useViewConfigStore();
const { updateFields } = useEntityEditorActions();
const isReadonly = computed(() => props.readonly === true);

const IDENTITY_CAMERA_STATE = Object.freeze({
  scale: 1,
  translateX: 0,
  translateY: 0
});
const containerRef = ref(null);
const svgRef = ref(null);
const sceneRootRef = ref(null);
const containerWidth = ref(900);
const containerHeight = ref(720);
const tooltipVisible = ref(false);
const tooltipModel = ref(null);
const tooltipX = ref(0);
const tooltipY = ref(0);
const hoverCursorGroupRef = ref(null);
const hoverCursorLineRef = ref(null);
const hoverCursorLabelRectRef = ref(null);
const hoverCursorLabelTextRef = ref(null);
const anchorCursorGroupRef = ref(null);
const anchorCursorLineRef = ref(null);
const anchorCursorLabelRectRef = ref(null);
const anchorCursorLabelTextRef = ref(null);
const magnifierClipRectRef = ref(null);
const magnifierGlassRectRef = ref(null);
const magnifierFrameRectRef = ref(null);
const magnifierOverlayGroupRef = ref(null);
const magnifierFrameGroupRef = ref(null);
const magnifierTransformGroupRef = ref(null);
const isRenderModelLoading = ref(false);
const directionalRenderModel = ref({
  trajectory: [],
  totalMD: 0,
  physicsContext: null,
  intervals: []
});
const tooltipPointerResolver = createClientPointerResolver();
const TOOLTIP_STALE_HIDE_MS = 48;
const DIRECTIONAL_WHEEL_ZOOM_SENSITIVITY = 0.0025;
const DIRECTIONAL_WHEEL_ZOOM_MIN = 0.25;
const DIRECTIONAL_WHEEL_ZOOM_MAX = 4;
let resizeObserver = null;
let directionalRenderRequestVersion = 0;
let lastTooltipHoverAt = 0;

const lastAutoFitSignature = computed(() => (
  typeof viewConfigStore.uiState?.lastDirectionalAutoFitSignature === 'string'
    ? viewConfigStore.uiState.lastDirectionalAutoFitSignature
    : null
));

function setLastAutoFitSignature(signature) {
  viewConfigStore.setDirectionalAutoFitSignature(signature);
}

const casingRows = computed(() => (
  Array.isArray(props.projectData?.casingData) ? props.projectData.casingData : []
));
const tubingRows = computed(() => (
  Array.isArray(props.projectData?.tubingData) ? props.projectData.tubingData : []
));
const drillStringRows = computed(() => (
  Array.isArray(props.projectData?.drillStringData) ? props.projectData.drillStringData : []
));
const equipmentRows = computed(() => (
  Array.isArray(props.projectData?.equipmentData) ? props.projectData.equipmentData : []
));
const horizontalLineRows = computed(() => (
  Array.isArray(props.projectData?.horizontalLines) ? props.projectData.horizontalLines : []
));
const plugRows = computed(() => (
  Array.isArray(props.projectData?.cementPlugs) ? props.projectData.cementPlugs : []
));
const fluidRows = computed(() => (
  Array.isArray(props.projectData?.annulusFluids) ? props.projectData.annulusFluids : []
));
const markerRows = computed(() => (
  Array.isArray(props.projectData?.markers) ? props.projectData.markers : []
));
const annotationBoxRows = computed(() => (
  Array.isArray(props.projectData?.annotationBoxes) ? props.projectData.annotationBoxes : []
));
const userAnnotationRows = computed(() => (
  Array.isArray(props.projectData?.userAnnotations) ? props.projectData.userAnnotations : []
));
const trajectoryRows = computed(() => (
  Array.isArray(props.projectData?.trajectory) ? props.projectData.trajectory : []
));
function toSafeAnalysisRequestId(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return null;
}

function hashSignatureValue(seed, text) {
  let hash = seed >>> 0;
  const normalized = String(text ?? '');
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatSignatureNumber(value, digits = 3) {
  const parsed = parseOptionalNumber(value);
  if (!Number.isFinite(parsed)) return '';
  return Number(parsed).toFixed(digits);
}

function buildTrajectoryRowsSignature(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let hash = 2166136261;
  rows.forEach((row) => {
    hash = hashSignatureValue(hash, formatSignatureNumber(row?.md, 3));
    hash = hashSignatureValue(hash, '|');
    hash = hashSignatureValue(hash, formatSignatureNumber(row?.inc, 3));
    hash = hashSignatureValue(hash, '|');
    hash = hashSignatureValue(hash, formatSignatureNumber(row?.azi, 3));
    hash = hashSignatureValue(hash, ';');
  });
  return `${rows.length}:${hash >>> 0}`;
}

const unitsLabel = computed(() => String(props.config?.units || 'ft'));
const plotTitle = computed(() => String(props.config?.plotTitle ?? '').trim());
const margin = computed(() => ({
  top: baseMargin.top,
  right: baseMargin.right,
  bottom: baseMargin.bottom,
  left: baseMargin.left
}));

const figHeightValue = computed(() => {
  const parsed = Number(props.config?.figHeight);
  const fallback = 800;
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(520, Math.round(value));
});

const lockAspectRatio = computed(() => props.config?.lockAspectRatio === true);
const directionalViewportFitMode = computed(() => (
  normalizeDirectionalViewportFitMode(props.config?.directionalViewportFitMode)
));

const xExaggerationValue = computed(() => normalizeXExaggeration(props.config?.xExaggeration));

const fallbackTrajectoryPoints = computed(() => (
  resolveTrajectoryPointsFromRows(
    trajectoryRows.value,
    props.config ?? {},
    {
      casingData: casingRows.value
    }
  )
));

const trajectoryPoints = computed(() => {
  const workerTrajectory = directionalRenderModel.value.trajectory;
  if (Array.isArray(workerTrajectory) && workerTrajectory.length > 0) {
    return workerTrajectory;
  }
  return fallbackTrajectoryPoints.value;
});

const xOriginValue = computed(() => {
  const firstPoint = trajectoryPoints.value[0];
  const parsed = parseOptionalNumber(firstPoint?.x);
  return Number.isFinite(parsed) ? parsed : 0;
});

const directionalStateSnapshot = computed(() => ({
  casingData: casingRows.value,
  tubingData: tubingRows.value,
  drillStringData: drillStringRows.value,
  equipmentData: Array.isArray(props.projectData?.equipmentData) ? props.projectData.equipmentData : [],
  horizontalLines: horizontalLineRows.value,
  annotationBoxes: annotationBoxRows.value,
  userAnnotations: userAnnotationRows.value,
  cementPlugs: plugRows.value,
  annulusFluids: fluidRows.value,
  markers: markerRows.value,
  trajectory: trajectoryRows.value,
  config: props.config ?? {},
  interaction: {}
}));

watch([directionalStateSnapshot, () => props.analysisRequestId], async ([snapshot, analysisRequestId]) => {
  const requestVersion = ++directionalRenderRequestVersion;
  const currentAnalysisRequestId = toSafeAnalysisRequestId(analysisRequestId);
  isRenderModelLoading.value = true;

  try {
    const result = await buildDirectionalRenderModelInWorker(snapshot);
    if (requestVersion !== directionalRenderRequestVersion) return;

    directionalRenderModel.value = {
      trajectory: Array.isArray(result?.trajectory) ? result.trajectory : [],
      totalMD: Number.isFinite(Number(result?.totalMD)) ? Number(result.totalMD) : 0,
      physicsContext: result?.physicsContext ?? null,
      intervals: Array.isArray(result?.intervals) ? result.intervals : []
    };
  } catch (error) {
    if (isRenderModelWorkerCancelledError(error)) return;
    if (requestVersion !== directionalRenderRequestVersion) return;

    directionalRenderModel.value = {
      trajectory: [],
      totalMD: 0,
      physicsContext: null,
      intervals: []
    };
  } finally {
    if (requestVersion === directionalRenderRequestVersion) {
      isRenderModelLoading.value = false;
      if (currentAnalysisRequestId !== null) {
        emit('analysis-geometry-ready', currentAnalysisRequestId);
      }
    }
  }
}, { immediate: true, deep: true });

const physicsContext = computed(() => (
  directionalRenderModel.value.physicsContext?.__physicsContext
    ? directionalRenderModel.value.physicsContext
    : createPhysicsContext(directionalStateSnapshot.value)
));

const equipment = computed(() => (
  Array.isArray(physicsContext.value?.equipment)
    ? physicsContext.value.equipment
    : []
));

const totalMDValue = computed(() => {
  const workerTotalMd = Number(directionalRenderModel.value.totalMD);
  if (Number.isFinite(workerTotalMd) && workerTotalMd > 0) return workerTotalMd;

  const points = trajectoryPoints.value;
  if (!Array.isArray(points) || points.length < 2) return 0;
  const lastMD = parseOptionalNumber(points[points.length - 1]?.md);
  if (!Number.isFinite(lastMD) || lastMD <= 0) return 0;
  return lastMD;
});

const directionalIntervals = computed(() => {
  const workerIntervals = directionalRenderModel.value.intervals;
  if (Array.isArray(workerIntervals) && workerIntervals.length > 0) {
    return workerIntervals;
  }

  const context = physicsContext.value;
  const maxMD = totalMDValue.value;
  if (!context || maxMD <= EPSILON) return [];

  const intervals = getPhysicsIntervals(context)
    .map((interval) => {
      const top = Math.max(0, Number(interval?.top));
      const bottom = Math.min(maxMD, Number(interval?.bottom));
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
      const midpoint = (top + bottom) / 2;
      return {
        top,
        bottom,
        midpoint,
        stack: getPhysicsStackAtDepth(midpoint, context)
      };
    })
    .filter(Boolean);

  if (intervals.length > 0) return intervals;

  return [{
    top: 0,
    bottom: maxMD,
    midpoint: maxMD / 2,
    stack: getPhysicsStackAtDepth(maxMD / 2, context)
  }];
});

const maxCasingOuterRadius = computed(() => {
  const ods = casingRows.value
    .map((row) => Number(row?.od))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (ods.length === 0) return 1;
  return Math.max(...ods) / 2;
});

const maxStackOuterRadius = computed(() => {
  const radii = [];
  directionalIntervals.value.forEach((interval) => {
    (Array.isArray(interval?.stack) ? interval.stack : []).forEach((layer) => {
      const outer = Number(layer?.outerRadius);
      if (Number.isFinite(outer) && outer > 0) {
        radii.push(outer);
      }
    });
  });
  return radii.length > 0 ? Math.max(...radii) : 1;
});

const visualSizingValue = computed(() => (
  buildDirectionalVisualSizing({
    intervals: directionalIntervals.value
  })
));

const maxProjectedRadiusValue = computed(() => (
  resolveDirectionalMaxVisualRadiusPx(visualSizingValue.value, 0)
));

const diameterScaleValue = computed(() => {
  const maxPhysicalRadius = Math.max(1, maxCasingOuterRadius.value, maxStackOuterRadius.value);
  return maxProjectedRadiusValue.value / maxPhysicalRadius;
});

const exaggeratedXValues = computed(() => (
  trajectoryPoints.value
    .map((point) => parseOptionalNumber(point?.x))
    .filter((value) => Number.isFinite(value))
    .map((value) => xOriginValue.value + ((value - xOriginValue.value) * xExaggerationValue.value))
));

const tvdValues = computed(() => (
  trajectoryPoints.value
    .map((point) => parseOptionalNumber(point?.tvd))
    .filter((value) => Number.isFinite(value))
));

const projectedCasingTvdBounds = computed(() => (
  resolveProjectedDepthBounds(
    casingRows.value,
    trajectoryPoints.value,
    {
      topKey: 'top',
      bottomKey: 'bottom'
    }
  )
));

const rawMinXValue = computed(() => (
  exaggeratedXValues.value.length > 0 ? Math.min(...exaggeratedXValues.value) : 0
));
const rawMaxXValue = computed(() => (
  exaggeratedXValues.value.length > 0 ? Math.max(...exaggeratedXValues.value) : 0
));
const rawMinTvdValue = computed(() => {
  const casingMin = projectedCasingTvdBounds.value?.min;
  const trajectoryMin = tvdValues.value.length > 0 ? Math.min(...tvdValues.value) : null;

  if (Number.isFinite(casingMin) && Number.isFinite(trajectoryMin)) {
    // Prefer casing top when trajectory contributes a zero-depth anchor point.
    if (trajectoryMin <= EPSILON && casingMin > EPSILON) {
      return casingMin;
    }
    return Math.min(casingMin, trajectoryMin);
  }
  if (Number.isFinite(casingMin)) return casingMin;
  if (Number.isFinite(trajectoryMin)) return trajectoryMin;
  return 0;
});
const rawMaxTvdValue = computed(() => {
  const casingMax = projectedCasingTvdBounds.value?.max;
  const trajectoryMax = tvdValues.value.length > 0 ? Math.max(...tvdValues.value) : null;
  if (Number.isFinite(casingMax) && Number.isFinite(trajectoryMax)) {
    return Math.max(casingMax, trajectoryMax);
  }
  if (Number.isFinite(casingMax)) return casingMax;
  if (Number.isFinite(trajectoryMax)) return trajectoryMax;
  return 1000;
});

const DIRECTIONAL_MIN_X_SPAN = 100;

const minXData = computed(() => {
  const center = (rawMinXValue.value + rawMaxXValue.value) / 2;
  const actualSpread = Math.max(0, rawMaxXValue.value - rawMinXValue.value);
  const targetSpread = Math.max(DIRECTIONAL_MIN_X_SPAN, actualSpread);
  return center - (targetSpread / 2);
});

const maxXData = computed(() => {
  const center = (rawMinXValue.value + rawMaxXValue.value) / 2;
  const actualSpread = Math.max(0, rawMaxXValue.value - rawMinXValue.value);
  const targetSpread = Math.max(DIRECTIONAL_MIN_X_SPAN, actualSpread);
  return center + (targetSpread / 2);
});
const minTvdData = computed(() => rawMinTvdValue.value);
const maxTvdData = computed(() => {
  const maxValue = rawMaxTvdValue.value;
  return maxValue > minTvdData.value ? maxValue : minTvdData.value + 1;
});

const datumDepth = computed(() => {
  const parsed = parseOptionalNumber(props.config?.datumDepth);
  if (Number.isFinite(parsed)) {
    if (Math.abs(parsed) <= EPSILON && rawMinTvdValue.value > EPSILON) {
      return rawMinTvdValue.value;
    }
    return parsed;
  }
  return rawMinTvdValue.value;
});

const minYData = computed(() => Math.min(minTvdData.value, datumDepth.value));
const maxYData = computed(() => {
  const maxValue = Math.max(maxTvdData.value, datumDepth.value);
  return maxValue > minYData.value ? maxValue : minYData.value + 1;
});
const trajectorySignature = computed(() => {
  const trajectoryInputSignature = buildTrajectoryRowsSignature(trajectoryRows.value);
  if (!trajectoryInputSignature) return null;
  const casingMin = Number(projectedCasingTvdBounds.value?.min);
  const casingMax = Number(projectedCasingTvdBounds.value?.max);
  return [
    trajectoryInputSignature,
    Number.isFinite(casingMin) ? casingMin.toFixed(3) : '',
    Number.isFinite(casingMax) ? casingMax.toFixed(3) : ''
  ].join('|');
});

const plotHeightValue = computed(() => Math.max(10, figHeightValue.value - margin.value.top - margin.value.bottom));
const dataWidthValue = computed(() => Math.max(1, Math.abs(maxXData.value - minXData.value)));
const dataHeightValue = computed(() => Math.max(1, Math.abs(maxYData.value - minYData.value)));
const centerlineDataAspectRatioValue = computed(() => dataWidthValue.value / dataHeightValue.value);
const visualInsetPaddingValue = computed(() => (
  resolveDirectionalVisualInsetPadding({
    visualMaxRadiusPx: maxProjectedRadiusValue.value,
    formationThicknessPx: visualSizingValue.value?.formationThicknessPx
  })
));
const dataAspectRatioValue = computed(() => {
  const plotHeight = plotHeightValue.value;
  if (!Number.isFinite(plotHeight) || plotHeight <= 0) return 1;
  const insetWidth = Number(visualInsetPaddingValue.value?.horizontal) || 0;
  const centerlinePlotWidth = centerlineDataAspectRatioValue.value * plotHeight;
  return (centerlinePlotWidth + (insetWidth * 2)) / plotHeight;
});

const canvasWidthMultiplierValue = computed(() => {
  const parsed = Number(props.config?.canvasWidthMultiplier);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
});

const svgWidthValue = computed(() => {
  if (lockAspectRatio.value) {
    return resolveDirectionalSvgWidthFromHeightWithInsets(
      figHeightValue.value,
      centerlineDataAspectRatioValue.value,
      margin.value,
      visualInsetPaddingValue.value
    );
  }

  return Math.round(DIRECTIONAL_BASE_SVG_WIDTH * canvasWidthMultiplierValue.value);
});

watch(dataAspectRatioValue, (nextAspect) => {
  viewConfigStore.setDirectionalDataAspectRatio(nextAspect);
}, { immediate: true });

const plotWidthValue = computed(() => Math.max(10, svgWidthValue.value - margin.value.left - margin.value.right));
const displayScaleValue = computed(() => {
  const nextContainerWidth = Number(containerWidth.value);
  const nextContainerHeight = Number(containerHeight.value);
  if (!Number.isFinite(nextContainerWidth) || nextContainerWidth <= 0) return 1;
  if (!Number.isFinite(svgWidthValue.value) || svgWidthValue.value <= 0) return 1;
  const widthRatio = nextContainerWidth / svgWidthValue.value;
  if (!Number.isFinite(widthRatio) || widthRatio <= 0) return 1;
  if (directionalViewportFitMode.value === DIRECTIONAL_VIEWPORT_FIT_MODE_FILL_WIDTH) {
    return widthRatio;
  }
  if (!Number.isFinite(nextContainerHeight) || nextContainerHeight <= 0) return 1;
  if (!Number.isFinite(figHeightValue.value) || figHeightValue.value <= 0) return 1;
  const heightRatio = nextContainerHeight / figHeightValue.value;
  const containRatio = Math.min(widthRatio, heightRatio);
  if (!Number.isFinite(containRatio) || containRatio <= 0) return 1;
  return containRatio;
});
const displayWidthValue = computed(() => Math.round(svgWidthValue.value * displayScaleValue.value));
const displayHeightValue = computed(() => Math.round(figHeightValue.value * displayScaleValue.value));
const plotInsetRangeValue = computed(() => (
  resolveDirectionalPlotInsetRange(
    svgWidthValue.value,
    figHeightValue.value,
    margin.value,
    visualInsetPaddingValue.value
  )
));

const xScale = computed(() => d3.scaleLinear()
  .domain([minXData.value, maxXData.value])
  .range([plotInsetRangeValue.value.left, plotInsetRangeValue.value.right]));

const yScale = computed(() => d3.scaleLinear()
  .domain([minYData.value, maxYData.value])
  .range([plotInsetRangeValue.value.top, plotInsetRangeValue.value.bottom]));

const directionalProjector = computed(() => (
  buildDirectionalProjector(
    trajectoryPoints.value,
    xScale.value,
    yScale.value,
    {
      xExaggeration: xExaggerationValue.value,
      xOrigin: xOriginValue.value
    }
  )
));

const crossSectionNearestSamples = computed(() => {
  const project = directionalProjector.value;
  const totalMD = Number(totalMDValue.value);
  if (typeof project !== 'function' || !Number.isFinite(totalMD) || totalMD <= EPSILON) return [];

  const sampleStep = Math.max(2, Math.min(24, totalMD / 900));
  return buildMDSamples(0, totalMD, sampleStep)
    .map((md) => {
      const point = project(md, 0);
      if (!isFinitePoint(point)) return null;
      return {
        md,
        x: point[0],
        y: point[1]
      };
    })
    .filter(Boolean);
});

function resolveNearestMDFromPointer(pointer) {
  const pointerX = Number(pointer?.x);
  const pointerY = Number(pointer?.y);
  if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return null;

  const samples = crossSectionNearestSamples.value;
  if (!Array.isArray(samples) || samples.length === 0) return null;

  let bestMD = null;
  let bestDistanceSq = Infinity;
  samples.forEach((sample) => {
    const dx = sample.x - pointerX;
    const dy = sample.y - pointerY;
    const distanceSq = (dx * dx) + (dy * dy);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestMD = sample.md;
    }
  });

  return Number.isFinite(bestMD) ? bestMD : null;
}

function resolveNearestMDFromProjectedY(pointerY) {
  const yValue = Number(pointerY);
  if (!Number.isFinite(yValue)) return null;

  const tvd = Number(yScale.value.invert(yValue));
  if (!Number.isFinite(tvd)) return null;

  return resolveMDFromTVD(tvd, trajectoryPoints.value);
}

function resolveLineSegmentInPlot(center, direction, bounds) {
  const cx = Number(center?.[0]);
  const cy = Number(center?.[1]);
  const dx = Number(direction?.x);
  const dy = Number(direction?.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) return null;

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

  if (Math.abs(dx) > EPSILON) {
    const tLeft = (left - cx) / dx;
    const yLeft = cy + (tLeft * dy);
    if (yLeft >= top - EPSILON && yLeft <= bottom + EPSILON) {
      pushUnique(left, clamp(yLeft, top, bottom));
    }

    const tRight = (right - cx) / dx;
    const yRight = cy + (tRight * dy);
    if (yRight >= top - EPSILON && yRight <= bottom + EPSILON) {
      pushUnique(right, clamp(yRight, top, bottom));
    }
  }

  if (Math.abs(dy) > EPSILON) {
    const tTop = (top - cy) / dy;
    const xTop = cx + (tTop * dx);
    if (xTop >= left - EPSILON && xTop <= right + EPSILON) {
      pushUnique(clamp(xTop, left, right), top);
    }

    const tBottom = (bottom - cy) / dy;
    const xBottom = cx + (tBottom * dx);
    if (xBottom >= left - EPSILON && xBottom <= right + EPSILON) {
      pushUnique(clamp(xBottom, left, right), bottom);
    }
  }

  if (intersections.length < 2) return null;

  let bestPair = null;
  let bestDistanceSq = -1;
  for (let i = 0; i < intersections.length - 1; i += 1) {
    for (let j = i + 1; j < intersections.length; j += 1) {
      const dxPair = intersections[i].x - intersections[j].x;
      const dyPair = intersections[i].y - intersections[j].y;
      const distanceSq = (dxPair * dxPair) + (dyPair * dyPair);
      if (distanceSq > bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestPair = [intersections[i], intersections[j]];
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

const isDepthCursorEnabled = computed(() => props.config?.showDepthCursor === true);
const depthCursorDirectionalMode = computed(() => (
  props.config?.depthCursorDirectionalMode === 'md' ? 'md' : 'tvd'
));
const plotLeftX = computed(() => xScale.value(minXData.value));
const plotRightX = computed(() => xScale.value(maxXData.value));
const plotTopY = computed(() => yScale.value(minYData.value));
const plotBottomY = computed(() => yScale.value(maxYData.value));

const depthCursor = useDepthCursorOverlay({
  enabled: isDepthCursorEnabled,
  containerRef,
  svgWidth: svgWidthValue,
  svgHeight: figHeightValue,
  plotLeftX,
  plotRightX,
  plotTopY,
  plotBottomY,
  restrictXToPlot: false,
  resolvePointerFromClient: ({ clientX, clientY, localPointer }) => (
    pointerMapping.resolvePointer({ clientX, clientY })?.canonicalPoint ??
    invertCameraPoint(localPointer, directionalCameraState.value) ??
    localPointer
  ),
  resolveDepth: (pointer) => {
    const tvd = Number(yScale.value.invert(pointer?.y));
    if (!Number.isFinite(tvd)) return null;
    if (depthCursorDirectionalMode.value === 'md') {
      return resolveNearestMDFromPointer(pointer);
    }
    return tvd;
  }
});
const depthCursorVisible = depthCursor.visible;
const depthCursorX = depthCursor.x;
const depthCursorY = depthCursor.y;
const crossSectionVisible = computed(() => props.config?.showDepthCrossSection === true);

const depthCursorLabel = computed(() => {
  const depth = Number(depthCursor.depth.value);
  if (!Number.isFinite(depth)) return '';
  const prefix = depthCursorDirectionalMode.value === 'md' ? 'MD' : 'TVD';
  return `${prefix} ${formatDepthValue(depth, 1)} ${unitsLabel.value}`;
});

const isMagnifierEnabled = computed(() => props.config?.showMagnifier === true);
const magnifierWindowWidth = MAGNIFIER_WINDOW_DEFAULTS.width;
const magnifierWindowHeight = MAGNIFIER_WINDOW_DEFAULTS.height;
const magnifierMargin = MAGNIFIER_WINDOW_DEFAULTS.margin;
const magnifierPointerGap = MAGNIFIER_WINDOW_DEFAULTS.pointerGap;
const magnifierEdgePadding = MAGNIFIER_WINDOW_DEFAULTS.edgePadding;
const magnifierScale = computed(() => (
  normalizeMagnifierZoomLevel(
    props.config?.magnifierZoomLevel,
    DEFAULT_MAGNIFIER_ZOOM_LEVEL
  )
));
const magnifierOverlay = useMagnifierOverlayDom({
  enabled: isMagnifierEnabled,
  containerRef,
  svgWidth: svgWidthValue,
  svgHeight: figHeightValue,
  windowWidth: magnifierWindowWidth,
  windowHeight: magnifierWindowHeight,
  scale: magnifierScale,
  margin: magnifierMargin,
  pointerGap: magnifierPointerGap,
  edgePadding: magnifierEdgePadding,
  movementEpsilon: 0.5,
  overlayGroupRef: magnifierOverlayGroupRef,
  frameGroupRef: magnifierFrameGroupRef,
  transformGroupRef: magnifierTransformGroupRef,
  clipRectRef: magnifierClipRectRef,
  glassRectRef: magnifierGlassRectRef,
  frameRectRef: magnifierFrameRectRef
});
const magnifierSceneId = `directional-scene-${magnifierIdToken}`;
const magnifierClipPathId = `directional-magnifier-clip-${magnifierIdToken}`;
const isCameraTransformEnabled = computed(() => (
  viewConfigStore.uiState?.useCameraTransform === true &&
  viewConfigStore.uiState?.cameraTransformDirectional === true
));
const directionalCameraState = computed(() => (
  isCameraTransformEnabled.value
    ? (viewConfigStore.uiState?.directionalCamera ?? IDENTITY_CAMERA_STATE)
    : IDENTITY_CAMERA_STATE
));
const sceneRootTransform = computed(() => buildCameraTransform(directionalCameraState.value));
const pointerMapping = createSchematicPointerMapping({
  svgElement: svgRef,
  resolveCamera: () => directionalCameraState.value
});
const cameraPanSession = useCameraPanSession({
  enabled: isCameraTransformEnabled,
  panBy: (deltaX, deltaY) => {
    viewConfigStore.panDirectionalCameraBy(deltaX, deltaY);
  }
});
const isCameraPanActive = cameraPanSession.isPanActive;
const labelDrag = useDiagramLabelDrag({
  enabled: true,
  resolvePointer: (event) => pointerMapping.resolvePointer(event)?.canonicalPoint ?? null
});

function buildDirectionalLabelPatch(payload, previewOffset = {}) {
  if (!payload) return null;
  if (payload.dragKind === 'depth-shift') {
    const resolveDepthFromPoint = payload.resolveDepthMode === 'projected-y'
      ? (point) => resolveNearestMDFromProjectedY(point?.y)
      : payload.resolveDepthMode === 'tvd-y'
        ? (point) => {
          const tvd = Number(yScale.value.invert(point?.y));
          return Number.isFinite(tvd) ? tvd : null;
        }
      : resolveNearestMDFromPointer;
    return resolveDirectionalDepthShiftPatch({
      startPointer: { x: Number(payload.centerX), y: Number(payload.centerY) },
      pointer: {
        x: Number(payload.centerX) + Number(previewOffset?.x ?? 0),
        y: Number(payload.centerY) + Number(previewOffset?.y ?? 0)
      },
      lockXToStart: true,
      resolveDepthFromPoint,
      entries: Array.isArray(payload.entries) ? payload.entries : []
    });
  }
  return resolveDirectionalLabelDragPatch({
    pointer: {
      x: Number(payload.centerX) + Number(previewOffset?.x ?? 0),
      y: Number(payload.centerY) + Number(previewOffset?.y ?? 0)
    },
    bounds: payload.bounds,
    resolveDepthFromPoint: resolveNearestMDFromPointer,
    xField: payload.xField,
    yField: payload.yField,
    depthRange: {
      min: 0,
      max: Math.max(0, Number(totalMDValue.value))
    }
  });
}

function handleStartLabelDrag(payload, event) {
  if (isReadonly.value || !payload) return;
  labelDrag.startDrag({
    previewId: payload.previewId,
    buildPatch: ({ previewOffset }) => buildDirectionalLabelPatch(payload, previewOffset),
    commitPatch: (patch) => {
      if (!patch || typeof patch !== 'object') return;
      updateFields({
        entityType: payload.entityType,
        rowId: payload.rowId,
        patch
      });
    }
  }, event);
}

function handleWindowPointerMove(event) {
  labelDrag.updateDrag(event);
}

function handleWindowPointerUp(event) {
  labelDrag.finishDrag(event);
}

const depthCursorLineSegment = computed(() => {
  if (!depthCursor.visible.value) return null;
  if (depthCursorDirectionalMode.value !== 'md') return null;

  const md = Number(depthCursor.depth.value);
  if (!Number.isFinite(md)) return null;

  const frame = resolveScreenFrameAtMD(md, {
    project: directionalProjector.value,
    totalMD: totalMDValue.value,
    diameterScale: diameterScaleValue.value,
    maxProjectedRadius: maxProjectedRadiusValue.value
  });
  if (!frame?.center || !frame?.normal) return null;

  return resolveLineSegmentInPlot(frame.center, frame.normal, {
    left: plotLeftX.value,
    right: plotRightX.value,
    top: plotTopY.value,
    bottom: plotBottomY.value
  });
});

const anchoredDepth = computed(() => {
  if (props.config?.showDepthCrossSection !== true) return null;
  const depth = Number(props.config?.cursorDepth);
  if (!Number.isFinite(depth)) return null;
  const maxDepth = Number(totalMDValue.value);
  if (!Number.isFinite(maxDepth) || maxDepth <= EPSILON) return null;
  return clamp(depth, 0, maxDepth);
});
const anchorDepthLabel = computed(() => {
  const depth = Number(anchoredDepth.value);
  if (!Number.isFinite(depth)) return '';
  return `MD ${formatDepthValue(depth, 1)} ${unitsLabel.value}`;
});
const anchorLineSegment = computed(() => {
  const md = Number(anchoredDepth.value);
  if (!Number.isFinite(md)) return null;

  const frame = resolveScreenFrameAtMD(md, {
    project: directionalProjector.value,
    totalMD: totalMDValue.value,
    diameterScale: diameterScaleValue.value,
    maxProjectedRadius: maxProjectedRadiusValue.value
  });
  if (!frame?.center || !frame?.normal) return null;

  return resolveLineSegmentInPlot(frame.center, frame.normal, {
    left: plotLeftX.value,
    right: plotRightX.value,
    top: plotTopY.value,
    bottom: plotBottomY.value
  });
});
const anchorLineVisible = computed(() => Number.isFinite(anchoredDepth.value));
const anchorCursorX = computed(() => {
  const segment = anchorLineSegment.value;
  if (segment) return (segment.startX + segment.endX) / 2;
  return plotLeftX.value;
});
const anchorCursorY = computed(() => {
  const segment = anchorLineSegment.value;
  if (segment) return (segment.startY + segment.endY) / 2;
  const md = Number(anchoredDepth.value);
  if (!Number.isFinite(md)) return 0;
  return yScale.value(md);
});

useDepthCursorLayerDom({
  visible: depthCursorVisible,
  cursorX: depthCursorX,
  cursorY: depthCursorY,
  lineStartX: computed(() => depthCursorLineSegment.value?.startX),
  lineStartY: computed(() => depthCursorLineSegment.value?.startY),
  lineEndX: computed(() => depthCursorLineSegment.value?.endX),
  lineEndY: computed(() => depthCursorLineSegment.value?.endY),
  plotLeftX,
  plotRightX,
  plotTopY,
  plotBottomY,
  label: depthCursorLabel,
  showLabel: true,
  groupRef: hoverCursorGroupRef,
  lineRef: hoverCursorLineRef,
  labelRectRef: hoverCursorLabelRectRef,
  labelTextRef: hoverCursorLabelTextRef
});

useDepthCursorLayerDom({
  visible: anchorLineVisible,
  cursorX: anchorCursorX,
  cursorY: anchorCursorY,
  lineStartX: computed(() => anchorLineSegment.value?.startX),
  lineStartY: computed(() => anchorLineSegment.value?.startY),
  lineEndX: computed(() => anchorLineSegment.value?.endX),
  lineEndY: computed(() => anchorLineSegment.value?.endY),
  plotLeftX,
  plotRightX,
  plotTopY,
  plotBottomY,
  label: anchorDepthLabel,
  showLabel: true,
  groupRef: anchorCursorGroupRef,
  lineRef: anchorCursorLineRef,
  labelRectRef: anchorCursorLabelRectRef,
  labelTextRef: anchorCursorLabelTextRef
});

function resolveCrossSectionDepthFromClient(clientX, clientY) {
  const pointerResult = pointerMapping.resolvePointer({ clientX, clientY });
  const pointer = pointerResult?.canonicalPoint;
  if (!pointer) return null;
  const nearestMD = Number(resolveNearestMDFromPointer(pointer));
  if (!Number.isFinite(nearestMD)) return null;
  const maxDepth = Number(totalMDValue.value);
  if (!Number.isFinite(maxDepth) || maxDepth <= EPSILON) return null;
  return clamp(nearestMD, 0, maxDepth);
}

const crossSectionDepthInteraction = useCrossSectionDepthInteraction({
  visible: crossSectionVisible,
  currentDepth: computed(() => props.config?.cursorDepth),
  resolveDepthFromClient: resolveCrossSectionDepthFromClient,
  setDepth: (depth) => viewConfigStore.setCursorDepth(depth),
  hoverIntervalMs: 33,
  depthEpsilon: 0.01,
  unlockOnMouseLeave: false
});

function executeSmartAutoFit(options = {}) {
  const signature = trajectorySignature.value;
  if (!signature) return false;
  const force = options?.force === true;
  if (!force && props.config?.lockAspectRatio !== true) return false;
  if (!force && viewConfigStore.consumeDirectionalAutoFitSuppression()) {
    setLastAutoFitSignature(signature);
    return false;
  }

  const recommendedHeight = solveOptimalFigureHeight(
    {
      minX: minXData.value,
      maxX: maxXData.value,
      minTvd: minYData.value,
      maxTvd: maxYData.value
    },
    {
      width: containerWidth.value,
      height: containerHeight.value
    },
    margin.value
  );
  if (!Number.isFinite(recommendedHeight)) return false;

  const nextHeight = Math.max(520, Math.round(recommendedHeight));
  const currentHeight = figHeightValue.value;
  if (!force && Math.abs(nextHeight - currentHeight) <= AUTO_FIT_HEIGHT_DELTA_THRESHOLD) {
    setLastAutoFitSignature(signature);
    return false;
  }

  viewConfigStore.updateConfig({
    figHeight: nextHeight
  });
  setLastAutoFitSignature(signature);
  return true;
}

const directionalFitToDataRequestCount = computed(() => (
  Number(viewConfigStore.uiState?.directionalFitToDataRequestCount) || 0
));

watch(directionalFitToDataRequestCount, async (nextCount, previousCount) => {
  if (!Number.isFinite(nextCount) || nextCount <= 0) return;
  if (Object.is(nextCount, previousCount)) return;
  await nextTick();
  executeSmartAutoFit({ force: true });
});

watch(trajectorySignature, (nextSignature, previousSignature) => {
  if (!nextSignature || !previousSignature || nextSignature === previousSignature) return;
  setLastAutoFitSignature(null);
});

watch(
  [trajectorySignature, containerWidth, containerHeight],
  async ([signature, width, height]) => {
    if (!signature || !Number.isFinite(width) || !Number.isFinite(height)) return;
    if (width <= 0 || height <= 0) return;
    if (lastAutoFitSignature.value === signature) return;
    await nextTick();
    executeSmartAutoFit();
  },
  { immediate: true }
);

function updateContainerSize() {
  const container = containerRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  containerWidth.value = Math.max(1, Math.round(rect.width));
  containerHeight.value = Math.max(1, Math.round(rect.height));
  tooltipPointerResolver.syncFromContainer(container, { forceRect: true });
  magnifierOverlay.refresh();
}

function resolvePointerPosition(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return { x: 8, y: 8 };
  }

  const container = containerRef.value;
  if (!tooltipPointerResolver.syncFromContainer(container)) {
    return { x: 8, y: 8 };
  }

  const pointer = tooltipPointerResolver.resolveFromClient(
    clientX,
    clientY,
    displayWidthValue.value,
    displayHeightValue.value
  );
  if (!pointer) {
    return { x: 8, y: 8 };
  }

  return {
    x: clamp(pointer.x, 0, displayWidthValue.value),
    y: clamp(pointer.y, 0, displayHeightValue.value)
  };
}

function showTooltip(model, event) {
  if (!model) {
    hideTooltip();
    return;
  }
  const pointer = resolvePointerPosition(event);
  tooltipModel.value = model;
  tooltipX.value = pointer.x;
  tooltipY.value = pointer.y;
  tooltipVisible.value = true;
  lastTooltipHoverAt = Date.now();
}

function hideTooltip() {
  tooltipVisible.value = false;
  tooltipModel.value = null;
  lastTooltipHoverAt = 0;
}

function normalizePipeEntity(entity) {
  if (!entity || typeof entity !== 'object') return null;
  const pipeType = normalizePipeType(entity.pipeType ?? entity.type);
  const rowIndex = Number(entity.rowIndex ?? entity.index);
  if (!pipeType || !Number.isInteger(rowIndex) || rowIndex < 0) return null;
  return { pipeType, rowIndex };
}

function resolvePipeRowsByType(pipeType) {
  const normalized = normalizePipeType(pipeType);
  if (normalized === 'casing') return casingRows.value;
  if (normalized === 'tubing') return tubingRows.value;
  if (normalized === 'drillString') return drillStringRows.value;
  return [];
}

function resolvePipeRow(entity) {
  const normalized = normalizePipeEntity(entity);
  if (!normalized) return null;
  const rows = resolvePipeRowsByType(normalized.pipeType);
  return rows[normalized.rowIndex] ?? null;
}

function handleSelectPipe(entity) {
  if (consumeSelectionClickAfterLabelDrag()) return;
  const normalized = normalizePipeEntity(entity);
  if (!normalized) return;
  dispatchSchematicInteraction('select', { type: 'pipe', id: normalized });
}

function consumeSelectionClickAfterLabelDrag() {
  return labelDrag.consumeFinishedDragClick() === true;
}

function handleHoverPipe(entity, event) {
  const normalized = normalizePipeEntity(entity);
  if (!normalized) {
    hideTooltip();
    return;
  }
  dispatchSchematicInteraction('hover', { type: 'pipe', id: normalized, preferPayload: true }, event);
  const row = resolvePipeRow(normalized);
  const model = buildPipeTooltipModel(row, unitsLabel.value, normalized.pipeType);
  showTooltip(model, event);
}

function handleLeavePipe() {
  dispatchSchematicInteraction('leave', { type: 'pipe' });
  hideTooltip();
}

function resolveFluidLayerAtDepth(depth, fluidIndex) {
  if (!Number.isFinite(depth) || !Number.isInteger(fluidIndex)) return null;
  const context = physicsContext.value;
  if (!context?.__physicsContext) return null;

  const stack = getPhysicsStackAtDepth(depth, context);
  if (!Array.isArray(stack) || stack.length === 0) return null;

  return stack.find((layer) => (
    layer?.material === 'fluid' &&
    Number(layer?.source?.index) === fluidIndex
  )) || null;
}

function resolveFluidTooltipMeta({ index, event }) {
  if (!Number.isInteger(index)) return null;
  const pointerResult = pointerMapping.resolvePointer(event);
  const pointer = pointerResult?.canonicalPoint;
  if (!pointer) return null;

  const depth = Number(resolveNearestMDFromPointer(pointer));
  if (!Number.isFinite(depth)) return null;

  const fluidLayer = resolveFluidLayerAtDepth(depth, index);
  const manualODOverride = fluidLayer?.manualODOverride;
  if (!manualODOverride) return null;

  return {
    manualODApplied: manualODOverride.appliedOD,
    manualODWasClamped: manualODOverride.wasClamped === true
  };
}

function resolveLineTooltipMeta({ row }) {
  if (!row || typeof row !== 'object') return null;
  const depthMeta = resolveDirectionalReferenceHorizonDepthMeta(row);
  return {
    directionalReferenceHorizonMode: depthMeta.mode,
    primaryDepth: depthMeta.primaryDepth,
    secondaryDepth: depthMeta.secondaryDepth,
    primaryLabel: depthMeta.primaryLabel,
    secondaryLabel: depthMeta.secondaryLabel
  };
}

const lineHandlers = usePlotEntityHandlers({
  type: 'line',
  rows: horizontalLineRows,
  unitsLabel,
  buildTooltipModel: buildLineTooltipModel,
  resolveTooltipMeta: resolveLineTooltipMeta,
  showTooltip,
  hideTooltip,
  consumeSelectClick: consumeSelectionClickAfterLabelDrag
});
const boxHandlers = usePlotEntityHandlers({
  type: 'box',
  rows: annotationBoxRows,
  unitsLabel,
  buildTooltipModel: buildBoxTooltipModel,
  showTooltip,
  hideTooltip,
  consumeSelectClick: consumeSelectionClickAfterLabelDrag
});
const markerHandlers = usePlotEntityHandlers({
  type: 'marker',
  rows: markerRows,
  unitsLabel,
  buildTooltipModel: buildMarkerTooltipModel,
  showTooltip,
  hideTooltip,
  consumeSelectClick: consumeSelectionClickAfterLabelDrag
});
const plugHandlers = usePlotEntityHandlers({
  type: 'plug',
  rows: plugRows,
  unitsLabel,
  buildTooltipModel: buildPlugTooltipModel,
  showTooltip,
  hideTooltip,
  consumeSelectClick: consumeSelectionClickAfterLabelDrag
});
const fluidHandlers = usePlotEntityHandlers({
  type: 'fluid',
  rows: fluidRows,
  unitsLabel,
  buildTooltipModel: buildFluidTooltipModel,
  resolveTooltipMeta: resolveFluidTooltipMeta,
  showTooltip,
  hideTooltip,
  consumeSelectClick: consumeSelectionClickAfterLabelDrag
});
const equipmentHandlers = usePlotEntityHandlers({
  type: 'equipment',
  rows: equipmentRows,
  unitsLabel,
  buildTooltipModel: buildEquipmentTooltipModel,
  showTooltip,
  hideTooltip,
  consumeSelectClick: consumeSelectionClickAfterLabelDrag
});

const handleSelectLine = lineHandlers.handleSelect;
const handleHoverLine = lineHandlers.handleHover;
const handleLeaveLine = lineHandlers.handleLeave;
const handleSelectBox = boxHandlers.handleSelect;
const handleHoverBox = boxHandlers.handleHover;
const handleLeaveBox = boxHandlers.handleLeave;
const handleSelectMarker = markerHandlers.handleSelect;
const handleHoverMarker = markerHandlers.handleHover;
const handleLeaveMarker = markerHandlers.handleLeave;
const handleSelectPlug = plugHandlers.handleSelect;
const handleHoverPlug = plugHandlers.handleHover;
const handleLeavePlug = plugHandlers.handleLeave;
const handleSelectFluid = fluidHandlers.handleSelect;
const handleHoverFluid = fluidHandlers.handleHover;
const handleLeaveFluid = fluidHandlers.handleLeave;
const handleSelectEquipment = equipmentHandlers.handleSelect;
const handleHoverEquipment = equipmentHandlers.handleHover;
const handleLeaveEquipment = equipmentHandlers.handleLeave;

function resetCameraPanState() {
  cameraPanSession.resetPan();
}

function startCameraPan(event) {
  return cameraPanSession.startPan(event);
}

function updateCameraPanFromPointer(event) {
  cameraPanSession.updatePan(event);
}

function handleCanvasPointerUp(event) {
  const finishResult = cameraPanSession.finishPan(event);
  if (finishResult?.shouldProcessClick) {
    handleCanvasBackgroundClick(event);
  }
}

function handleCanvasPointerDown(event) {
  if (!isCameraTransformEnabled.value && hasInteractiveSchematicTarget(event?.target)) return;
  startCameraPan(event);
}

function handleCanvasMouseLeave() {
  resetCameraPanState();
  handleLeavePipe();
  handleLeaveLine();
  handleLeaveBox();
  handleLeaveMarker();
  handleLeaveEquipment();
  handleLeaveSurfaceAssembly();
  handleLeavePlug();
  handleLeaveFluid();
  crossSectionDepthInteraction.handleMouseLeave();
  depthCursor.hide();
  magnifierOverlay.handleMouseLeave();
  hideTooltip();
}

function hideStaleTooltipOnMouseMove() {
  if (!tooltipVisible.value || lastTooltipHoverAt <= 0) return;
  if ((Date.now() - lastTooltipHoverAt) <= TOOLTIP_STALE_HIDE_MS) return;
  hideTooltip();
}

function handleCanvasMouseMove(event) {
  if (labelDrag.activePreviewId.value) return;
  if (isCameraPanActive.value) return;
  hideStaleTooltipOnMouseMove();
  if (crossSectionVisible.value) {
    crossSectionDepthInteraction.handleHover(event);
  }
  if (isDepthCursorEnabled.value) {
    depthCursor.handleMouseMove(event);
  }
  magnifierOverlay.handleMouseMove(event);
}

function handleCanvasScroll() {
  if (isDepthCursorEnabled.value) {
    depthCursor.handleScroll();
  }
  magnifierOverlay.handleScroll();
}

function handleCanvasWheel(event) {
  if (!isCameraTransformEnabled.value) return;
  if (isCameraPanActive.value) return;

  const pointerResult = pointerMapping.resolvePointer(event);
  const pointer = pointerResult?.svgPoint;
  const canonicalPoint = pointerResult?.canonicalPoint;
  if (!pointer || !canonicalPoint) return;

  const currentScale = Number(directionalCameraState.value?.scale);
  const deltaY = Number(event?.deltaY);
  const zoomDelta = Number.isFinite(deltaY)
    ? (-deltaY * DIRECTIONAL_WHEEL_ZOOM_SENSITIVITY)
    : 0;
  if (!Number.isFinite(currentScale) || zoomDelta === 0) return;

  const nextScale = clampZoom(currentScale + zoomDelta, {
    min: DIRECTIONAL_WHEEL_ZOOM_MIN,
    max: DIRECTIONAL_WHEEL_ZOOM_MAX,
    fallback: currentScale
  });
  if (Object.is(nextScale, currentScale)) return;

  const nextTranslateX = pointer.x - (canonicalPoint.x * nextScale);
  const nextTranslateY = pointer.y - (canonicalPoint.y * nextScale);
  viewConfigStore.setDirectionalCameraZoom(nextScale);
  viewConfigStore.setDirectionalCameraPan({
    translateX: nextTranslateX,
    translateY: nextTranslateY
  });

  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
  handleCanvasScroll();
}

function clearAllSelections() {
  clearSelection('all', { deferSync: true });
  interactionStore.setSelectedUserAnnotationId(null);
  syncSelectionIndicators();
}

function handleCanvasBackgroundClick(event) {
  const consumedLabelDragClick = labelDrag.consumeFinishedDragClick();
  if (consumedLabelDragClick) return;
  if (crossSectionVisible.value) {
    crossSectionDepthInteraction.lockDepthFromEvent(event);
  }

  if (hasInteractiveSchematicTarget(event?.target)) return;
  const topmostEntity = resolveTopmostInteractionEntity(event, event?.target);
  if (topmostEntity) {
    const lockedEntity = normalizeInteractionEntity(interactionStore.interaction.lockedEntity);
    if (isSameInteractionEntity(lockedEntity, topmostEntity)) return;
    dispatchSchematicInteraction('select', { entity: topmostEntity }, event);
    return;
  }
  clearAllSelections();
}

onMounted(() => {
  updateContainerSize();
  emit('svg-ready', svgRef.value);
  window.removeEventListener('pointermove', handleWindowPointerMove);
  window.removeEventListener('pointerup', handleWindowPointerUp);
  window.addEventListener('pointermove', handleWindowPointerMove);
  window.addEventListener('pointerup', handleWindowPointerUp);
  if (typeof ResizeObserver !== 'function') return;
  resizeObserver = new ResizeObserver(() => {
    updateContainerSize();
  });
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }

});

onBeforeUnmount(() => {
  resetCameraPanState();
  setLastAutoFitSignature(trajectorySignature.value);
  directionalRenderRequestVersion += 1;
  cancelRenderModelWorkerJobs();
  window.removeEventListener('pointermove', handleWindowPointerMove);
  window.removeEventListener('pointerup', handleWindowPointerUp);
  labelDrag.clearDrag();
  hideTooltip();
  emit('svg-ready', null);
  resizeObserver?.disconnect();
  resizeObserver = null;
});

defineExpose({
  executeSmartAutoFit: () => executeSmartAutoFit({ force: true })
});
</script>

<template>
  <div
    ref="containerRef"
    class="schematic-canvas"
    aria-label="Directional schematic canvas"
    @mousemove="handleCanvasMouseMove"
    @scroll.passive="handleCanvasScroll"
    @wheel="handleCanvasWheel"
    @pointerdown="handleCanvasPointerDown"
    @pointermove="updateCameraPanFromPointer"
    @pointerup="handleCanvasPointerUp"
    @pointercancel="handleCanvasPointerUp"
    @mouseleave="handleCanvasMouseLeave"
  >
    <div v-if="isRenderModelLoading" class="schematic-canvas__loading-overlay">Updating...</div>
    <svg
      ref="svgRef"
      class="schematic-canvas__svg"
      :width="displayWidthValue"
      :height="displayHeightValue"
      :viewBox="`0 0 ${svgWidthValue} ${figHeightValue}`"
      :data-export-width="svgWidthValue"
      :data-export-height="figHeightValue"
      preserveAspectRatio="xMidYMid meet"
      @click="handleCanvasBackgroundClick"
    >
      <defs v-if="isMagnifierEnabled">
        <clipPath :id="magnifierClipPathId">
          <rect
            ref="magnifierClipRectRef"
            x="0"
            y="0"
            :width="magnifierWindowWidth"
            :height="magnifierWindowHeight"
            rx="8"
            ry="8"
          />
        </clipPath>
      </defs>

      <g ref="sceneRootRef" :id="magnifierSceneId" :transform="sceneRootTransform">
        <DirectionalAxisLayer
        :x-scale="xScale"
        :y-scale="yScale"
        :min-x-data="minXData"
        :max-x-data="maxXData"
        :min-y-data="minYData"
        :max-y-data="maxYData"
        :svg-height="figHeightValue"
        :datum-depth="datumDepth"
        :units-label="unitsLabel"
        :title-text="plotTitle"
        :x-exaggeration="xExaggerationValue"
        :x-origin="xOriginValue"
        :left-visual-inset-px="visualInsetPaddingValue.left"
        :right-visual-inset-px="visualInsetPaddingValue.right"
      />
      <DirectionalBandLayer
        :intervals="directionalIntervals"
        :trajectory-points="trajectoryPoints"
        :casing-data="casingRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :visual-sizing="visualSizingValue"
        :diameter-scale="diameterScaleValue"
        :color-palette="props.config?.colorPalette || 'Tableau 10'"
        :show-cement="props.config?.showCement !== false"
        :cement-color="props.config?.cementColor || 'lightgray'"
        :cement-hatch-enabled="props.config?.cementHatchEnabled === true"
        :cement-hatch-style="props.config?.cementHatchStyle || 'none'"
        :x-exaggeration="xExaggerationValue"
        :x-origin="xOriginValue"
        @select-pipe="handleSelectPipe"
        @hover-pipe="handleHoverPipe"
        @leave-pipe="handleLeavePipe"
        @select-equipment="handleSelectEquipment"
        @hover-equipment="handleHoverEquipment"
        @leave-equipment="handleLeaveEquipment"
        @select-fluid="handleSelectFluid"
        @hover-fluid="handleHoverFluid"
        @leave-fluid="handleLeaveFluid"
        @select-plug="handleSelectPlug"
        @hover-plug="handleHoverPlug"
        @leave-plug="handleLeavePlug"
      />

      <DirectionalTopologyOverlayLayer
        v-if="props.topologyResult"
        :intervals="directionalIntervals"
        :topology-result="props.topologyResult"
        :projector="directionalProjector"
        :visual-sizing="visualSizingValue"
        :diameter-scale="diameterScaleValue"
        :show-active-flow="props.topologyOverlayOptions?.showActiveFlow !== false"
        :show-min-cost-path="props.topologyOverlayOptions?.showMinCostPath !== false"
        :show-spof="props.topologyOverlayOptions?.showSpof !== false"
        :selected-node-ids="props.topologyOverlaySelection?.selectedNodeIds || []"
      />

      <DirectionalEquipmentLayer
        :equipment="equipment"
        :projector="directionalProjector"
        :total-md="totalMDValue"
        :visual-sizing="visualSizingValue"
        :diameter-scale="diameterScaleValue"
        @select-equipment="handleSelectEquipment"
        @hover-equipment="handleHoverEquipment"
        @leave-equipment="handleLeaveEquipment"
      />

      <DirectionalDecorationLayer
        :trajectory-points="trajectoryPoints"
        :physics-context="physicsContext"
        :state-snapshot="directionalStateSnapshot"
        :markers="markerRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :total-md="totalMDValue"
        :visual-sizing="visualSizingValue"
        :diameter-scale="diameterScaleValue"
        :max-projected-radius="maxProjectedRadiusValue"
        :x-exaggeration="xExaggerationValue"
        :x-origin="xOriginValue"
        :crossover-pixel-half-height="props.config?.crossoverPixelHalfHeight"
        @select-marker="handleSelectMarker"
        @hover-marker="handleHoverMarker"
        @leave-marker="handleLeaveMarker"
      />

      <DirectionalOverlayLayer
        :trajectory-points="trajectoryPoints"
        :physics-context="physicsContext"
        :casing-data="casingRows"
        :horizontal-lines="horizontalLineRows"
        :annulus-fluids="fluidRows"
        :cement-plugs="plugRows"
        :annotation-boxes="annotationBoxRows"
        :config="props.config || {}"
        :x-scale="xScale"
        :y-scale="yScale"
        :min-x-data="minXData"
        :max-x-data="maxXData"
        :min-y-data="minYData"
        :max-y-data="maxYData"
        :total-md="totalMDValue"
        :visual-sizing="visualSizingValue"
        :diameter-scale="diameterScaleValue"
        :max-projected-radius="maxProjectedRadiusValue"
        :x-exaggeration="xExaggerationValue"
        :x-origin="xOriginValue"
        :drag-preview-id="labelDrag.activePreviewId.value"
        :drag-preview-offset="labelDrag.previewOffset.value"
        @select-line="handleSelectLine"
        @hover-line="handleHoverLine"
        @leave-line="handleLeaveLine"
        @select-pipe="handleSelectPipe"
        @hover-pipe="handleHoverPipe"
        @leave-pipe="handleLeavePipe"
        @select-fluid="handleSelectFluid"
        @hover-fluid="handleHoverFluid"
        @leave-fluid="handleLeaveFluid"
        @select-equipment="handleSelectEquipment"
        @hover-equipment="handleHoverEquipment"
        @leave-equipment="handleLeaveEquipment"
        @select-box="handleSelectBox"
        @hover-box="handleHoverBox"
        @leave-box="handleLeaveBox"
        @start-label-drag="handleStartLabelDrag"
      />

      <DirectionalPhysicsDebugLayer
        v-if="props.config?.showPhysicsDebug === true"
        :intervals="directionalIntervals"
        :trajectory-points="trajectoryPoints"
        :x-scale="xScale"
        :y-scale="yScale"
        :total-md="totalMDValue"
        :x-exaggeration="xExaggerationValue"
        :x-origin="xOriginValue"
      />

      <g
        ref="hoverCursorGroupRef"
        class="depth-cursor-layer depth-cursor-layer--hover"
        style="display: none;"
      >
        <line
          ref="hoverCursorLineRef"
          class="depth-cursor-layer__line"
        />
        <rect
          ref="hoverCursorLabelRectRef"
          class="depth-cursor-layer__label-box"
          rx="6"
          ry="6"
          style="display: none;"
        />
        <text
          ref="hoverCursorLabelTextRef"
          class="depth-cursor-layer__label-text"
          text-anchor="middle"
          dominant-baseline="middle"
          style="display: none;"
        />
      </g>

      <g
        ref="anchorCursorGroupRef"
        class="depth-cursor-layer depth-cursor-layer--anchor"
        style="display: none;"
      >
        <line
          ref="anchorCursorLineRef"
          class="depth-cursor-layer__line"
        />
        <rect
          ref="anchorCursorLabelRectRef"
          class="depth-cursor-layer__label-box"
          rx="6"
          ry="6"
          style="display: none;"
        />
        <text
          ref="anchorCursorLabelTextRef"
          class="depth-cursor-layer__label-text"
          text-anchor="middle"
          dominant-baseline="middle"
          style="display: none;"
        />
      </g>
      </g>


      <g
        v-if="isMagnifierEnabled"
        ref="magnifierOverlayGroupRef"
        class="schematic-canvas__magnifier"
        :clip-path="`url(#${magnifierClipPathId})`"
        style="display: none;"
      >
        <rect
          ref="magnifierGlassRectRef"
          class="schematic-canvas__magnifier-glass"
          x="0"
          y="0"
          :width="magnifierWindowWidth"
          :height="magnifierWindowHeight"
          rx="8"
          ry="8"
        />
        <g ref="magnifierTransformGroupRef">
          <use :href="`#${magnifierSceneId}`" />
        </g>
      </g>

      <g
        v-if="isMagnifierEnabled"
        ref="magnifierFrameGroupRef"
        class="schematic-canvas__magnifier-frame"
        style="display: none;"
      >
        <rect
          ref="magnifierFrameRectRef"
          x="0"
          y="0"
          :width="magnifierWindowWidth"
          :height="magnifierWindowHeight"
          rx="8"
          ry="8"
        />
      </g>
    </svg>

    <SchematicPlotTooltip
      :visible="tooltipVisible"
      :model="tooltipModel"
      :x="tooltipX"
      :y="tooltipY"
      :container-width="displayWidthValue"
      :container-height="displayHeightValue"
    />
  </div>
</template>

<style scoped>
.schematic-canvas {
  position: relative;
  overflow: auto;
  min-height: 520px;
  width: 100%;
  height: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background:
    radial-gradient(circle at 12% -20%, var(--color-plot-radial-a), transparent 45%),
    radial-gradient(circle at 84% 118%, var(--color-plot-radial-b), transparent 40%),
    linear-gradient(180deg, var(--color-plot-surface-start) 0%, var(--color-plot-surface-end) 100%);
}

.schematic-canvas__svg {
  display: block;
}

.schematic-canvas__svg :deep(text),
.schematic-canvas__svg :deep(tspan) {
  user-select: none;
  -webkit-user-select: none;
}

.depth-cursor-layer {
  pointer-events: none;
}

.depth-cursor-layer__line {
  stroke: var(--color-cursor-primary);
  stroke-width: 1.3;
  stroke-dasharray: 5 4;
  opacity: 0.95;
}

.depth-cursor-layer__label-box {
  fill: var(--color-cursor-primary-fill);
  stroke: var(--color-cursor-primary-stroke);
  stroke-width: 1;
}

.depth-cursor-layer__label-text {
  fill: var(--color-cursor-label-text);
  font-size: 11px;
  font-weight: 600;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
  letter-spacing: 0.01em;
}

.depth-cursor-layer--anchor .depth-cursor-layer__line {
  stroke: var(--color-cursor-anchor);
  stroke-width: 1.8;
  stroke-dasharray: none;
  opacity: 0.95;
}

.depth-cursor-layer--anchor .depth-cursor-layer__label-box {
  fill: var(--color-cursor-anchor-fill);
  stroke: var(--color-cursor-anchor-stroke);
}

.schematic-canvas__magnifier {
  pointer-events: none;
}

.schematic-canvas__magnifier-glass {
  fill: var(--color-magnifier-glass);
}

.schematic-canvas__magnifier-frame {
  pointer-events: none;
}

.schematic-canvas__magnifier-frame rect {
  fill: none;
  stroke: var(--color-magnifier-frame-stroke);
  stroke-width: 1.5;
}

.schematic-canvas__loading-overlay {
  position: sticky;
  top: 8px;
  right: 8px;
  margin-left: auto;
  width: fit-content;
  z-index: 3;
  background: color-mix(in srgb, var(--color-surface-elevated) 88%, transparent);
  border: 1px solid var(--line);
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
}
</style>
