import {
  createTopologyInspectorEdgeRows,
  createTopologyInspectorNodeRows
} from '@/topology/topologyInspector.js';
import { MODELED_CASING_ANNULUS_KINDS } from '@/topology/topologyTypes.js';

const GRAPH_SCOPE_SET = new Set(['min_path', 'spof', 'active_flow', 'selected_barrier']);
function buildAnnulusLaneLabel(kind = '') {
  const suffix = String(kind ?? '').replace('ANNULUS_', '').trim();
  if (!suffix) return null;
  if (suffix === 'A') return 'Outer Annulus A (Casing-Casing)';
  return `Outer Annulus ${suffix}`;
}

const GRAPH_LANE_ORDER = Object.freeze([
  'TUBING_INNER',
  'TUBING_ANNULUS',
  'BORE',
  ...MODELED_CASING_ANNULUS_KINDS,
  'FORMATION_ANNULUS',
  'SURFACE'
]);

const GRAPH_LANE_INDEX_BY_KIND = new Map(
  GRAPH_LANE_ORDER.map((kind, index) => [kind, index])
);

const DEFAULT_LANE_SPACING = 180;
const DEFAULT_LANE_OFFSET = 80;
const DEFAULT_DEPTH_TO_Y_SCALE = 0.02;
const DEFAULT_TOP_OFFSET_Y = 36;
const DEFAULT_SURFACE_Y = -72;
const DEFAULT_MINIMUM_VERTICAL_GAP = 34;
const DEFAULT_LANE_HORIZONTAL_JITTER = 14;
const DEFAULT_LANE_HEADER_Y = -116;
const DENSE_KIND_LABEL_THRESHOLD = 4;

const NODE_KIND_LABEL_BY_TOKEN = Object.freeze({
  TUBING_INNER: 'Tubing Inner',
  TUBING_ANNULUS: 'Inner Annulus (Tubing-Casing)',
  BORE: 'Bore (Legacy)',
  ...Object.fromEntries(
    MODELED_CASING_ANNULUS_KINDS.map((kind) => [kind, buildAnnulusLaneLabel(kind)])
  ),
  FORMATION_ANNULUS: 'Formation Annulus',
  SURFACE: 'Surface'
});

const EDGE_KIND_LABEL_BY_TOKEN = Object.freeze({
  vertical: 'Vertical continuity',
  radial: 'Radial communication',
  termination: 'Surface termination'
});

