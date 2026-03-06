import * as d3 from 'd3';
import { formatTimeIndexValue } from '@/utils/lasTimeAxis.js';

const MIN_TRACK_WIDTH = 196;
const HEADER_HEIGHT = 38;
export const LAS_PLOT_TOTAL_HEIGHT = 400;
const LAS_PLOT_MIN_TOTAL_HEIGHT = 280;
const BASE_PLOT_MARGIN = Object.freeze({ top: 6, right: 16, bottom: 30, left: 56 });
const DEPTH_AXIS_TICK_COUNT = 12;
const DEPTH_AXIS_FONT_SIZE_PX = 11;
const DEPTH_AXIS_CHAR_WIDTH_RATIO = 0.62;
const DEPTH_AXIS_TICK_PADDING_PX = 18;
const DEPTH_AXIS_LABEL_GUTTER_PX = 8;

export function clearLasSurface(container) {
  if (!container) return;
  container.innerHTML = '';
}

export function renderLasPlot(container, data) {
  const availableWidth = resolveAvailablePlotWidth(container);
  const availableHeight = resolveAvailablePlotHeight(container);
  clearLasSurface(container);
  if (!container || !hasPlotSeries(data)) return null;

  const dimensions = resolvePlotDimensions(
    data,
    data.series.length,
    availableWidth,
    availableHeight
  );
  const svg = createPlotSvg(container, dimensions);
  const yScale = createDepthScale(data, dimensions);

  renderDepthAxis(svg, yScale, data.indexCurve, data.depthRange?.depthUnit, dimensions, data.timeAxis);
  const tracks = renderTrackSeries(svg, data.series, yScale, dimensions);
  renderTrackBoundary(svg, dimensions.margin.left + data.series.length * dimensions.trackWidth, dimensions);

  const plotTop = dimensions.margin.top + dimensions.headerHeight;
  const plotBottom = plotTop + dimensions.plotHeight;
  const plotLeft = dimensions.margin.left;
  const plotRight = plotLeft + data.series.length * dimensions.trackWidth;
  const minDepth = Number(data?.depthRange?.minDepth ?? 0);
  const maxDepth = Number(data?.depthRange?.maxDepth ?? minDepth + 1);

  return {
    width: dimensions.totalWidth,
    height: dimensions.totalHeight,
    plotArea: {
      left: plotLeft,
      right: plotRight,
      top: plotTop,
      bottom: plotBottom,
    },
    depthRange: {
      minDepth,
      maxDepth,
      depthUnit: data?.depthRange?.depthUnit ?? null,
      samplingStep: Number(data?.depthRange?.samplingStep ?? 1),
      indexCurve: data?.indexCurve ?? null,
      timeAxis: data?.timeAxis ?? null,
    },
    tracks
  };
}

function hasPlotSeries(data) {
  return Array.isArray(data?.series) && data.series.length > 0;
}

function resolveAvailablePlotWidth(container) {
  const measuredWidth = Number(container?.clientWidth ?? 0);
  if (Number.isFinite(measuredWidth) && measuredWidth > 0) return measuredWidth;
  const parentWidth = Number(container?.parentElement?.clientWidth ?? 0);
  if (Number.isFinite(parentWidth) && parentWidth > 0) return parentWidth;
  return 0;
}

function resolveAvailablePlotHeight(container) {
  const measuredHeight = Number(container?.clientHeight ?? 0);
  if (Number.isFinite(measuredHeight) && measuredHeight > 0) return measuredHeight;
  const parentHeight = Number(container?.parentElement?.clientHeight ?? 0);
  if (Number.isFinite(parentHeight) && parentHeight > 0) return parentHeight;
  return LAS_PLOT_TOTAL_HEIGHT;
}

function resolvePlotDimensions(data, trackCount, availableWidth = 0, availableHeight = LAS_PLOT_TOTAL_HEIGHT) {
  const margin = resolvePlotMargin(data);
  const resolvedTotalHeight = resolvePlotTotalHeight(availableHeight);
  const plotHeight = resolvedTotalHeight - margin.top - margin.bottom - HEADER_HEIGHT;
  const usableTrackWidth = resolveTrackWidth(trackCount, availableWidth, margin);
  return {
    margin,
    headerHeight: HEADER_HEIGHT,
    totalHeight: resolvedTotalHeight,
    plotHeight,
    trackWidth: usableTrackWidth,
    totalWidth: margin.left + trackCount * usableTrackWidth + margin.right,
  };
}

function resolvePlotTotalHeight(availableHeight) {
  const numeric = Number(availableHeight);
  if (!Number.isFinite(numeric) || numeric <= 0) return LAS_PLOT_TOTAL_HEIGHT;
  return Math.max(LAS_PLOT_MIN_TOTAL_HEIGHT, Math.round(numeric));
}

function resolveTrackWidth(trackCount, availableWidth, margin) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return MIN_TRACK_WIDTH;
  const availableTrackArea = Math.max(availableWidth - margin.left - margin.right, MIN_TRACK_WIDTH);
  return Math.max(MIN_TRACK_WIDTH, Math.floor(availableTrackArea / Math.max(trackCount, 1)));
}

