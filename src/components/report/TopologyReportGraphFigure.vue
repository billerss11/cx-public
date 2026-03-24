<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';

defineOptions({ name: 'TopologyReportGraphFigure' });

const props = defineProps({
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
  }
});

const emit = defineEmits(['svg-ready']);

const svgRef = ref(null);
const NODE_RADIUS = 14;
const SURFACE_NODE_RADIUS = 16;
const HEADER_WIDTH = 160;
const HEADER_HEIGHT = 28;
const BOUNDS_PADDING = 48;

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveNodeRadius(node = {}) {
  return String(node?.kind ?? '').trim() === 'SURFACE'
    ? SURFACE_NODE_RADIUS
    : NODE_RADIUS;
}

const nodeEntries = computed(() => {
  const layouts = props.graph?.layouts?.nodes ?? {};
  return Object.entries(props.graph?.nodes ?? {})
    .map(([nodeId, node]) => ({
      nodeId,
      node,
      layout: layouts[nodeId] ?? null
    }))
    .filter(({ layout }) => (
      Number.isFinite(Number(layout?.x)) && Number.isFinite(Number(layout?.y))
    ));
});

const edgeEntries = computed(() => {
  const nodesById = new Map(nodeEntries.value.map((entry) => [entry.nodeId, entry]));
  return Object.entries(props.graph?.edges ?? {})
    .map(([edgeId, edge]) => ({
      edgeId,
      edge,
      sourceNode: nodesById.get(String(edge?.source ?? '').trim()) ?? null,
      targetNode: nodesById.get(String(edge?.target ?? '').trim()) ?? null
    }))
    .filter((entry) => entry.sourceNode && entry.targetNode);
});

const laneGuideEntries = computed(() => (
  Array.isArray(props.graph?.laneGuides) ? props.graph.laneGuides : []
));

const laneHeaderEntries = computed(() => (
  Array.isArray(props.graph?.laneHeaders) ? props.graph.laneHeaders : []
));

const svgBounds = computed(() => {
  const xs = [];
  const ys = [];

  nodeEntries.value.forEach(({ node, layout }) => {
    const radius = resolveNodeRadius(node);
    xs.push(Number(layout.x) - radius, Number(layout.x) + radius);
    ys.push(Number(layout.y) - radius, Number(layout.y) + radius + 44);
  });

  laneGuideEntries.value.forEach((guide) => {
    const x = toFiniteNumber(guide?.x);
    const y = toFiniteNumber(guide?.y);
    const width = toFiniteNumber(guide?.width);
    const height = toFiniteNumber(guide?.height);
    if (!x || !y || !width || !height) return;
    xs.push(x - (width / 2), x + (width / 2));
    ys.push(y, y + height);
  });

  laneHeaderEntries.value.forEach((header) => {
    const x = toFiniteNumber(header?.x);
    const y = toFiniteNumber(header?.y);
    if (!x || !y) return;
    xs.push(x - (HEADER_WIDTH / 2), x + (HEADER_WIDTH / 2));
    ys.push(y - (HEADER_HEIGHT / 2), y + (HEADER_HEIGHT / 2));
  });

  if (xs.length === 0 || ys.length === 0) {
    return {
      minX: 0,
      minY: 0,
      width: 640,
      height: 360
    };
  }

  const minX = Math.min(...xs) - BOUNDS_PADDING;
  const minY = Math.min(...ys) - BOUNDS_PADDING;
  const maxX = Math.max(...xs) + BOUNDS_PADDING;
  const maxY = Math.max(...ys) + BOUNDS_PADDING;

  return {
    minX,
    minY,
    width: Math.max(640, maxX - minX),
    height: Math.max(360, maxY - minY)
  };
});

const viewBox = computed(() => (
  `${svgBounds.value.minX} ${svgBounds.value.minY} ${svgBounds.value.width} ${svgBounds.value.height}`
));

async function emitSvgReady() {
  await nextTick();
  if (svgRef.value) {
    emit('svg-ready', svgRef.value);
  }
}