function toToken(value) {
  const token = String(value ?? '').trim();
  return token.length > 0 ? token : null;
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeScope(scope) {
  const token = String(scope ?? '').trim().toLowerCase();
  return GRAPH_SCOPE_SET.has(token) ? token : 'min_path';
}

function formatDepthValue(value) {
  const numeric = toFiniteNumber(value);
  if (!Number.isFinite(numeric)) return null;
  return Number.isInteger(numeric) ? numeric.toLocaleString() : numeric.toFixed(1);
}

function formatDepthRange(top, bottom) {
  const topLabel = formatDepthValue(top);
  const bottomLabel = formatDepthValue(bottom);
  if (!topLabel || !bottomLabel) return null;
  return `${topLabel}-${bottomLabel}`;
}

function toHumanWords(token) {
  return String(token ?? '')
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');
}

function formatTopologyGraphNodeKindLabel(kind) {
  const token = toToken(kind);
  if (!token) return 'Node';
  return NODE_KIND_LABEL_BY_TOKEN[token] ?? toHumanWords(token);
}

function formatTopologyGraphEdgeKindLabel(kind) {
  const token = String(kind ?? '').trim().toLowerCase();
  if (!token) return 'Edge';
  return EDGE_KIND_LABEL_BY_TOKEN[token] ?? toHumanWords(token);
}

function buildCompactLaneIndexByKind(nodeRows = []) {
  const uniqueKinds = [];
  const seenKinds = new Set();

  nodeRows.forEach((row) => {
    const kind = toToken(row?.kind);
    if (!kind || seenKinds.has(kind)) return;
    seenKinds.add(kind);
    uniqueKinds.push(kind);
  });

  const knownKinds = uniqueKinds
    .filter((kind) => GRAPH_LANE_INDEX_BY_KIND.has(kind))
    .sort((left, right) => GRAPH_LANE_INDEX_BY_KIND.get(left) - GRAPH_LANE_INDEX_BY_KIND.get(right));

  const unknownKinds = uniqueKinds
    .filter((kind) => !GRAPH_LANE_INDEX_BY_KIND.has(kind))
    .sort((left, right) => left.localeCompare(right));

  return new Map([...knownKinds, ...unknownKinds].map((kind, index) => [kind, index]));
}

function resolveLaneIndex(kind, laneIndexByKind = new Map()) {
  const safeKind = toToken(kind);
  if (!safeKind) return laneIndexByKind.size;
  if (laneIndexByKind.has(safeKind)) return laneIndexByKind.get(safeKind);
  return laneIndexByKind.size;
}

function resolveNodeY(nodeRow, depthToYScale = DEFAULT_DEPTH_TO_Y_SCALE) {
  const top = toFiniteNumber(nodeRow?.depthTop);
  const bottom = toFiniteNumber(nodeRow?.depthBottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return DEFAULT_SURFACE_Y;
  return DEFAULT_TOP_OFFSET_Y + ((top + bottom) * 0.5 * depthToYScale);
}

function resolveNodeTone(kind) {
  if (kind === 'SURFACE') return '#0f766e';
  if (kind === 'TUBING_INNER' || kind === 'BORE') return '#0f3f75';
  if (kind === 'FORMATION_ANNULUS') return '#7c2d12';
  return '#1f2937';
}

function resolveEdgeTone(kind, cost) {
  if (kind === 'termination') return '#0f766e';
  if (kind === 'radial') return Number(cost) === 1 ? '#be123c' : '#c2410c';
  return Number(cost) === 1 ? '#be123c' : '#475569';
}

function applyMinimumLaneVerticalGap(
  layoutNodesById = {},
  laneNodeEntries = new Map(),
  minimumVerticalGap = DEFAULT_MINIMUM_VERTICAL_GAP
) {
  const safeGap = Number(minimumVerticalGap);
  if (!(safeGap > 0)) return;

  laneNodeEntries.forEach((entries = []) => {
    const sortedEntries = [...entries].sort((left, right) => Number(left?.y) - Number(right?.y));
    let previousY = null;

    sortedEntries.forEach((entry) => {
      const nodeId = toToken(entry?.nodeId);
      if (!nodeId) return;
      const layoutNode = layoutNodesById[nodeId];
      if (!layoutNode) return;
      const rawY = Number(entry?.y);
      const safeY = Number.isFinite(rawY) ? rawY : Number(layoutNode.y);
      if (!Number.isFinite(safeY)) return;
      const nextY = previousY === null ? safeY : Math.max(safeY, previousY + safeGap);
      layoutNode.y = nextY;
      previousY = nextY;
    });
  });
}

function applyLaneHorizontalJitter(
  layoutNodesById = {},
  laneNodeEntries = new Map(),
  laneHorizontalJitter = DEFAULT_LANE_HORIZONTAL_JITTER
) {
  const safeJitter = Number(laneHorizontalJitter);
  if (!(safeJitter > 0)) return;
  const jitterPattern = [0, 1, -1, 2, -2];

  laneNodeEntries.forEach((entries = []) => {
    if (entries.length <= 2) return;
    const sortedEntries = [...entries].sort((left, right) => Number(left?.y) - Number(right?.y));

    sortedEntries.forEach((entry, index) => {
      const nodeId = toToken(entry?.nodeId);
      if (!nodeId) return;
      const layoutNode = layoutNodesById[nodeId];
      if (!layoutNode) return;
      const jitterMultiplier = jitterPattern[index % jitterPattern.length];
      layoutNode.x = Number(layoutNode.x) + (jitterMultiplier * safeJitter);
    });
  });
}

function buildNodeKindCountMap(nodeRows = []) {
  const kindCountMap = new Map();
  nodeRows.forEach((row) => {
    const kind = toToken(row?.kind);
    if (!kind) return;
    kindCountMap.set(kind, (kindCountMap.get(kind) ?? 0) + 1);
  });
  return kindCountMap;
}

function formatTopologyGraphDepthLabel(nodeRow = {}, options = {}) {
  const depthUnitsLabel = toToken(options?.depthUnitsLabel) ?? 'ft';
  const range = formatDepthRange(nodeRow?.depthTop, nodeRow?.depthBottom);
  if (!range) return `depth N/A`;
  return `${range} ${depthUnitsLabel} MD`;
}

export function formatTopologyGraphNodeLabel(nodeRow = {}, options = {}) {
  const depthUnitsLabel = toToken(options?.depthUnitsLabel) ?? 'ft';
  const kindLabel = formatTopologyGraphNodeKindLabel(nodeRow?.kind);
  const range = formatDepthRange(nodeRow?.depthTop, nodeRow?.depthBottom);
  if (!range) return kindLabel === 'Surface' ? kindLabel : `${kindLabel} | depth N/A`;
  return `${kindLabel} | ${range} ${depthUnitsLabel} MD`;
}

export function formatTopologyGraphEdgeLabel(edgeRow = {}) {
  const kind = formatTopologyGraphEdgeKindLabel(edgeRow?.kind);
  const cost = Number.isFinite(Number(edgeRow?.cost)) ? Number(edgeRow.cost) : null;
  const rule = toToken(edgeRow?.ruleId);
  const costLabel = Number.isFinite(cost) ? `cost=${cost}` : 'cost=N/A';
  if (!rule) return `${kind} | ${costLabel}`;
  return `${kind} | ${costLabel} | ${rule}`;
}

function formatTopologyGraphEdgePathLabel(edgeRow = {}) {
  const fromKind = toToken(edgeRow?.fromKind);
  const toKind = toToken(edgeRow?.toKind);
  const fromLabel = fromKind
    ? formatTopologyGraphNodeKindLabel(fromKind)
    : toToken(edgeRow?.fromNodeId);
  const toLabel = toKind
    ? formatTopologyGraphNodeKindLabel(toKind)
    : toToken(edgeRow?.toNodeId);
  if (!fromLabel || !toLabel) return null;
  return `Path: ${fromLabel} -> ${toLabel}`;
}

function buildTopologyGraphEdgeTooltipLines(edgeRow = {}) {
  const lines = [formatTopologyGraphEdgeLabel(edgeRow)];
  const pathLabel = formatTopologyGraphEdgePathLabel(edgeRow);
  if (pathLabel) lines.push(pathLabel);
  const rule = toToken(edgeRow?.ruleId);
  if (rule) lines.push(`Rule: ${rule}`);
  const summary = toToken(edgeRow?.reasonSummary);
  if (summary) lines.push(summary);
  return lines;
}

function buildGraphNodes(nodeRows = [], options = {}) {
  const depthUnitsLabel = toToken(options?.depthUnitsLabel) ?? 'ft';
  const laneSpacing = Number(options?.laneSpacing) > 0 ? Number(options.laneSpacing) : DEFAULT_LANE_SPACING;
  const laneOffset = Number.isFinite(Number(options?.laneOffset)) ? Number(options.laneOffset) : DEFAULT_LANE_OFFSET;
  const depthToYScale = Number(options?.depthToYScale) > 0
    ? Number(options.depthToYScale)
    : DEFAULT_DEPTH_TO_Y_SCALE;
  const minimumVerticalGap = Number(options?.minimumVerticalGap) > 0
    ? Number(options.minimumVerticalGap)
    : DEFAULT_MINIMUM_VERTICAL_GAP;
  const laneHorizontalJitter = Number(options?.laneHorizontalJitter) > 0
    ? Number(options.laneHorizontalJitter)
    : DEFAULT_LANE_HORIZONTAL_JITTER;
  const laneHeaderY = Number.isFinite(Number(options?.laneHeaderY))
    ? Number(options.laneHeaderY)
    : DEFAULT_LANE_HEADER_Y;
  const laneIndexByKind = buildCompactLaneIndexByKind(nodeRows);
  const kindCountMap = buildNodeKindCountMap(nodeRows);
  const laneHeaders = [...laneIndexByKind.entries()]
    .sort((left, right) => Number(left[1]) - Number(right[1]))
    .map(([kind, laneIndex]) => ({
      kind,
      label: formatTopologyGraphNodeKindLabel(kind),
      x: laneOffset + (laneIndex * laneSpacing),
      y: laneHeaderY
    }));

  const nodes = {};
  const layouts = { nodes: {} };
  const laneNodeEntries = new Map();

  nodeRows.forEach((row) => {
    const nodeId = toToken(row?.nodeId);
    if (!nodeId) return;
    const nodeKind = toToken(row?.kind) ?? 'unknown';
    const nodeKindCount = kindCountMap.get(nodeKind) ?? 0;
    const shouldCompactLabel = nodeKind !== 'SURFACE' && nodeKindCount >= DENSE_KIND_LABEL_THRESHOLD;
    const laneIndex = resolveLaneIndex(row?.kind, laneIndexByKind);
    const x = laneOffset + (laneIndex * laneSpacing);
    const y = resolveNodeY(row, depthToYScale);
    nodes[nodeId] = {
      name: nodeId,
      kind: nodeKind,
      displayLabel: shouldCompactLabel
        ? formatTopologyGraphDepthLabel(row, { depthUnitsLabel })
        : formatTopologyGraphNodeLabel(row, { depthUnitsLabel }),
      tone: resolveNodeTone(row?.kind)
    };
    layouts.nodes[nodeId] = { x, y, fixed: true };
    if (!laneNodeEntries.has(laneIndex)) laneNodeEntries.set(laneIndex, []);
    laneNodeEntries.get(laneIndex).push({ nodeId, y });
  });
  applyMinimumLaneVerticalGap(layouts.nodes, laneNodeEntries, minimumVerticalGap);
  applyLaneHorizontalJitter(layouts.nodes, laneNodeEntries, laneHorizontalJitter);

  return { nodes, layouts, laneHeaders };
}

function buildGraphEdges(edgeRows = [], nodes = {}) {
  const edges = {};
  edgeRows.forEach((row) => {
    const edgeId = toToken(row?.edgeId);
    const from = toToken(row?.fromNodeId);
    const to = toToken(row?.toNodeId);
    if (!edgeId || !from || !to) return;
    if (!nodes[from] || !nodes[to]) return;
    edges[edgeId] = {
      source: from,
      target: to,
      kind: toToken(row?.kind) ?? 'unknown',
      cost: Number.isFinite(Number(row?.cost)) ? Number(row.cost) : null,
      displayLabel: formatTopologyGraphEdgeLabel(row),
      tooltipLines: buildTopologyGraphEdgeTooltipLines(row),
      tone: resolveEdgeTone(row?.kind, row?.cost),
      dasharray: Number(row?.cost) === 1 ? '6 4' : 0
    };
  });
  return edges;
}

export function buildTopologyDebugGraph(topologyResult = {}, options = {}) {
  const scope = normalizeScope(options?.scope);
  const selectedBarrierEdgeIds = Array.isArray(options?.selectedBarrierEdgeIds)
    ? options.selectedBarrierEdgeIds
    : [];
  const nodeRows = createTopologyInspectorNodeRows(topologyResult, {
    scope,
    selectedBarrierEdgeIds
  });
  const edgeRows = createTopologyInspectorEdgeRows(topologyResult, {
    scope,
    selectedBarrierEdgeIds
  });
  const { nodes, layouts, laneHeaders } = buildGraphNodes(nodeRows, options);
  const edges = buildGraphEdges(edgeRows, nodes);

  return {
    nodes,
    edges,
    layouts,
    laneHeaders,
    scope,
    nodeCount: Object.keys(nodes).length,
    edgeCount: Object.keys(edges).length
  };
}

export const TOPOLOGY_GRAPH_SUPPORTED_SCOPES = Object.freeze([...GRAPH_SCOPE_SET]);

