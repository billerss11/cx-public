import Handsontable from 'handsontable';
import {
  MODELED_CASING_ANNULUS_KINDS,
  SOURCE_KIND_FORMATION_INFLOW,
  SOURCE_KIND_LEAK,
  SOURCE_KIND_PERFORATION,
  SOURCE_KIND_SCENARIO,
  TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';

export const TOPOLOGY_SOURCE_TYPE_OPTIONS = Object.freeze([
  SOURCE_KIND_FORMATION_INFLOW,
  SOURCE_KIND_PERFORATION,
  SOURCE_KIND_LEAK,
  SOURCE_KIND_SCENARIO
]);

export const TOPOLOGY_SOURCE_VOLUME_OPTIONS = TOPOLOGY_VOLUME_KINDS;

function createTopologySourceVolumeCellLabels() {
  const labels = {
    TUBING_INNER: 'TUBING_INNER (legacy BORE)',
    TUBING_ANNULUS: 'TUBING_ANNULUS (inner annulus: tubing-to-first-casing)',
    FORMATION_ANNULUS: 'FORMATION_ANNULUS (open hole / outside outermost casing)'
  };

  MODELED_CASING_ANNULUS_KINDS.forEach((kind, index) => {
    const suffix = kind.replace('ANNULUS_', '');
    labels[kind] = index === 0
      ? `${kind} (outer annulus ${suffix}: first casing-to-casing)`
      : `${kind} (outer annulus ${suffix})`;
  });

  return Object.freeze(labels);
}

export const TOPOLOGY_SOURCE_VOLUME_CELL_LABELS = createTopologySourceVolumeCellLabels();

export function buildTopologySourceVolumeRenderer() {
  return function topologySourceVolumeRenderer(instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer(instance, td, row, col, prop, value, cellProperties);
    const token = String(value ?? '').trim().toUpperCase();
    if (!token) return;
    const label = TOPOLOGY_SOURCE_VOLUME_CELL_LABELS[token];
    if (!label) return;
    td.textContent = label;
  };
}

export default {
  TOPOLOGY_SOURCE_TYPE_OPTIONS,
  TOPOLOGY_SOURCE_VOLUME_OPTIONS,
  TOPOLOGY_SOURCE_VOLUME_CELL_LABELS,
  buildTopologySourceVolumeRenderer
};
