import * as d3 from 'd3';
import { clearLasSurface } from '@/utils/lasPlotRenderer.js';

const MIN_CELL_SIZE = 44;
const MAX_CELL_SIZE = 72;
const LABEL_CHAR_WIDTH = 7;
const LABEL_PADDING = 24;
const COL_LABEL_GAP = 10;
const LEGEND_HEIGHT = 36;
const LEGEND_GAP = 20;

export function renderLasCorrelationHeatmap(container, data) {
  const containerWidth = container?.clientWidth ?? 0;
  const containerHeight = container?.clientHeight ?? 0;
  clearLasSurface(container);
  if (!container || !hasCorrelationData(data)) return;

  const curveCount = data.curves.length;
  const margin = resolveMargins(data.curves);
  const cellSize = resolveCellSize(curveCount, containerWidth, containerHeight, margin);
  const innerSize = curveCount * cellSize;
  const totalWidth = margin.left + innerSize + margin.right;
  const totalHeight = margin.top + innerSize + LEGEND_GAP + LEGEND_HEIGHT + margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', totalWidth)
    .attr('height', totalHeight)
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .style('display', 'block');

  const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
  const scales = createScales(data.curves, innerSize);
  const cells = buildCells(data.curves, data.matrix);
  const colorScale = d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);

  renderCells(root, cells, scales, colorScale, cellSize);
  renderValues(root, cells, scales, colorScale, cellSize);
  renderRowLabels(root, data.curves, scales);
  renderColumnLabels(root, data.curves, scales);
  renderLegend(svg, colorScale, margin.left, margin.top + innerSize + LEGEND_GAP, innerSize);
}

function hasCorrelationData(data) {
  return Array.isArray(data?.curves) && data.curves.length > 0
    && Array.isArray(data?.matrix) && data.matrix.length > 0;
}

function resolveMargins(curves) {
  const longestLabel = Math.max(...curves.map((c) => c.length));
  const labelPx = Math.ceil(longestLabel * LABEL_CHAR_WIDTH);
  const sideMargin = Math.max(labelPx + LABEL_PADDING, 80);
  const topMargin = labelPx + COL_LABEL_GAP + LABEL_PADDING;
  return { top: topMargin, right: 24, bottom: 16, left: sideMargin };
}

function resolveCellSize(curveCount, containerWidth, containerHeight, margin) {
  if (containerWidth <= 0 || curveCount <= 0) return MIN_CELL_SIZE;
  const availableW = containerWidth - margin.left - margin.right;
  const availableH = containerHeight - margin.top - margin.bottom - LEGEND_GAP - LEGEND_HEIGHT;
  const fitW = Math.floor(availableW / curveCount);
  const fitH = availableH > 0 ? Math.floor(availableH / curveCount) : MAX_CELL_SIZE;
  const fit = Math.min(fitW, fitH);
  return Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, fit));
}

function createScales(curves, innerSize) {
  return {
    x: d3.scaleBand().domain(curves).range([0, innerSize]).padding(0.04),
    y: d3.scaleBand().domain(curves).range([0, innerSize]).padding(0.04),
  };
}

function buildCells(curves, matrix) {
  const cells = [];
  matrix.forEach((row, ri) => {
    row.forEach((value, ci) => {
      cells.push({
        row: curves[ri],
        col: curves[ci],
        value: Number.isFinite(Number(value)) ? Number(value) : null,
      });
    });
  });
  return cells;
}

function contrastColor(value, colorScale) {
  if (value === null) return '#667';
  const rgb = d3.rgb(colorScale(value));
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance < 140 ? '#fff' : '#1a2030';
}

function renderCells(root, cells, scales, colorScale, cellSize) {
  const radius = Math.max(2, Math.round(cellSize * 0.06));
  root
    .selectAll('rect')
    .data(cells)
    .enter()
    .append('rect')
    .attr('x', (d) => scales.x(d.col))
    .attr('y', (d) => scales.y(d.row))
    .attr('width', scales.x.bandwidth())
    .attr('height', scales.y.bandwidth())
    .attr('rx', radius)
    .attr('ry', radius)
    .attr('fill', (d) => (d.value === null ? '#f0f2f5' : colorScale(d.value)))
    .attr('stroke', 'rgba(37, 50, 74, 0.08)')
    .attr('stroke-width', 0.5)
    .append('title')
    .text((d) => `${d.row} vs ${d.col}: ${d.value === null ? 'N/A' : d.value.toFixed(3)}`);
}

function renderValues(root, cells, scales, colorScale, cellSize) {
  const fontSize = cellSize >= 56 ? 12 : cellSize >= 48 ? 11 : 10;
  root
    .selectAll('.hm-val')
    .data(cells)
    .enter()
    .append('text')
    .attr('class', 'hm-val')
    .attr('x', (d) => scales.x(d.col) + scales.x.bandwidth() / 2)
    .attr('y', (d) => scales.y(d.row) + scales.y.bandwidth() / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .style('font-size', `${fontSize}px`)
    .style('font-weight', '600')
    .style('fill', (d) => contrastColor(d.value, colorScale))
    .style('pointer-events', 'none')
    .text((d) => (d.value === null ? '-' : d.value.toFixed(2)));
}

function renderRowLabels(root, curves, scales) {
  root
    .selectAll('.hm-row')
    .data(curves)
    .enter()
    .append('text')
    .attr('class', 'hm-row')
    .attr('x', -8)
    .attr('y', (c) => scales.y(c) + scales.y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'central')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('fill', 'var(--p-text-color, #25324a)');

  root.selectAll('.hm-row').text((c) => c);
}

function renderColumnLabels(root, curves, scales) {
  root
    .selectAll('.hm-col')
    .data(curves)
    .enter()
    .append('text')
    .attr('class', 'hm-col')
    .attr('transform', (c) =>
      `translate(${scales.x(c) + scales.x.bandwidth() / 2}, -${COL_LABEL_GAP}) rotate(-90)`)
    .attr('text-anchor', 'start')
    .attr('dominant-baseline', 'central')
    .style('font-size', '11px')
    .style('font-weight', '600')
    .style('fill', 'var(--p-text-color, #25324a)')
    .text((c) => c);
}

function renderLegend(svg, colorScale, x, y, width) {
  const legendWidth = Math.min(width, 280);
  const legendHeight = 14;
  const offsetX = x + (width - legendWidth) / 2;
  const g = svg.append('g').attr('transform', `translate(${offsetX}, ${y})`);

  const steps = 60;
  const stepWidth = legendWidth / steps;
  for (let i = 0; i < steps; i++) {
    const val = -1 + (2 * i) / (steps - 1);
    g.append('rect')
      .attr('x', i * stepWidth)
      .attr('y', 0)
      .attr('width', stepWidth + 0.5)
      .attr('height', legendHeight)
      .attr('fill', colorScale(val))
      .attr('rx', i === 0 ? 3 : i === steps - 1 ? 3 : 0)
      .attr('ry', i === 0 ? 3 : i === steps - 1 ? 3 : 0);
  }

  const labels = [
    { val: '-1', x: 0, anchor: 'start' },
    { val: '0', x: legendWidth / 2, anchor: 'middle' },
    { val: '+1', x: legendWidth, anchor: 'end' },
  ];
  labels.forEach((l) => {
    g.append('text')
      .attr('x', l.x)
      .attr('y', legendHeight + 14)
      .attr('text-anchor', l.anchor)
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', 'var(--p-text-muted-color, #6f7786)')
      .text(l.val);
  });
}
