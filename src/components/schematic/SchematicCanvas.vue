<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';
import { clamp, formatDepthValue, parseOptionalNumber } from '@/utils/general.js';
import { useSchematicScales } from '@/composables/useSchematicScales.js';
import { useSchematicStackSlices } from '@/composables/useSchematicStackSlices.js';
import { usePlotEntityHandlers } from '@/composables/usePlotEntityHandlers.js';
import { useDepthCursorOverlay } from '@/composables/useDepthCursorOverlay.js';
import { useDepthCursorLayerDom } from '@/composables/useDepthCursorLayerDom.js';
import { useCrossSectionDepthInteraction } from '@/composables/useCrossSectionDepthInteraction.js';
import { useMagnifierOverlayDom } from '@/composables/useMagnifierOverlayDom.js';
import {
  createContext as createPhysicsContext,
  getStackAtDepth as getPhysicsStackAtDepth
} from '@/composables/usePhysics.js';
import {
  hasInteractiveSchematicTarget,
  isSameInteractionEntity,
  normalizeInteractionEntity,
  resolveTopmostInteractionEntity,
  resolveSvgPointerPosition
} from '@/composables/useSchematicInteraction.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import {
  DEFAULT_MAGNIFIER_ZOOM_LEVEL,
  MAGNIFIER_WINDOW_DEFAULTS,
  normalizeMagnifierZoomLevel
} from '@/constants/index.js';
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
import {
  USER_ANNOTATION_TOOL_MODE_SELECT,
  normalizeUserAnnotationId,
  removeUserAnnotationById
} from '@/utils/userAnnotations.js';
import AxisLayer from './layers/AxisLayer.vue';
import AnnotationLayer from './layers/AnnotationLayer.vue';
import BaseFillLayer from './layers/BaseFillLayer.vue';
import CementLayer from './layers/CementLayer.vue';
import FluidLayer from './layers/FluidLayer.vue';
import FluidLabelLayer from './layers/FluidLabelLayer.vue';
import PlugLayer from './layers/PlugLayer.vue';
import CasingLayer from './layers/CasingLayer.vue';
import CasingLabelLayer from './layers/CasingLabelLayer.vue';
import MarkerLayer from './layers/MarkerLayer.vue';
import HorizontalLineLayer from './layers/HorizontalLineLayer.vue';
import CrossoverLayer from './layers/CrossoverLayer.vue';
import EquipmentLayer from './layers/EquipmentLayer.vue';
import PhysicsDebugLayer from './layers/PhysicsDebugLayer.vue';
import TopologyOverlayLayer from './layers/TopologyOverlayLayer.vue';
import PatternDefs from './layers/PatternDefs.vue';
import UserAnnotationLayer from './layers/UserAnnotationLayer.vue';
import { collectVerticalHatchPatterns } from './layers/verticalHatchPatterns.js';
import SchematicPlotTooltip from './SchematicPlotTooltip.vue';

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
  allowReadonlySelection: {
    type: Boolean,
    default: false
  },
  allowTooltips: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['svg-ready']);
const magnifierIdToken = Math.random().toString(36).slice(2, 9);
const isReadonly = computed(() => props.readonly === true);
const isSelectionEnabled = computed(() => !isReadonly.value || props.allowReadonlySelection === true);
const shouldShowTooltips = computed(() => !isReadonly.value || props.allowTooltips !== false);
const isMagnifierEnabled = computed(() => props.config?.showMagnifier === true);
const projectDataStore = useProjectDataStore();
const interactionStore = useInteractionStore();
const viewConfigStore = useViewConfigStore();

