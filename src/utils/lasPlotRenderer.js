import * as d3 from 'd3';

const MIN_TRACK_WIDTH = 196;
const HEADER_HEIGHT = 38;
export const LAS_PLOT_TOTAL_HEIGHT = 400;
const LAS_PLOT_MIN_TOTAL_HEIGHT = 280;
const PLOT_MARGIN = Object.freeze({ top: 6, right: 16, bottom: 30, left: 56 });

export function clearLasSurface(container) {
  if (!container) return;
  container.innerHTML = '';
}

export function renderLasPlot(container, data) {
  const availableWidth = resolveAvailablePlotWidth(container);
  const availableHeight = resolveAvailablePlotHeight(container);
  clearLasSurface(container);
  if (!container || !hasPlotSeries(data)) return;

  const dimensions = resolvePlotDimensions(
    data.series.length,
    availableWidth,
    availableHeight
  );
  const svg = createPlotSvg(container, dimensions);
  const yScale = createDepthScale(data, dimensions);

  renderDepthAxis(svg, yScale, data.indexCurve, data.depthRange?.depthUnit, dimensions);
  renderTrackSeries(svg, data.series, yScale, dimensions);
  renderTrackBoundary(svg, dimensions.margin.left + data.series.length * dimensions.trackWidth, dimensions);
}

function hasPlotSeries(data) {
  return Array.isArray(data?.series) && data.series.length > 0;
}

function resolveAvailablePlotWidth(container) {
  const measuredWidth = Number(container?.clientWidth ?? 0);
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return 0;
  return measuredWidth;
}

function resolveAvailablePlotHeight(container) {
  const measuredHeight = Number(container?.clientHeight ?? 0);
  if (Number.isFinite(measuredHeight) && measuredHeight > 0) return measuredHeight;
  const parentHeight = Number(container?.parentElement?.clientHeight ?? 0);
  if (Number.isFinite(parentHeight) && parentHeight > 0) return parentHeight;
  return LAS_PLOT_TOTAL_HEIGHT;
}

function resolvePlotDimensions(trackCount, availableWidth = 0, availableHeight = LAS_PLOT_TOTAL_HEIGHT) {
  const resolvedTotalHeight = resolvePlotTotalHeight(availableHeight);
  const plotHeight = resolvedTotalHeight - PLOT_MARGIN.top - PLOT_MARGIN.bottom - HEADER_HEIGHT;
  const usableTrackWidth = resolveTrackWidth(trackCount, availableWidth);
  return {
    margin: PLOT_MARGIN,
    headerHeight: HEADER_HEIGHT,
    totalHeight: resolvedTotalHeight,
    plotHeight,
    trackWidth: usableTrackWidth,
    totalWidth: PLOT_MARGIN.left + trackCount * usableTrackWidth + PLOT_MARGIN.right,
  };
}

function resolvePlotTotalHeight(availableHeight) {
  const numeric = Number(availableHeight);
  if (!Number.isFinite(numeric) || numeric <= 0) return LAS_PLOT_TOTAL_HEIGHT;
  return Math.max(LAS_PLOT_MIN_TOTAL_HEIGHT, Math.round(numeric));
}

function resolveTrackWidth(trackCount, availableWidth) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return MIN_TRACK_WIDTH;
  const availableTrackArea = Math.max(availableWidth - PLOT_MARGIN.left - PLOT_MARGIN.right, MIN_TRACK_WIDTH);
  return Math.max(MIN_TRACK_WIDTH, Math.floor(availableTrackArea / Math.max(trackCount, 1)));
}

function createPlotSvg(container, dimensions) {
  return d3
    .select(container)
    .append('svg')
    .attr('width', dimensions.totalWidth)
    .attr('height', dimensions.totalHeight)
    .attr('viewBox', `0 0 ${dimensions.totalWidth} ${dimensions.totalHeight}`)
    .style('display', 'block')
    .style('background', 'var(--color-surface-elevated, #fff)')
    .style('border', '1px solid var(--line, #d7dde7)')
    .style('border-radius', '18px');
}

