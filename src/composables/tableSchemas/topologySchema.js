import {
  NODE_KIND_FORMATION_ANNULUS,
  SOURCE_KIND_SCENARIO
} from '@/topology/topologyTypes.js';
import {
  filterScenarioBreakoutRows,
  filterScenarioSourceRows,
  mergeScenarioBreakoutRows,
  mergeScenarioSourceRows
} from '@/topology/sourceRows.js';
import {
  TOPOLOGY_SOURCE_TYPE_OPTIONS,
  TOPOLOGY_SOURCE_VOLUME_OPTIONS,
  buildTopologySourceVolumeRenderer
} from './baseSchemaUtils.js';

const TOPOLOGY_SOURCE_NUMERIC_FIELDS = new Set(['top', 'bottom']);

function resolveTranslator(t) {
  return typeof t === 'function' ? t : (key) => key;
}

function resolveFallbackTranslator(tf) {
  return typeof tf === 'function'
    ? tf
    : (_key, fallback) => fallback;
}

export function buildTopologySourceSchema(domainState, options = {}) {
  const t = resolveTranslator(options?.t);
  const tf = resolveFallbackTranslator(options?.tf);
  const topologyVolumeRenderer = buildTopologySourceVolumeRenderer();

  return {
    getData: () => filterScenarioSourceRows(domainState.topologySources),
    prepareData: (rows) => rows.map((row) => ({
      ...row,
      show: row?.show !== false
    })),
    colHeaders: () => [
      tf('table.topology_sources.top', 'Top'),
      tf('table.topology_sources.bottom', 'Bottom'),
      tf('table.topology_sources.source_type', 'Source type'),
      tf('table.topology_sources.volume_key', 'Volume'),
      tf('table.topology_sources.label', 'Label'),
      tf('table.topology_sources.show', 'Show')
    ],
    columns: () => [
      { data: 'top', type: 'numeric' },
      { data: 'bottom', type: 'numeric' },
      {
        data: 'sourceType',
        type: 'dropdown',
        source: TOPOLOGY_SOURCE_TYPE_OPTIONS,
        strict: false,
        allowInvalid: true
      },
      {
        data: 'volumeKey',
        type: 'dropdown',
        source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
        strict: false,
        allowInvalid: true,
        renderer: topologyVolumeRenderer
      },
      { data: 'label', type: 'text' },
      { data: 'show', type: 'checkbox', className: 'htCenter' }
    ],
    requiredFields: ['top', 'bottom', 'sourceType', 'volumeKey'],
    numericFields: TOPOLOGY_SOURCE_NUMERIC_FIELDS,
    sampleKeyFields: ['label'],
    afterChangeIgnoreSources: ['loadData', 'normalize'],
    triggersSchematicRender: false,
    enableRowSelection: false,
    mapRowsForStore: (rows) => mergeScenarioSourceRows(domainState.topologySources, rows),
    buildDefaultRow: () => ({
      top: 9000,
      bottom: 9000,
      sourceType: 'formation_inflow',
      volumeKey: NODE_KIND_FORMATION_ANNULUS,
      fromVolumeKey: null,
      toVolumeKey: null,
      label: t('defaults.new_topology_source'),
      show: true
    })
  };
}

export function buildTopologyBreakoutSchema(domainState, options = {}) {
  const t = resolveTranslator(options?.t);
  const tf = resolveFallbackTranslator(options?.tf);
  const topologyVolumeRenderer = buildTopologySourceVolumeRenderer();

  return {
    getData: () => filterScenarioBreakoutRows(domainState.topologySources),
    prepareData: (rows) => rows.map((row) => ({
      ...row,
      show: row?.show !== false
    })),
    colHeaders: () => [
      tf('table.topology_sources.top', 'Top'),
      tf('table.topology_sources.bottom', 'Bottom'),
      tf('table.topology_sources.from_volume_key', 'From volume'),
      tf('table.topology_sources.to_volume_key', 'To volume'),
      tf('table.topology_sources.label', 'Label'),
      tf('table.topology_sources.show', 'Show')
    ],
    columns: () => [
      { data: 'top', type: 'numeric' },
      { data: 'bottom', type: 'numeric' },
      {
        data: 'fromVolumeKey',
        type: 'dropdown',
        source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
        strict: false,
        allowInvalid: true,
        renderer: topologyVolumeRenderer
      },
      {
        data: 'toVolumeKey',
        type: 'dropdown',
        source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
        strict: false,
        allowInvalid: true,
        renderer: topologyVolumeRenderer
      },
      { data: 'label', type: 'text' },
      { data: 'show', type: 'checkbox', className: 'htCenter' }
    ],
    requiredFields: ['top', 'bottom', 'fromVolumeKey', 'toVolumeKey'],
    numericFields: TOPOLOGY_SOURCE_NUMERIC_FIELDS,
    sampleKeyFields: ['label'],
    afterChangeIgnoreSources: ['loadData', 'normalize'],
    triggersSchematicRender: false,
    enableRowSelection: false,
    mapRowsForStore: (rows) => mergeScenarioBreakoutRows(domainState.topologySources, rows),
    buildDefaultRow: () => ({
      top: 9000,
      bottom: 9000,
      sourceType: SOURCE_KIND_SCENARIO,
      volumeKey: null,
      fromVolumeKey: 'ANNULUS_A',
      toVolumeKey: 'ANNULUS_B',
      label: t('defaults.new_topology_breakout'),
      show: true
    })
  };
}

export default {
  buildTopologySourceSchema,
  buildTopologyBreakoutSchema
};
