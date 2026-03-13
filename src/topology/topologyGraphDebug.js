import {
  createTopologyInspectorEdgeRows,
  createTopologyInspectorNodeRows
} from '@/topology/topologyInspector.js';
import { MODELED_CASING_ANNULUS_KINDS } from '@/topology/topologyTypes.js';

const GRAPH_SCOPE_SET = new Set(['min_path', 'spof', 'active_flow', 'selected_barrier']);
function buildAnnulusLaneLabel(kind = '') {
  const suffix = String(kind ?? '').replace('ANNULUS_', '').trim();
  if (!suffix) return null;
  if (suffix === 'A') return 'Annulus A (First Annulus)';
  return `Annulus ${suffix}`;
}

const GRAPH_LANE_ORDER = Object.freeze([
  'TUBING_INNER',
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
const DEFAULT_SURFACE_Y = -72;
const DEFAULT_TOP_BAND_Y = 44;
const DEFAULT_ROW_BAND_SPACING = 72;
const DEFAULT_DEPTH_BAND_TOLERANCE = 250;
const DEFAULT_LANE_HORIZONTAL_JITTER = 14;
const DEFAULT_LANE_HEADER_Y = -116;

const NODE_KIND_LABEL_BY_TOKEN = Object.freeze({
  TUBING_INNER: 'Tubing Inner',
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

function resolveNodeDepthMidpoint(nodeRow = {}) {
  const top = toFiniteNumber(nodeRow?.depthTop);
  const bottom = toFiniteNumber(nodeRow?.depthBottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  return (top + bottom) * 0.5;
}

function resolveNodeTone(kind) {
  if (kind === 'SURFACE') return 'var(--color-analysis-graph-node-surface)';
  if (kind === 'TUBING_INNER' || kind === 'BORE') return 'var(--color-analysis-graph-node-tubing)';
  if (kind === 'FORMATION_ANNULUS') return 'var(--color-analysis-graph-node-formation)';
  return 'var(--color-analysis-graph-node-default)';
}

function resolveEdgeTone(kind, cost) {
  if (kind === 'termination') return 'var(--color-analysis-graph-line-termination)';
  if (kind === 'radial') return Number(cost) === 1
    ? 'var(--color-analysis-graph-line-barrier)'
    : 'var(--color-analysis-graph-line-radial)';
  return Number(cost) === 1
    ? 'var(--color-analysis-graph-line-barrier)'
    : 'var(--color-analysis-graph-line-open)';
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

function compareNodeRowsByDepth(left = {}, right = {}) {
  const leftMidpoint = resolveNodeDepthMidpoint(left);
  const rightMidpoint = resolveNodeDepthMidpoint(right);
  if (Number.isFinite(leftMidpoint) && Number.isFinite(rightMidpoint) && leftMidpoint !== rightMidpoint) {
    return leftMidpoint - rightMidpoint;
  }

  const leftTop = toFiniteNumber(left?.depthTop);
  const rightTop = toFiniteNumber(right?.depthTop);
  if (Number.isFinite(leftTop) && Number.isFinite(rightTop) && leftTop !== rightTop) {
    return leftTop - rightTop;
  }

  return String(left?.nodeId ?? '').localeCompare(String(right?.nodeId ?? ''));
}

function buildNodeRowBands(nodeRows = [], options = {}) {
  const safeTolerance = Number(options?.depthBandTolerance) > 0
    ? Number(options.depthBandTolerance)
    : DEFAULT_DEPTH_BAND_TOLERANCE;
  const surfaceRows = [];
  const nonSurfaceRows = [];

  nodeRows.forEach((row) => {
    if (toToken(row?.kind) === 'SURFACE') {
      surfaceRows.push(row);
      return;
    }
    nonSurfaceRows.push(row);
  });

  const bands = [];
  [...nonSurfaceRows]
    .sort(compareNodeRowsByDepth)
    .forEach((row) => {
      const midpoint = resolveNodeDepthMidpoint(row);
      const currentBand = bands[bands.length - 1] ?? null;
      if (!currentBand) {
        bands.push({
          anchorDepthMidpoint: midpoint,
          rows: [row]
        });
        return;
      }

      const currentAnchor = Number(currentBand.anchorDepthMidpoint);
      const canShareBand = Number.isFinite(midpoint)
        && Number.isFinite(currentAnchor)
        && Math.abs(midpoint - currentAnchor) <= safeTolerance;
      if (!canShareBand) {
        bands.push({
          anchorDepthMidpoint: midpoint,
          rows: [row]
        });
        return;
      }

      currentBand.rows.push(row);
      const finiteMidpoints = currentBand.rows
        .map((bandRow) => resolveNodeDepthMidpoint(bandRow))
        .filter((value) => Number.isFinite(value));
      currentBand.anchorDepthMidpoint = finiteMidpoints.length > 0
        ? finiteMidpoints.reduce((sum, value) => sum + value, 0) / finiteMidpoints.length
        : midpoint;
    });

  return {
    surfaceRows,
    bands
  };
}

function buildLaneGuides(laneHeaders = [], layouts = {}, options = {}) {
  const laneSpacing = Number(options?.laneSpacing) > 0 ? Number(options.laneSpacing) : DEFAULT_LANE_SPACING;
  const nodeLayouts = Object.values(layouts?.nodes ?? {});
  const yValues = nodeLayouts
    .map((layout) => Number(layout?.y))
    .filter((value) => Number.isFinite(value));
  const top = yValues.length > 0
    ? Math.min(DEFAULT_SURFACE_Y - 18, ...yValues.map((value) => value - 26))
    : DEFAULT_SURFACE_Y - 18;
  const bottom = yValues.length > 0
    ? Math.max(...yValues.map((value) => value + 26))
    : DEFAULT_TOP_BAND_Y + DEFAULT_ROW_BAND_SPACING;
  const width = Math.max(104, laneSpacing - 44);

  return laneHeaders.map((laneHeader) => ({
    kind: laneHeader.kind,
    label: laneHeader.label,
    x: laneHeader.x,
    y: top,
    width,
    height: Math.max(56, bottom - top)
  }));
}

function buildGraphNodes(nodeRows = [], options = {}) {
  const depthUnitsLabel = toToken(options?.depthUnitsLabel) ?? 'ft';
  const laneSpacing = Number(options?.laneSpacing) > 0 ? Number(options.laneSpacing) : DEFAULT_LANE_SPACING;
  const laneOffset = Number.isFinite(Number(options?.laneOffset)) ? Number(options.laneOffset) : DEFAULT_LANE_OFFSET;
  const topBandY = Number.isFinite(Number(options?.topBandY))
    ? Number(options.topBandY)
    : DEFAULT_TOP_BAND_Y;
  const rowBandSpacing = Number(options?.rowBandSpacing) > 0
    ? Number(options.rowBandSpacing)
    : DEFAULT_ROW_BAND_SPACING;
  const laneHorizontalJitter = Number(options?.laneHorizontalJitter) > 0
    ? Number(options.laneHorizontalJitter)
    : DEFAULT_LANE_HORIZONTAL_JITTER;
  const laneHeaderY = Number.isFinite(Number(options?.laneHeaderY))
    ? Number(options.laneHeaderY)
    : DEFAULT_LANE_HEADER_Y;
  const laneIndexByKind = buildCompactLaneIndexByKind(nodeRows);
  const { surfaceRows, bands } = buildNodeRowBands(nodeRows, options);
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
  const rowsWithBandMetadata = [];

  surfaceRows.forEach((row) => {
    rowsWithBandMetadata.push({
      row,
      bandIndex: -1,
      y: DEFAULT_SURFACE_Y
    });
  });

  bands.forEach((band, bandIndex) => {
    const y = topBandY + (bandIndex * rowBandSpacing);
    band.rows.forEach((row) => {
      rowsWithBandMetadata.push({ row, bandIndex, y });
    });
  });

  rowsWithBandMetadata.forEach(({ row, bandIndex, y }) => {
    const nodeId = toToken(row?.nodeId);
    if (!nodeId) return;
    const nodeKind = toToken(row?.kind) ?? 'unknown';
    const laneIndex = resolveLaneIndex(row?.kind, laneIndexByKind);
    const x = laneOffset + (laneIndex * laneSpacing);
    const kindLabel = formatTopologyGraphNodeKindLabel(nodeKind);
    const depthLabel = formatTopologyGraphDepthLabel(row, { depthUnitsLabel });
    nodes[nodeId] = {
      name: nodeId,
      kind: nodeKind,
      displayLabel: nodeKind === 'SURFACE' ? kindLabel : depthLabel,
      detailLines: nodeKind === 'SURFACE'
        ? [kindLabel]
        : [kindLabel, depthLabel],
      tone: resolveNodeTone(row?.kind)
    };
    layouts.nodes[nodeId] = { x, y, fixed: true };
    if (!laneNodeEntries.has(laneIndex)) laneNodeEntries.set(laneIndex, []);
    laneNodeEntries.get(laneIndex).push({ nodeId, y, bandIndex });
  });
  applyLaneHorizontalJitter(layouts.nodes, laneNodeEntries, laneHorizontalJitter);

  const laneGuides = buildLaneGuides(laneHeaders, layouts, { laneSpacing });

  return { nodes, layouts, laneHeaders, laneGuides };
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
      detailLines: buildTopologyGraphEdgeTooltipLines(row),
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
  const { nodes, layouts, laneHeaders, laneGuides } = buildGraphNodes(nodeRows, options);
  const edges = buildGraphEdges(edgeRows, nodes);

  return {
    nodes,
    edges,
    layouts,
    laneHeaders,
    laneGuides,
    scope,
    nodeCount: Object.keys(nodes).length,
    edgeCount: Object.keys(edges).length
  };
}

export const TOPOLOGY_GRAPH_SUPPORTED_SCOPES = Object.freeze([...GRAPH_SCOPE_SET]);

