<script setup>
defineOptions({ name: 'TopologyGraphDebugDialog' });

import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, ref, watch } from 'vue';
import Select from 'primevue/select';
import { VNetworkGraph, defineConfigs } from 'v-network-graph';
import 'v-network-graph/lib/style.css';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  scope: {
    type: String,
    default: 'min_path'
  },
  scopeOptions: {
    type: Array,
    default: () => []
  },
  graph: {
    type: Object,
    default: () => ({
      nodes: {},
      edges: {},
      layouts: { nodes: {} },
      laneHeaders: [],
      laneGuides: [],
      nodeCount: 0,
      edgeCount: 0
    })
  },
  selectedNodeIds: {
    type: Array,
    default: () => []
  },
  selectedEdgeIds: {
    type: Array,
    default: () => []
  },
  requiresBarrierSelection: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:visible',
  'update:scope',
  'node-click',
  'edge-click'
]);

const topologyGraphLayers = Object.freeze({
  'lane-guides': 'base',
  'lane-headers': 'base'
});
const TOPOLOGY_GRAPH_MIN_WIDTH = 520;
const TOPOLOGY_GRAPH_MIN_HEIGHT = 360;
const TOPOLOGY_GRAPH_DEFAULT_WIDTH = 1180;
const TOPOLOGY_GRAPH_DEFAULT_HEIGHT = 820;
const TOPOLOGY_GRAPH_EDGE_TOOLTIP_WRAP_LIMIT = 52;

const isNodeDragActive = ref(false);

