function normalizeOffset(activePreviewId, labelId, previewOffset) {
  const active = String(activePreviewId ?? '').trim();
  const current = String(labelId ?? '').trim();
  if (!active || !current || active !== current) return null;

  const offsetX = Number(previewOffset?.x);
  const offsetY = Number(previewOffset?.y);
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null;

  return {
    x: offsetX,
    y: offsetY
  };
}

function shiftAbsoluteTextRows(rows = [], offset) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    x: Number(row?.x) + offset.x,
    y: Number(row?.y) + offset.y
  }));
}

function shiftTextLines(lines = [], offset) {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    ...line,
    x: Number(line?.x) + offset.x,
    ...(Number.isFinite(Number(line?.y)) ? { y: Number(line.y) + offset.y } : {})
  }));
}

function resolveAnchor(label = {}) {
  const anchorX = Number.isFinite(Number(label?.anchorX))
    ? Number(label.anchorX)
    : (Number.isFinite(Number(label?.arrowEndX)) ? Number(label.arrowEndX) : Number(label?.lineX1));
  const anchorY = Number.isFinite(Number(label?.anchorY))
    ? Number(label.anchorY)
    : (Number.isFinite(Number(label?.arrowEndY)) ? Number(label.arrowEndY) : Number(label?.lineY1));
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;
  return { x: anchorX, y: anchorY };
}

export function applyPreviewToArrowedBoxLabel(label = {}, activePreviewId, previewOffset, options = {}) {
  const offset = normalizeOffset(activePreviewId, label?.id, previewOffset);
  if (!offset) return label;

  const boxX = Number(label?.boxX) + offset.x;
  const boxY = Number(label?.boxY) + offset.y;
  const boxWidth = Number(label?.boxWidth);
  const boxHeight = Number(label?.boxHeight);
  const anchor = resolveAnchor(label);
  if (!Number.isFinite(boxX) || !Number.isFinite(boxY) || !Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || !anchor) {
    return label;
  }

  const centerX = boxX + (boxWidth / 2);
  const centerY = boxY + (boxHeight / 2);
  const connectorX = centerX <= anchor.x ? boxX + boxWidth : boxX;
  const connectorY = centerY;

  const next = {
    ...label,
    boxX,
    boxY
  };

  if (Number.isFinite(Number(label?.textX))) {
    next.textX = Number(label.textX) + offset.x;
  }
  if (Number.isFinite(Number(label?.textY))) {
    next.textY = Number(label.textY) + offset.y;
  }
  if (Array.isArray(label?.textRows)) {
    next.textRows = shiftAbsoluteTextRows(label.textRows, offset);
  }
  if (Array.isArray(label?.textLines)) {
    next.textLines = shiftTextLines(label.textLines, offset);
  }

  if (typeof options.buildArrowGeometry === 'function') {
    const arrow = options.buildArrowGeometry(connectorX, connectorY, anchor.x, anchor.y);
    if (arrow) next.arrow = arrow;
  }

  if (typeof options.buildArrowHeadPoints === 'function') {
    const points = options.buildArrowHeadPoints([connectorX, connectorY], [anchor.x, anchor.y], 6, 3);
    if (points) next.arrowHeadPoints = points;
    next.lineX2 = connectorX;
    next.lineY2 = connectorY;
  }

  if (Number.isFinite(Number(label?.arrowStartX))) next.arrowStartX = connectorX;
  if (Number.isFinite(Number(label?.arrowStartY))) next.arrowStartY = connectorY;

  return next;
}

export function applyPreviewToDirectionalLineOverlay(line = {}, activePreviewId, previewOffset, options = {}) {
  const offset = normalizeOffset(activePreviewId, line?.id, previewOffset);
  if (!offset) return line;

  const next = { ...line };
  const resolveDepthFromPreviewY = options.resolveDepthFromPreviewY;
  const resolveSegmentAtDepth = options.resolveSegmentAtDepth;

  if (line?.activeMode === 'md' &&
    typeof resolveDepthFromPreviewY === 'function' &&
    typeof resolveSegmentAtDepth === 'function') {
    const nextDepth = Number(resolveDepthFromPreviewY(Number(line?.y) + offset.y));
    const segment = resolveSegmentAtDepth(nextDepth);
    if (segment) {
      const centerY = (Number(segment.y1) + Number(segment.y2)) / 2;
      const deltaY = centerY - Number(line?.y);
      next.y = centerY;
      next.x1 = Number(segment.x1);
      next.y1 = Number(segment.y1);
      next.x2 = Number(segment.x2);
      next.y2 = Number(segment.y2);
      if (Number.isFinite(Number(line?.boxY))) next.boxY = Number(line.boxY) + deltaY;
      if (Number.isFinite(Number(line?.textY))) next.textY = Number(line.textY) + deltaY;
      if (Array.isArray(line?.textLines)) {
        next.textLines = line.textLines.map((textLine) => ({
          ...textLine,
          ...(Number.isFinite(Number(textLine?.y)) ? { y: Number(textLine.y) + deltaY } : {})
        }));
      }
      return next;
    }
  }

  next.y = Number(line?.y) + offset.y;
  next.y1 = Number(line?.y1) + offset.y;
  next.y2 = Number(line?.y2) + offset.y;
  if (Number.isFinite(Number(line?.boxY))) next.boxY = Number(line.boxY) + offset.y;
  if (Number.isFinite(Number(line?.textY))) next.textY = Number(line.textY) + offset.y;
  if (Array.isArray(line?.textLines)) {
    next.textLines = line.textLines.map((textLine) => ({
      ...textLine,
      ...(Number.isFinite(Number(textLine?.y)) ? { y: Number(textLine.y) + offset.y } : {})
    }));
  }
  return next;
}

export default {
  applyPreviewToArrowedBoxLabel,
  applyPreviewToDirectionalLineOverlay
};
