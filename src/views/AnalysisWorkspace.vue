<script setup>
defineOptions({ name: 'AnalysisWorkspace' });

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import Select from 'primevue/select';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import { VNetworkGraph, defineConfigs } from 'v-network-graph';
import 'v-network-graph/lib/style.css';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import { useTopologyStore } from '@/stores/topologyStore.js';
import {
  cancelTopologyWorkerJobs,
  isTopologyWorkerCancelledError,
  requestTopologyModelInWorker
} from '@/composables/useTopologyWorker.js';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import SchematicCanvas from '@/components/schematic/SchematicCanvas.vue';
import DirectionalSchematicCanvas from '@/components/schematic/DirectionalSchematicCanvas.vue';
import { resolveWarningMetadata } from '@/topology/warningCatalog.js';
import {
  createTopologyInspectorEdgeRows,
  createTopologyInspectorNodeRows,
  createTopologyPathEdgeSummaryRows,
  resolveTopologyInspectorOverlayNodeIds
} from '@/topology/topologyInspector.js';
import { buildTopologyDebugGraph } from '@/topology/topologyGraphDebug.js';
import {
  resolveTopologyOverlaySynchronizationState
} from '@/topology/resultSynchronization.js';
import {
  formatTopologyOverlayHintDetail,
  resolveTopologyOverlayHintKey
} from '@/topology/overlaySynchronizationPresentation.js';
import {
  buildTopologyWarningNavigationByRowId,
  resolveTopologyWarningRowNavigationTarget
} from '@/topology/warningNavigation.js';
import {
  requestTableRowFocus,
  setActiveTableTabKey,
  setTablesAccordionOpen
} from '@/components/tables/panes/tablePaneState.js';

const projectDataStore = useProjectDataStore();
const viewConfigStore = useViewConfigStore();
const projectStore = useProjectStore();
const workspaceStore = useWorkspaceStore();
const topologyStore = useTopologyStore();
const topologyOverlayOptions = reactive({
  showActiveFlow: true,
  showMinCostPath: false,
  showSpof: false
});
const latestAnalysisGeometryRequestId = ref(null);
const directionalGeometryReadyRequestId = ref(null);
const selectedBarrierElementKey = ref(null);
const envelopeTableControls = reactive({
  filterMode: 'all',
  sortMode: 'edge_desc'
});
const warningTableControls = reactive({
  categoryFilter: 'all',
  codeFilter: 'all'
});
const inspectorTableControls = reactive({
  scope: 'min_path',
  nodeKind: 'all',
  edgeKind: 'all'
});
const topologyGraphControls = reactive({
  visible: true,
  scope: 'min_path'
});
const selectedInspectorNodeId = ref(null);
const selectedInspectorEdgeId = ref(null);
const TOPOLOGY_GRAPH_MIN_WIDTH = 520;
const TOPOLOGY_GRAPH_MIN_HEIGHT = 360;
const TOPOLOGY_GRAPH_DEFAULT_WIDTH = 1180;
const TOPOLOGY_GRAPH_DEFAULT_HEIGHT = 820;
let detachTopologyGraphResizeListener = null;

const {
  dialogSize: topologyGraphDialogSize,
  reconcileDialogSize: reconcileTopologyGraphDialogSize,
  resizeDialogBy: resizeTopologyGraphDialogBy,
  startDialogResize: startTopologyGraphDialogResize,
  stopDialogResize: stopTopologyGraphDialogResize
} = useFloatingDialogResize({
  minWidth: TOPOLOGY_GRAPH_MIN_WIDTH,
  minHeight: TOPOLOGY_GRAPH_MIN_HEIGHT,
  defaultWidth: TOPOLOGY_GRAPH_DEFAULT_WIDTH,
  defaultHeight: TOPOLOGY_GRAPH_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.96,
  maxViewportHeightRatio: 0.88,
  cursorClass: 'resizing-both'
});