const topologyGraphConfigs = computed(() => defineConfigs({
  view: {
    autoPanAndZoomOnLoad: 'fit-content',
    fitContentMargin: {
      top: 48,
      left: 72,
      right: 72,
      bottom: 36
    },
    panEnabled: true,
    zoomEnabled: true,
    mouseWheelZoomEnabled: true,
    doubleClickZoomEnabled: false,
    minZoomLevel: 0.18,
    maxZoomLevel: 8,
    grid: {
      visible: false
    }
  },
  node: {
    draggable: true,
    selectable: true,
    normal: {
      type: 'circle',
      radius: (node) => (node?.kind === 'SURFACE' ? 15 : 13),
      color: (node) => String(node?.tone ?? 'var(--color-analysis-graph-node-default)'),
      strokeColor: 'var(--color-analysis-graph-node-stroke)',
      strokeWidth: 1
    },
    hover: {
      type: 'circle',
      radius: (node) => (node?.kind === 'SURFACE' ? 15 : 13),
      color: 'var(--color-analysis-graph-node-hover-fill)',
      strokeColor: 'var(--color-analysis-graph-node-hover-stroke)',
      strokeWidth: 1.4
    },
    selected: {
      type: 'circle',
      radius: (node) => (node?.kind === 'SURFACE' ? 15 : 13),
      color: 'var(--color-analysis-graph-node-selected-fill)',
      strokeColor: 'var(--color-analysis-graph-node-selected-stroke)',
      strokeWidth: 2
    },
    label: {
      visible: !isNodeDragActive.value,
      text: (node) => String(node?.displayLabel ?? node?.name ?? ''),
      color: 'var(--color-analysis-graph-node-label-text)',
      fontSize: 9,
      lineHeight: 1.05,
      direction: 'east',
      directionAutoAdjustment: false,
      margin: 8,
      background: {
        visible: true,
        color: 'var(--color-analysis-graph-node-label-bg)',
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
      color: (edge) => String(edge?.tone ?? 'var(--color-analysis-graph-edge-default)'),
      dasharray: (edge) => edge?.dasharray ?? 0,
      animate: false,
      animationSpeed: 50
    },
    selected: {
      width: 3.2,
      color: 'var(--color-analysis-graph-edge-selected)',
      dasharray: 0,
      animate: false,
      animationSpeed: 50
    },
    label: {
      visible: false,
      text: (edge) => String(edge?.displayLabel ?? ''),
      color: 'var(--color-analysis-graph-edge-label-text)',
      fontSize: 9,
      lineHeight: 1.02,
      margin: 4,
      padding: 3,
      background: {
        visible: true,
        color: 'var(--color-analysis-graph-edge-label-bg)',
        borderRadius: 3
      }
    }
  }
}));

const graphRef = ref(null);
const localLayouts = shallowRef({ nodes: {} });
const localZoomLevel = ref(1);
let detachWindowResizeListener = null;

const {
  dialogSize,
  reconcileDialogSize,
  resizeDialogBy,
  startDialogResize,
  stopDialogResize
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
  width: `${dialogSize.value.width}px`,
  height: `${dialogSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '88vh'
}));

function cloneGraphLayouts(layouts = {}) {
  const nodes = Object.fromEntries(
    Object.entries(layouts?.nodes ?? {}).map(([nodeId, layout]) => ([nodeId, {
      x: Number(layout?.x),
      y: Number(layout?.y),
      fixed: layout?.fixed !== false
    }]))
  );
  return { nodes };
}

const selectedScopeOption = computed(() => (
  props.scopeOptions.find((option) => option?.value === props.scope) ?? props.scopeOptions[0] ?? null
));

const topologyGraphHasData = computed(() => (
  Number(props.graph?.nodeCount ?? 0) > 0 && Number(props.graph?.edgeCount ?? 0) > 0
));

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

const selectedGraphEdgeHoverLines = computed(() => {
  const selectedEdgeId = String(props.selectedEdgeIds?.[0] ?? '').trim();
  if (!selectedEdgeId) return [];
  const edge = props.graph?.edges?.[selectedEdgeId] ?? null;
  if (!edge) return [];
  const sourceLines = Array.isArray(edge?.detailLines)
    ? edge.detailLines
    : (Array.isArray(edge?.tooltipLines) ? edge.tooltipLines : []);
  return sourceLines.flatMap((line) => wrapTopologyGraphTooltipLine(line));
});

const selectedGraphDetail = computed(() => {
  const selectedEdgeId = String(props.selectedEdgeIds?.[0] ?? '').trim();
  if (selectedEdgeId) {
    const edge = props.graph?.edges?.[selectedEdgeId] ?? null;
    if (edge) {
      return {
        type: 'edge',
        titleKey: 'ui.analysis.topology.graph.detail.selected_edge',
        title: 'Selected edge',
        lines: Array.isArray(edge?.detailLines) ? edge.detailLines : []
      };
    }
  }

  const selectedNodeId = String(props.selectedNodeIds?.[0] ?? '').trim();
  if (selectedNodeId) {
    const node = props.graph?.nodes?.[selectedNodeId] ?? null;
    if (node) {
      return {
        type: 'node',
        titleKey: 'ui.analysis.topology.graph.detail.selected_node',
        title: 'Selected node',
        lines: Array.isArray(node?.detailLines) ? node.detailLines : []
      };
    }
  }

  return {
    type: 'empty',
    titleKey: 'ui.analysis.topology.graph.detail.empty',
    title: 'Selection details',
    lines: ['Click a node or edge to inspect details.']
  };
});

async function fitGraphToContents() {
  await graphRef.value?.fitToContents?.();
}

async function restoreGraphView() {
  localLayouts.value = cloneGraphLayouts(props.graph?.layouts ?? {});
  localZoomLevel.value = 1;
  await nextTick();
  await fitGraphToContents();
}

async function handleFitGraphClick() {
  await fitGraphToContents();
}

async function handleResetLayoutClick() {
  localLayouts.value = cloneGraphLayouts(props.graph?.layouts ?? {});
  await nextTick();
  await fitGraphToContents();
}

async function handleResetZoomClick() {
  localZoomLevel.value = 1;
  await nextTick();
  await graphRef.value?.panToCenter?.();
}

function handleGraphLayoutsUpdate(nextLayouts = {}) {
  localLayouts.value = nextLayouts ?? { nodes: {} };
}

function handleGraphZoomLevelUpdate(nextZoomLevel) {
  const numericZoomLevel = Number(nextZoomLevel);
  if (!Number.isFinite(numericZoomLevel)) return;
  localZoomLevel.value = numericZoomLevel;
}

function handleNodeClick(nodeId) {
  const safeNodeId = String(nodeId ?? '').trim();
  if (!safeNodeId) return;
  emit('node-click', safeNodeId);
}

function handleEdgeClick(edgeId) {
  const safeEdgeId = String(edgeId ?? '').trim();
  if (!safeEdgeId) return;
  emit('edge-click', safeEdgeId);
}

function handleNodeDragStart() {
  isNodeDragActive.value = true;
}

function handleNodeDragEnd() {
  isNodeDragActive.value = false;
}

function handleTopologyGraphResizerKeydown(event) {
  const key = String(event?.key ?? '');
  const step = event?.shiftKey === true ? 36 : 18;
  if (key === 'ArrowRight') {
    event.preventDefault();
    resizeDialogBy(step, 0);
    return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    resizeDialogBy(-step, 0);
    return;
  }
  if (key === 'ArrowDown') {
    event.preventDefault();
    resizeDialogBy(0, step);
    return;
  }
  if (key === 'ArrowUp') {
    event.preventDefault();
    resizeDialogBy(0, -step);
  }
}

onMounted(() => {
  reconcileDialogSize();
  const handleResize = () => {
    reconcileDialogSize();
  };
  window.addEventListener('resize', handleResize);
  detachWindowResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
});

watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    stopDialogResize();
    return;
  }
  void restoreGraphView();
}, { immediate: true });

watch(() => props.graph, () => {
  if (!props.visible) return;
  void restoreGraphView();
});

onBeforeUnmount(() => {
  detachWindowResizeListener?.();
  detachWindowResizeListener = null;
});
</script>

<template>
  <Dialog
    :visible="visible"
    data-vue-owned="true"
    class="analysis-topology__graph-dialog"
    :modal="false"
    :draggable="true"
    :maximizable="true"
    :style="topologyGraphDialogStyle"
    :breakpoints="{ '1200px': '94vw', '768px': '98vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <span data-i18n="ui.analysis.topology.graph.title">Topology graph debug pane</span>
    </template>

    <div class="analysis-topology__graph-pane analysis-topology__graph-pane--dialog">
      <p class="analysis-topology__meta" data-i18n="ui.analysis.topology.graph.description">
        Fixed-lane graph view for explainability. Click a node or edge to sync selection with inspector and overlay.
      </p>

      <section class="analysis-topology__graph-toolbar">
        <div class="analysis-topology__graph-toolbar-row">
          <div class="analysis-topology__graph-controls">
            <label class="analysis-topology__control-label" data-i18n="ui.analysis.topology.graph.scope.label">
              Graph scope:
            </label>
            <Select
              :model-value="scope"
              :options="scopeOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="analysis-topology__control-select"
              @update:model-value="emit('update:scope', $event)"
            >
              <template #value="slotProps">
                <span v-if="selectedScopeOption" :data-i18n="selectedScopeOption.i18nKey">
                  {{ selectedScopeOption.label }}
                </span>
                <span v-else>{{ slotProps.placeholder }}</span>
              </template>
              <template #option="slotProps">
                <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
              </template>
            </Select>
          </div>

          <div class="analysis-topology__graph-actions">
            <Button data-test="topology-graph-fit" size="small" outlined @click="handleFitGraphClick">
              <span data-i18n="ui.analysis.topology.graph.controls.fit">Fit graph</span>
            </Button>
            <Button data-test="topology-graph-reset-layout" size="small" outlined @click="handleResetLayoutClick">
              <span data-i18n="ui.analysis.topology.graph.controls.reset_layout">Reset layout</span>
            </Button>
            <Button data-test="topology-graph-reset-zoom" size="small" outlined @click="handleResetZoomClick">
              <span data-i18n="ui.analysis.topology.graph.controls.reset_zoom">Reset zoom</span>
            </Button>
          </div>
        </div>

        <div class="analysis-topology__graph-toolbar-row analysis-topology__graph-toolbar-row--meta">
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.graph.visible_nodes">Graph nodes:</span>
            <span>{{ graph.nodeCount }}</span>
          </p>
          <p class="analysis-topology__meta">
            <span data-i18n="ui.analysis.topology.graph.visible_edges">Graph edges:</span>
            <span>{{ graph.edgeCount }}</span>
          </p>
        </div>

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
      </section>

      <div class="analysis-topology__graph-detail-card">
        <p class="analysis-topology__graph-detail-title" :data-i18n="selectedGraphDetail.titleKey">
          {{ selectedGraphDetail.title }}
        </p>
        <p
          v-for="(line, lineIndex) in selectedGraphDetail.lines"
          :key="`topology-graph-detail-${lineIndex}`"
          class="analysis-topology__graph-detail-line"
        >
          {{ line }}
        </p>
      </div>

      <p
        v-if="requiresBarrierSelection"
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
      <div
        v-else
        :class="[
          'analysis-topology__graph-canvas-shell',
          { 'analysis-topology__graph-canvas-shell--dragging': isNodeDragActive }
        ]"
      >
        <VNetworkGraph
          ref="graphRef"
          class="analysis-topology__graph-canvas analysis-topology__graph-canvas--dialog"
          :nodes="graph.nodes"
          :edges="graph.edges"
          :layouts="localLayouts"
          :zoom-level="localZoomLevel"
          :configs="topologyGraphConfigs"
          :layers="topologyGraphLayers"
          :selected-nodes="selectedNodeIds"
          :selected-edges="selectedEdgeIds"
          :event-handlers="{
            'node:click': (payload) => handleNodeClick(payload?.node),
            'node:dragstart': handleNodeDragStart,
            'node:dragend': handleNodeDragEnd,
            'node:pointerup': handleNodeDragEnd,
            'edge:click': (payload) => handleEdgeClick(payload?.edge ?? payload?.edges?.[0])
          }"
          @update:layouts="handleGraphLayoutsUpdate"
          @update:zoomLevel="handleGraphZoomLevelUpdate"
        >
          <template #lane-guides>
            <g class="analysis-topology__graph-lane-guides" aria-hidden="true">
              <g
                v-for="laneGuide in graph.laneGuides"
                :key="`topology-lane-guide-${laneGuide.kind}`"
                :transform="`translate(${laneGuide.x} ${laneGuide.y})`"
              >
                <rect
                  class="analysis-topology__graph-lane-guide-rect"
                  :x="-laneGuide.width / 2"
                  y="0"
                  :width="laneGuide.width"
                  :height="laneGuide.height"
                  rx="12"
                  ry="12"
                />
              </g>
            </g>
          </template>

          <template #lane-headers>
            <g class="analysis-topology__graph-lane-headers" aria-hidden="true">
              <g
                v-for="laneHeader in graph.laneHeaders"
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
        </VNetworkGraph>
        <div v-if="selectedGraphEdgeHoverLines.length > 0" class="analysis-topology__graph-hover-detail">
          <p
            v-for="(line, lineIndex) in selectedGraphEdgeHoverLines"
            :key="`topology-edge-hover-line-${lineIndex}`"
            class="analysis-topology__graph-hover-detail-line"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="analysis-topology__graph-resizer"
        aria-label="Resize topology graph dialog"
        @keydown="handleTopologyGraphResizerKeydown"
        @pointerdown="startDialogResize"
      ></button>
    </div>
  </Dialog>
</template>

<style scoped>
.analysis-topology__meta {
  margin: 0;
  font-size: 0.76rem;
  color: var(--muted);
}

.analysis-topology__graph-pane {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analysis-topology__graph-pane--dialog {
  border-top: 0;
  padding-top: 0;
  position: relative;
  height: 100%;
  box-sizing: border-box;
  padding-right: 22px;
  padding-bottom: 22px;
}

.analysis-topology__graph-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-analysis-graph-node-label-bg) 84%, transparent);
}

.analysis-topology__graph-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 12px;
}

.analysis-topology__graph-toolbar-row--meta {
  justify-content: flex-start;
}

.analysis-topology__graph-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: min(100%, 320px);
}

.analysis-topology__graph-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.analysis-topology__graph-detail-card {
  padding: 10px 12px;
  border: 1px solid var(--color-analysis-graph-hover-border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-analysis-graph-node-label-bg) 92%, transparent);
}

.analysis-topology__graph-detail-title {
  margin: 0 0 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink);
}

.analysis-topology__graph-detail-line {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.35;
  color: var(--muted);
}

.analysis-topology__graph-detail-line + .analysis-topology__graph-detail-line {
  margin-top: 2px;
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
  background: linear-gradient(
    180deg,
    var(--color-analysis-graph-canvas-start),
    var(--color-analysis-graph-canvas-end)
  );
}

.analysis-topology__graph-canvas--dialog {
  min-height: 420px;
  height: min(58vh, 620px);
}

.analysis-topology__graph-canvas-shell {
  position: relative;
  width: 100%;
  min-height: 0;
}

.analysis-topology__graph-canvas-shell--dragging {
  cursor: grabbing;
}

.analysis-topology__graph-canvas-shell--dragging :deep(.v-ng-node-label),
.analysis-topology__graph-canvas-shell--dragging :deep(.v-ng-edge-label) {
  display: none;
}

.analysis-topology__graph-hover-detail {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  max-width: min(420px, 48%);
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--color-analysis-graph-hover-border);
  border-radius: var(--radius-sm);
  background: var(--color-analysis-graph-hover-bg);
  pointer-events: none;
}

.analysis-topology__graph-hover-detail-line {
  margin: 0;
  color: var(--color-analysis-graph-hover-text);
  font-size: 0.73rem;
  line-height: 1.35;
}

.analysis-topology__graph-hover-detail-line + .analysis-topology__graph-hover-detail-line {
  margin-top: 2px;
}

.analysis-topology__graph-lane-guides,
.analysis-topology__graph-lane-headers {
  pointer-events: none;
}

.analysis-topology__graph-lane-guide-rect {
  fill: color-mix(in srgb, var(--color-analysis-graph-lane-header-fill) 58%, transparent);
  stroke: color-mix(in srgb, var(--color-analysis-graph-lane-header-stroke) 92%, transparent);
  stroke-width: 1;
}

.analysis-topology__graph-lane-header-bg {
  fill: var(--color-analysis-graph-lane-header-fill);
  stroke: var(--color-analysis-graph-lane-header-stroke);
  stroke-width: 1;
}

.analysis-topology__graph-lane-header-text {
  fill: var(--color-analysis-graph-lane-header-text);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
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
  flex-wrap: wrap;
  gap: 6px 16px;
}

.analysis-topology__graph-legend-item {
  margin: 0;
  display: inline-flex;
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
  border-top-color: var(--color-analysis-graph-line-open);
}

.analysis-topology__graph-line--barrier {
  border-top-color: var(--color-analysis-graph-line-barrier);
  border-top-style: dashed;
}

.analysis-topology__graph-line--radial {
  border-top-color: var(--color-analysis-graph-line-radial);
}

.analysis-topology__graph-line--termination {
  border-top-color: var(--color-analysis-graph-line-termination);
}

@media (max-width: 768px) {
  .analysis-topology__graph-actions {
    justify-content: flex-start;
  }

  .analysis-topology__graph-canvas--dialog {
    min-height: 360px;
    height: min(54vh, 520px);
  }

  .analysis-topology__graph-hover-detail {
    top: 8px;
    right: 8px;
    max-width: calc(100% - 16px);
  }
}
</style>
