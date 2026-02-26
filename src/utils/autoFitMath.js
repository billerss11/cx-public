function toPositiveNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export function solveOptimalFigureHeight(dataBounds, containerDimensions, margins, minimumHeight = 520) {
  const leftMargin = toPositiveNumber(margins?.left, 0);
  const rightMargin = toPositiveNumber(margins?.right, 0);
  const topMargin = toPositiveNumber(margins?.top, 0);
  const bottomMargin = toPositiveNumber(margins?.bottom, 0);

  const containerWidth = toPositiveNumber(containerDimensions?.width, 0);
  const containerHeight = toPositiveNumber(containerDimensions?.height, 0);
  const availableWidth = containerWidth - leftMargin - rightMargin;
  const availableHeight = containerHeight - topMargin - bottomMargin;
  if (availableWidth <= 0 || availableHeight <= 0) return null;

  const minX = Number(dataBounds?.minX);
  const maxX = Number(dataBounds?.maxX);
  const minTvd = Number(dataBounds?.minTvd);
  const maxTvd = Number(dataBounds?.maxTvd);
  const dataWidth = Math.max(1, Math.abs(maxX - minX));
  const dataHeight = Math.max(1, Math.abs(maxTvd - minTvd));

  const dataAspect = dataWidth / dataHeight;
  const containerAspect = availableWidth / availableHeight;

  const optimalPlotHeight = dataAspect > containerAspect
    ? (availableWidth / dataAspect)
    : availableHeight;

  const resolvedHeight = Math.round(optimalPlotHeight + topMargin + bottomMargin);
  return Math.max(minimumHeight, resolvedHeight);
}
