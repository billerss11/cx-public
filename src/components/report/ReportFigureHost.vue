<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import SchematicCanvas from '@/components/schematic/SchematicCanvas.vue';
import DirectionalSchematicCanvas from '@/components/schematic/DirectionalSchematicCanvas.vue';
import TopologyReportGraphFigure from '@/components/report/TopologyReportGraphFigure.vue';
import { serializeStyledSvg } from '@/app/svgExport.js';

defineOptions({ name: 'ReportFigureHost' });

const props = defineProps({
  snapshot: {
    type: Object,
    required: true
  },
  topologyResult: {
    type: Object,
    default: null
  },
  topologyGraph: {
    type: Object,
    default: null
  },
  includeTopologyGraph: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['ready', 'error']);

const analysisRequestId = 1;
const schematicSvgElement = ref(null);
const schematicSvgMarkup = ref(null);
const topologyGraphSvgMarkup = ref(null);
const directionalGeometryReady = ref(false);
const hasEmittedReady = ref(false);

const isDirectionalView = computed(() => (
  String(props.snapshot?.config?.viewMode ?? '').trim().toLowerCase() === 'directional'
));

const shouldRenderTopologyGraph = computed(() => {
  if (props.includeTopologyGraph !== true) return false;
  return Number(props.topologyGraph?.nodeCount ?? 0) > 0
    && Number(props.topologyGraph?.edgeCount ?? 0) > 0;
});

watch(isDirectionalView, (value) => {
  directionalGeometryReady.value = value !== true;
}, { immediate: true });

watch(shouldRenderTopologyGraph, (value) => {
  if (!value) {
    topologyGraphSvgMarkup.value = '';
    emitReadyIfComplete();
  }
}, { immediate: true });

function emitReadyIfComplete() {
  if (hasEmittedReady.value) return;
  if (schematicSvgMarkup.value === null) return;
  if (topologyGraphSvgMarkup.value === null) return;

  hasEmittedReady.value = true;
  emit('ready', {
    schematicSvg: schematicSvgMarkup.value || '',
    topologyGraphSvg: topologyGraphSvgMarkup.value || ''
  });
}

async function finalizeSchematicSvg() {
  if (!schematicSvgElement.value) return;
  if (isDirectionalView.value && directionalGeometryReady.value !== true) return;

  await nextTick();
  try {
    schematicSvgMarkup.value = serializeStyledSvg(schematicSvgElement.value);
    emitReadyIfComplete();
  } catch (error) {
    emit('error', error);
  }
}

function handleSchematicSvgReady(svgElement) {
  schematicSvgElement.value = svgElement ?? null;
  if (!svgElement) {
    schematicSvgMarkup.value = null;
    return;
  }
  void finalizeSchematicSvg();
}

function handleDirectionalGeometryReady() {
  directionalGeometryReady.value = true;
  void finalizeSchematicSvg();
}

async function handleTopologyGraphSvgReady(svgElement) {
  if (!svgElement) {
    topologyGraphSvgMarkup.value = '';
    emitReadyIfComplete();
    return;
  }

  await nextTick();
  try {
    topologyGraphSvgMarkup.value = serializeStyledSvg(svgElement);
    emitReadyIfComplete();
  } catch (error) {
    emit('error', error);
  }
}
</script>

<template>
  <div class="report-figure-host" aria-hidden="true">
    <DirectionalSchematicCanvas
      v-if="isDirectionalView"
      :project-data="snapshot.stateSnapshot"
      :config="snapshot.config"
      :readonly="true"
      :topology-result="topologyResult"
      :analysis-request-id="analysisRequestId"
      @svg-ready="handleSchematicSvgReady"
      @analysis-geometry-ready="handleDirectionalGeometryReady"
    />
    <SchematicCanvas
      v-else
      :project-data="snapshot.stateSnapshot"
      :config="snapshot.config"
      :topology-result="topologyResult"
      :readonly="true"
      :allow-readonly-selection="false"
      :allow-tooltips="false"
      @svg-ready="handleSchematicSvgReady"
    />

    <TopologyReportGraphFigure
      v-if="shouldRenderTopologyGraph"
      :graph="topologyGraph"
      @svg-ready="handleTopologyGraphSvgReady"
    />
  </div>
</template>

<style scoped>
.report-figure-host {
  position: fixed;
  left: -20000px;
  top: 0;
  width: 1400px;
  min-height: 900px;
  pointer-events: none;
  opacity: 0;
}
</style>
