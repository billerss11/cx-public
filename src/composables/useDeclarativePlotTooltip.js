import { formatDepthValue } from '@/utils/general.js';
import { normalizeEnumInput, t, translateEnum } from '@/app/i18n.js';

function resolveUnits(unitsLabel) {
  return unitsLabel === 'm' ? 'm' : 'ft';
}

function resolveDepthRangeText(top, bottom, units) {
  const topText = formatDepthValue(top);
  const bottomText = formatDepthValue(bottom);
  return topText === bottomText
    ? `${topText} ${units}`
    : `${topText}-${bottomText} ${units}`;
}

export function buildCasingTooltipModel(casing, unitsLabel = 'ft') {
  if (!casing || typeof casing !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const odValue = Number(casing.od);
  const weightValue = Number(casing.weight);
  const gradeText = String(casing.grade ?? '').trim();
  const odText = Number.isFinite(odValue)
    ? t('tooltip.od', { value: odValue.toFixed(3) })
    : t('common.unknown_od');

  const specParts = [odText];
  if (Number.isFinite(weightValue)) {
    specParts.push(`${weightValue.toFixed(1)}#`);
  }
  if (gradeText) {
    specParts.push(gradeText);
  }

  const lines = [
    specParts.join(' - '),
    t('tooltip.top', { value: formatDepthValue(casing.top), units }),
    t('tooltip.bottom', { value: formatDepthValue(casing.bottom), units })
  ];

  if (casing.toc !== undefined && casing.toc !== null) {
    lines.push(t('tooltip.toc', { value: formatDepthValue(casing.toc), units }));
  }
  if (casing.boc !== undefined && casing.boc !== null) {
    lines.push(t('tooltip.boc', { value: formatDepthValue(casing.boc), units }));
  }

  return {
    title: String(casing.label || t('common.unnamed_casing')),
    color: null,
    lines
  };
}

export function buildPipeTooltipModel(pipe, unitsLabel = 'ft', pipeType = 'casing') {
  const model = buildCasingTooltipModel(pipe, unitsLabel);
  if (!model) return null;
  const normalizedPipeType = String(pipeType ?? '').trim().toLowerCase();
  const hasLabel = String(pipe?.label ?? '').trim().length > 0;
  if (!hasLabel && normalizedPipeType !== 'casing') {
    model.title = t('common.unnamed');
  }
  return model;
}

export function buildLineTooltipModel(line, unitsLabel = 'ft') {
  if (!line || typeof line !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const lineStyle = normalizeEnumInput('lineStyle', line.lineStyle || 'solid');
  const styleLabel = translateEnum('lineStyle', lineStyle) || String(line.lineStyle || '');
  const fontSize = Number(line.fontSize);

  return {
    title: String(line.label || t('common.default_line_label')),
    color: line.color ? String(line.color) : null,
    lines: [
      t('tooltip.depth', { value: formatDepthValue(line.depth), units }),
      t('tooltip.style', { value: styleLabel }),
      t('tooltip.font', { value: Number.isFinite(fontSize) ? fontSize : 11 })
    ]
  };
}

export function buildBoxTooltipModel(box, unitsLabel = 'ft') {
  if (!box || typeof box !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const opacityRaw = Number(box.opacity);
  const opacityPercent = Number.isFinite(opacityRaw) ? opacityRaw * 100 : 30;
  const lines = [
    `${formatDepthValue(box.topDepth)} - ${formatDepthValue(box.bottomDepth)} ${units}`,
    t('tooltip.opacity', { value: opacityPercent })
  ];

  const detailText = String(box.detail ?? '').trim();
  if (detailText) {
    lines.push(detailText);
  }

  return {
    title: String(box.label || t('common.default_box')),
    color: box.color ? String(box.color) : null,
    lines
  };
}

export function buildMarkerTooltipModel(marker, unitsLabel = 'ft') {
  if (!marker || typeof marker !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const type = normalizeEnumInput('markerType', marker.type) || 'perforation';
  const typeLabel = translateEnum('markerType', type) || String(type);
  const side = normalizeEnumInput('markerSide', marker.side || '');
  const sideLabel = translateEnum('markerSide', side || marker.side || '');
  const rangeText = resolveDepthRangeText(marker.top, marker.bottom, units);

  const lines = [
    t('tooltip.type', { value: typeLabel }),
    t('tooltip.depth_value', { value: rangeText })
  ];

  const attachToLabel = String(marker.attachToRow ?? '').trim();
  if (attachToLabel) {
    lines.push(t('tooltip.target', { value: attachToLabel }));
  }
  if (marker.side) {
    lines.push(t('tooltip.side', { value: sideLabel || marker.side }));
  }
  if (marker.scale) {
    lines.push(t('tooltip.scale', { value: marker.scale }));
  }

  return {
    title: String(marker.label || typeLabel),
    color: marker.color ? String(marker.color) : null,
    lines
  };
}

export function buildPlugTooltipModel(plug, unitsLabel = 'ft') {
  if (!plug || typeof plug !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const top = formatDepthValue(plug.top);
  const bottom = formatDepthValue(plug.bottom);
  const lines = [
    t('tooltip.depth', { value: `${top}-${bottom}`, units })
  ];

  const attachToLabel = String(plug.attachToRow ?? '').trim();
  if (attachToLabel) {
    lines.push(t('tooltip.target', { value: attachToLabel }));
  }

  const hatchStyle = normalizeEnumInput('hatchStyle', plug.hatchStyle);
  if (hatchStyle && hatchStyle !== 'none') {
    lines.push(t('tooltip.hatch', { value: translateEnum('hatchStyle', hatchStyle) }));
  }

  const manualWidth = Number(plug.manualWidth);
  if (Number.isFinite(manualWidth)) {
    lines.push(t('tooltip.manual_width', { value: manualWidth.toFixed(3) }));
  }

  return {
    title: String(plug.label || t('common.default_plug')),
    color: plug.color ? String(plug.color) : null,
    lines
  };
}

export function buildFluidTooltipModel(fluid, unitsLabel = 'ft', metadata = null) {
  if (!fluid || typeof fluid !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const lines = [
    t('tooltip.depth', {
      value: `${formatDepthValue(fluid.top)}-${formatDepthValue(fluid.bottom)}`,
      units
    })
  ];

  const placement = String(fluid.placement ?? '').trim();
  if (placement) {
    lines.push(t('tooltip.target', { value: placement }));
  } else {
    const innerRef = String(fluid.innerRef ?? '').trim();
    const outerRef = String(fluid.outerRef ?? '').trim();
    if (innerRef || outerRef) {
      const boundaryText = `${innerRef || t('common.none_center')} -> ${outerRef || ''}`.trim();
      lines.push(t('tooltip.target', { value: boundaryText }));
    }
  }

  const requestedManualOd = Number(fluid.manualOD);
  const appliedManualOd = Number(metadata?.manualODApplied);
  const manualOdWasClamped = metadata?.manualODWasClamped === true;
  if (Number.isFinite(requestedManualOd)) {
    if (manualOdWasClamped && Number.isFinite(appliedManualOd)) {
      lines.push(t('tooltip.target_od', {
        value: `${requestedManualOd.toFixed(3)} -> ${appliedManualOd.toFixed(3)}`
      }));
    } else {
      lines.push(t('tooltip.target_od', { value: requestedManualOd.toFixed(3) }));
    }
  } else if (Number.isFinite(appliedManualOd)) {
    lines.push(t('tooltip.target_od', { value: appliedManualOd.toFixed(3) }));
  }

  const hatchStyle = normalizeEnumInput('hatchStyle', fluid.hatchStyle);
  if (hatchStyle && hatchStyle !== 'none') {
    lines.push(t('tooltip.hatch', { value: translateEnum('hatchStyle', hatchStyle) }));
  }

  const fontSize = Number(fluid.fontSize);
  if (Number.isFinite(fontSize)) {
    lines.push(t('tooltip.font', { value: fontSize }));
  }

  return {
    title: String(fluid.label || t('common.default_fluid')),
    color: fluid.color ? String(fluid.color) : null,
    lines
  };
}

export function buildEquipmentTooltipModel(equipment, unitsLabel = 'ft') {
  if (!equipment || typeof equipment !== 'object') return null;

  const units = resolveUnits(unitsLabel);
  const type = String(equipment.type ?? '').trim() || 'Equipment';
  const depth = Number(equipment.depth);
  const scale = Number(equipment.scale);

  const lines = [];
  if (Number.isFinite(depth)) {
    lines.push(t('tooltip.depth', { value: formatDepthValue(depth), units }));
  }
  lines.push(t('tooltip.type', { value: type }));
  if (Number.isFinite(scale)) {
    lines.push(t('tooltip.scale', { value: scale }));
  }

  return {
    title: String(equipment.label || type),
    color: equipment.color ? String(equipment.color) : null,
    lines
  };
}
