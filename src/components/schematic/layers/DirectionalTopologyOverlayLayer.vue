<script setup>
import { computed } from 'vue';
import { buildDirectionalTopologyOverlayPolygons } from './directionalTopologyOverlayModel.js';

const props = defineProps({
  intervals: {
    type: Array,
    default: () => []
  },
  topologyResult: {
    type: Object,
    default: null
  },
  projector: {
    type: Function,
    default: null
  },
  visualSizing: {
    type: Object,
    default: null
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  sampleStepMd: {
    type: Number,
    default: 20
  },
  showActiveFlow: {
    type: Boolean,
    default: true
  },
  showMinCostPath: {
    type: Boolean,
    default: true
  },
  showSpof: {
    type: Boolean,
    default: true
  },
  selectedNodeIds: {
    type: Array,
    default: () => []
  }
});

const overlayPolygons = computed(() => {
  return buildDirectionalTopologyOverlayPolygons({
    intervals: props.intervals,
    topologyResult: props.topologyResult,
    projector: props.projector,
    visualSizing: props.visualSizing,
    diameterScale: props.diameterScale,
    sampleStepMd: props.sampleStepMd,
    showActiveFlow: props.showActiveFlow,
    showMinCostPath: props.showMinCostPath,
    showSpof: props.showSpof,
    selectedNodeIds: props.selectedNodeIds
  });
});
</script>

<template>
  <g class="directional-topology-overlay-layer" aria-hidden="true">
    <polygon
      v-for="polygon in overlayPolygons"
      :key="polygon.id"
      class="directional-topology-overlay-layer__polygon"
      :points="polygon.points"
      :fill="polygon.fill"
      :stroke="polygon.stroke"
    />
  </g>
</template>

<style scoped>
.directional-topology-overlay-layer__polygon {
  pointer-events: none;
  stroke-width: 0.8px;
}
</style>