onMounted(() => {
  void emitSvgReady();
});

watch(() => props.graph, () => {
  void emitSvgReady();
}, { deep: true });
</script>

<template>
  <svg
    ref="svgRef"
    class="topology-report-graph"
    :width="svgBounds.width"
    :height="svgBounds.height"
    :viewBox="viewBox"
    role="img"
    aria-label="Topology graph report figure"
  >
    <g class="topology-report-graph__lane-guides" aria-hidden="true">
      <g
        v-for="guide in laneGuideEntries"
        :key="`guide-${guide.kind}`"
        :transform="`translate(${guide.x} ${guide.y})`"
      >
        <rect
          class="topology-report-graph__lane-guide"
          :x="-(Number(guide.width) / 2)"
          y="0"
          :width="guide.width"
          :height="guide.height"
          rx="12"
          ry="12"
        />
      </g>
    </g>

    <g class="topology-report-graph__edges">
      <line
        v-for="entry in edgeEntries"
        :key="entry.edgeId"
        class="topology-report-graph__edge"
        :x1="entry.sourceNode.layout.x"
        :y1="entry.sourceNode.layout.y"
        :x2="entry.targetNode.layout.x"
        :y2="entry.targetNode.layout.y"
        :stroke="entry.edge.tone || 'var(--color-analysis-graph-line-open, #4f6b81)'"
        :stroke-dasharray="entry.edge.dasharray || 0"
      />
    </g>

    <g class="topology-report-graph__nodes">
      <g
        v-for="entry in nodeEntries"
        :key="entry.nodeId"
        class="topology-report-graph__node"
        :transform="`translate(${entry.layout.x} ${entry.layout.y})`"
      >
        <circle
          class="topology-report-graph__node-circle"
          :r="resolveNodeRadius(entry.node)"
          :fill="entry.node.tone || 'var(--color-analysis-graph-node-default, #3f6a8a)'"
        />
        <text
          class="topology-report-graph__node-label"
          x="0"
          y="30"
          text-anchor="middle"
        >
          {{ entry.node.displayLabel || entry.nodeId }}
        </text>
      </g>
    </g>

    <g class="topology-report-graph__lane-headers" aria-hidden="true">
      <g
        v-for="header in laneHeaderEntries"
        :key="`header-${header.kind}`"
        :transform="`translate(${header.x} ${header.y})`"
      >
        <rect
          class="topology-report-graph__lane-header-bg"
          :x="-(HEADER_WIDTH / 2)"
          :y="-(HEADER_HEIGHT / 2)"
          :width="HEADER_WIDTH"
          :height="HEADER_HEIGHT"
          rx="6"
          ry="6"
        />
        <text
          class="topology-report-graph__lane-header-text"
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {{ header.label }}
        </text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.topology-report-graph {
  display: block;
}

.topology-report-graph__lane-guide {
  fill: color-mix(in srgb, var(--color-analysis-graph-lane-header-fill, #dce7ef) 60%, transparent);
  stroke: color-mix(in srgb, var(--color-analysis-graph-lane-header-stroke, #88a1b5) 85%, transparent);
  stroke-width: 1;
}

.topology-report-graph__edge {
  fill: none;
  stroke-width: 2.5;
}

.topology-report-graph__node-circle {
  stroke: var(--color-analysis-graph-node-stroke, #17324d);
  stroke-width: 1.2;
}

.topology-report-graph__node-label {
  fill: var(--color-analysis-graph-node-label-text, #172b3a);
  font-size: 12px;
  font-weight: 600;
}

.topology-report-graph__lane-header-bg {
  fill: var(--color-analysis-graph-lane-header-fill, #dce7ef);
  stroke: var(--color-analysis-graph-lane-header-stroke, #88a1b5);
  stroke-width: 1;
}

.topology-report-graph__lane-header-text {
  fill: var(--color-analysis-graph-lane-header-text, #17324d);
  font-size: 11px;
  font-weight: 700;
}
</style>