const containerRef = ref(null);
const svgRef = ref(null);
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
let resizeObserver = null;
let hasGlobalInteractionListeners = false;

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
const operationPhase = computed(() => (
  String(props.config?.operationPhase ?? '').trim().toLowerCase() === 'drilling'
    ? 'drilling'
    : 'production'
));
const activeTransientPipeRows = computed(() => (
  operationPhase.value === 'drilling' ? drillStringRows.value : tubingRows.value
));
const renderPipeRows = computed(() => ([
  ...casingRows.value.map((row, index) => ({
    ...row,
    sourceIndex: index,
    pipeType: String(row?.pipeType ?? '').trim() || 'casing',
    componentType: String(row?.componentType ?? '').trim() || 'pipe'
  })),
  ...activeTransientPipeRows.value.map((row, index) => ({
    ...row,
    sourceIndex: index,
    pipeType: String(row?.pipeType ?? '').trim() || (operationPhase.value === 'drilling' ? 'drillString' : 'tubing'),
    componentType: String(row?.componentType ?? '').trim() || 'pipe'
  }))
]));
const horizontalLineRows = computed(() => (
  Array.isArray(props.projectData?.horizontalLines) ? props.projectData.horizontalLines : []
));
const annotationBoxRows = computed(() => (
  Array.isArray(props.projectData?.annotationBoxes) ? props.projectData.annotationBoxes : []
));
const userAnnotationRows = computed(() => (
  Array.isArray(props.projectData?.userAnnotations) ? props.projectData.userAnnotations : []
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
const physicsIntervals = computed(() => (
  Array.isArray(props.projectData?.physicsIntervals) ? props.projectData.physicsIntervals : []
));
const trajectoryRows = computed(() => (
  Array.isArray(props.projectData?.trajectory) ? props.projectData.trajectory : []
));
const selectedUserAnnotationId = computed(() => {
  return normalizeUserAnnotationId(interactionStore.interaction.selectedUserAnnotationId);
});

const schematicStateSnapshot = computed(() => ({
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

const { slices } = useSchematicStackSlices(schematicStateSnapshot);
const hatchPatterns = computed(() => (
  collectVerticalHatchPatterns(slices.value, plugRows.value, fluidRows.value, props.config ?? {})
));

const physicsContext = computed(() => createPhysicsContext(schematicStateSnapshot.value));

const linerHangerBarriers = computed(() => (
  Array.isArray(physicsContext.value?.barriers)
    ? physicsContext.value.barriers.filter((barrier) => barrier?.type === 'liner_packer')
    : []
));

const crossoverConnections = computed(() => (
  Array.isArray(physicsContext.value?.connections)
    ? physicsContext.value.connections
    : []
));

const equipment = computed(() => (
  Array.isArray(physicsContext.value?.equipment)
    ? physicsContext.value.equipment
    : []
));

function getValidTopBottomDepth(row, topKey = 'top', bottomKey = 'bottom') {
  const top = parseOptionalNumber(row?.[topKey]);
  const bottom = parseOptionalNumber(row?.[bottomKey]);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
  return { top, bottom };
}

const minDepthValue = computed(() => {
  const casingTops = casingRows.value
    .map((row) => {
      const depth = getValidTopBottomDepth(row, 'top', 'bottom');
      return depth?.top ?? null;
    })
    .filter((value) => Number.isFinite(value));
  if (casingTops.length > 0) return Math.min(...casingTops);

  const tops = slices.value
    .map((slice) => Number(slice?.top))
    .filter((value) => Number.isFinite(value));
  if (tops.length > 0) return Math.min(...tops);

  return 0;
});

const maxDepthValue = computed(() => {
  const bottoms = slices.value
    .map((slice) => parseOptionalNumber(slice?.bottom))
    .filter((value) => Number.isFinite(value));
  const maxBottom = bottoms.length > 0
    ? Math.max(...bottoms)
    : Math.max(
      1,
      ...casingRows.value
        .map((row) => {
          const depth = getValidTopBottomDepth(row, 'top', 'bottom');
          return depth?.bottom ?? null;
        })
        .filter((value) => Number.isFinite(value))
    );
  return maxBottom > minDepthValue.value ? maxBottom : minDepthValue.value + 1;
});

const maxCasingOuterRadius = computed(() => {
  const ods = renderPipeRows.value
    .map((row) => Number(row?.od))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (ods.length === 0) return 1;
  return Math.max(...ods) / 2;
});

const maxStackOuterRadius = computed(() => {
  const radii = [];
  slices.value.forEach((slice) => {
    (Array.isArray(slice?.stack) ? slice.stack : []).forEach((layer) => {
      const outer = Number(layer?.outerRadius);
      if (Number.isFinite(outer) && outer > 0) {
        radii.push(outer);
      }
    });
  });
  return radii.length > 0 ? Math.max(...radii) : 1;
});

const widthMultiplier = computed(() => {
  const parsed = Number(props.config?.widthMultiplier);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3.5;
});

const diameterScaleValue = computed(() => {
  const maxOD = Math.max(1, maxCasingOuterRadius.value * 2, maxStackOuterRadius.value * 2);
  return Math.max(0.5, Math.min(50, (maxDepthValue.value / 30) / maxOD));
});

const xHalfValue = computed(() => {
  const maxOD = Math.max(1, maxCasingOuterRadius.value * 2, maxStackOuterRadius.value * 2);
  const halfWidth = (maxOD * diameterScaleValue.value) / 2;
  return Math.max(30, halfWidth * widthMultiplier.value);
});

const plotTitle = computed(() => String(props.config?.plotTitle ?? '').trim());
const unitsLabel = computed(() => String(props.config?.units || 'ft'));
const datumDepth = computed(() => {
  const parsed = parseOptionalNumber(props.config?.datumDepth);
  if (Number.isFinite(parsed)) {
    if (Math.abs(parsed) <= 1e-6 && minDepthValue.value > 1e-6) {
      return minDepthValue.value;
    }
    return parsed;
  }
  return minDepthValue.value;
});

const plotTopDepthValue = computed(() => Math.min(minDepthValue.value, datumDepth.value));
const plotBottomDepthValue = computed(() => {
  const padded = maxDepthValue.value * 1.03;
  return padded > plotTopDepthValue.value ? padded : plotTopDepthValue.value + 1;
});

const figHeightValue = computed(() => {
  const parsed = Number(props.config?.figHeight);
  const fallback = 800;
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(520, Math.round(value));
});
const figHeightCss = computed(() => `${figHeightValue.value}px`);
const canvasWidthMultiplierValue = computed(() => {
  const parsed = Number(props.config?.canvasWidthMultiplier);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
});
const legacyBaseWidth = 1000;
const svgWidthValue = computed(() => Math.round(legacyBaseWidth * canvasWidthMultiplierValue.value));

const {
  width,
  height,
  xHalf,
  minDepth,
  maxDepth,
  xScale,
  yScale
} = useSchematicScales({
  minDepth: plotTopDepthValue,
  maxDepth: plotBottomDepthValue,
  xHalf: xHalfValue,
  margin: {
    top: 60,
    right: 150,
    bottom: 80,
    left: 120
  }
}, svgWidthValue, figHeightValue);

const isDepthCursorEnabled = computed(() => props.config?.showDepthCursor === true);
const plotLeftX = computed(() => xScale.value(-xHalf.value));
const plotRightX = computed(() => xScale.value(xHalf.value));
const plotTopY = computed(() => yScale.value(minDepth.value));
const plotBottomY = computed(() => yScale.value(maxDepth.value));

const depthCursor = useDepthCursorOverlay({
  enabled: isDepthCursorEnabled,
  containerRef,
  svgWidth: width,
  svgHeight: height,
  plotLeftX,
  plotRightX,
  plotTopY,
  plotBottomY,
  restrictXToPlot: false,
  resolveDepthAtY: (cursorY) => yScale.value.invert(cursorY)
});
const depthCursorVisible = depthCursor.visible;
const depthCursorX = depthCursor.x;
const depthCursorY = depthCursor.y;
const crossSectionVisible = computed(() => props.config?.showDepthCrossSection === true);

const depthCursorLabel = computed(() => {
  const depth = Number(depthCursor.depth.value);
  if (!Number.isFinite(depth)) return '';
  return `MD ${formatDepthValue(depth, 1)} ${unitsLabel.value}`;
});

const anchoredDepth = computed(() => {
  if (props.config?.showDepthCrossSection !== true) return null;
  const depth = Number(props.config?.cursorDepth);
  if (!Number.isFinite(depth)) return null;
  return clamp(depth, minDepth.value, maxDepth.value);
});
const anchorLineVisible = computed(() => Number.isFinite(anchoredDepth.value));
const anchorCursorY = computed(() => (
  Number.isFinite(anchoredDepth.value) ? yScale.value(anchoredDepth.value) : 0
));
const anchorDepthLabel = computed(() => {
  const depth = Number(anchoredDepth.value);
  if (!Number.isFinite(depth)) return '';
  return `MD ${formatDepthValue(depth, 1)} ${unitsLabel.value}`;
});

useDepthCursorLayerDom({
  visible: depthCursorVisible,
  cursorX: depthCursorX,
  cursorY: depthCursorY,
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
  cursorX: plotLeftX,
  cursorY: anchorCursorY,
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
  const pointer = resolveSvgPointerPosition(svgRef.value, { clientX, clientY });
  if (!pointer) return null;
  const nextDepth = Number(yScale.value.invert(pointer.y));
  if (!Number.isFinite(nextDepth)) return null;
  return clamp(nextDepth, minDepth.value, maxDepth.value);
}

const crossSectionDepthInteraction = useCrossSectionDepthInteraction({
  visible: crossSectionVisible,
  currentDepth: computed(() => props.config?.cursorDepth),
  resolveDepthFromClient: resolveCrossSectionDepthFromClient,
  setDepth: (depth) => viewConfigStore.setCursorDepth(depth),
  hoverIntervalMs: 33,
  depthEpsilon: 0.01,
  unlockOnMouseLeave: true
});

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
  svgWidth: width,
  svgHeight: height,
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
const magnifierSceneId = `schematic-scene-${magnifierIdToken}`;
const magnifierClipPathId = `schematic-magnifier-clip-${magnifierIdToken}`;

function updateContainerSize() {
  const container = containerRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const widthNext = Math.max(420, Math.round(rect.width));
  const heightNext = Math.max(520, Math.round(rect.height));
  containerWidth.value = widthNext;
  containerHeight.value = heightNext;
  magnifierOverlay.refresh();
}

function showTooltipIfEnabled(model, event) {
  if (!shouldShowTooltips.value) {
    hideTooltip();
    return;
  }
  showTooltip(model, event);
}

function resolvePointerPosition(event) {
  const container = containerRef.value;
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);

  if (!container || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return {
      x: 8,
      y: 8
    };
  }

  const rect = container.getBoundingClientRect();
  return {
    x: clamp(clientX - rect.left, 0, containerWidth.value),
    y: clamp(clientY - rect.top, 0, containerHeight.value)
  };
}

function showTooltip(model, event) {
  if (!model) {
    hideTooltip();
    return;
  }

  const next = resolvePointerPosition(event);
  tooltipModel.value = model;
  tooltipX.value = next.x;
  tooltipY.value = next.y;
  tooltipVisible.value = true;
}

function hideTooltip() {
  tooltipVisible.value = false;
  tooltipModel.value = null;
}

const interactionGuard = () => isSelectionEnabled.value;

function normalizePipeType(pipeType) {
  const normalized = String(pipeType ?? '').trim().toLowerCase();
  if (normalized === 'casing') return 'casing';
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return null;
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
  if (!isSelectionEnabled.value) return;
  const normalized = normalizePipeEntity(entity);
  if (!normalized) return;
  dispatchSchematicInteraction('select', { type: 'pipe', id: normalized });
}

function handleHoverPipe(entity, event) {
  const normalized = normalizePipeEntity(entity);
  if (!normalized) {
    hideTooltip();
    return;
  }
  if (isSelectionEnabled.value) {
    dispatchSchematicInteraction('hover', { type: 'pipe', id: normalized, preferPayload: true }, event);
  }
  const row = resolvePipeRow(normalized);
  const model = buildPipeTooltipModel(row, unitsLabel.value, normalized.pipeType);
  showTooltipIfEnabled(model, event);
}

function handleLeavePipe() {
  if (isSelectionEnabled.value) {
    dispatchSchematicInteraction('leave', { type: 'pipe' });
  } else {
    hideTooltip();
  }
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
  const pointer = resolveSvgPointerPosition(svgRef.value, event);
  if (!pointer) return null;

  const depth = clamp(Number(yScale.value.invert(pointer.y)), minDepth.value, maxDepth.value);
  if (!Number.isFinite(depth)) return null;

  const fluidLayer = resolveFluidLayerAtDepth(depth, index);
  const manualODOverride = fluidLayer?.manualODOverride;
  if (!manualODOverride) return null;

  return {
    manualODApplied: manualODOverride.appliedOD,
    manualODWasClamped: manualODOverride.wasClamped === true
  };
}

const lineHandlers = usePlotEntityHandlers({
  type: 'line',
  rows: horizontalLineRows,
  unitsLabel,
  buildTooltipModel: buildLineTooltipModel,
  showTooltip: showTooltipIfEnabled,
  hideTooltip,
  canInteract: interactionGuard
});
const boxHandlers = usePlotEntityHandlers({
  type: 'box',
  rows: annotationBoxRows,
  unitsLabel,
  buildTooltipModel: buildBoxTooltipModel,
  showTooltip: showTooltipIfEnabled,
  hideTooltip,
  canInteract: interactionGuard
});
const markerHandlers = usePlotEntityHandlers({
  type: 'marker',
  rows: markerRows,
  unitsLabel,
  buildTooltipModel: buildMarkerTooltipModel,
  showTooltip: showTooltipIfEnabled,
  hideTooltip,
  canInteract: interactionGuard
});
const equipmentHandlers = usePlotEntityHandlers({
  type: 'equipment',
  rows: equipmentRows,
  unitsLabel,
  buildTooltipModel: buildEquipmentTooltipModel,
  showTooltip,
  hideTooltip
});
const plugHandlers = usePlotEntityHandlers({
  type: 'plug',
  rows: plugRows,
  unitsLabel,
  buildTooltipModel: buildPlugTooltipModel,
  showTooltip: showTooltipIfEnabled,
  hideTooltip,
  canInteract: interactionGuard
});
const fluidHandlers = usePlotEntityHandlers({
  type: 'fluid',
  rows: fluidRows,
  unitsLabel,
  buildTooltipModel: buildFluidTooltipModel,
  resolveTooltipMeta: resolveFluidTooltipMeta,
  showTooltip: showTooltipIfEnabled,
  hideTooltip,
  canInteract: interactionGuard
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
const handleSelectEquipment = equipmentHandlers.handleSelect;
const handleHoverEquipment = equipmentHandlers.handleHover;
const handleLeaveEquipment = equipmentHandlers.handleLeave;
const handleSelectPlug = plugHandlers.handleSelect;
const handleHoverPlug = plugHandlers.handleHover;
const handleLeavePlug = plugHandlers.handleLeave;
const handleSelectFluid = fluidHandlers.handleSelect;
const handleHoverFluid = fluidHandlers.handleHover;
const handleLeaveFluid = fluidHandlers.handleLeave;

function focusCanvasContainer() {
  const container = containerRef.value;
  if (!container || typeof container.focus !== 'function') return;
  container.focus({ preventScroll: true });
}

function isTextInputLikeElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return element.isContentEditable === true;
}

function isCanvasKeyboardScopeActive() {
  const container = containerRef.value;
  if (!container || typeof document === 'undefined') return false;
  const activeElement = document.activeElement;
  if (!(activeElement instanceof Element)) return false;
  return container.contains(activeElement);
}

function updateUserAnnotations(mutator) {
  if (typeof mutator !== 'function') return;
  const rows = Array.isArray(userAnnotationRows.value) ? userAnnotationRows.value : [];
  const nextRows = mutator(rows);
  if (!Array.isArray(nextRows)) return;
  projectDataStore.setUserAnnotations(nextRows);
}

function deleteUserAnnotationById(id) {
  const rows = Array.isArray(userAnnotationRows.value) ? userAnnotationRows.value : [];
  const result = removeUserAnnotationById(rows, id);
  if (!result.removed) return false;
  projectDataStore.setUserAnnotations(result.nextRows);
  interactionStore.setSelectedUserAnnotationId(null);
  return true;
}

function handleCreateUserAnnotation(annotation) {
  if (isReadonly.value || !annotation) return;
  updateUserAnnotations((rows) => [...rows, annotation]);
  const nextId = normalizeUserAnnotationId(annotation?.id);
  interactionStore.setSelectedUserAnnotationId(nextId);
  viewConfigStore.setAnnotationToolMode(USER_ANNOTATION_TOOL_MODE_SELECT);
}

function handleUpdateUserAnnotation(payload = {}) {
  if (isReadonly.value) return;
  const id = String(payload?.id ?? '').trim();
  const index = Number.isInteger(payload?.index) ? payload.index : null;
  const patch = payload?.patch;
  if ((!id && index === null) || !patch || typeof patch !== 'object') return;

  updateUserAnnotations((rows) => rows.map((row, rowIndex) => {
    const idMatches = id && String(row?.id ?? '').trim() === id;
    const indexMatches = index !== null && rowIndex === index;
    if (!idMatches && !indexMatches) return row;
    const next = { ...row, ...patch };
    if (patch.style && typeof patch.style === 'object') {
      next.style = { ...(row?.style ?? {}), ...patch.style };
    }
    if (patch.anchor && typeof patch.anchor === 'object') {
      next.anchor = { ...(row?.anchor ?? {}), ...patch.anchor };
    }
    if (patch.labelPos && typeof patch.labelPos === 'object') {
      next.labelPos = { ...(row?.labelPos ?? {}), ...patch.labelPos };
    }
    return next;
  }));
}

function handleSelectUserAnnotation(payload = {}) {
  interactionStore.setSelectedUserAnnotationId(normalizeUserAnnotationId(payload?.id));
}

function handleDeleteUserAnnotation(payload = {}) {
  if (isReadonly.value) return;
  deleteUserAnnotationById(payload?.id);
}

function handleCanvasPointerDown(event) {
  const target = event?.target;
  if (isTextInputLikeElement(target)) return;
  if (target instanceof Element && target.closest('.user-annotation-layer__editor')) return;
  focusCanvasContainer();
}

function handleGlobalKeyDown(event) {
  if (isReadonly.value) return;
  if (!isCanvasKeyboardScopeActive()) return;

  const key = String(event?.key ?? '');
  const isDeleteKey = key === 'Delete' || key === 'Backspace';
  if (!isDeleteKey) return;
  if (isTextInputLikeElement(document.activeElement)) return;

  const deleted = deleteUserAnnotationById(selectedUserAnnotationId.value);
  if (!deleted) return;
  event.preventDefault();
}

function connectGlobalInteractionListeners() {
  if (hasGlobalInteractionListeners || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleGlobalKeyDown);
  hasGlobalInteractionListeners = true;
}

function disconnectGlobalInteractionListeners() {
  if (!hasGlobalInteractionListeners || typeof window === 'undefined') return;
  window.removeEventListener('keydown', handleGlobalKeyDown);
  hasGlobalInteractionListeners = false;
}

function handleCanvasMouseLeave() {
  handleLeavePipe();
  handleLeaveLine();
  handleLeaveBox();
  handleLeaveMarker();
  handleLeaveEquipment();
  handleLeavePlug();
  handleLeaveFluid();
  crossSectionDepthInteraction.handleMouseLeave();
  depthCursor.hide();
  magnifierOverlay.handleMouseLeave();
}

function handleCanvasMouseMove(event) {
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

function clearAllSelections() {
  clearSelection('all', { deferSync: true });
  interactionStore.setSelectedUserAnnotationId(null);
  syncSelectionIndicators();
}

function handleCanvasBackgroundClick(event) {
  if (crossSectionVisible.value) {
    crossSectionDepthInteraction.lockDepthFromEvent(event);
  }
  if (!isSelectionEnabled.value) return;

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

function connectCanvasLifecycle() {
  updateContainerSize();
  emit('svg-ready', svgRef.value);
  connectGlobalInteractionListeners();
  if (typeof ResizeObserver !== 'function') return;
  if (resizeObserver) return;
  if (!containerRef.value) return;

  resizeObserver = new ResizeObserver(() => {
    updateContainerSize();
  });

  resizeObserver.observe(containerRef.value);
}

function disconnectCanvasLifecycle() {
  hideTooltip();
  disconnectGlobalInteractionListeners();
  emit('svg-ready', null);
  resizeObserver?.disconnect();
  resizeObserver = null;
}

onMounted(() => {
  connectCanvasLifecycle();
});

onActivated(() => {
  connectCanvasLifecycle();
});

onDeactivated(() => {
  disconnectCanvasLifecycle();
});

onBeforeUnmount(() => {
  disconnectCanvasLifecycle();
});
</script>

<template>
  <div
    ref="containerRef"
    class="schematic-canvas"
    tabindex="0"
    @mousemove="handleCanvasMouseMove"
    @scroll.passive="handleCanvasScroll"
    @pointerdown="handleCanvasPointerDown"
    @mouseleave="handleCanvasMouseLeave"
  >
    <svg
      ref="svgRef"
      class="schematic-canvas__svg"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      @click="handleCanvasBackgroundClick"
    >
      <PatternDefs :patterns="hatchPatterns" />
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

      <g :id="magnifierSceneId">
        <AxisLayer
        :x-scale="xScale"
        :y-scale="yScale"
        :min-depth="minDepth"
        :max-depth="maxDepth"
        :x-half="xHalf"
        :width="width"
        :svg-height="height"
        :max-casing-outer-radius="maxCasingOuterRadius"
        :diameter-scale="diameterScaleValue"
        :datum-depth="datumDepth"
        :units-label="unitsLabel"
        :title-text="plotTitle"
      />

      <AnnotationLayer
        :boxes="annotationBoxRows"
        :config="config || {}"
        :x-scale="xScale"
        :y-scale="yScale"
        :x-half="xHalf"
        :width="width"
        @select-box="handleSelectBox"
        @hover-box="handleHoverBox"
        @leave-box="handleLeaveBox"
      />

      <BaseFillLayer
        :slices="slices"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
      />

      <CementLayer
        :slices="slices"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        :show-cement="config?.showCement !== false"
        :cement-color="config?.cementColor || 'lightgray'"
        :cement-hatch-enabled="config?.cementHatchEnabled === true"
        :cement-hatch-style="config?.cementHatchStyle || 'none'"
      />

      <FluidLayer
        :slices="slices"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        :fluids="fluidRows"
        @select-fluid="handleSelectFluid"
        @hover-fluid="handleHoverFluid"
        @leave-fluid="handleLeaveFluid"
      />

      <PlugLayer
        :slices="slices"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        :plugs="plugRows"
        @select-plug="handleSelectPlug"
        @hover-plug="handleHoverPlug"
        @leave-plug="handleLeavePlug"
      />

      <TopologyOverlayLayer
        v-if="props.topologyResult"
        :slices="slices"
        :topology-result="props.topologyResult"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        :show-active-flow="props.topologyOverlayOptions?.showActiveFlow !== false"
        :show-min-cost-path="props.topologyOverlayOptions?.showMinCostPath !== false"
        :show-spof="props.topologyOverlayOptions?.showSpof !== false"
        :selected-node-ids="props.topologyOverlaySelection?.selectedNodeIds || []"
      />

      <CasingLayer
        :casing-data="renderPipeRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :min-depth="minDepthValue"
        :units-label="unitsLabel"
        :diameter-scale="diameterScaleValue"
        :color-palette="config?.colorPalette || 'Tableau 10'"
        :barriers="linerHangerBarriers"
        @select-pipe="handleSelectPipe"
        @hover-pipe="handleHoverPipe"
        @leave-pipe="handleLeavePipe"
      />

      <CrossoverLayer
        :connections="crossoverConnections"
        :pipe-data="renderPipeRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        :crossover-pixel-half-height="Number(config?.crossoverPixelHalfHeight ?? 5)"
        :color-palette="config?.colorPalette || 'Tableau 10'"
      />

      <EquipmentLayer
        :equipment="equipment"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        :x-half="xHalf"
        @select-equipment="handleSelectEquipment"
        @hover-equipment="handleHoverEquipment"
        @leave-equipment="handleLeaveEquipment"
      />

      <MarkerLayer
        :markers="markerRows"
        :casing-data="casingRows"
        :tubing-data="tubingRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :diameter-scale="diameterScaleValue"
        @select-marker="handleSelectMarker"
        @hover-marker="handleHoverMarker"
        @leave-marker="handleLeaveMarker"
      />

      <CasingLabelLayer
        :pipe-data="renderPipeRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :x-half="xHalf"
        :width="width"
        :height="height"
        :units-label="unitsLabel"
        :diameter-scale="diameterScaleValue"
        @select-pipe="handleSelectPipe"
        @hover-pipe="handleHoverPipe"
        @leave-pipe="handleLeavePipe"
      />

      <FluidLabelLayer
        :fluids="fluidRows"
        :physics-context="physicsContext"
        :config="config || {}"
        :x-scale="xScale"
        :y-scale="yScale"
        :x-half="xHalf"
        :width="width"
        :height="height"
        :diameter-scale="diameterScaleValue"
        @select-fluid="handleSelectFluid"
        @hover-fluid="handleHoverFluid"
        @leave-fluid="handleLeaveFluid"
      />

      <HorizontalLineLayer
        :lines="horizontalLineRows"
        :x-scale="xScale"
        :y-scale="yScale"
        :x-half="xHalf"
        :width="width"
        :units-label="unitsLabel"
        @select-line="handleSelectLine"
        @hover-line="handleHoverLine"
        @leave-line="handleLeaveLine"
      />

      <PhysicsDebugLayer
        v-if="config?.showPhysicsDebug === true"
        :intervals="physicsIntervals"
        :x-scale="xScale"
        :y-scale="yScale"
        :x-half="xHalf"
        :width="width"
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

      <UserAnnotationLayer
        :annotations="userAnnotationRows"
        :selected-id="selectedUserAnnotationId"
        :x-scale="xScale"
        :y-scale="yScale"
        :min-depth="minDepth"
        :max-depth="maxDepth"
        :x-half="xHalf"
        :width="width"
        :height="height"
        :tool-mode="config?.annotationToolMode || 'select'"
        :readonly="isReadonly"
        :svg-element="svgRef"
        @create-annotation="handleCreateUserAnnotation"
        @update-annotation="handleUpdateUserAnnotation"
        @select-annotation="handleSelectUserAnnotation"
        @delete-annotation="handleDeleteUserAnnotation"
      />
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
      :container-width="width"
      :container-height="height"
    />
  </div>
</template>

<style scoped>
.schematic-canvas {
  position: relative;
  overflow: auto;
  min-height: 520px;
  width: 100%;
  height: v-bind(figHeightCss);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background:
    radial-gradient(circle at 12% -20%, var(--color-plot-radial-a), transparent 45%),
    radial-gradient(circle at 84% 118%, var(--color-plot-radial-b), transparent 40%),
    linear-gradient(180deg, var(--color-plot-surface-start) 0%, var(--color-plot-surface-end) 100%);
}

.schematic-canvas:focus {
  outline: 2px solid var(--color-plot-focus-ring);
  outline-offset: 2px;
}

.schematic-canvas:focus:not(:focus-visible) {
  outline: none;
}

.schematic-canvas__svg {
  display: block;
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
</style>