function resolvePlotMargin(data) {
  const minDepth = Number(data?.depthRange?.minDepth ?? 0);
  const maxDepth = Number(data?.depthRange?.maxDepth ?? minDepth + 1);
  const timeAxis = data?.timeAxis ?? null;
  const axisLabel = resolveIndexLabel(data?.indexCurve, data?.depthRange?.depthUnit, timeAxis);
  const tickLabelWidth = estimateDepthAxisTickLabelWidth(minDepth, maxDepth, DEPTH_AXIS_TICK_COUNT, timeAxis);
  const axisLabelAllowance = axisLabel ? DEPTH_AXIS_LABEL_GUTTER_PX : 0;
  const left = Math.max(
    BASE_PLOT_MARGIN.left,
    tickLabelWidth + DEPTH_AXIS_TICK_PADDING_PX + axisLabelAllowance
  );
  return {
    ...BASE_PLOT_MARGIN,
    left
  };
}

function estimateDepthAxisTickLabelWidth(minDepth, maxDepth, tickCount, timeAxis = null) {
  const [domainStart, domainEnd] = normalizeDepthDomain(minDepth, maxDepth);
  const formatTick = resolveDepthTickFormatter(domainStart, domainEnd, tickCount, timeAxis);
  const tickValues = d3.ticks(domainStart, domainEnd, tickCount);
  const sampledTicks = tickValues.length > 0 ? tickValues : [domainStart, domainEnd];
  const maxTickLength = sampledTicks.reduce((longest, tickValue) => {
    const label = String(formatTick(tickValue));
    return Math.max(longest, label.length);
  }, 0);
  return Math.ceil(maxTickLength * DEPTH_AXIS_FONT_SIZE_PX * DEPTH_AXIS_CHAR_WIDTH_RATIO);
}

function normalizeDepthDomain(minDepth, maxDepth) {
  const hasMin = Number.isFinite(minDepth);
  const hasMax = Number.isFinite(maxDepth);
  if (!hasMin && !hasMax) return [0, 1];
  if (!hasMin) return [maxDepth - 1, maxDepth];
  if (!hasMax) return [minDepth, minDepth + 1];
  if (minDepth === maxDepth) return [minDepth, minDepth + 1];
  return minDepth < maxDepth ? [minDepth, maxDepth] : [maxDepth, minDepth];
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

function resolveDepthTickFormatter(domainStart, domainEnd, tickCount, timeAxis = null) {
  if (String(timeAxis?.mode || '').trim() === 'clock' && String(timeAxis?.status || '').trim() === 'ready') {
    return (value) => formatTimeIndexValue(value, timeAxis, { includeMilliseconds: false });
  }
  return d3.tickFormat(domainStart, domainEnd, tickCount);
}

function renderDepthAxis(svg, yScale, indexCurve, depthUnit, dimensions, timeAxis = null) {
  const [domainStart, domainEnd] = normalizeDepthDomain(
    Number(yScale.domain()?.[0]),
    Number(yScale.domain()?.[1])
  );
  const axis = d3
    .axisLeft(yScale)
    .ticks(DEPTH_AXIS_TICK_COUNT)
    .tickFormat(resolveDepthTickFormatter(domainStart, domainEnd, DEPTH_AXIS_TICK_COUNT, timeAxis));
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
    .text(resolveIndexLabel(indexCurve, depthUnit, timeAxis));
}

function resolveIndexLabel(indexCurve, depthUnit, timeAxis = null) {
  if (String(timeAxis?.mode || '').trim() === 'clock') {
    const timezone = String(timeAxis?.timezone || '').trim() || 'UTC';
    const prefix = String(indexCurve ?? '').trim() || 'TIME';
    return `${prefix} (clock, ${timezone})`;
  }
  if (!depthUnit) return indexCurve ?? '';
  return `${indexCurve ?? ''} (${depthUnit})`;
}

function renderTrackSeries(svg, series, yScale, dimensions) {
  const colors = d3.schemeTableau10;
  return series.map((entry, index) =>
    renderTrack(svg, entry, index, yScale, colors[index % colors.length], dimensions)
  );
}

function renderTrack(svg, entry, index, yScale, color, dimensions) {
  const trackX = dimensions.margin.left + index * dimensions.trackWidth;
  renderTrackBoundary(svg, trackX, dimensions);
  renderTrackHeader(svg, entry, trackX, color, dimensions);
  const points = Array.isArray(entry?.points) ? entry.points : [];

  const values = extractTrackValues(points);
  if (values.length === 0) {
    return {
      mnemonic: entry?.mnemonic ?? '',
      unit: entry?.unit ?? '',
      points
    };
  }

  const xScale = createTrackScale(values, trackX, dimensions.trackWidth);
  renderTrackLine(svg, points, xScale, yScale, color);
  renderTrackAxis(svg, xScale, dimensions);

  return {
    mnemonic: entry?.mnemonic ?? '',
    unit: entry?.unit ?? '',
    points
  };
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
