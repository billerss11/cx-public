const SVG_EXPORT_STYLE_PROPERTIES = Object.freeze([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'opacity',
  'color',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'word-spacing',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'paint-order',
  'white-space',
  'visibility',
  'display',
  'vector-effect',
  'shape-rendering',
  'text-rendering',
  'marker-start',
  'marker-mid',
  'marker-end',
  'rx',
  'ry'
]);

function parseSvgLength(value) {
  const token = String(value ?? '').trim();
  if (!token || token.endsWith('%')) return null;
  const parsed = Number.parseFloat(token);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveExplicitExportDimensions(svg) {
  if (!svg) return { width: null, height: null };

  const exportWidth = parseSvgLength(svg.getAttribute?.('data-export-width'));
  const exportHeight = parseSvgLength(svg.getAttribute?.('data-export-height'));
  if (!exportWidth || !exportHeight) {
    return { width: null, height: null };
  }

  return {
    width: exportWidth,
    height: exportHeight
  };
}

function inlineSvgComputedStyles(sourceNode, targetNode) {
  if (!sourceNode || !targetNode || typeof window?.getComputedStyle !== 'function') return;

  const computedStyle = window.getComputedStyle(sourceNode);
  if (!computedStyle) return;

  SVG_EXPORT_STYLE_PROPERTIES.forEach((property) => {
    const value = computedStyle.getPropertyValue(property);
    if (value) {
      targetNode.style.setProperty(property, value);
    }
  });
}

export function serializeStyledSvg(svg) {
  if (!svg) return '';

  const clonedSvg = svg.cloneNode(true);
  if (!clonedSvg) return '';

  const sourceNodes = [svg, ...svg.querySelectorAll('*')];
  const clonedNodes = [clonedSvg, ...clonedSvg.querySelectorAll('*')];
  const nodeCount = Math.min(sourceNodes.length, clonedNodes.length);

  for (let index = 0; index < nodeCount; index += 1) {
    inlineSvgComputedStyles(sourceNodes[index], clonedNodes[index]);
  }

  const explicitExport = resolveExplicitExportDimensions(svg);
  if (explicitExport.width && explicitExport.height) {
    clonedSvg.setAttribute('width', String(explicitExport.width));
    clonedSvg.setAttribute('height', String(explicitExport.height));
  }

  clonedSvg.removeAttribute('data-export-width');
  clonedSvg.removeAttribute('data-export-height');
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return new XMLSerializer().serializeToString(clonedSvg);
}
