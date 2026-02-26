<script setup>
import { computed } from 'vue';
import {
  TRACKED_VOLUME_NODE_KINDS,
  buildHighlightNodeSets,
  isFiniteRange,
  nearlyEqual,
  mergeContiguousDepthSpans,
  rangesOverlap,
  resolveNodeLayer,
  resolveTopologyOverlayStyle
} from './topologyOverlayShared.js';

const props = defineProps({
  slices: {
    type: Array,
    default: () => []
  },
  topologyResult: {
    type: Object,
    default: null
  },
  xScale: {
    type: Function,
    required: true
  },
  yScale: {
    type: Function,
    required: true
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  showActiveFlow: {
    type: Boolean,
    default: true
  },
  showMinCostPath: {
    type: Boolean,
    default: true
  },
  showSpof: {
    type: Boolean,
    default: true
  },
  selectedNodeIds: {
    type: Array,
    default: () => []
  }
});

function resolveOverlayStyle(nodeId, sets) {
  const isSelected = sets.selectedNodeIds.has(nodeId);
  const isSpof = props.showSpof !== false && sets.spofNodeIds.has(nodeId);
  const isPath = props.showMinCostPath !== false && sets.pathNodeIds.has(nodeId);
  const isActive = props.showActiveFlow !== false && sets.activeNodeIds.has(nodeId);
  return resolveTopologyOverlayStyle({ isSelected, isSpof, isPath, isActive });
}

const overlaySegments = computed(() => {
  const result = props.topologyResult && typeof props.topologyResult === 'object'
    ? props.topologyResult
    : null;
  if (!result) return [];

  const nodes = Array.isArray(result.nodes) ? result.nodes : [];
  const trackedNodes = nodes.filter((node) => (
    TRACKED_VOLUME_NODE_KINDS.includes(node?.kind)
    && isFiniteRange(node?.depthTop, node?.depthBottom)
  ));
  if (trackedNodes.length === 0) return [];

  const sets = buildHighlightNodeSets(result, props.selectedNodeIds);
  if (sets.highlightedNodeIds.size === 0) return [];

  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  const rawSegments = [];
  const slices = Array.isArray(props.slices) ? props.slices : [];

  slices.forEach((slice, sliceIndex) => {
    const top = Number(slice?.top);
    const bottom = Number(slice?.bottom);
    if (!isFiniteRange(top, bottom)) return;

    const sliceNodes = trackedNodes.filter((node) => (
      rangesOverlap(node.depthTop, node.depthBottom, top, bottom)
    ));
    sliceNodes.forEach((node, nodeIndex) => {
      if (!sets.highlightedNodeIds.has(node.nodeId)) return;

      const layer = resolveNodeLayer(node, Array.isArray(slice?.stack) ? slice.stack : []);
      if (!layer) return;

      const inner = Number(layer?.innerRadius);
      const outer = Number(layer?.outerRadius);
      if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner) return;

      const style = resolveOverlayStyle(node.nodeId, sets);
      if (!style) return;

      const clippedTop = Math.max(top, Number(node.depthTop));
      const clippedBottom = Math.min(bottom, Number(node.depthBottom));
      if (!isFiniteRange(clippedTop, clippedBottom)) return;

      const innerScaled = inner * diameterScale;
      const outerScaled = outer * diameterScale;
      const leftOuterX = props.xScale(-outerScaled);
      const leftInnerX = props.xScale(-innerScaled);
      const rightInnerX = props.xScale(innerScaled);
      const rightOuterX = props.xScale(outerScaled);
      const spansCenter = nearlyEqual(innerScaled, 0);

      if (spansCenter) {
        const fullWidth = rightOuterX - leftOuterX;
        if (fullWidth <= 0) return;

        rawSegments.push({
          id: `topology-${sliceIndex}-${nodeIndex}-center`,
          side: 'center',
          top: clippedTop,
          bottom: clippedBottom,
          x: leftOuterX,
          width: fullWidth,
          fill: style.fill,
          stroke: style.stroke
        });
        return;
      }

      const widthLeft = leftInnerX - leftOuterX;
      const widthRight = rightOuterX - rightInnerX;
      if (widthLeft <= 0 || widthRight <= 0) return;

      rawSegments.push({
        id: `topology-${sliceIndex}-${nodeIndex}-left`,
        side: 'left',
        top: clippedTop,
        bottom: clippedBottom,
        x: leftOuterX,
        width: widthLeft,
        fill: style.fill,
        stroke: style.stroke
      });
      rawSegments.push({
        id: `topology-${sliceIndex}-${nodeIndex}-right`,
        side: 'right',
        top: clippedTop,
        bottom: clippedBottom,
        x: rightInnerX,
        width: widthRight,
        fill: style.fill,
        stroke: style.stroke
      });
    });
  });

  const mergedSegments = mergeContiguousDepthSpans(
    rawSegments,
    (entry) => [
      entry.side,
      Number(entry.x).toFixed(6),
      Number(entry.width).toFixed(6),
      String(entry.fill ?? ''),
      String(entry.stroke ?? '')
    ].join('|')
  );

  return mergedSegments
    .map((segment, index) => {
      const yTop = props.yScale(segment.top);
      const yBottom = props.yScale(segment.bottom);
      const height = yBottom - yTop;
      if (!Number.isFinite(yTop) || !Number.isFinite(yBottom) || height <= 0) return null;

      return {
        id: `topology-merged-${index}`,
        x: segment.x,
        y: yTop,
        width: segment.width,
        height,
        fill: segment.fill,
        stroke: segment.stroke
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="topology-overlay-layer" aria-hidden="true">
    <rect
      v-for="segment in overlaySegments"
      :key="segment.id"
      class="topology-overlay-layer__segment"
      :x="segment.x"
      :y="segment.y"
      :width="segment.width"
      :height="segment.height"
      :fill="segment.fill"
      :stroke="segment.stroke"
    />
  </g>
</template>

<style scoped>
.topology-overlay-layer__segment {
  pointer-events: none;
  stroke-width: 0.8px;
}
</style>
