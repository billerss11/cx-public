<script setup>
import { computed } from 'vue';
import { buildMDSamples } from './directionalProjection.js';
import {
  TRACKED_VOLUME_NODE_KINDS,
  buildHighlightNodeSets,
  isFiniteRange,
  mergeContiguousDepthSpans,
  nearlyEqual,
  rangesOverlap,
  resolveNodeLayer,
  resolveTopologyOverlayStyle
} from './topologyOverlayShared.js';

const EPSILON = 1e-4;

const props = defineProps({
  intervals: {
    type: Array,
    default: () => []
  },
  topologyResult: {
    type: Object,
    default: null
  },
  projector: {
    type: Function,
    default: null
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  sampleStepMd: {
    type: Number,
    default: 20
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

function isFinitePoint(point) {
  return Array.isArray(point)
    && point.length >= 2
    && Number.isFinite(Number(point[0]))
    && Number.isFinite(Number(point[1]));
}

function resolveOverlayStyle(nodeId, sets) {
  const isSelected = sets.selectedNodeIds.has(nodeId);
  const isSpof = props.showSpof !== false && sets.spofNodeIds.has(nodeId);
  const isPath = props.showMinCostPath !== false && sets.pathNodeIds.has(nodeId);
  const isActive = props.showActiveFlow !== false && sets.activeNodeIds.has(nodeId);
  return resolveTopologyOverlayStyle({ isSelected, isSpof, isPath, isActive });
}

function buildOverlayPolygon(projector, top, bottom, innerRadius, outerRadius, sideSign, sampleStepMd = 20) {
  const sampleMds = buildMDSamples(top, bottom, sampleStepMd);
  if (sampleMds.length < 2) return null;

  if (nearlyEqual(sideSign, 0, EPSILON)) {
    const leftBoundaryPoints = sampleMds
      .map((md) => projector(md, -outerRadius))
      .filter((point) => isFinitePoint(point));
    const rightBoundaryPoints = [...sampleMds]
      .reverse()
      .map((md) => projector(md, outerRadius))
      .filter((point) => isFinitePoint(point));

    if (leftBoundaryPoints.length < 2 || rightBoundaryPoints.length < 2) return null;
    const points = [...leftBoundaryPoints, ...rightBoundaryPoints];
    if (points.length < 4) return null;
    return points.map((point) => point.join(',')).join(' ');
  }

  const outerPoints = sampleMds
    .map((md) => projector(md, sideSign * outerRadius))
    .filter((point) => isFinitePoint(point));
  const innerPoints = [...sampleMds]
    .reverse()
    .map((md) => projector(md, sideSign * innerRadius))
    .filter((point) => isFinitePoint(point));

  if (outerPoints.length < 2 || innerPoints.length < 2) return null;
  const points = [...outerPoints, ...innerPoints];
  if (points.length < 4) return null;
  return points.map((point) => point.join(',')).join(' ');
}

const overlayPolygons = computed(() => {
  const result = props.topologyResult && typeof props.topologyResult === 'object'
    ? props.topologyResult
    : null;
  const projector = typeof props.projector === 'function' ? props.projector : null;
  if (!result || !projector) return [];

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
  const sampleStepMd = Number.isFinite(Number(props.sampleStepMd)) && Number(props.sampleStepMd) > EPSILON
    ? Number(props.sampleStepMd)
    : 20;
  const intervals = Array.isArray(props.intervals) ? props.intervals : [];
  const rawEntries = [];

  intervals.forEach((interval, intervalIndex) => {
    const top = Number(interval?.top);
    const bottom = Number(interval?.bottom);
    if (!isFiniteRange(top, bottom)) return;

    const intervalNodes = trackedNodes.filter((node) => (
      rangesOverlap(node.depthTop, node.depthBottom, top, bottom)
    ));
    intervalNodes.forEach((node, nodeIndex) => {
      if (!sets.highlightedNodeIds.has(node.nodeId)) return;

      const layer = resolveNodeLayer(node, Array.isArray(interval?.stack) ? interval.stack : []);
      if (!layer) return;

      const inner = Number(layer?.innerRadius) * diameterScale;
      const outer = Number(layer?.outerRadius) * diameterScale;
      if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner) return;

      const style = resolveOverlayStyle(node.nodeId, sets);
      if (!style) return;

      const clippedTop = Math.max(top, Number(node.depthTop));
      const clippedBottom = Math.min(bottom, Number(node.depthBottom));
      if (!isFiniteRange(clippedTop, clippedBottom)) return;

      const spansCenter = nearlyEqual(inner, 0, EPSILON);
      if (spansCenter) {
        rawEntries.push({
          id: `directional-topology-${intervalIndex}-${nodeIndex}-center`,
          top: clippedTop,
          bottom: clippedBottom,
          inner,
          outer,
          sideSign: 0,
          fill: style.fill,
          stroke: style.stroke
        });
        return;
      }

      [-1, 1].forEach((sideSign) => {
        rawEntries.push({
          id: `directional-topology-${intervalIndex}-${nodeIndex}-${sideSign}`,
          top: clippedTop,
          bottom: clippedBottom,
          inner,
          outer,
          sideSign,
          fill: style.fill,
          stroke: style.stroke
        });
      });
    });
  });

  const mergedEntries = mergeContiguousDepthSpans(
    rawEntries,
    (entry) => [
      Number(entry.sideSign),
      Number(entry.inner).toFixed(6),
      Number(entry.outer).toFixed(6),
      String(entry.fill ?? ''),
      String(entry.stroke ?? '')
    ].join('|')
  );

  return mergedEntries
    .map((entry, index) => {
      const points = buildOverlayPolygon(
        projector,
        entry.top,
        entry.bottom,
        entry.inner,
        entry.outer,
        entry.sideSign,
        sampleStepMd
      );
      if (!points) return null;
      return {
        id: `directional-topology-merged-${index}`,
        points,
        fill: entry.fill,
        stroke: entry.stroke
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="directional-topology-overlay-layer" aria-hidden="true">
    <polygon
      v-for="polygon in overlayPolygons"
      :key="polygon.id"
      class="directional-topology-overlay-layer__polygon"
      :points="polygon.points"
      :fill="polygon.fill"
      :stroke="polygon.stroke"
    />
  </g>
</template>

<style scoped>
.directional-topology-overlay-layer__polygon {
  pointer-events: none;
  stroke-width: 0.8px;
}
</style>