const topologyGraphDialogStyle = computed(() => ({
  width: `${topologyGraphDialogSize.value.width}px`,
  height: `${topologyGraphDialogSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '88vh'
}));

const WARNING_CATEGORY_UI = Object.freeze({
  equipment: Object.freeze({
    label: 'Equipment',
    i18nKey: 'ui.analysis.topology.warnings.filter.category.equipment'
  }),
  marker: Object.freeze({
    label: 'Marker',
    i18nKey: 'ui.analysis.topology.warnings.filter.category.marker'
  }),
  source: Object.freeze({
    label: 'Source',
    i18nKey: 'ui.analysis.topology.warnings.filter.category.source'
  }),
  policy: Object.freeze({
    label: 'Policy',
    i18nKey: 'ui.analysis.topology.warnings.filter.category.policy'
  }),
  uncategorized: Object.freeze({
    label: 'Uncategorized',
    i18nKey: 'ui.analysis.topology.warnings.filter.category.uncategorized'
  })
});

const envelopeFilterOptions = [
  { value: 'all', label: 'All', i18nKey: 'ui.analysis.topology.envelope.filter.all' },
  { value: 'primary_only', label: 'Primary only', i18nKey: 'ui.analysis.topology.envelope.filter.primary_only' },
  { value: 'secondary_only', label: 'Secondary only', i18nKey: 'ui.analysis.topology.envelope.filter.secondary_only' },
  { value: 'overlap_only', label: 'Overlap only', i18nKey: 'ui.analysis.topology.envelope.filter.overlap_only' }
];

const envelopeSortOptions = [
  { value: 'edge_desc', label: 'Edges: high to low', i18nKey: 'ui.analysis.topology.envelope.sort.edge_desc' },
  { value: 'edge_asc', label: 'Edges: low to high', i18nKey: 'ui.analysis.topology.envelope.sort.edge_asc' },
  { value: 'row_id_asc', label: 'Row ID: A to Z', i18nKey: 'ui.analysis.topology.envelope.sort.row_id_asc' },
  { value: 'row_id_desc', label: 'Row ID: Z to A', i18nKey: 'ui.analysis.topology.envelope.sort.row_id_desc' },
  { value: 'function_asc', label: 'Function: A to Z', i18nKey: 'ui.analysis.topology.envelope.sort.function_asc' }
];

const inspectorScopeOptions = [
  { value: 'min_path', label: 'Min-cost path', i18nKey: 'ui.analysis.topology.inspector.scope.min_path' },
  { value: 'spof', label: 'SPOF only', i18nKey: 'ui.analysis.topology.inspector.scope.spof' },
  { value: 'active_flow', label: 'Active flow', i18nKey: 'ui.analysis.topology.inspector.scope.active_flow' },
  { value: 'selected_barrier', label: 'Selected barrier', i18nKey: 'ui.analysis.topology.inspector.scope.selected_barrier' },
  { value: 'all', label: 'All topology edges', i18nKey: 'ui.analysis.topology.inspector.scope.all' }
];

const topologyGraphScopeOptions = [
  { value: 'min_path', label: 'Min-cost path', i18nKey: 'ui.analysis.topology.graph.scope.min_path' },
  { value: 'spof', label: 'SPOF only', i18nKey: 'ui.analysis.topology.graph.scope.spof' },
  { value: 'active_flow', label: 'Active flow', i18nKey: 'ui.analysis.topology.inspector.scope.active_flow' },
  { value: 'selected_barrier', label: 'Selected barrier', i18nKey: 'ui.analysis.topology.graph.scope.selected_barrier' }
];
const topologyGraphLayers = Object.freeze({
  'lane-headers': 'base'
});

const TOPOLOGY_GRAPH_EDGE_TOOLTIP_WIDTH = 280;
const TOPOLOGY_GRAPH_EDGE_TOOLTIP_PADDING_X = 10;
const TOPOLOGY_GRAPH_EDGE_TOOLTIP_PADDING_Y = 8;
const TOPOLOGY_GRAPH_EDGE_TOOLTIP_LINE_HEIGHT = 14;
const TOPOLOGY_GRAPH_EDGE_TOOLTIP_WRAP_LIMIT = 52;

const topologyGraphConfigs = defineConfigs({
  view: {
    autoPanAndZoomOnLoad: 'fit-content',
    fitContentMargin: {
      top: 44,
      left: 72,
      right: 72,
      bottom: 36
    },
    minZoomLevel: 0.18,
    maxZoomLevel: 8,
    grid: {
      visible: false
    }
  },
  node: {
    draggable: false,
    selectable: true,
    normal: {
      type: 'rect',
      width: (node) => (node?.kind === 'SURFACE' ? 88 : 64),
      height: 22,
      borderRadius: 4,
      color: (node) => String(node?.tone ?? '#1f2937'),
      strokeColor: '#0f172a',
      strokeWidth: 1
    },
    hover: {
      type: 'rect',
      width: (node) => (node?.kind === 'SURFACE' ? 88 : 64),
      height: 22,
      borderRadius: 4,
      color: '#3b82f6',
      strokeColor: '#1d4ed8',
      strokeWidth: 1.4
    },
    selected: {
      type: 'rect',
      width: (node) => (node?.kind === 'SURFACE' ? 88 : 64),
      height: 22,
      borderRadius: 4,
      color: '#2563eb',
      strokeColor: '#1d4ed8',
      strokeWidth: 2
    },
    label: {
      visible: true,
      text: (node) => String(node?.displayLabel ?? node?.name ?? ''),
      color: '#0f172a',
      fontSize: 10,
      lineHeight: 1.05,
      direction: 'east',
      margin: 10,
      background: {
        visible: true,
        color: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 3,
        padding: {
          vertical: 2,
          horizontal: 4
        }
      }
    }
  },
  edge: {
    selectable: true,
    type: 'straight',
    normal: {
      width: 2.3,
      color: (edge) => String(edge?.tone ?? '#475569'),
      dasharray: (edge) => edge?.dasharray ?? 0,
      animate: false,
      animationSpeed: 50
    },
    selected: {
      width: 3.2,
      color: '#2563eb',
      dasharray: 0,
      animate: false,
      animationSpeed: 50
    },
    label: {
      visible: false,
      text: (edge) => String(edge?.displayLabel ?? ''),
      color: '#334155',
      fontSize: 9,
      lineHeight: 1.02,
      margin: 4,
      padding: 3,
      background: {
        visible: true,
        color: 'rgba(248, 250, 252, 0.86)',
        borderRadius: 3
      }
    }
  }
});

const {
  casingData,
  tubingData,
  drillStringData,
  equipmentData,
  horizontalLines,
  annotationBoxes,
  userAnnotations,
  cementPlugs,
  annulusFluids,
  markers,
  topologySources,
  physicsIntervals,
  trajectory
} = storeToRefs(projectDataStore);
const { activeWellTopology } = storeToRefs(topologyStore);

const declarativeProjectData = computed(() => ({
  casingData: casingData.value,
  tubingData: tubingData.value,
  drillStringData: drillStringData.value,
  equipmentData: equipmentData.value,
  horizontalLines: horizontalLines.value,
  annotationBoxes: annotationBoxes.value,
  userAnnotations: userAnnotations.value,
  cementPlugs: cementPlugs.value,
  annulusFluids: annulusFluids.value,
  markers: markers.value,
  topologySources: topologySources.value,
  physicsIntervals: physicsIntervals.value,
  trajectory: trajectory.value
}));

const topologyStateSnapshot = computed(() => ({
  casingData: casingData.value,
  tubingData: tubingData.value,
  drillStringData: drillStringData.value,
  equipmentData: equipmentData.value,
  horizontalLines: horizontalLines.value,
  annotationBoxes: annotationBoxes.value,
  userAnnotations: userAnnotations.value,
  cementPlugs: cementPlugs.value,
  annulusFluids: annulusFluids.value,
  markers: markers.value,
  topologySources: topologySources.value,
  trajectory: trajectory.value,
  config: viewConfigStore.config,
  interaction: {}
}));

const isAnalysisWorkspaceActive = computed(() => workspaceStore.currentActivity === 'analysis');
const activeWellId = computed(() => String(projectStore.activeWellId ?? '').trim() || null);
const isDirectionalView = computed(() => viewConfigStore.config?.viewMode === 'directional');

function toSafeAnalysisRequestId(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return null;
}

function createTopologyLineageMeta(requestId, options = {}) {
  const safeRequestId = toSafeAnalysisRequestId(requestId);
  const includeDirectionalReady = options?.includeDirectionalReady === true;
  const geometryReadyRequestId = isDirectionalView.value
    ? (includeDirectionalReady ? toSafeAnalysisRequestId(directionalGeometryReadyRequestId.value) : null)
    : safeRequestId;

  return {
    viewMode: isDirectionalView.value ? 'directional' : 'vertical',
    geometryRequestId: safeRequestId,
    geometryReadyRequestId
  };
}

function handleDirectionalGeometryReady(requestId) {
  const safeRequestId = toSafeAnalysisRequestId(requestId);
  if (!safeRequestId) return;
  if (safeRequestId !== toSafeAnalysisRequestId(latestAnalysisGeometryRequestId.value)) return;
  directionalGeometryReadyRequestId.value = safeRequestId;
  if (!activeWellId.value) return;
  topologyStore.setWellRequestGeometryReady?.(activeWellId.value, safeRequestId, safeRequestId);
}

watch(isAnalysisWorkspaceActive, (isActive) => {
  if (isActive) return;
  cancelTopologyWorkerJobs('Analysis workspace inactive');
  latestAnalysisGeometryRequestId.value = null;
  directionalGeometryReadyRequestId.value = null;
});

watch(activeWellId, (wellId) => {
  if (wellId) return;
  latestAnalysisGeometryRequestId.value = null;
  directionalGeometryReadyRequestId.value = null;
});

watch(() => topologyGraphControls.visible, (isVisible) => {
  if (isVisible === true) return;
  stopTopologyGraphDialogResize();
});

function handleTopologyGraphResizerKeydown(event) {
  const key = String(event?.key ?? '');
  const step = event?.shiftKey === true ? 36 : 18;
  if (key === 'ArrowRight') {
    event.preventDefault();
    resizeTopologyGraphDialogBy(step, 0);
    return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    resizeTopologyGraphDialogBy(-step, 0);
    return;
  }
  if (key === 'ArrowDown') {
    event.preventDefault();
    resizeTopologyGraphDialogBy(0, step);
    return;
  }
  if (key === 'ArrowUp') {
    event.preventDefault();
    resizeTopologyGraphDialogBy(0, -step);
  }
}

watch(
  [topologyStateSnapshot, activeWellId, isAnalysisWorkspaceActive],
  ([snapshot, wellId, isActive]) => {
    if (!isActive || !wellId) return;

    const { requestId, promise } = requestTopologyModelInWorker(snapshot, {
      wellId,
      supersedeReason: 'New analysis snapshot available'
    });
    latestAnalysisGeometryRequestId.value = requestId;
    if (isDirectionalView.value) {
      directionalGeometryReadyRequestId.value = null;
    } else {
      directionalGeometryReadyRequestId.value = requestId;
    }
    topologyStore.setWellRequestStarted(wellId, requestId, createTopologyLineageMeta(requestId));

    promise
      .then((result) => {
        topologyStore.setWellTopologyResult(
          wellId,
          result,
          requestId,
          createTopologyLineageMeta(requestId, { includeDirectionalReady: true })
        );
      })
      .catch((error) => {
        if (isTopologyWorkerCancelledError(error)) {
          topologyStore.setWellRequestCancelled(
            wellId,
            requestId,
            createTopologyLineageMeta(requestId, { includeDirectionalReady: true })
          );
          return;
        }
        topologyStore.setWellTopologyError(
          wellId,
          error,
          requestId,
          createTopologyLineageMeta(requestId, { includeDirectionalReady: true })
        );
      });
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  reconcileTopologyGraphDialogSize();
  const handleResize = () => {
    reconcileTopologyGraphDialogSize();
  };
  window.addEventListener('resize', handleResize);
  detachTopologyGraphResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
});

onBeforeUnmount(() => {
  stopTopologyGraphDialogResize();
  detachTopologyGraphResizeListener?.();
  detachTopologyGraphResizeListener = null;
  cancelTopologyWorkerJobs('Analysis workspace unmounted');
});

const summaryStats = computed(() => ([
  { key: 'casing', label: 'Casing Strings', labelKey: 'ui.analysis.metric.casing', value: casingData.value.length },
  { key: 'fluids', label: 'Fluid Intervals', labelKey: 'ui.analysis.metric.fluids', value: annulusFluids.value.length },
  { key: 'markers', label: 'Markers', labelKey: 'ui.analysis.metric.markers', value: markers.value.length },
  { key: 'trajectory', label: 'Trajectory Points', labelKey: 'ui.analysis.metric.trajectory', value: trajectory.value.length }
]));

const topologyResult = computed(() => (
  activeWellTopology.value?.result && typeof activeWellTopology.value.result === 'object'
    ? activeWellTopology.value.result
    : null
));
const expectedOverlayRequestId = computed(() => {
  const latestRequestId = toSafeAnalysisRequestId(latestAnalysisGeometryRequestId.value);
  if (!latestRequestId) return null;
  if (!isDirectionalView.value) return latestRequestId;
  return toSafeAnalysisRequestId(directionalGeometryReadyRequestId.value);
});
const topologyOverlaySynchronization = computed(() => (
  resolveTopologyOverlaySynchronizationState(activeWellTopology.value, {
    expectedRequestId: expectedOverlayRequestId.value,
    requireExpectedRequestId: isDirectionalView.value
  })
));
const synchronizedTopologyResult = computed(() => (
  topologyOverlaySynchronization.value.isSynchronized === true
    ? topologyResult.value
    : null
));
const shouldShowOverlayUpdatingHint = computed(() => (
  topologyOverlaySynchronization.value.overlaySuppressed === true
));
const topologyOverlayUpdatingHintKey = computed(() => {
  return resolveTopologyOverlayHintKey(topologyOverlaySynchronization.value);
});
const topologyOverlayUpdatingHintDetail = computed(() => {
  return formatTopologyOverlayHintDetail(topologyOverlaySynchronization.value);
});

const topologyIsLoading = computed(() => activeWellTopology.value?.loading === true);

const topologyError = computed(() => {
  const rawError = String(activeWellTopology.value?.error ?? '').trim();
  return rawError || null;
});

const topologyStatusKey = computed(() => {
  if (topologyIsLoading.value) return 'ui.analysis.topology.status.loading';
  if (topologyError.value) return 'ui.analysis.topology.status.error';
  if (topologyResult.value) return 'ui.analysis.topology.status.ready';
  return 'ui.analysis.topology.status.idle';
});

function formatMetricValue(value, fallback = 'N/A') {
  if (value === null || value === undefined || value === '') return fallback;
  if (Number.isFinite(Number(value))) return Number(value).toLocaleString();
  return String(value);
}

const topologyStats = computed(() => {
  const result = topologyResult.value;
  const activeFlowCount = Array.isArray(result?.activeFlowNodeIds) ? result.activeFlowNodeIds.length : 0;
  const spofCount = Array.isArray(result?.spofEdgeIds) ? result.spofEdgeIds.length : 0;
  const warningCount = Array.isArray(result?.validationWarnings) ? result.validationWarnings.length : 0;
  const nodeCount = Array.isArray(result?.nodes) ? result.nodes.length : 0;
  const edgeCount = Array.isArray(result?.edges) ? result.edges.length : 0;
  const sourceCount = Array.isArray(result?.sourceEntities) ? result.sourceEntities.length : 0;
  const primaryEnvelopeElementCount = Number(result?.barrierEnvelope?.primary?.elementCount ?? 0);
  const secondaryEnvelopeElementCount = Number(result?.barrierEnvelope?.secondary?.elementCount ?? 0);
  const overlapEnvelopeElementCount = Number(result?.barrierEnvelope?.overlap?.elementCount ?? 0);
  const minFailureCostToSurface = Number.isFinite(Number(result?.minFailureCostToSurface))
    ? Number(result.minFailureCostToSurface)
    : null;

  return [
    {
      key: 'active-flow',
      label: 'Active Flow Nodes',
      labelKey: 'ui.analysis.topology.metric.active_flow',
      value: formatMetricValue(activeFlowCount, '0')
    },
    {
      key: 'min-failure',
      label: 'Min Failure Cost',
      labelKey: 'ui.analysis.topology.metric.min_failure_cost',
      value: formatMetricValue(minFailureCostToSurface, 'N/A')
    },
    {
      key: 'spof',
      label: 'SPOF Edges',
      labelKey: 'ui.analysis.topology.metric.spof',
      value: formatMetricValue(spofCount, '0')
    },
    {
      key: 'warnings',
      label: 'Validation Warnings',
      labelKey: 'ui.analysis.topology.metric.warnings',
      value: formatMetricValue(warningCount, '0')
    },
    {
      key: 'nodes',
      label: 'Nodes',
      labelKey: 'ui.analysis.topology.metric.nodes',
      value: formatMetricValue(nodeCount, '0')
    },
    {
      key: 'edges',
      label: 'Edges',
      labelKey: 'ui.analysis.topology.metric.edges',
      value: formatMetricValue(edgeCount, '0')
    },
    {
      key: 'sources',
      label: 'Source Entities',
      labelKey: 'ui.analysis.topology.metric.sources',
      value: formatMetricValue(sourceCount, '0')
    },
    {
      key: 'envelope-primary',
      label: 'Primary Envelope Elements',
      labelKey: 'ui.analysis.topology.metric.envelope_primary',
      value: formatMetricValue(primaryEnvelopeElementCount, '0')
    },
    {
      key: 'envelope-secondary',
      label: 'Secondary Envelope Elements',
      labelKey: 'ui.analysis.topology.metric.envelope_secondary',
      value: formatMetricValue(secondaryEnvelopeElementCount, '0')
    },
    {
      key: 'envelope-overlap',
      label: 'Envelope Overlap Elements',
      labelKey: 'ui.analysis.topology.metric.envelope_overlap',
      value: formatMetricValue(overlapEnvelopeElementCount, '0')
    }
  ];
});

const topologyWarningRows = computed(() => {
  const rawWarnings = Array.isArray(topologyResult.value?.validationWarnings)
    ? topologyResult.value.validationWarnings
    : [];

  const sourceNavigationByRowId = buildTopologyWarningNavigationByRowId({
    sourceRows: topologySources.value,
    equipmentRows: equipmentData.value,
    markerRows: markers.value
  });

  return rawWarnings.map((warning, warningIndex) => {
    const code = String(warning?.code ?? '').trim() || null;
    const metadata = code ? resolveWarningMetadata(code) : null;
    const metadataCategory = String(metadata?.category ?? '').trim().toLowerCase() || null;
    const warningCategory = String(warning?.category ?? '').trim().toLowerCase() || metadataCategory || 'uncategorized';
    const rowId = String(warning?.rowId ?? '').trim() || null;
    const rowNavigationTarget = resolveTopologyWarningRowNavigationTarget(rowId, sourceNavigationByRowId);

    return {
      key: `${rowId ?? 'warning'}-${warningIndex}-${code || 'no-code'}`,
      code,
      category: warningCategory,
      message: String(warning?.message ?? '').trim() || '',
      rowId,
      rowNavigationTarget,
      depth: warning?.depth,
      recommendation: String(warning?.recommendation ?? '').trim() || null
    };
  });
});

function applyWarningCategoryFilter(warnings = [], categoryFilter = 'all') {
  const normalizedCategoryFilter = String(categoryFilter ?? 'all').trim().toLowerCase();
  if (normalizedCategoryFilter === 'all') return warnings;
  return warnings.filter((warning) => (
    String(warning?.category ?? '').trim().toLowerCase() === normalizedCategoryFilter
  ));
}

const topologyWarningCategoryOptions = computed(() => {
  const uniqueCategories = [...new Set(
    topologyWarningRows.value
      .map((warning) => String(warning?.category ?? '').trim().toLowerCase())
      .filter((category) => category.length > 0)
  )].sort((left, right) => left.localeCompare(right));

  return [
    {
      value: 'all',
      label: 'All categories',
      i18nKey: 'ui.analysis.topology.warnings.filter.all_categories'
    },
    ...uniqueCategories.map((category) => {
      const metadata = WARNING_CATEGORY_UI[category] ?? WARNING_CATEGORY_UI.uncategorized;
      return {
        value: category,
        label: metadata.label,
        i18nKey: metadata.i18nKey
      };
    })
  ];
});

const selectedTopologyWarningCategoryOption = computed(() => (
  topologyWarningCategoryOptions.value.find((option) => option.value === warningTableControls.categoryFilter)
  ?? topologyWarningCategoryOptions.value[0]
  ?? null
));

const topologyWarningCodeOptions = computed(() => {
  const warningsWithinCategory = applyWarningCategoryFilter(
    topologyWarningRows.value,
    warningTableControls.categoryFilter
  );
  const uniqueCodes = [...new Set(
    warningsWithinCategory
      .map((warning) => String(warning?.code ?? '').trim())
      .filter((code) => code.length > 0)
  )].sort((left, right) => left.localeCompare(right));

  return [
    {
      value: 'all',
      label: 'All codes',
      i18nKey: 'ui.analysis.topology.warnings.filter.all_codes'
    },
    ...uniqueCodes.map((code) => ({
      value: code,
      label: code,
      i18nKey: null
    }))
  ];
});

const selectedTopologyWarningCodeOption = computed(() => (
  topologyWarningCodeOptions.value.find((option) => option.value === warningTableControls.codeFilter)
  ?? topologyWarningCodeOptions.value[0]
  ?? null
));

const hasTopologyWarnings = computed(() => topologyWarningRows.value.length > 0);

const topologyWarningCategoryCounts = computed(() => {
  const counts = new Map();
  topologyWarningRows.value.forEach((warning) => {
    const categoryKey = String(warning?.category ?? '').trim().toLowerCase() || 'uncategorized';
    counts.set(categoryKey, (counts.get(categoryKey) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => (
      Number(right[1]) - Number(left[1]) || String(left[0]).localeCompare(String(right[0]))
    ))
    .map(([category, count]) => {
      const metadata = WARNING_CATEGORY_UI[category] ?? WARNING_CATEGORY_UI.uncategorized;
      return {
        key: category,
        label: metadata.label,
        i18nKey: metadata.i18nKey,
        count: Number(count)
      };
    });
});

const topologyWarningCodeCounts = computed(() => {
  const counts = new Map();
  topologyWarningRows.value.forEach((warning) => {
    const warningCode = String(warning?.code ?? '').trim() || 'uncoded';
    const warningCategory = String(warning?.category ?? '').trim().toLowerCase() || 'uncategorized';
    if (!counts.has(warningCode)) {
      counts.set(warningCode, {
        count: 0,
        category: warningCategory
      });
    }
    const current = counts.get(warningCode);
    current.count += 1;
    if (!current.category && warningCategory) {
      current.category = warningCategory;
    }
  });

  return [...counts.entries()]
    .sort((left, right) => (
      Number(right[1]?.count ?? 0) - Number(left[1]?.count ?? 0) || String(left[0]).localeCompare(String(right[0]))
    ))
    .map(([code, value]) => ({
      key: code,
      label: code,
      count: Number(value?.count ?? 0),
      category: String(value?.category ?? '').trim().toLowerCase() || 'uncategorized'
    }));
});

function isWarningCategoryChipActive(categoryKey) {
  return String(warningTableControls.categoryFilter ?? 'all').trim().toLowerCase() === String(categoryKey ?? '').trim().toLowerCase();
}

function isWarningCodeChipActive(codeKey, categoryKey) {
  const selectedCode = String(warningTableControls.codeFilter ?? 'all').trim().toLowerCase();
  const selectedCategory = String(warningTableControls.categoryFilter ?? 'all').trim().toLowerCase();
  return selectedCode === String(codeKey ?? '').trim().toLowerCase()
    && selectedCategory === String(categoryKey ?? '').trim().toLowerCase();
}

function resetWarningFilters() {
  warningTableControls.categoryFilter = 'all';
  warningTableControls.codeFilter = 'all';
}

function handleWarningCategoryChipClick(categoryKey) {
  const nextCategory = String(categoryKey ?? 'all').trim().toLowerCase() || 'all';
  const currentCategory = String(warningTableControls.categoryFilter ?? 'all').trim().toLowerCase();
  const currentCode = String(warningTableControls.codeFilter ?? 'all').trim().toLowerCase();

  if (currentCategory === nextCategory && currentCode === 'all') {
    resetWarningFilters();
    return;
  }

  warningTableControls.categoryFilter = nextCategory;
  warningTableControls.codeFilter = 'all';
}

function handleWarningCodeChipClick(codeKey, categoryKey) {
  const nextCode = String(codeKey ?? 'all').trim().toLowerCase() || 'all';
  const nextCategory = String(categoryKey ?? 'all').trim().toLowerCase() || 'all';
  const currentCode = String(warningTableControls.codeFilter ?? 'all').trim().toLowerCase();
  const currentCategory = String(warningTableControls.categoryFilter ?? 'all').trim().toLowerCase();

  if (currentCode === nextCode && currentCategory === nextCategory) {
    resetWarningFilters();
    return;
  }

  warningTableControls.categoryFilter = nextCategory;
  warningTableControls.codeFilter = nextCode;
}

function getWarningChipButtons(currentTarget) {
  const container = currentTarget?.closest?.('.analysis-topology__warning-chip-list');
  if (!container) return [];
  return [...container.querySelectorAll('button.analysis-topology__warning-chip:not(:disabled)')];
}

function handleWarningChipKeydown(event) {
  const navigationKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
  if (event.key === 'Escape') {
    event.preventDefault();
    resetWarningFilters();
    return;
  }
  if (!navigationKeys.has(event.key)) return;

  const chipButtons = getWarningChipButtons(event.currentTarget);
  if (chipButtons.length === 0) return;
  const currentIndex = chipButtons.indexOf(event.currentTarget);
  if (currentIndex < 0) return;

  let nextIndex = currentIndex;
  if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = chipButtons.length - 1;
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % chipButtons.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + chipButtons.length) % chipButtons.length;
  }

  event.preventDefault();
  chipButtons[nextIndex]?.focus?.();
}

const topologyWarnings = computed(() => {
  const warningsWithinCategory = applyWarningCategoryFilter(
    topologyWarningRows.value,
    warningTableControls.categoryFilter
  );
  const filterCode = String(warningTableControls.codeFilter ?? 'all').trim().toLowerCase();
  if (filterCode === 'all') {
    return warningsWithinCategory.slice(0, 6);
  }
  return warningsWithinCategory
    .filter((warning) => String(warning?.code ?? '').trim().toLowerCase() === filterCode)
    .slice(0, 6);
});

function formatWarningDepth(depth) {
  if (!Number.isFinite(Number(depth))) return null;
  return Number(depth).toLocaleString();
}

function handleWarningRowNavigation(warning) {
  const navigationTarget = warning?.rowNavigationTarget;
  if (!navigationTarget) return;
  if (!Number.isInteger(navigationTarget.rowIndex) || navigationTarget.rowIndex < 0) return;

  setTablesAccordionOpen(true);
  setActiveTableTabKey(navigationTarget.tabKey);
  requestTableRowFocus(navigationTarget.tableType, navigationTarget.rowIndex);
}

const topologyMetaText = computed(() => {
  const result = topologyResult.value;
  if (!result) return null;
  const requestId = Number.isInteger(Number(result?.requestId)) ? Number(result.requestId) : null;
  const wellId = String(result?.wellId ?? '').trim() || String(activeWellId.value ?? '').trim() || 'unknown';
  if (requestId === null) {
    return `well=${wellId}`;
  }
  return `request=${requestId} | well=${wellId}`;
});

const topologySourcePolicyKey = computed(() => {
  const sourcePolicy = topologyResult.value?.sourcePolicy;
  if (sourcePolicy?.mode === 'scenario_explicit' || sourcePolicy?.explicitScenarioDerived === true) {
    return 'ui.analysis.topology.source_policy.scenario_explicit';
  }
  if (sourcePolicy?.illustrativeFluidDerived === true) {
    return 'ui.analysis.topology.source_policy.fluid_opt_in';
  }
  if (sourcePolicy?.mode === 'open_hole_opt_in' || sourcePolicy?.openHoleDerived === true) {
    return 'ui.analysis.topology.source_policy.open_hole_opt_in';
  }
  return 'ui.analysis.topology.source_policy.marker_default';
});

function normalizeTraversalDirectionToken(value, fallback = 'bidirectional') {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'forward' || token === 'reverse' || token === 'bidirectional') return token;
  return fallback;
}

function formatTraversalContractSummary(contract, includeSink = false) {
  const safeContract = contract && typeof contract === 'object' ? contract : {};
  const terminationDirection = normalizeTraversalDirectionToken(
    safeContract?.edgeDirectionsByKind?.termination,
    'bidirectional'
  );
  if (!includeSink) return `term=${terminationDirection}`;

  const sinkNodeIds = Array.isArray(safeContract?.sinkNodeIds)
    ? safeContract.sinkNodeIds
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length > 0)
    : [];
  const sinkToken = sinkNodeIds.length > 0 ? sinkNodeIds.join(',') : 'none';
  return `term=${terminationDirection}; sink=${sinkToken}`;
}

const topologyTraversalContractsText = computed(() => {
  const contracts = topologyResult.value?.traversalContracts;
  if (!contracts || typeof contracts !== 'object') return null;
  const activeFlowSummary = formatTraversalContractSummary(contracts.activeFlow, true);
  const minimumFailureSummary = formatTraversalContractSummary(contracts.minimumFailure, false);
  return `active(${activeFlowSummary}) | min_failure(${minimumFailureSummary})`;
});

const barrierEnvelope = computed(() => (
  topologyResult.value?.barrierEnvelope && typeof topologyResult.value.barrierEnvelope === 'object'
    ? topologyResult.value.barrierEnvelope
    : null
));

const envelopeModeKey = computed(() => {
  const mode = String(barrierEnvelope.value?.mode ?? '').trim();
  if (mode === 'heuristic_alternative_path_excluding_primary_edges') {
    return 'ui.analysis.topology.envelope.mode.alt_path_excluding_primary';
  }
  return 'ui.analysis.topology.envelope.mode.unknown';
});

const envelopeHeuristicKey = computed(() => {
  const heuristic = String(barrierEnvelope.value?.summary?.independenceHeuristic ?? '').trim();
  if (heuristic === 'no_barrier_elements') return 'ui.analysis.topology.envelope.heuristic.no_barrier_elements';
  if (heuristic === 'single_path_only') return 'ui.analysis.topology.envelope.heuristic.single_path_only';
  if (heuristic === 'distinct_envelopes') return 'ui.analysis.topology.envelope.heuristic.distinct';
  if (heuristic === 'fully_shared_envelopes') return 'ui.analysis.topology.envelope.heuristic.full_overlap';
  if (heuristic === 'partial_overlap_envelopes') return 'ui.analysis.topology.envelope.heuristic.partial_overlap';
  return 'ui.analysis.topology.envelope.heuristic.unknown';
});

function formatList(values) {
  const safeValues = Array.isArray(values) ? values : [];
  return safeValues
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function compareTextValue(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function sortEnvelopeRows(rows = [], sortMode = 'edge_desc') {
  const sortedRows = [...rows];
  sortedRows.sort((left, right) => {
    if (sortMode === 'edge_asc') {
      return Number(left.edgeCount) - Number(right.edgeCount)
        || compareTextValue(left.rowId, right.rowId)
        || compareTextValue(left.functionKey, right.functionKey);
    }
    if (sortMode === 'row_id_asc') {
      return compareTextValue(left.rowId, right.rowId)
        || compareTextValue(left.functionKey, right.functionKey)
        || Number(right.edgeCount) - Number(left.edgeCount);
    }
    if (sortMode === 'row_id_desc') {
      return compareTextValue(right.rowId, left.rowId)
        || compareTextValue(left.functionKey, right.functionKey)
        || Number(right.edgeCount) - Number(left.edgeCount);
    }
    if (sortMode === 'function_asc') {
      return compareTextValue(left.functionKey, right.functionKey)
        || compareTextValue(left.rowId, right.rowId)
        || Number(right.edgeCount) - Number(left.edgeCount);
    }
    return Number(right.edgeCount) - Number(left.edgeCount)
      || compareTextValue(left.rowId, right.rowId)
      || compareTextValue(left.functionKey, right.functionKey);
  });
  return sortedRows;
}

function applyEnvelopeFilter(rows = [], filterMode = 'all') {
  if (filterMode === 'primary_only') {
    return rows.filter((row) => row.appearsOnPrimaryPath === true);
  }
  if (filterMode === 'secondary_only') {
    return rows.filter((row) => row.appearsOnSecondaryPath === true);
  }
  if (filterMode === 'overlap_only') {
    return rows.filter((row) => row.appearsOnPrimaryPath === true && row.appearsOnSecondaryPath === true);
  }
  return rows;
}

const barrierElementSourceRows = computed(() => {
  const elements = Array.isArray(barrierEnvelope.value?.barrierElements)
    ? barrierEnvelope.value.barrierElements
    : [];

  return elements.map((element, index) => {
    const rowId = String(element?.rowId ?? '').trim();
    const functionKey = String(element?.functionKey ?? '').trim();
    const equipmentTypes = formatList(element?.equipmentTypes);
    const edgeCount = Array.isArray(element?.edgeIds) ? element.edgeIds.length : 0;
    return {
      key: String(element?.elementId ?? `barrier-element-${index}`),
      rowId: rowId || 'N/A',
      functionKey: functionKey || 'boundary_seal',
      equipmentTypes: equipmentTypes || 'N/A',
      edgeIds: Array.isArray(element?.edgeIds) ? element.edgeIds : [],
      edgeCount,
      isOverlap: element?.appearsOnPrimaryPath === true && element?.appearsOnSecondaryPath === true,
      appearsOnPrimaryPath: element?.appearsOnPrimaryPath === true,
      appearsOnSecondaryPath: element?.appearsOnSecondaryPath === true
    };
  });
});

const selectedEnvelopeFilterOption = computed(() => (
  envelopeFilterOptions.find((option) => option.value === envelopeTableControls.filterMode) ?? null
));

const selectedEnvelopeSortOption = computed(() => (
  envelopeSortOptions.find((option) => option.value === envelopeTableControls.sortMode) ?? null
));

const barrierElementRows = computed(() => {
  const filteredRows = applyEnvelopeFilter(
    barrierElementSourceRows.value,
    envelopeTableControls.filterMode
  );
  return sortEnvelopeRows(filteredRows, envelopeTableControls.sortMode);
});

const selectedBarrierElement = computed(() => (
  barrierElementSourceRows.value.find((row) => row.key === selectedBarrierElementKey.value) ?? null
));

const selectedBarrierEdgeIds = computed(() => (
  Array.isArray(selectedBarrierElement.value?.edgeIds)
    ? selectedBarrierElement.value.edgeIds
    : []
));

const selectedBarrierNodeIds = computed(() => {
  const result = topologyResult.value;
  const selectedElement = selectedBarrierElement.value;
  if (!result || !selectedElement) return [];

  const edgeById = new Map(
    (Array.isArray(result?.edges) ? result.edges : [])
      .map((edge) => [String(edge?.edgeId ?? '').trim(), edge])
  );
  const nodeIds = new Set();
  selectedElement.edgeIds.forEach((edgeId) => {
    const edge = edgeById.get(String(edgeId ?? '').trim());
    if (!edge) return;
    if (String(edge?.from ?? '').trim()) nodeIds.add(String(edge.from).trim());
    if (String(edge?.to ?? '').trim()) nodeIds.add(String(edge.to).trim());
  });

  return [...nodeIds];
});

const selectedInspectorScopeOption = computed(() => (
  inspectorScopeOptions.find((option) => option.value === inspectorTableControls.scope) ?? null
));

const topologyInspectorEdgeRows = computed(() => (
  createTopologyInspectorEdgeRows(topologyResult.value, {
    scope: inspectorTableControls.scope,
    selectedBarrierEdgeIds: selectedBarrierEdgeIds.value
  })
));

const topologyInspectorNodeRows = computed(() => (
  createTopologyInspectorNodeRows(topologyResult.value, {
    scope: inspectorTableControls.scope,
    selectedBarrierEdgeIds: selectedBarrierEdgeIds.value
  })
));

const topologyInspectorNodeKindOptions = computed(() => {
  const uniqueKinds = [...new Set(
    topologyInspectorNodeRows.value
      .map((row) => String(row?.kind ?? '').trim())
      .filter((kind) => kind.length > 0)
  )].sort((left, right) => left.localeCompare(right));

  return [
    {
      value: 'all',
      label: 'All node kinds',
      i18nKey: 'ui.analysis.topology.inspector.node_kind.all'
    },
    ...uniqueKinds.map((kind) => ({
      value: kind,
      label: kind,
      i18nKey: null
    }))
  ];
});

const topologyInspectorEdgeKindOptions = computed(() => {
  const uniqueKinds = [...new Set(
    topologyInspectorEdgeRows.value
      .map((row) => String(row?.kind ?? '').trim())
      .filter((kind) => kind.length > 0)
  )].sort((left, right) => left.localeCompare(right));

  return [
    {
      value: 'all',
      label: 'All edge kinds',
      i18nKey: 'ui.analysis.topology.inspector.edge_kind.all'
    },
    ...uniqueKinds.map((kind) => ({
      value: kind,
      label: kind,
      i18nKey: null
    }))
  ];
});

const selectedInspectorNodeKindOption = computed(() => (
  topologyInspectorNodeKindOptions.value
    .find((option) => option.value === inspectorTableControls.nodeKind)
  ?? topologyInspectorNodeKindOptions.value[0]
  ?? null
));

const selectedInspectorEdgeKindOption = computed(() => (
  topologyInspectorEdgeKindOptions.value
    .find((option) => option.value === inspectorTableControls.edgeKind)
  ?? topologyInspectorEdgeKindOptions.value[0]
  ?? null
));

const filteredTopologyInspectorNodeRows = computed(() => {
  const selectedKind = String(inspectorTableControls.nodeKind ?? 'all').trim();
  if (selectedKind === 'all') return topologyInspectorNodeRows.value;
  return topologyInspectorNodeRows.value.filter((row) => String(row?.kind ?? '').trim() === selectedKind);
});

const filteredTopologyInspectorEdgeRows = computed(() => {
  const selectedKind = String(inspectorTableControls.edgeKind ?? 'all').trim();
  if (selectedKind === 'all') return topologyInspectorEdgeRows.value;
  return topologyInspectorEdgeRows.value.filter((row) => String(row?.kind ?? '').trim() === selectedKind);
});

function formatInspectorDepthRange(nodeRow) {
  const top = Number(nodeRow?.depthTop);
  const bottom = Number(nodeRow?.depthBottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return 'N/A';
  return `${top.toLocaleString()} - ${bottom.toLocaleString()}`;
}

function formatInspectorEdgeEndpoint(nodeId) {
  const safeNodeId = String(nodeId ?? '').trim();
  return safeNodeId || 'N/A';
}

function formatInspectorNullableNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
}

function handleInspectorNodeRowClick(event) {
  const nodeId = String(event?.data?.nodeId ?? '').trim();
  if (!nodeId) return;
  selectedInspectorEdgeId.value = null;
  selectedInspectorNodeId.value = selectedInspectorNodeId.value === nodeId ? null : nodeId;
}

function handleInspectorEdgeRowClick(event) {
  const edgeId = String(event?.data?.edgeId ?? '').trim();
  if (!edgeId) return;
  selectedInspectorNodeId.value = null;
  selectedInspectorEdgeId.value = selectedInspectorEdgeId.value === edgeId ? null : edgeId;
}

function handlePathSummaryStepClick(stepRow) {
  const edgeId = String(stepRow?.edgeId ?? '').trim();
  if (!edgeId) return;
  selectedInspectorNodeId.value = null;
  selectedInspectorEdgeId.value = selectedInspectorEdgeId.value === edgeId ? null : edgeId;
}

function clearInspectorSelection() {
  selectedInspectorNodeId.value = null;
  selectedInspectorEdgeId.value = null;
}

function resolveInspectorNodeRowClass(rowData) {
  const nodeId = String(rowData?.nodeId ?? '').trim();
  if (!nodeId || nodeId !== selectedInspectorNodeId.value) return '';
  return 'analysis-topology__inspector-row--selected';
}

function resolveInspectorEdgeRowClass(rowData) {
  const edgeId = String(rowData?.edgeId ?? '').trim();
  if (!edgeId || edgeId !== selectedInspectorEdgeId.value) return '';
  return 'analysis-topology__inspector-row--selected';
}

const minCostPathSummaryRows = computed(() => (
  createTopologyPathEdgeSummaryRows(topologyResult.value)
));

const selectedTopologyGraphScopeOption = computed(() => (
  topologyGraphScopeOptions.find((option) => option.value === topologyGraphControls.scope) ?? null
));

const topologyDepthUnitsLabel = computed(() => {
  const unitsToken = String(projectStore.projectConfig?.defaultUnits ?? '').trim();
  return unitsToken || 'ft';
});

const topologyDebugGraph = computed(() => (
  buildTopologyDebugGraph(topologyResult.value, {
    scope: topologyGraphControls.scope,
    selectedBarrierEdgeIds: selectedBarrierEdgeIds.value,
    depthUnitsLabel: topologyDepthUnitsLabel.value
  })
));

const topologyGraphSelectedNodeIds = computed(() => (
  selectedInspectorNodeId.value ? [selectedInspectorNodeId.value] : []
));

const topologyGraphSelectedEdgeIds = computed(() => (
  selectedInspectorEdgeId.value ? [selectedInspectorEdgeId.value] : []
));

const topologyGraphRequiresBarrierSelection = computed(() => (
  topologyGraphControls.scope === 'selected_barrier'
  && selectedBarrierEdgeIds.value.length === 0
));

const topologyGraphHasData = computed(() => (
  topologyDebugGraph.value.nodeCount > 0 && topologyDebugGraph.value.edgeCount > 0
));

function handleTopologyGraphNodeClick(payload = {}) {
  const nodeId = String(payload?.node ?? '').trim();
  if (!nodeId) return;
  selectedInspectorEdgeId.value = null;
  selectedInspectorNodeId.value = selectedInspectorNodeId.value === nodeId ? null : nodeId;
}

function handleTopologyGraphEdgeClick(payload = {}) {
  const directEdgeId = String(payload?.edge ?? '').trim();
  const fallbackEdgeId = Array.isArray(payload?.edges) ? String(payload.edges[0] ?? '').trim() : '';
  const edgeId = directEdgeId || fallbackEdgeId;
  if (!edgeId) return;
  selectedInspectorNodeId.value = null;
  selectedInspectorEdgeId.value = selectedInspectorEdgeId.value === edgeId ? null : edgeId;
}

const topologyGraphEventHandlers = {
  'node:click': handleTopologyGraphNodeClick,
  'edge:click': handleTopologyGraphEdgeClick
};

function wrapTopologyGraphTooltipLine(line, maxCharacters = TOPOLOGY_GRAPH_EDGE_TOOLTIP_WRAP_LIMIT) {
  const safeLine = String(line ?? '').trim();
  if (!safeLine) return [];
  if (safeLine.length <= maxCharacters) return [safeLine];

  const words = safeLine.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [safeLine];

  const wrappedLines = [];
  let currentLine = '';
  words.forEach((word) => {
    if (!currentLine) {
      currentLine = word;
      return;
    }
    const candidate = `${currentLine} ${word}`;
    if (candidate.length <= maxCharacters) {
      currentLine = candidate;
      return;
    }
    wrappedLines.push(currentLine);
    currentLine = word;
  });
  if (currentLine) wrappedLines.push(currentLine);
  return wrappedLines;
}

function resolveTopologyGraphEdgeTooltipLines(edge = {}) {
  const sourceLines = Array.isArray(edge?.tooltipLines) ? edge.tooltipLines : [];
  return sourceLines.flatMap((line) => wrapTopologyGraphTooltipLine(line));
}

function resolveTopologyGraphEdgeTooltipModel(slotProps = {}) {
  if (slotProps?.isSummarized === true || slotProps?.hovered !== true) return null;
  const lines = resolveTopologyGraphEdgeTooltipLines(slotProps?.edge);
  if (lines.length === 0) return null;

  const scaleValue = Number(slotProps?.scale);
  const scale = Number.isFinite(scaleValue) && scaleValue > 0 ? scaleValue : 1;
  const inverseScale = 1 / scale;
  const width = TOPOLOGY_GRAPH_EDGE_TOOLTIP_WIDTH;
  const height = (TOPOLOGY_GRAPH_EDGE_TOOLTIP_PADDING_Y * 2) + (lines.length * TOPOLOGY_GRAPH_EDGE_TOOLTIP_LINE_HEIGHT);
  const centerX = Number(slotProps?.center?.x);
  const centerY = Number(slotProps?.center?.y);

  return {
    lines,
    width,
    height,
    lineHeight: TOPOLOGY_GRAPH_EDGE_TOOLTIP_LINE_HEIGHT,
    textX: TOPOLOGY_GRAPH_EDGE_TOOLTIP_PADDING_X,
    textY: TOPOLOGY_GRAPH_EDGE_TOOLTIP_PADDING_Y + 10,
    originX: Number.isFinite(centerX) ? centerX + 12 : 0,
    originY: Number.isFinite(centerY) ? centerY - height - 12 : 0,
    inverseScale
  };
}

const topologyOverlaySelection = computed(() => ({
  selectedBarrierElementId: selectedBarrierElementKey.value,
  selectedNodeIds: resolveTopologyInspectorOverlayNodeIds({
    topologyResult: topologyResult.value,
    selectedBarrierNodeIds: selectedBarrierNodeIds.value,
    selectedInspectorNodeId: selectedInspectorNodeId.value,
    selectedInspectorEdgeId: selectedInspectorEdgeId.value
  })
}));

function handleBarrierRowClick(event) {
  const rowKey = String(event?.data?.key ?? '').trim();
  if (!rowKey) return;
  selectedBarrierElementKey.value = selectedBarrierElementKey.value === rowKey ? null : rowKey;
}

function clearSelectedBarrierElement() {
  selectedBarrierElementKey.value = null;
}

function resolveBarrierRowClass(rowData) {
  const rowKey = String(rowData?.key ?? '').trim();
  if (!rowKey || rowKey !== selectedBarrierElementKey.value) return '';
  return 'analysis-topology__envelope-row--selected';
}

watch(barrierElementSourceRows, (rows) => {
  if (!selectedBarrierElementKey.value) return;
  const stillExists = rows.some((row) => row.key === selectedBarrierElementKey.value);
  if (!stillExists) {
    selectedBarrierElementKey.value = null;
  }
}, { immediate: true });

watch(topologyWarningCategoryOptions, (options) => {
  const hasSelectedOption = options.some((option) => option.value === warningTableControls.categoryFilter);
  if (!hasSelectedOption) {
    warningTableControls.categoryFilter = 'all';
  }
}, { immediate: true });

watch(topologyWarningCodeOptions, (options) => {
  const hasSelectedOption = options.some((option) => option.value === warningTableControls.codeFilter);
  if (!hasSelectedOption) {
    warningTableControls.codeFilter = 'all';
  }
}, { immediate: true });

watch(topologyInspectorNodeKindOptions, (options) => {
  const hasSelectedOption = options.some((option) => option.value === inspectorTableControls.nodeKind);
  if (!hasSelectedOption) {
    inspectorTableControls.nodeKind = 'all';
  }
}, { immediate: true });

watch(topologyInspectorEdgeKindOptions, (options) => {
  const hasSelectedOption = options.some((option) => option.value === inspectorTableControls.edgeKind);
  if (!hasSelectedOption) {
    inspectorTableControls.edgeKind = 'all';
  }
}, { immediate: true });

watch(filteredTopologyInspectorNodeRows, (rows) => {
  const currentNodeId = String(selectedInspectorNodeId.value ?? '').trim();
  if (!currentNodeId) return;
  const stillVisible = rows.some((row) => String(row?.nodeId ?? '').trim() === currentNodeId);
  if (!stillVisible) {
    selectedInspectorNodeId.value = null;
  }
}, { immediate: true });

watch(filteredTopologyInspectorEdgeRows, (rows) => {
  const currentEdgeId = String(selectedInspectorEdgeId.value ?? '').trim();
  if (!currentEdgeId) return;
  const stillVisible = rows.some((row) => String(row?.edgeId ?? '').trim() === currentEdgeId);
  if (!stillVisible) {
    selectedInspectorEdgeId.value = null;
  }
}, { immediate: true });
</script>

<template>
  <Splitter class="analysis-workspace" layout="horizontal">
    <SplitterPanel
      class="analysis-workspace__panel analysis-workspace__panel--controls"
      :size="30"
      :min-size="22"
    >
      <aside class="analysis-workspace__controls">
      <p class="analysis-workspace__eyebrow" data-i18n="ui.analysis.eyebrow">Analysis Workspace</p>
      <h2 class="analysis-workspace__title" data-i18n="ui.analysis.title">Topology and Barrier Analysis</h2>
      <p class="analysis-workspace__description" data-i18n="ui.analysis.description">
        Review flow connectivity, barrier robustness, and warnings on the same synchronized schematic.
      </p>

      <div class="analysis-workspace__metrics">
        <article v-for="metric in summaryStats" :key="metric.key" class="analysis-metric">
          <p class="analysis-metric__label" :data-i18n="metric.labelKey">{{ metric.label }}</p>
          <p class="analysis-metric__value">{{ metric.value }}</p>
        </article>
      </div>

      <section class="analysis-topology">
        <header class="analysis-topology__header">
          <h3 class="analysis-topology__title" data-i18n="ui.analysis.topology.title">Topology MVP</h3>
          <p class="analysis-topology__status">
            <span class="analysis-topology__status-label" data-i18n="ui.analysis.topology.status_label">Status:</span>
            <span :data-i18n="topologyStatusKey">
              {{ topologyIsLoading ? 'Loading' : (topologyError ? 'Error' : (topologyResult ? 'Ready' : 'Idle')) }}
            </span>
          </p>
        </header>
        <p v-if="shouldShowOverlayUpdatingHint" class="analysis-topology__sync-note">
          <span :data-i18n="topologyOverlayUpdatingHintKey">
            {{
              topologyOverlayUpdatingHintKey === 'ui.analysis.topology.overlay_sync.stale_result'
                ? 'Topology overlays are temporarily hidden because analysis is recomputing newer results.'
                : topologyOverlayUpdatingHintKey === 'ui.analysis.topology.overlay_sync.geometry_pending'
                  ? 'Topology overlays are waiting for directional geometry to finish updating.'
                  : topologyOverlayUpdatingHintKey === 'ui.analysis.topology.overlay_sync.request_mismatch'
                    ? 'Topology overlays are waiting for geometry/topology request IDs to align.'
                : 'Topology overlays are updating...'
            }}
          </span>
          <span v-if="topologyOverlayUpdatingHintDetail" class="analysis-topology__sync-note-detail">
            {{ topologyOverlayUpdatingHintDetail }}
          </span>
        </p>
        <div class="analysis-topology__metrics">
          <article
            v-for="metric in topologyStats"
            :key="metric.key"
            class="analysis-topology-metric"
          >
            <p class="analysis-topology-metric__label" :data-i18n="metric.labelKey">{{ metric.label }}</p>
            <p class="analysis-topology-metric__value">{{ metric.value }}</p>
          </article>
        </div>

        <details class="analysis-topology__diagnostics">
          <summary class="analysis-topology__diagnostics-summary" data-i18n="ui.analysis.topology.diagnostics.title">
            Advanced diagnostics (debug)
          </summary>
          <div class="analysis-topology__diagnostics-body">
        <p v-if="topologyMetaText" class="analysis-topology__meta">{{ topologyMetaText }}</p>
        <p class="analysis-topology__meta">
          <span data-i18n="ui.analysis.topology.source_policy.label">Source policy:</span>
          <span :data-i18n="topologySourcePolicyKey">
            {{
              topologySourcePolicyKey === 'ui.analysis.topology.source_policy.scenario_explicit'
                ? 'Explicit scenario source rows'
                : topologySourcePolicyKey === 'ui.analysis.topology.source_policy.fluid_opt_in'
                  ? 'Marker + illustrative fluid (opt-in)'
                  : topologySourcePolicyKey === 'ui.analysis.topology.source_policy.open_hole_opt_in'
                    ? 'Marker + open-hole source (opt-in)'
                  : 'Marker-driven default'
            }}
          </span>
        </p>
        <p class="analysis-topology__meta" data-i18n="ui.analysis.topology.source_policy.volume_guide">
          Volume guide: use TUBING_ANNULUS for tubing-adjacent annulus; use ANNULUS_A for first casing annulus.
        </p>
        <p v-if="topologyTraversalContractsText" class="analysis-topology__meta">
          <span data-i18n="ui.analysis.topology.traversal_contracts.label">Traversal contracts:</span>
          <span>{{ topologyTraversalContractsText }}</span>
        </p>

        <div class="analysis-topology__notes">
          <p class="analysis-topology__notes-title" data-i18n="ui.analysis.topology.notes.title">Quick meaning</p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.active_flow">
            Active Flow: connected zones with no barrier failures assumed.
          </p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.min_failure_cost">
            Min Failure Cost: number of barrier failures needed for any path to surface.
          </p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.min_path">
            Min-cost Path: the path that requires the fewest failures.
          </p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.spof">
            SPOF: a single barrier on that best path; if it fails, a surface path exists.
          </p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.min_failure_cost_zero">
            If Min Failure Cost is 0, a surface path is already open in the current model.
          </p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.envelope_overlap">
            Envelope overlap means the same barrier element appears in both primary and secondary heuristic envelopes.
          </p>
          <p class="analysis-topology__note" data-i18n="ui.analysis.topology.notes.volume_semantics">
            Volume semantics: TUBING_ANNULUS tracks tubing-to-first-casing annulus; ANNULUS_A tracks first casing-to-casing annulus.
          </p>
        </div>

        <div class="analysis-topology__envelope">
          <p class="analysis-topology__section-title" data-i18n="ui.analysis.topology.envelope.title">
            Barrier envelope drill-down
          </p>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.envelope.mode_label">Mode:</span>
            <span :data-i18n="envelopeModeKey">
              {{
                envelopeModeKey === 'ui.analysis.topology.envelope.mode.alt_path_excluding_primary'
                  ? 'Alternative path excluding primary path edges'
                  : 'Unknown'
              }}
            </span>
          </p>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.envelope.heuristic_label">Independence heuristic:</span>
            <span :data-i18n="envelopeHeuristicKey">
              {{
                envelopeHeuristicKey === 'ui.analysis.topology.envelope.heuristic.no_barrier_elements'
                  ? 'No barrier elements on the primary path'
                  : envelopeHeuristicKey === 'ui.analysis.topology.envelope.heuristic.single_path_only'
                    ? 'Single path only (no secondary envelope found)'
                    : envelopeHeuristicKey === 'ui.analysis.topology.envelope.heuristic.distinct'
                      ? 'Distinct envelopes (no shared elements)'
                      : envelopeHeuristicKey === 'ui.analysis.topology.envelope.heuristic.full_overlap'
                        ? 'Fully overlapping envelopes'
                        : envelopeHeuristicKey === 'ui.analysis.topology.envelope.heuristic.partial_overlap'
                          ? 'Partially overlapping envelopes'
                          : 'Unknown'
              }}
            </span>
          </p>
          <div class="analysis-topology__envelope-controls">
            <div class="analysis-topology__envelope-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.envelope.filter.label">
                Filter:
              </label>
              <Select
                v-model="envelopeTableControls.filterMode"
                :options="envelopeFilterOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedEnvelopeFilterOption" :data-i18n="selectedEnvelopeFilterOption.i18nKey">
                    {{ selectedEnvelopeFilterOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
            <div class="analysis-topology__envelope-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.envelope.sort.label">
                Sort:
              </label>
              <Select
                v-model="envelopeTableControls.sortMode"
                :options="envelopeSortOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedEnvelopeSortOption" :data-i18n="selectedEnvelopeSortOption.i18nKey">
                    {{ selectedEnvelopeSortOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
          </div>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.envelope.visible_count_label">Visible rows:</span>
            <span>{{ barrierElementRows.length }} / {{ barrierElementSourceRows.length }}</span>
          </p>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.envelope.selection.label">Selected element:</span>
            <span>{{ selectedBarrierElementKey || 'N/A' }}</span>
          </p>
          <div class="analysis-topology__envelope-actions">
            <Button
              text
              size="small"
              :disabled="!selectedBarrierElementKey"
              @click="clearSelectedBarrierElement"
            >
              <span data-i18n="ui.analysis.topology.envelope.selection.clear">Clear selection</span>
            </Button>
          </div>

          <DataTable
            :value="barrierElementRows"
            data-key="key"
            size="small"
            scrollable
            scroll-height="220px"
            class="analysis-topology__envelope-table"
            :row-class="resolveBarrierRowClass"
            @row-click="handleBarrierRowClick"
          >
            <template #empty>
              <span data-i18n="ui.analysis.topology.envelope.empty">
                No barrier elements are available for this topology run.
              </span>
            </template>

            <Column field="rowId">
              <template #header>
                <span data-i18n="ui.analysis.topology.envelope.column.row_id">Row ID</span>
              </template>
            </Column>
            <Column field="functionKey">
              <template #header>
                <span data-i18n="ui.analysis.topology.envelope.column.function">Function</span>
              </template>
            </Column>
            <Column field="equipmentTypes">
              <template #header>
                <span data-i18n="ui.analysis.topology.envelope.column.equipment">Equipment</span>
              </template>
            </Column>
            <Column field="edgeCount">
              <template #header>
                <span data-i18n="ui.analysis.topology.envelope.column.edge_count">Edges</span>
              </template>
            </Column>
            <Column field="appearsOnPrimaryPath">
              <template #header>
                <span data-i18n="ui.analysis.topology.envelope.column.primary">Primary</span>
              </template>
              <template #body="{ data }">
                <span :data-i18n="data.appearsOnPrimaryPath ? 'common.on' : 'common.off'">
                  {{ data.appearsOnPrimaryPath ? 'On' : 'Off' }}
                </span>
              </template>
            </Column>
            <Column field="appearsOnSecondaryPath">
              <template #header>
                <span data-i18n="ui.analysis.topology.envelope.column.secondary">Secondary</span>
              </template>
              <template #body="{ data }">
                <span :data-i18n="data.appearsOnSecondaryPath ? 'common.on' : 'common.off'">
                  {{ data.appearsOnSecondaryPath ? 'On' : 'Off' }}
                </span>
              </template>
            </Column>
          </DataTable>
        </div>

        <div class="analysis-topology__inspector">
          <p class="analysis-topology__section-title" data-i18n="ui.analysis.topology.inspector.title">
            Node and edge inspector
          </p>
          <p class="analysis-topology__meta" data-i18n="ui.analysis.topology.inspector.description">
            Filter graph details by topology scope and click rows to highlight the corresponding regions.
          </p>
          <div class="analysis-topology__inspector-controls">
            <div class="analysis-topology__inspector-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.inspector.scope.label">
                Scope:
              </label>
              <Select
                v-model="inspectorTableControls.scope"
                :options="inspectorScopeOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedInspectorScopeOption" :data-i18n="selectedInspectorScopeOption.i18nKey">
                    {{ selectedInspectorScopeOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
            <div class="analysis-topology__inspector-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.inspector.node_kind.label">
                Node kind:
              </label>
              <Select
                v-model="inspectorTableControls.nodeKind"
                :options="topologyInspectorNodeKindOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedInspectorNodeKindOption?.i18nKey" :data-i18n="selectedInspectorNodeKindOption.i18nKey">
                    {{ selectedInspectorNodeKindOption.label }}
                  </span>
                  <span v-else-if="selectedInspectorNodeKindOption">
                    {{ selectedInspectorNodeKindOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span v-if="slotProps.option.i18nKey" :data-i18n="slotProps.option.i18nKey">
                    {{ slotProps.option.label }}
                  </span>
                  <span v-else>{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
            <div class="analysis-topology__inspector-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.inspector.edge_kind.label">
                Edge kind:
              </label>
              <Select
                v-model="inspectorTableControls.edgeKind"
                :options="topologyInspectorEdgeKindOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedInspectorEdgeKindOption?.i18nKey" :data-i18n="selectedInspectorEdgeKindOption.i18nKey">
                    {{ selectedInspectorEdgeKindOption.label }}
                  </span>
                  <span v-else-if="selectedInspectorEdgeKindOption">
                    {{ selectedInspectorEdgeKindOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span v-if="slotProps.option.i18nKey" :data-i18n="slotProps.option.i18nKey">
                    {{ slotProps.option.label }}
                  </span>
                  <span v-else>{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
          </div>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.inspector.visible_nodes">Visible nodes:</span>
            <span>{{ filteredTopologyInspectorNodeRows.length }} / {{ topologyInspectorNodeRows.length }}</span>
          </p>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.inspector.visible_edges">Visible edges:</span>
            <span>{{ filteredTopologyInspectorEdgeRows.length }} / {{ topologyInspectorEdgeRows.length }}</span>
          </p>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.inspector.selection.label">Inspector selection:</span>
            <span>{{ selectedInspectorEdgeId || selectedInspectorNodeId || 'N/A' }}</span>
          </p>
          <div class="analysis-topology__envelope-actions">
            <Button
              text
              size="small"
              :disabled="!selectedInspectorEdgeId && !selectedInspectorNodeId"
              @click="clearInspectorSelection"
            >
              <span data-i18n="ui.analysis.topology.inspector.selection.clear">Clear inspector selection</span>
            </Button>
          </div>

          <DataTable
            :value="filteredTopologyInspectorNodeRows"
            data-key="key"
            size="small"
            scrollable
            scroll-height="160px"
            class="analysis-topology__inspector-table"
            :row-class="resolveInspectorNodeRowClass"
            @row-click="handleInspectorNodeRowClick"
          >
            <template #empty>
              <span data-i18n="ui.analysis.topology.inspector.nodes.empty">
                No topology nodes are available for the selected filters.
              </span>
            </template>

            <template #header>
              <span data-i18n="ui.analysis.topology.inspector.nodes.title">Nodes</span>
            </template>

            <Column field="nodeId">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.nodes.column.node_id">Node ID</span>
              </template>
            </Column>
            <Column field="kind">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.nodes.column.kind">Kind</span>
              </template>
            </Column>
            <Column field="depthRange">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.nodes.column.depth">Depth (MD)</span>
              </template>
              <template #body="{ data }">
                {{ formatInspectorDepthRange(data) }}
              </template>
            </Column>
            <Column field="isActiveFlow">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.nodes.column.active">Active</span>
              </template>
              <template #body="{ data }">
                <span :data-i18n="data.isActiveFlow ? 'common.on' : 'common.off'">
                  {{ data.isActiveFlow ? 'On' : 'Off' }}
                </span>
              </template>
            </Column>
          </DataTable>

          <DataTable
            :value="filteredTopologyInspectorEdgeRows"
            data-key="key"
            size="small"
            scrollable
            scroll-height="160px"
            class="analysis-topology__inspector-table"
            :row-class="resolveInspectorEdgeRowClass"
            @row-click="handleInspectorEdgeRowClick"
          >
            <template #empty>
              <span data-i18n="ui.analysis.topology.inspector.edges.empty">
                No topology edges are available for the selected filters.
              </span>
            </template>

            <template #header>
              <span data-i18n="ui.analysis.topology.inspector.edges.title">Edges</span>
            </template>

            <Column field="edgeId">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.edges.column.edge_id">Edge ID</span>
              </template>
            </Column>
            <Column field="kind">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.edges.column.kind">Kind</span>
              </template>
            </Column>
            <Column field="cost">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.edges.column.cost">Cost</span>
              </template>
              <template #body="{ data }">
                {{ data.cost ?? 'N/A' }}
              </template>
            </Column>
            <Column field="fromNodeId">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.edges.column.from">From</span>
              </template>
              <template #body="{ data }">
                {{ formatInspectorEdgeEndpoint(data.fromNodeId) }}
              </template>
            </Column>
            <Column field="toNodeId">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.edges.column.to">To</span>
              </template>
              <template #body="{ data }">
                {{ formatInspectorEdgeEndpoint(data.toNodeId) }}
              </template>
            </Column>
            <Column field="ruleId">
              <template #header>
                <span data-i18n="ui.analysis.topology.inspector.edges.column.rule">Rule</span>
              </template>
              <template #body="{ data }">
                {{ data.ruleId || 'N/A' }}
              </template>
            </Column>
          </DataTable>

          <div class="analysis-topology__path-summary">
            <p class="analysis-topology__section-title" data-i18n="ui.analysis.topology.path_summary.title">
              Selected-path summary
            </p>
            <p class="analysis-topology__meta">
              <span data-i18n="ui.analysis.topology.path_summary.cost_label">Path cost:</span>
              <span>{{ formatInspectorNullableNumber(topologyResult?.minFailureCostToSurface) }}</span>
            </p>
            <p class="analysis-topology__meta">
              <span data-i18n="ui.analysis.topology.path_summary.edge_count_label">Path edges:</span>
              <span>{{ minCostPathSummaryRows.length }}</span>
            </p>
            <ol
              v-if="minCostPathSummaryRows.length > 0"
              class="analysis-topology__path-summary-list"
            >
              <li
                v-for="step in minCostPathSummaryRows"
                :key="step.key"
                class="analysis-topology__path-summary-item"
              >
                <button
                  type="button"
                  class="analysis-topology__path-summary-button"
                  :class="{ 'analysis-topology__path-summary-button--active': selectedInspectorEdgeId === step.edgeId }"
                  @click="handlePathSummaryStepClick(step)"
                >
                  <span class="analysis-topology__path-summary-step">{{ step.step }}.</span>
                  <span class="analysis-topology__path-summary-kind">{{ step.kind }}</span>
                  <span class="analysis-topology__path-summary-cost">
                    ({{ formatInspectorNullableNumber(step.cost) }})
                  </span>
                  <span class="analysis-topology__path-summary-node">{{ step.fromNodeId }}</span>
                  <span class="analysis-topology__path-summary-arrow">-></span>
                  <span class="analysis-topology__path-summary-node">{{ step.toNodeId }}</span>
                </button>
              </li>
            </ol>
            <p
              v-else
              class="analysis-topology__meta"
              data-i18n="ui.analysis.topology.path_summary.empty"
            >
              No min-cost path edge sequence is available.
            </p>
          </div>
        </div>
          </div>
        </details>

        <div class="analysis-topology__toggles">
          <p class="analysis-topology__toggles-title" data-i18n="ui.analysis.topology.toggle.title">Overlay layers</p>
          <label class="analysis-topology__toggle-item">
            <Checkbox v-model="topologyOverlayOptions.showActiveFlow" binary input-id="analysis-overlay-active-flow" />
            <span data-i18n="ui.analysis.topology.toggle.active_flow">Active flow</span>
          </label>
          <label class="analysis-topology__toggle-item">
            <Checkbox v-model="topologyOverlayOptions.showMinCostPath" binary input-id="analysis-overlay-min-path" />
            <span data-i18n="ui.analysis.topology.toggle.min_path">Min-cost path</span>
          </label>
          <label class="analysis-topology__toggle-item">
            <Checkbox v-model="topologyOverlayOptions.showSpof" binary input-id="analysis-overlay-spof" />
            <span data-i18n="ui.analysis.topology.toggle.spof">SPOF</span>
          </label>
          <label class="analysis-topology__toggle-item">
            <Checkbox v-model="topologyGraphControls.visible" binary input-id="analysis-graph-debug-pane" />
            <span data-i18n="ui.analysis.topology.toggle.graph_debug">Graph debug pane</span>
          </label>
        </div>

        <div class="analysis-topology__legend">
          <p class="analysis-topology__legend-title" data-i18n="ui.analysis.topology.legend.title">Color legend</p>
          <p class="analysis-topology__legend-item">
            <span class="analysis-topology__legend-swatch analysis-topology__legend-swatch--active" />
            <span data-i18n="ui.analysis.topology.legend.active">Yellow = active flow region</span>
          </p>
          <p class="analysis-topology__legend-item">
            <span class="analysis-topology__legend-swatch analysis-topology__legend-swatch--path" />
            <span data-i18n="ui.analysis.topology.legend.path">Amber = min-cost path region</span>
          </p>
          <p class="analysis-topology__legend-item">
            <span class="analysis-topology__legend-swatch analysis-topology__legend-swatch--spof" />
            <span data-i18n="ui.analysis.topology.legend.spof">Magenta = single-point-of-failure region</span>
          </p>
          <p class="analysis-topology__legend-item">
            <span class="analysis-topology__legend-swatch analysis-topology__legend-swatch--selected" />
            <span data-i18n="ui.analysis.topology.legend.selected">Blue = selected barrier element</span>
          </p>
        </div>

        <p v-if="topologyError" class="analysis-topology__error">{{ topologyError }}</p>

        <div
          v-if="hasTopologyWarnings"
          class="analysis-topology__warnings"
          tabindex="0"
          @keydown.esc.stop.prevent="resetWarningFilters"
        >
          <p class="analysis-topology__warnings-title" data-i18n="ui.analysis.topology.warnings_title">
            Topology validation warnings:
          </p>
          <div class="analysis-topology__warning-summary">
            <p class="analysis-topology__warning-summary-label" data-i18n="ui.analysis.topology.warnings.summary.by_category">
              By category:
            </p>
            <div class="analysis-topology__warning-chip-list">
              <Button
                v-for="categoryItem in topologyWarningCategoryCounts"
                :key="`warning-category-${categoryItem.key}`"
                class="analysis-topology__warning-chip"
                :class="{ 'analysis-topology__warning-chip--active': isWarningCategoryChipActive(categoryItem.key) }"
                :aria-pressed="isWarningCategoryChipActive(categoryItem.key)"
                size="small"
                :outlined="!isWarningCategoryChipActive(categoryItem.key)"
                :severity="isWarningCategoryChipActive(categoryItem.key) ? 'primary' : 'secondary'"
                @click="handleWarningCategoryChipClick(categoryItem.key)"
                @keydown="handleWarningChipKeydown"
              >
                <span v-if="categoryItem.i18nKey" :data-i18n="categoryItem.i18nKey">{{ categoryItem.label }}</span>
                <span v-else>{{ categoryItem.label }}</span>
                <span class="analysis-topology__warning-chip-count">{{ categoryItem.count }}</span>
              </Button>
            </div>
            <p class="analysis-topology__warning-summary-label" data-i18n="ui.analysis.topology.warnings.summary.by_code">
              By code:
            </p>
            <div class="analysis-topology__warning-chip-list">
              <Button
                v-for="codeItem in topologyWarningCodeCounts"
                :key="`warning-code-${codeItem.key}`"
                class="analysis-topology__warning-chip"
                :class="{ 'analysis-topology__warning-chip--active': isWarningCodeChipActive(codeItem.key, codeItem.category) }"
                :aria-pressed="isWarningCodeChipActive(codeItem.key, codeItem.category)"
                size="small"
                :outlined="!isWarningCodeChipActive(codeItem.key, codeItem.category)"
                :severity="isWarningCodeChipActive(codeItem.key, codeItem.category) ? 'primary' : 'secondary'"
                @click="handleWarningCodeChipClick(codeItem.key, codeItem.category)"
                @keydown="handleWarningChipKeydown"
              >
                <span class="analysis-topology__warning-chip-code">{{ codeItem.label }}</span>
                <span class="analysis-topology__warning-chip-count">{{ codeItem.count }}</span>
              </Button>
            </div>
          </div>
          <div class="analysis-topology__warning-controls">
            <div class="analysis-topology__warning-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.warnings.filter.category_label">
                Category:
              </label>
              <Select
                v-model="warningTableControls.categoryFilter"
                :options="topologyWarningCategoryOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedTopologyWarningCategoryOption?.i18nKey" :data-i18n="selectedTopologyWarningCategoryOption.i18nKey">
                    {{ selectedTopologyWarningCategoryOption.label }}
                  </span>
                  <span v-else-if="selectedTopologyWarningCategoryOption">
                    {{ selectedTopologyWarningCategoryOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span v-if="slotProps.option.i18nKey" :data-i18n="slotProps.option.i18nKey">
                    {{ slotProps.option.label }}
                  </span>
                  <span v-else>{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
            <div class="analysis-topology__warning-control">
              <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.warnings.filter.code_label">
                Code:
              </label>
              <Select
                v-model="warningTableControls.codeFilter"
                :options="topologyWarningCodeOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="analysis-topology__control-select"
              >
                <template #value="slotProps">
                  <span v-if="selectedTopologyWarningCodeOption?.i18nKey" :data-i18n="selectedTopologyWarningCodeOption.i18nKey">
                    {{ selectedTopologyWarningCodeOption.label }}
                  </span>
                  <span v-else-if="selectedTopologyWarningCodeOption">
                    {{ selectedTopologyWarningCodeOption.label }}
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <span v-if="slotProps.option.i18nKey" :data-i18n="slotProps.option.i18nKey">
                    {{ slotProps.option.label }}
                  </span>
                  <span v-else>{{ slotProps.option.label }}</span>
                </template>
              </Select>
            </div>
          </div>
          <ul class="analysis-topology__warning-list">
            <li
              v-for="warning in topologyWarnings"
              :key="warning.key"
              class="analysis-topology__warning-item"
            >
              <span v-if="warning.code" class="analysis-topology__warning-code">[{{ warning.code }}]</span>
              <span>{{ warning.message }}</span>
              <Button
                v-if="warning.rowNavigationTarget"
                class="analysis-topology__warning-row-link"
                size="small"
                text
                type="button"
                @click="handleWarningRowNavigation(warning)"
              >
                #{{ warning.rowId }}
              </Button>
              <span v-else-if="warning.rowId" class="analysis-topology__warning-row-id">#{{ warning.rowId }}</span>
              <span v-if="formatWarningDepth(warning.depth)" class="analysis-topology__warning-depth">
                @ {{ formatWarningDepth(warning.depth) }}
              </span>
              <small v-if="warning.recommendation" class="analysis-topology__warning-recommendation">
                <strong data-i18n="ui.visual_inspector.recommendation_label">Recommendation:</strong>
                <span>{{ warning.recommendation }}</span>
              </small>
            </li>
          </ul>
        </div>
      </section>
      </aside>
    </SplitterPanel>

    <SplitterPanel
      class="analysis-workspace__panel analysis-workspace__panel--canvas"
      :size="70"
      :min-size="40"
    >
      <main class="analysis-workspace__canvas schematic-light-scope">
      <DirectionalSchematicCanvas
        v-if="isDirectionalView"
        :project-data="declarativeProjectData"
        :config="viewConfigStore.config"
        :analysis-request-id="latestAnalysisGeometryRequestId"
        :topology-result="synchronizedTopologyResult"
        :topology-overlay-options="topologyOverlayOptions"
        :topology-overlay-selection="topologyOverlaySelection"
        @analysis-geometry-ready="handleDirectionalGeometryReady"
      />
      <SchematicCanvas
        v-else
        :project-data="declarativeProjectData"
        :config="viewConfigStore.config"
        :readonly="true"
        :allow-readonly-selection="true"
        :allow-tooltips="true"
        :topology-result="synchronizedTopologyResult"
        :topology-overlay-options="topologyOverlayOptions"
        :topology-overlay-selection="topologyOverlaySelection"
      />
      </main>
    </SplitterPanel>
  </Splitter>

  <Dialog
    v-model:visible="topologyGraphControls.visible"
    data-vue-owned="true"
    class="analysis-topology__graph-dialog"
    :modal="false"
    :draggable="true"
    :maximizable="true"
    :style="topologyGraphDialogStyle"
    :breakpoints="{ '1200px': '94vw', '768px': '98vw' }"
  >
    <template #header>
      <span data-i18n="ui.analysis.topology.graph.title">Topology graph debug pane</span>
    </template>

    <div class="analysis-topology__graph-pane analysis-topology__graph-pane--dialog">
      <p class="analysis-topology__meta" data-i18n="ui.analysis.topology.graph.description">
        Fixed-lane graph view for explainability. Click a node or edge to sync selection with inspector and overlay.
      </p>
      <div class="analysis-topology__graph-controls">
        <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.graph.scope.label">
          Graph scope:
        </label>
        <Select
          v-model="topologyGraphControls.scope"
          :options="topologyGraphScopeOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="analysis-topology__control-select"
        >
          <template #value="slotProps">
            <span v-if="selectedTopologyGraphScopeOption" :data-i18n="selectedTopologyGraphScopeOption.i18nKey">
              {{ selectedTopologyGraphScopeOption.label }}
            </span>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
          <template #option="slotProps">
            <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
          </template>
        </Select>
      </div>
      <p class="analysis-topology__meta">
        <span data-i18n="ui.analysis.topology.graph.visible_nodes">Graph nodes:</span>
        <span>{{ topologyDebugGraph.nodeCount }}</span>
      </p>
      <p class="analysis-topology__meta">
        <span data-i18n="ui.analysis.topology.graph.visible_edges">Graph edges:</span>
        <span>{{ topologyDebugGraph.edgeCount }}</span>
      </p>
      <p
        v-if="topologyGraphRequiresBarrierSelection"
        class="analysis-topology__graph-hint"
        data-i18n="ui.analysis.topology.graph.empty_selected_barrier"
      >
        Select a barrier element row to render the selected-barrier graph scope.
      </p>
      <p
        v-else-if="!topologyGraphHasData"
        class="analysis-topology__graph-hint"
        data-i18n="ui.analysis.topology.graph.empty"
      >
        No topology subgraph data is available for the selected scope.
      </p>
      <VNetworkGraph
        v-else
        class="analysis-topology__graph-canvas analysis-topology__graph-canvas--dialog"
        :nodes="topologyDebugGraph.nodes"
        :edges="topologyDebugGraph.edges"
        :layouts="topologyDebugGraph.layouts"
        :configs="topologyGraphConfigs"
        :layers="topologyGraphLayers"
        :selected-nodes="topologyGraphSelectedNodeIds"
        :selected-edges="topologyGraphSelectedEdgeIds"
        :event-handlers="topologyGraphEventHandlers"
      >
        <template #lane-headers>
          <g class="analysis-topology__graph-lane-headers" aria-hidden="true">
            <g
              v-for="laneHeader in topologyDebugGraph.laneHeaders"
              :key="`topology-lane-header-${laneHeader.kind}`"
              :transform="`translate(${laneHeader.x} ${laneHeader.y})`"
            >
              <rect class="analysis-topology__graph-lane-header-bg" x="-60" y="-12" width="120" height="22" rx="4" ry="4" />
              <text class="analysis-topology__graph-lane-header-text" x="0" y="-1" text-anchor="middle" dominant-baseline="central">
                {{ laneHeader.label }}
              </text>
            </g>
          </g>
        </template>
        <template #edge-overlay="slotProps">
          <template
            v-for="tooltipModel in [resolveTopologyGraphEdgeTooltipModel(slotProps)]"
            :key="`topology-edge-tooltip-${slotProps.edgeId ?? 'summary'}`"
          >
            <g
              v-if="tooltipModel"
              class="analysis-topology__graph-edge-tooltip"
              :transform="`translate(${tooltipModel.originX} ${tooltipModel.originY}) scale(${tooltipModel.inverseScale})`"
            >
              <rect
                class="analysis-topology__graph-edge-tooltip-bg"
                x="0"
                y="0"
                :width="tooltipModel.width"
                :height="tooltipModel.height"
                rx="6"
                ry="6"
              />
              <text class="analysis-topology__graph-edge-tooltip-line" :x="tooltipModel.textX" :y="tooltipModel.textY">
                <tspan
                  v-for="(line, lineIndex) in tooltipModel.lines"
                  :key="`topology-edge-tooltip-line-${lineIndex}`"
                  :x="tooltipModel.textX"
                  :dy="lineIndex === 0 ? 0 : tooltipModel.lineHeight"
                >
                  {{ line }}
                </tspan>
              </text>
            </g>
          </template>
        </template>
      </VNetworkGraph>
      <div class="analysis-topology__graph-legend">
        <p class="analysis-topology__graph-legend-item">
          <span class="analysis-topology__graph-line analysis-topology__graph-line--open" />
          <span data-i18n="ui.analysis.topology.graph.legend.open">Solid line = open continuity (cost 0)</span>
        </p>
        <p class="analysis-topology__graph-legend-item">
          <span class="analysis-topology__graph-line analysis-topology__graph-line--barrier" />
          <span data-i18n="ui.analysis.topology.graph.legend.barrier">Dashed red line = barrier/failable boundary (cost 1)</span>
        </p>
        <p class="analysis-topology__graph-legend-item">
          <span class="analysis-topology__graph-line analysis-topology__graph-line--radial" />
          <span data-i18n="ui.analysis.topology.graph.legend.radial">Orange line = radial communication edge</span>
        </p>
        <p class="analysis-topology__graph-legend-item">
          <span class="analysis-topology__graph-line analysis-topology__graph-line--termination" />
          <span data-i18n="ui.analysis.topology.graph.legend.termination">Green line = termination edge to surface</span>
        </p>
      </div>
      <button
        type="button"
        class="analysis-topology__graph-resizer"
        aria-label="Resize topology graph dialog"
        @keydown="handleTopologyGraphResizerKeydown"
        @pointerdown="startTopologyGraphDialogResize"
      ></button>
    </div>
  </Dialog>
</template>

<style scoped>
.analysis-workspace {
  width: 100%;
  min-height: 0;
  height: 100%;
}

.analysis-workspace__panel {
  min-width: 0;
  min-height: 0;
}

.analysis-workspace__controls {
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: auto;
}

.analysis-workspace__eyebrow {
  margin: 0;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: var(--p-primary-700);
}

.analysis-workspace__title {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.3;
}

.analysis-workspace__description {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
}

.analysis-workspace__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.analysis-metric {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 10px 12px;
}

.analysis-metric__label {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.analysis-metric__value {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--ink);
}

.analysis-topology {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.analysis-topology__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.analysis-topology__title {
  margin: 0;
  font-size: 0.95rem;
}

.analysis-topology__status {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.analysis-topology__status-label {
  margin-right: 6px;
}

.analysis-topology__sync-note {
  margin: 0;
  font-size: 0.76rem;
  color: #8a5b00;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(217, 119, 6, 0.28);
  border-radius: 6px;
  padding: 6px 8px;
}

.analysis-topology__sync-note-detail {
  display: block;
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 0.7rem;
  color: #7c4a03;
}

.analysis-topology__meta {
  margin: 0;
  font-size: 0.76rem;
  color: var(--muted);
}

.analysis-topology__diagnostics {
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

.analysis-topology__diagnostics-summary {
  margin: 0;
  cursor: pointer;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  list-style: none;
  user-select: none;
}

.analysis-topology__diagnostics-summary::-webkit-details-marker {
  display: none;
}

.analysis-topology__diagnostics-summary::before {
  content: '▸';
  margin-right: 6px;
}

.analysis-topology__diagnostics[open] .analysis-topology__diagnostics-summary::before {
  content: '▾';
}

.analysis-topology__diagnostics-body {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analysis-topology__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.analysis-topology__toggles {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analysis-topology__toggles-title {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.analysis-topology__toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--ink);
}

.analysis-topology__legend {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__legend-title {
  margin: 0 0 2px;
  font-size: 0.78rem;
  color: var(--muted);
}

.analysis-topology__legend-item {
  margin: 0;
  font-size: 0.78rem;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 6px;
}

.analysis-topology__legend-swatch {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.25);
  flex: 0 0 auto;
}

.analysis-topology__legend-swatch--active {
  background: var(--color-topology-legend-active);
}

.analysis-topology__legend-swatch--path {
  background: var(--color-topology-legend-path);
}

.analysis-topology__legend-swatch--spof {
  background: var(--color-topology-legend-spof);
}

.analysis-topology__legend-swatch--selected {
  background: var(--color-topology-legend-selected);
}

.analysis-topology-metric {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  padding: 8px 10px;
}

.analysis-topology-metric__label {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.analysis-topology-metric__value {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ink);
}

.analysis-topology__notes {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__section-title {
  margin: 0 0 2px;
  font-size: 0.78rem;
  color: var(--muted);
}

.analysis-topology__notes-title {
  margin: 0 0 2px;
  font-size: 0.78rem;
  color: var(--muted);
}

.analysis-topology__note {
  margin: 0;
  font-size: 0.77rem;
  line-height: 1.35;
  color: var(--ink);
}

.analysis-topology__error {
  margin: 0;
  color: var(--color-danger-600, #b42318);
  font-size: 0.82rem;
}

.analysis-topology__warnings {
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

.analysis-topology__warnings-title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--muted);
}

.analysis-topology__warning-summary {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
}

.analysis-topology__warning-summary-label {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted);
}

.analysis-topology__warning-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.analysis-topology__warning-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-size: 0.72rem;
  line-height: 1.1;
}

.analysis-topology__warning-chip-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.analysis-topology__warning-chip-count {
  color: var(--muted);
  font-weight: 600;
}

:deep(.analysis-topology__warning-chip.p-button) {
  padding: 0.2rem 0.4rem;
}

:deep(.analysis-topology__warning-chip.p-button .p-button-label) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
}

:deep(.analysis-topology__warning-chip--active.p-button) {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--p-primary-color) 35%, transparent);
}

.analysis-topology__warning-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 6px;
}

.analysis-topology__warning-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__warning-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__warning-item {
  font-size: 0.8rem;
  color: var(--ink);
  line-height: 1.35;
}

.analysis-topology__warning-code {
  color: var(--muted);
  margin-right: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.72rem;
}

.analysis-topology__warning-depth {
  color: var(--muted);
  margin-left: 4px;
}

.analysis-topology__warning-row-id {
  color: var(--muted);
  margin-left: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.72rem;
}

.analysis-topology__warning-row-link {
  padding: 0;
  min-width: auto;
  margin-left: 4px;
  vertical-align: baseline;
}

:deep(.analysis-topology__warning-row-link.p-button .p-button-label) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.72rem;
}

.analysis-topology__warning-recommendation {
  display: block;
  margin-top: 2px;
  color: var(--muted);
}

.analysis-topology__envelope {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analysis-topology__envelope-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.analysis-topology__envelope-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__control-label {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted);
}

.analysis-topology__control-select {
  width: 100%;
}

.analysis-topology__envelope-actions {
  display: flex;
  justify-content: flex-end;
}

.analysis-topology__inspector {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analysis-topology__inspector-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.analysis-topology__inspector-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__path-summary {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analysis-topology__path-summary-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__path-summary-item {
  margin: 0;
}

.analysis-topology__path-summary-button {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--ink);
  text-align: left;
  padding: 0.32rem 0.42rem;
  font-size: 0.73rem;
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.analysis-topology__path-summary-button:hover {
  border-color: color-mix(in srgb, var(--p-primary-color) 35%, var(--line));
}

.analysis-topology__path-summary-button--active {
  border-color: color-mix(in srgb, var(--p-primary-color) 55%, var(--line));
  background: rgba(37, 99, 235, 0.12);
}

.analysis-topology__path-summary-step {
  color: var(--muted);
  min-width: 1.3rem;
}

.analysis-topology__path-summary-kind {
  font-weight: 600;
  text-transform: lowercase;
}

.analysis-topology__path-summary-cost {
  color: var(--muted);
}

.analysis-topology__path-summary-node {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.69rem;
}

.analysis-topology__path-summary-arrow {
  color: var(--muted);
}

.analysis-topology__graph-pane {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analysis-topology__graph-pane--dialog {
  border-top: 0;
  padding-top: 0;
  gap: 8px;
  position: relative;
  height: 100%;
  box-sizing: border-box;
  padding-right: 22px;
  padding-bottom: 22px;
}

.analysis-topology__graph-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__graph-hint {
  margin: 0;
  font-size: 0.76rem;
  color: var(--muted);
}

.analysis-topology__graph-canvas {
  width: 100%;
  height: 340px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
}

.analysis-topology__graph-canvas--dialog {
  min-height: 420px;
  height: min(62vh, 620px);
}

.analysis-topology__graph-lane-headers {
  pointer-events: none;
}

.analysis-topology__graph-lane-header-bg {
  fill: rgba(248, 250, 252, 0.92);
  stroke: rgba(148, 163, 184, 0.75);
  stroke-width: 1;
}

.analysis-topology__graph-lane-header-text {
  fill: #0f172a;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.analysis-topology__graph-edge-tooltip {
  pointer-events: none;
}

.analysis-topology__graph-edge-tooltip-bg {
  fill: rgba(15, 23, 42, 0.96);
  stroke: rgba(148, 163, 184, 0.72);
  stroke-width: 1;
}

.analysis-topology__graph-edge-tooltip-line {
  fill: #f8fafc;
  font-size: 11px;
  font-weight: 500;
}

:deep(.analysis-topology__graph-dialog .p-dialog-content) {
  height: calc(100% - 0.25rem);
  padding-top: 0.5rem;
}

.analysis-topology__graph-resizer {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  border: 0;
  padding: 0;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 0 0 2px 0;
  background: transparent;
  cursor: nwse-resize;
  z-index: 3;
}

.analysis-topology__graph-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analysis-topology__graph-legend-item {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--ink);
}

.analysis-topology__graph-line {
  width: 24px;
  height: 0;
  border-top-width: 2px;
  border-top-style: solid;
  flex: 0 0 auto;
}

.analysis-topology__graph-line--open {
  border-top-color: #475569;
}

.analysis-topology__graph-line--barrier {
  border-top-color: #be123c;
  border-top-style: dashed;
}

.analysis-topology__graph-line--radial {
  border-top-color: #c2410c;
}

.analysis-topology__graph-line--termination {
  border-top-color: #0f766e;
}

:deep(.analysis-topology__envelope-table .p-datatable-table) {
  font-size: 0.75rem;
}

:deep(.analysis-topology__envelope-table .p-datatable-thead > tr > th),
:deep(.analysis-topology__envelope-table .p-datatable-tbody > tr > td) {
  padding: 0.35rem 0.4rem;
}

:deep(.analysis-topology__envelope-table .p-datatable-tbody > tr) {
  cursor: pointer;
}

:deep(.analysis-topology__envelope-table .analysis-topology__envelope-row--selected > td) {
  background: rgba(37, 99, 235, 0.12);
}

:deep(.analysis-topology__inspector-table .p-datatable-table) {
  font-size: 0.74rem;
}

:deep(.analysis-topology__inspector-table .p-datatable-thead > tr > th),
:deep(.analysis-topology__inspector-table .p-datatable-tbody > tr > td) {
  padding: 0.32rem 0.38rem;
}

:deep(.analysis-topology__inspector-table .p-datatable-tbody > tr) {
  cursor: pointer;
}

:deep(.analysis-topology__inspector-table .analysis-topology__inspector-row--selected > td) {
  background: rgba(37, 99, 235, 0.12);
}

.analysis-workspace__canvas {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

@media (max-width: 991px) {
  .analysis-workspace {
    min-height: auto;
    height: auto;
  }

  .analysis-workspace__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-topology__envelope-controls {
    grid-template-columns: 1fr;
  }

  .analysis-topology__warning-controls {
    grid-template-columns: 1fr;
  }

  .analysis-topology__inspector-controls {
    grid-template-columns: 1fr;
  }

  .analysis-topology__graph-canvas {
    height: 280px;
  }

  .analysis-topology__graph-canvas--dialog {
    min-height: 300px;
    height: min(58vh, 440px);
  }
}
</style>