function createDepthScale(data, dimensions) {
  const minDepth = Number(data?.depthRange?.minDepth ?? 0);
  const maxDepth = Number(data?.depthRange?.maxDepth ?? minDepth + 1);
  return d3
    .scaleLinear()
    .domain([minDepth, maxDepth])
    .range([
      dimensions.margin.top + dimensions.headerHeight,
      dimensions.margin.top + dimensions.headerHeight + dimensions.plotHeight,
    ]);
}

function renderDepthAxis(svg, yScale, indexCurve, depthUnit, dimensions) {
  const axis = d3.axisLeft(yScale).ticks(12);
  svg
    .append('g')
    .attr('transform', `translate(${dimensions.margin.left}, 0)`)
    .call(axis)
    .selectAll('text')
    .style('font-size', '11px')
    .style('fill', 'var(--p-text-color, #25324a)');

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(dimensions.margin.top + dimensions.headerHeight + dimensions.plotHeight / 2))
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '700')
    .style('fill', 'var(--p-text-color, #25324a)')
    .text(resolveIndexLabel(indexCurve, depthUnit));
}

function resolveIndexLabel(indexCurve, depthUnit) {
  if (!depthUnit) return indexCurve ?? '';
  return `${indexCurve ?? ''} (${depthUnit})`;
}

function renderTrackSeries(svg, series, yScale, dimensions) {
  const colors = d3.schemeTableau10;
  series.forEach((entry, index) => {
    renderTrack(svg, entry, index, yScale, colors[index % colors.length], dimensions);
  });
}

function renderTrack(svg, entry, index, yScale, color, dimensions) {
  const trackX = dimensions.margin.left + index * dimensions.trackWidth;
  renderTrackBoundary(svg, trackX, dimensions);
  renderTrackHeader(svg, entry, trackX, color, dimensions);

  const values = extractTrackValues(entry?.points);
  if (values.length === 0) return;

  const xScale = createTrackScale(values, trackX, dimensions.trackWidth);
  renderTrackLine(svg, entry?.points ?? [], xScale, yScale, color);
  renderTrackAxis(svg, xScale, dimensions);
}

function renderTrackBoundary(svg, xPosition, dimensions) {
  svg
    .append('line')
    .attr('x1', xPosition)
    .attr('x2', xPosition)
    .attr('y1', dimensions.margin.top + dimensions.headerHeight)
    .attr('y2', dimensions.margin.top + dimensions.headerHeight + dimensions.plotHeight)
    .attr('stroke', 'var(--line, #d7dde7)')
    .attr('stroke-width', 1);
}

function renderTrackHeader(svg, entry, trackX, color, dimensions) {
  const label = entry?.unit ? `${entry.mnemonic} (${entry.unit})` : entry?.mnemonic ?? '';
  svg
    .append('text')
    .attr('x', trackX + dimensions.trackWidth / 2)
    .attr('y', dimensions.margin.top + dimensions.headerHeight - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', '700')
    .style('fill', color)
    .text(label);
}

function extractTrackValues(points) {
  if (!Array.isArray(points)) return [];
  return points
    .filter((point) => point?.[1] !== null && point?.[1] !== undefined)
    .map((point) => Number(point[1]))
    .filter((value) => Number.isFinite(value));
}

function createTrackScale(values, trackX, trackWidth) {
  const [minValue, maxValue] = d3.extent(values);
  const safeMax = minValue === maxValue ? maxValue + 1 : maxValue;
  return d3
    .scaleLinear()
    .domain([minValue, safeMax])
    .range([trackX + 10, trackX + trackWidth - 10]);
}

function renderTrackLine(svg, points, xScale, yScale, color) {
  const line = d3
    .line()
    .defined((point) => point?.[1] !== null && point?.[1] !== undefined)
    .x((point) => xScale(Number(point[1])))
    .y((point) => yScale(Number(point[0])));

  svg
    .append('path')
    .datum(points)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 1.6);
}

function renderTrackAxis(svg, xScale, dimensions) {
  const axis = d3.axisBottom(xScale).ticks(4).tickFormat(d3.format('.2s'));
  svg
    .append('g')
    .attr('transform', `translate(0, ${dimensions.margin.top + dimensions.headerHeight + dimensions.plotHeight})`)
    .call(axis)
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', 'var(--p-text-muted-color, #718096)');
}
