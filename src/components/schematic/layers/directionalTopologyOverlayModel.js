import { buildMDSamples } from './directionalProjection.js';
import { resolveDirectionalLayerVisualRadii } from '@/utils/directionalSizing.js';
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
const DEFAULT_SAMPLE_STEP_MD = 20;
function isFinitePoint(point) {
  return Array.isArray(point)
    && point.length >= 2
    && Number.isFinite(Number(point[0]))
    && Number.isFinite(Number(point[1]));
}

function normalizePositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= EPSILON) {
    return fallback;
  }
  return numeric;
}

function resolveOverlayStyleForNode(nodeId, sets, options = {}) {
  const isSelected = sets.selectedNodeIds.has(nodeId);
  const isSpof = options.showSpof !== false && sets.spofNodeIds.has(nodeId);
  const isPath = options.showMinCostPath !== false && sets.pathNodeIds.has(nodeId);
  const isActive = options.showActiveFlow !== false && sets.activeNodeIds.has(nodeId);
  return resolveTopologyOverlayStyle({ isSelected, isSpof, isPath, isActive });
}

function appendNodeEntries(rawEntries, node, interval, intervalIndex, nodeIndex, options, sets) {
  if (!sets.highlightedNodeIds.has(node.nodeId)) return;

  const layer = resolveNodeLayer(node, Array.isArray(interval?.stack) ? interval.stack : []);
  if (!layer) return;

  const visualRadii = resolveDirectionalLayerVisualRadii(
    layer,
    options.visualSizing,
    options.diameterScale
  );
  const inner = Number(visualRadii?.innerRadius);
  const outer = Number(visualRadii?.outerRadius);
  if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner) return;

  const style = resolveOverlayStyleForNode(node.nodeId, sets, options);
  if (!style) return;

  const clippedTop = Math.max(Number(interval.top), Number(node.depthTop));
  const clippedBottom = Math.min(Number(interval.bottom), Number(node.depthBottom));
  if (!isFiniteRange(clippedTop, clippedBottom)) return;

  const sharedEntry = {
    top: clippedTop,
    bottom: clippedBottom,
    inner,
    outer,
    fill: style.fill,
    stroke: style.stroke,
    nodeKind: String(node.kind ?? ''),
    nodeId: String(node.nodeId ?? '')
  };

  if (nearlyEqual(inner, 0, EPSILON)) {
    rawEntries.push({
      ...sharedEntry,
      id: `directional-topology-${intervalIndex}-${nodeIndex}-center`,
      sideSign: 0
    });
    return;
  }

  [-1, 1].forEach((sideSign) => {
    rawEntries.push({
      ...sharedEntry,
      id: `directional-topology-${intervalIndex}-${nodeIndex}-${sideSign}`,
      sideSign
    });
  });
}

export function buildDirectionalTopologyOverlayEntries(options = {}) {
  const topologyResult = options.topologyResult && typeof options.topologyResult === 'object'
    ? options.topologyResult
    : null;
  if (!topologyResult) return [];

  const nodes = Array.isArray(topologyResult.nodes) ? topologyResult.nodes : [];
  const trackedNodes = nodes.filter((node) => (
    TRACKED_VOLUME_NODE_KINDS.includes(node?.kind)
    && isFiniteRange(node?.depthTop, node?.depthBottom)
  ));
  if (trackedNodes.length === 0) return [];

  const sets = buildHighlightNodeSets(topologyResult, options.selectedNodeIds);
  if (sets.highlightedNodeIds.size === 0) return [];

  const intervals = Array.isArray(options.intervals) ? options.intervals : [];
  const rawEntries = [];

  intervals.forEach((interval, intervalIndex) => {
    const top = Number(interval?.top);
    const bottom = Number(interval?.bottom);
    if (!isFiniteRange(top, bottom)) return;

    trackedNodes
      .filter((node) => rangesOverlap(node.depthTop, node.depthBottom, top, bottom))
      .forEach((node, nodeIndex) => {
        appendNodeEntries(rawEntries, node, interval, intervalIndex, nodeIndex, options, sets);
      });
  });

  const mergedEntries = mergeContiguousDepthSpans(
    rawEntries,
    (entry) => [
      Number(entry.sideSign),
      Number(entry.inner).toFixed(6),
      Number(entry.outer).toFixed(6),
      String(entry.fill ?? ''),
      String(entry.stroke ?? ''),
      String(entry.nodeKind ?? '')
    ].join('|')
  );

  return mergedEntries.map((entry, index) => ({
    id: `directional-topology-merged-${index}`,
    ...entry
  }));
}

export function buildDirectionalTopologyOverlayPolygon(
  projector,
  top,
  bottom,
  innerRadius,
  outerRadius,
  sideSign,
  sampleStepMd = DEFAULT_SAMPLE_STEP_MD
) {
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

export function buildDirectionalTopologyOverlayPolygons(options = {}) {
  const projector = typeof options.projector === 'function' ? options.projector : null;
  if (!projector) return [];

  const sampleStepMd = normalizePositiveNumber(options.sampleStepMd, DEFAULT_SAMPLE_STEP_MD);
  const entries = buildDirectionalTopologyOverlayEntries(options);
  if (entries.length === 0) return [];

  return entries
    .map((entry) => {
      const points = buildDirectionalTopologyOverlayPolygon(
        projector,
        Number(entry.top),
        Number(entry.bottom),
        Number(entry.inner),
        Number(entry.outer),
        Number(entry.sideSign),
        sampleStepMd
      );
      if (!points) return null;
      return {
        id: String(entry.id ?? ''),
        points,
        fill: entry.fill,
        stroke: entry.stroke,
        nodeKind: entry.nodeKind
      };
    })
    .filter(Boolean);
}

export default {
  buildDirectionalTopologyOverlayEntries,
  buildDirectionalTopologyOverlayPolygon,
  buildDirectionalTopologyOverlayPolygons
};
