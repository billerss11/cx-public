import {
  resolveDirectionalLineLabelPlacement,
  resolveDirectionalLinePointFromOffset,
  resolveDirectionalLineProjectedDelta
} from '@/utils/directionalLineLabelGeometry.js';

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

function resolvePreviewedDirectionalLineLabelGeometry(line = {}, centerlineAnchor = {}, offsetPx = null, segmentOverride = null) {
  const boxWidth = Number(line?.boxWidth);
  const boxHeight = Number(line?.boxHeight);
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || !Number.isFinite(offsetPx)) return null;
  const segment = segmentOverride ?? {
    x1: line?.x1,
    y1: line?.y1,
    x2: line?.x2,
    y2: line?.y2
  };
  const anchorPoint = resolveDirectionalLinePointFromOffset(centerlineAnchor, segment, offsetPx);
  if (!anchorPoint) return null;
  const placement = resolveDirectionalLineLabelPlacement({
    segment,
    anchorX: anchorPoint.x,
    anchorY: anchorPoint.y,
    boxWidth,
    boxHeight,
    textAnchor: line?.textAnchor,
    normalOffsetPx: line?.normalOffsetPx
  });
  if (!placement) return null;

  return {
    ...placement,
    offsetPx,
    anchorX: anchorPoint.x,
    anchorY: anchorPoint.y
  };
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
      next.y = centerY;
      next.x1 = Number(segment.x1);
      next.y1 = Number(segment.y1);
      next.x2 = Number(segment.x2);
      next.y2 = Number(segment.y2);
      const nextPlacement = resolvePreviewedDirectionalLineLabelGeometry(
        {
          ...line,
          x1: next.x1,
          y1: next.y1,
          x2: next.x2,
          y2: next.y2
        },
        {
          x: Number(segment?.centerlineAnchorX ?? line?.centerlineAnchorX),
          y: Number(segment?.centerlineAnchorY ?? line?.centerlineAnchorY)
        },
        Number(line?.centerlineOffsetPx),
        {
          x1: next.x1,
          y1: next.y1,
          x2: next.x2,
          y2: next.y2
        }
      );
      if (nextPlacement) {
        const startBoxX = Number(line?.boxX);
        const startBoxY = Number(line?.boxY);
        const deltaX = Number.isFinite(startBoxX) ? nextPlacement.boxX - startBoxX : 0;
        const deltaY = Number.isFinite(startBoxY) ? nextPlacement.boxY - startBoxY : 0;
        next.centerlineAnchorX = Number(segment?.centerlineAnchorX ?? line?.centerlineAnchorX);
        next.centerlineAnchorY = Number(segment?.centerlineAnchorY ?? line?.centerlineAnchorY);
        next.centerlineOffsetPx = nextPlacement.offsetPx;
        next.anchorScreenX = nextPlacement.anchorX;
        next.anchorScreenY = nextPlacement.anchorY;
        next.boxX = nextPlacement.boxX;
        next.boxY = nextPlacement.boxY;
        if (Number.isFinite(Number(line?.textX))) next.textX = Number(line.textX) + deltaX;
        if (Number.isFinite(Number(line?.textY))) next.textY = Number(line.textY) + deltaY;
        if (Array.isArray(line?.textLines)) {
          next.textLines = line.textLines.map((textLine) => ({
            ...textLine,
            x: Number(textLine?.x) + deltaX,
            ...(Number.isFinite(Number(textLine?.y)) ? { y: Number(textLine.y) + deltaY } : {})
          }));
        }
        return next;
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

export function applyPreviewToDirectionalLineLabel(line = {}, activePreviewId, previewOffset, options = {}) {
  const previewId = options.previewId ?? `${line?.id}:label`;
  const offset = normalizeOffset(activePreviewId, previewId, previewOffset);
  if (!offset) return line;

  const bounds = options.bounds && typeof options.bounds === 'object'
    ? options.bounds
    : null;
  const boxWidth = Number(line?.boxWidth);
  const boxHeight = Number(line?.boxHeight);
  const startBoxX = Number(line?.boxX);
  const startBoxY = Number(line?.boxY);
  if (!Number.isFinite(boxWidth) || !Number.isFinite(boxHeight) || !Number.isFinite(startBoxX) || !Number.isFinite(startBoxY)) {
    return line;
  }

  const minX = Number(bounds?.left);
  const maxX = Number(bounds?.right);
  let deltaX;
  let deltaY;
  let next;
  if (line?.activeMode === 'md') {
    const deltaAlongLine = resolveDirectionalLineProjectedDelta({
      x1: line?.x1,
      y1: line?.y1,
      x2: line?.x2,
      y2: line?.y2
    }, offset);
    const startOffsetPx = Number(line?.centerlineOffsetPx);
    const nextOffsetPx = Number.isFinite(startOffsetPx) && Number.isFinite(deltaAlongLine)
      ? startOffsetPx + deltaAlongLine
      : startOffsetPx;
    const nextPlacement = resolvePreviewedDirectionalLineLabelGeometry(
      line,
      {
        x: Number(line?.centerlineAnchorX),
        y: Number(line?.centerlineAnchorY)
      },
      nextOffsetPx
    );
    if (!nextPlacement) return line;

    deltaX = nextPlacement.boxX - startBoxX;
    deltaY = nextPlacement.boxY - startBoxY;
    next = {
      ...line,
      centerlineOffsetPx: nextPlacement.offsetPx,
      anchorScreenX: nextPlacement.anchorX,
      anchorScreenY: nextPlacement.anchorY,
      boxX: nextPlacement.boxX,
      boxY: nextPlacement.boxY
    };
  } else {
    const nextCenterXRaw = startBoxX + (boxWidth / 2) + offset.x;
    const nextCenterX = Number.isFinite(minX) && Number.isFinite(maxX)
      ? Math.max(Math.min(nextCenterXRaw, Math.max(minX, maxX) - (boxWidth / 2)), Math.min(minX, maxX) + (boxWidth / 2))
      : nextCenterXRaw;
    const nextBoxX = nextCenterX - (boxWidth / 2);
    const currentCenterY = startBoxY + (boxHeight / 2);
    const resolvedCenterY = currentCenterY;
    deltaX = nextBoxX - startBoxX;
    deltaY = resolvedCenterY - currentCenterY;
    next = {
      ...line,
      boxX: nextBoxX,
      boxY: startBoxY + deltaY
    };
  }

  if (Number.isFinite(Number(line?.textX))) next.textX = Number(line.textX) + deltaX;
  if (Number.isFinite(Number(line?.textY))) next.textY = Number(line.textY) + deltaY;
  if (Array.isArray(line?.textLines)) {
    next.textLines = line.textLines.map((textLine) => ({
      ...textLine,
      x: Number(textLine?.x) + deltaX,
      ...(Number.isFinite(Number(textLine?.y)) ? { y: Number(textLine.y) + deltaY } : {})
    }));
  }

  return next;
}

export default {
  applyPreviewToArrowedBoxLabel,
  applyPreviewToDirectionalLineOverlay,
  applyPreviewToDirectionalLineLabel
};
