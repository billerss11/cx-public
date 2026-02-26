<script setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef } from 'vue';
import { clamp } from '@/utils/general.js';
import {
  COLOR_PALETTES,
  DEFAULT_CEMENT_COLOR,
  DEFAULT_CEMENT_PLUG_COLOR
} from '@/constants/index.js';
import {
  buildEquipmentTooltipModel,
  buildFluidTooltipModel,
  buildMarkerTooltipModel,
  buildPipeTooltipModel,
  buildPlugTooltipModel
} from '@/composables/useDeclarativePlotTooltip.js';
import { useCrossSectionScanner } from '@/composables/useCrossSectionScanner.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import CrossSectionMarkerLayer from './layers/CrossSectionMarkerLayer.vue';
import CrossSectionEquipmentLayer from './layers/CrossSectionEquipmentLayer.vue';
import CrossSectionOpenHoleBoundaryLayer from './layers/CrossSectionOpenHoleBoundaryLayer.vue';
import CrossSectionLabels from './layers/CrossSectionLabels.vue';
import CrossSectionRingLayer from './layers/CrossSectionRingLayer.vue';
import SchematicPlotTooltip from '@/components/schematic/SchematicPlotTooltip.vue';
import { clearSelection, dispatchSchematicInteraction } from '@/app/selection.js';
import { hasInteractiveSchematicTarget, normalizeInteractionEntity } from '@/composables/useSchematicInteraction.js';
import {
  CROSS_SECTION_STYLE,
  getHatchStyleKey,
  sanitizePatternId
} from '@/app/rendering.js';
import { createClientPointerResolver } from '@/composables/useClientPointerResolver.js';

const VIEWBOX_MARGIN = 14;
const MIN_VIEWBOX_SIZE = 120;
const MIN_RENDER_SURFACE_SIZE = 96;
const PIPE_TYPES = new Set(['casing', 'tubing', 'drillString']);
const INTERACTIVE_ENTITY_TYPES = ['casing', 'tubing', 'drillString', 'fluid', 'plug', 'marker', 'equipment'];

const props = defineProps({
  depth: {
    type: Number,
    default: 0
  },
  projectData: {
    type: Object,
    default: () => ({})
  },
  config: {
    type: Object,
    default: () => ({})
  }
});

const interactionStore = useInteractionStore();
const containerRef = ref(null);
const surfaceWrapRef = ref(null);
const renderSurfaceSize = ref(230);
const tooltipVisible = ref(false);
const tooltipModel = ref(null);
const tooltipX = ref(0);
const tooltipY = ref(0);
const tooltipPointerResolver = createClientPointerResolver();

const scannerInput = computed(() => ({
  ...(props.projectData ?? {}),
  config: props.config ?? props.projectData?.config ?? {}
}));

const { crossSectionData } = useCrossSectionScanner(toRef(props, 'depth'), scannerInput);

const paletteColors = computed(() => (
  COLOR_PALETTES[props.config?.colorPalette] ??
  COLOR_PALETTES['Tableau 10'] ??
  ['var(--color-cross-mid-stroke)']
));

function resolvePipeColor(layer, fallbackIndex) {
  const pipeType = String(layer?.source?.pipeType ?? layer?.pipeType ?? '').trim().toLowerCase();
  if (pipeType === 'tubing') return 'var(--color-cursor-primary)';
  if (pipeType === 'drillstring') return 'var(--color-state-warning)';
  const colors = paletteColors.value;
  const sourceIndex = Number(layer?.source?.index);
  const paletteIndex = Number.isInteger(sourceIndex) ? sourceIndex : fallbackIndex;
  return colors[paletteIndex % colors.length] ?? 'var(--color-cross-mid-stroke)';
}

function buildHatchPatternId(prefix, layerType, token, styleKey, color) {
  const safeToken = sanitizePatternId(token);
  return `${prefix}${layerType}-${safeToken}-${styleKey}-${sanitizePatternId(color)}`;
}

const maxDiameter = computed(() => {
  const parsed = Number(crossSectionData.value?.maxDiameter);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
});

const viewBoxSize = computed(() => {
  const next = maxDiameter.value * 12;
  return Math.max(MIN_VIEWBOX_SIZE, Math.round(next));
});

const center = computed(() => viewBoxSize.value / 2);
const availableRadius = computed(() => Math.max(20, center.value - VIEWBOX_MARGIN));
const maxRadius = computed(() => maxDiameter.value / 2);
const scale = computed(() => {
  if (!Number.isFinite(maxRadius.value) || maxRadius.value <= 0) return 1;
  return availableRadius.value / maxRadius.value;
});
const viewBoxString = computed(() => `0 0 ${viewBoxSize.value} ${viewBoxSize.value}`);
const unitsLabel = computed(() => (props.config?.units === 'm' ? 'm' : 'ft'));
const sourceState = computed(() => props.projectData?.state ?? props.projectData ?? {});

const casingRows = computed(() => (
  Array.isArray(sourceState.value?.casingData) ? sourceState.value.casingData : []
));
const tubingRows = computed(() => (
  Array.isArray(sourceState.value?.tubingData) ? sourceState.value.tubingData : []
));
const drillStringRows = computed(() => (
  Array.isArray(sourceState.value?.drillStringData) ? sourceState.value.drillStringData : []
));
const fluidRows = computed(() => (
  Array.isArray(sourceState.value?.annulusFluids) ? sourceState.value.annulusFluids : []
));
const plugRows = computed(() => (
  Array.isArray(sourceState.value?.cementPlugs) ? sourceState.value.cementPlugs : []
));
const markerRows = computed(() => (
  Array.isArray(sourceState.value?.markers) ? sourceState.value.markers : []
));
const equipmentRows = computed(() => (
  Array.isArray(sourceState.value?.equipmentData) ? sourceState.value.equipmentData : []
));

function normalizePipeType(pipeType) {
  const normalized = String(pipeType ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function normalizeEntity(entity) {
  const type = String(entity?.type ?? '').trim();
  const id = Number(entity?.id);
  if (!type || !Number.isInteger(id) || id < 0) return null;
  return { type, id };
}

function resolveEntityFromLayer(layer) {
  const sourceType = String(layer?.source?.type ?? '').trim().toLowerCase();
  const sourceIndex = Number(layer?.source?.sourceIndex ?? layer?.source?.index);

  if ((sourceType === 'pipe' || sourceType === 'casing') && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
    const pipeType = sourceType === 'casing'
      ? 'casing'
      : normalizePipeType(layer?.source?.pipeType ?? layer?.pipeType);
    return { type: pipeType, id: sourceIndex };
  }
  if (sourceType === 'fluid' && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
    return { type: 'fluid', id: sourceIndex };
  }
  if (sourceType === 'plug' && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
    return { type: 'plug', id: sourceIndex };
  }
  if (sourceType === 'marker' && Number.isInteger(sourceIndex) && sourceIndex >= 0) {
    return { type: 'marker', id: sourceIndex };
  }
  return null;
}

const hasRenderableLayers = computed(() => (
  Array.isArray(crossSectionData.value?.layers) &&
  crossSectionData.value.layers.length > 0
));

const styledLayerModel = computed(() => {
  const patternMap = new Map();
  const styleConfig = CROSS_SECTION_STYLE;
  const patternPrefix = String(styleConfig?.patternPrefix ?? '').trim();
  const patternIdPrefix = patternPrefix ? `${sanitizePatternId(patternPrefix)}-` : '';
  const config = props.config ?? {};
  const layers = Array.isArray(crossSectionData.value?.layers) ? crossSectionData.value.layers : [];
  const coreFill = 'var(--color-cross-core-fill)';
  const coreStroke = 'var(--color-cross-core-stroke)';
  const annulusMudFill = 'var(--color-cross-annulus-fill)';
  const annulusMudStroke = 'var(--color-cross-annulus-stroke)';

  const styledLayers = layers
    .map((layer, index) => {
      const material = String(layer?.material ?? '');
      let fill = annulusMudFill;
      let stroke = annulusMudStroke;
      let strokeWidth = 0.4;
      let opacity = 0.75;

      if (material === 'wellbore') {
        fill = coreFill;
        stroke = 'none';
        strokeWidth = 0;
        opacity = 1;
      } else if (material === 'steel') {
        fill = resolvePipeColor(layer, index);
        stroke = 'var(--color-cross-steel-stroke)';
        strokeWidth = 0.8;
        opacity = styleConfig.steelOpacity;
      } else if (material === 'cement') {
        if (config.showCement === false) {
          fill = layer?.role === 'core' ? coreFill : annulusMudFill;
          stroke = layer?.role === 'core' ? coreStroke : annulusMudStroke;
          strokeWidth = styleConfig.cementStrokeWidth;
          opacity = styleConfig.cementOpacity;
        } else {
          const baseColor = String(config.cementColor || DEFAULT_CEMENT_COLOR);
          fill = baseColor;
          const hatchKey = config.cementHatchEnabled === true
            ? getHatchStyleKey(config.cementHatchStyle)
            : 'none';
          if (hatchKey !== 'none') {
            const patternId = buildHatchPatternId(patternIdPrefix, 'cement', 'global', hatchKey, baseColor);
            if (!patternMap.has(patternId)) {
              patternMap.set(patternId, { id: patternId, styleKey: hatchKey, color: baseColor });
            }
            fill = `url(#${patternId})`;
          }
          stroke = 'var(--color-cross-mid-stroke)';
          strokeWidth = styleConfig.cementStrokeWidth;
          opacity = styleConfig.cementOpacity;
        }
      } else if (material === 'fluid') {
        if (layer?.role === 'core') {
          fill = coreFill;
          stroke = coreStroke;
          strokeWidth = styleConfig.fluidStrokeWidth;
          opacity = 1;
        } else {
          const baseColor = String(layer?.color || DEFAULT_CEMENT_COLOR);
          fill = baseColor;
          const hatchKey = getHatchStyleKey(layer?.hatchStyle || 'none');
          if (hatchKey !== 'none') {
            const token = String(layer?.source?.index ?? 'x');
            const patternId = buildHatchPatternId(patternIdPrefix, 'fluid', token, hatchKey, baseColor);
            if (!patternMap.has(patternId)) {
              patternMap.set(patternId, { id: patternId, styleKey: hatchKey, color: baseColor });
            }
            fill = `url(#${patternId})`;
          }
          stroke = 'var(--color-cross-mid-stroke)';
          strokeWidth = styleConfig.fluidStrokeWidth;
          opacity = styleConfig.fluidOpacity;
        }
      } else if (material === 'plug') {
        const baseColor = String(layer?.color || DEFAULT_CEMENT_PLUG_COLOR);
        fill = baseColor;
        const hatchKey = getHatchStyleKey(layer?.hatchStyle || 'none');
        if (hatchKey !== 'none') {
          const token = String(layer?.source?.index ?? 'x');
          const patternId = buildHatchPatternId(patternIdPrefix, 'plug', token, hatchKey, baseColor);
          if (!patternMap.has(patternId)) {
            patternMap.set(patternId, { id: patternId, styleKey: hatchKey, color: baseColor });
          }
          fill = `url(#${patternId})`;
        }
        stroke = 'var(--color-cross-steel-stroke)';
        strokeWidth = styleConfig.plugStrokeWidth;
        opacity = styleConfig.plugOpacity;
      } else if (material === 'void') {
        fill = 'none';
        stroke = 'none';
        strokeWidth = 0;
        opacity = 0;
      } else if (layer?.role === 'core') {
        fill = coreFill;
        stroke = coreStroke;
        strokeWidth = 0.45;
        opacity = 1;
      }

      return {
        ...layer,
        id: layer?.id ?? `cross-layer-${index}`,
        interactionEntity: resolveEntityFromLayer(layer),
        fill,
        stroke,
        strokeWidth,
        opacity
      };
    })
    .filter((layer) => !(layer.fill === 'none' && layer.stroke === 'none'));

  return {
    layers: styledLayers,
    patterns: Array.from(patternMap.values())
  };
});

const renderLayers = computed(() => styledLayerModel.value.layers);
const hatchPatterns = computed(() => styledLayerModel.value.patterns);

const activeEntity = computed(() => {
  const lockedEntity = normalizeInteractionEntity(interactionStore.interaction.lockedEntity);
  if (lockedEntity) return lockedEntity;
  return normalizeInteractionEntity(interactionStore.interaction.hoveredEntity);
});

function resolvePipeRowsByType(pipeType) {
  const normalized = normalizePipeType(pipeType);
  if (normalized === 'casing') return casingRows.value;
  if (normalized === 'tubing') return tubingRows.value;
  if (normalized === 'drillString') return drillStringRows.value;
  return [];
}

function resolveEntityRow(entity) {
  const normalized = normalizeEntity(entity);
  if (!normalized) return null;
  if (PIPE_TYPES.has(normalized.type)) {
    const rows = resolvePipeRowsByType(normalized.type);
    return rows[normalized.id] ?? null;
  }
  if (normalized.type === 'fluid') return fluidRows.value[normalized.id] ?? null;
  if (normalized.type === 'plug') return plugRows.value[normalized.id] ?? null;
  if (normalized.type === 'marker') return markerRows.value[normalized.id] ?? null;
  if (normalized.type === 'equipment') return equipmentRows.value[normalized.id] ?? null;
  return null;
}

function resolveTooltipModel(entity) {
  const normalized = normalizeEntity(entity);
  if (!normalized) return null;
  const row = resolveEntityRow(normalized);
  if (!row) return null;

  if (PIPE_TYPES.has(normalized.type)) {
    return buildPipeTooltipModel(row, unitsLabel.value, normalized.type);
  }
  if (normalized.type === 'fluid') {
    return buildFluidTooltipModel(row, unitsLabel.value);
  }
  if (normalized.type === 'plug') {
    return buildPlugTooltipModel(row, unitsLabel.value);
  }
  if (normalized.type === 'marker') {
    return buildMarkerTooltipModel(row, unitsLabel.value);
  }
  if (normalized.type === 'equipment') {
    return buildEquipmentTooltipModel(row, unitsLabel.value);
  }
  return null;
}

function resolveTooltipPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return { x: 8, y: 8 };
  }

  if (!tooltipPointerResolver.syncFromContainer(containerRef.value)) {
    return { x: 8, y: 8 };
  }

  const surfaceSize = Math.max(MIN_RENDER_SURFACE_SIZE, Number(renderSurfaceSize.value) || 0);
  const pointer = tooltipPointerResolver.resolveFromClient(clientX, clientY, surfaceSize, surfaceSize);
  if (!pointer) {
    return { x: 8, y: 8 };
  }

  return {
    x: clamp(pointer.x, 0, surfaceSize),
    y: clamp(pointer.y, 0, surfaceSize)
  };
}

function showTooltip(model, event) {
  if (!model) {
    tooltipVisible.value = false;
    tooltipModel.value = null;
    return;
  }
  const pointer = resolveTooltipPointer(event);
  tooltipModel.value = model;
  tooltipX.value = pointer.x;
  tooltipY.value = pointer.y;
  tooltipVisible.value = true;
}

function hideTooltip() {
  tooltipVisible.value = false;
  tooltipModel.value = null;
}

function handleSelectEntity(entity, event) {
  const normalized = normalizeEntity(entity);
  if (!normalized) return;
  dispatchSchematicInteraction('select', { entity: normalized }, event);
}

function handleHoverEntity(entity, event) {
  const normalized = normalizeEntity(entity);
  if (!normalized) {
    hideTooltip();
    return;
  }
  dispatchSchematicInteraction('hover', { entity: normalized }, event);
  showTooltip(resolveTooltipModel(normalized), event);
}

function handleLeaveEntity(entity) {
  const normalized = normalizeEntity(entity);
  if (normalized) {
    dispatchSchematicInteraction('leave', { type: normalized.type });
  }
  hideTooltip();
}

function handleCanvasMouseLeave() {
  INTERACTIVE_ENTITY_TYPES.forEach((type) => {
    dispatchSchematicInteraction('leave', { type });
  });
  hideTooltip();
}

function handleBackgroundClick(event) {
  if (hasInteractiveSchematicTarget(event?.target)) return;
  clearSelection('all');
  hideTooltip();
}

const openHoleRadii = computed(() => {
  const layers = Array.isArray(crossSectionData.value?.layers) ? crossSectionData.value.layers : [];
  const keys = new Set();
  layers.forEach((layer) => {
    if (layer?.isOpenHoleBoundary !== true) return;
    const outerRadius = Number(layer?.outerRadius);
    if (!Number.isFinite(outerRadius) || outerRadius <= 0) return;
    keys.add(outerRadius.toFixed(6));
  });
  return Array.from(keys)
    .map((radius) => Number(radius))
    .filter((radius) => Number.isFinite(radius) && radius > 0)
    .sort((a, b) => a - b);
});

let surfaceResizeObserver = null;

function updateRenderSurfaceSize() {
  const rect = surfaceWrapRef.value?.getBoundingClientRect?.();
  if (!rect) return;
  const nextSize = Math.floor(Math.min(rect.width, rect.height));
  if (!Number.isFinite(nextSize) || nextSize <= 0) return;
  renderSurfaceSize.value = Math.max(MIN_RENDER_SURFACE_SIZE, nextSize);
  tooltipPointerResolver.syncFromContainer(containerRef.value, { forceRect: true });
}

onMounted(() => {
  updateRenderSurfaceSize();
  if (typeof ResizeObserver !== 'function' || !surfaceWrapRef.value) return;
  surfaceResizeObserver = new ResizeObserver(() => {
    updateRenderSurfaceSize();
  });
  surfaceResizeObserver.observe(surfaceWrapRef.value);
});

onBeforeUnmount(() => {
  surfaceResizeObserver?.disconnect?.();
  surfaceResizeObserver = null;
});
</script>

<template>
  <div class="cross-section-canvas">
    <div ref="surfaceWrapRef" class="cross-section-canvas__surface-wrap">
      <div
        ref="containerRef"
        class="cross-section-canvas__surface"
        :style="{ width: `${renderSurfaceSize}px`, height: `${renderSurfaceSize}px` }"
        @mouseleave="handleCanvasMouseLeave"
      >
        <svg
          class="cross-section-canvas__svg"
          :viewBox="viewBoxString"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Cross-section view"
          @click="handleBackgroundClick"
        >
          <defs v-if="hatchPatterns.length > 0">
            <pattern
              v-for="pattern in hatchPatterns"
              :id="pattern.id"
              :key="pattern.id"
              patternUnits="userSpaceOnUse"
              width="8"
              height="8"
            >
              <path
                v-if="pattern.styleKey === 'diag'"
                d="M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4"
                :stroke="pattern.color"
                stroke-width="1"
              />
              <path
                v-else-if="pattern.styleKey === 'cross'"
                d="M0,8 l8,-8 M0,0 l8,8"
                :stroke="pattern.color"
                stroke-width="1"
              />
              <g v-else-if="pattern.styleKey === 'dots'">
                <circle cx="2" cy="2" r="1.2" :fill="pattern.color" />
                <circle cx="6" cy="6" r="1.2" :fill="pattern.color" />
              </g>
              <path
                v-else-if="pattern.styleKey === 'grid'"
                d="M0,4 l8,0 M4,0 l0,8"
                :stroke="pattern.color"
                stroke-width="1"
              />
            </pattern>
          </defs>

        <g v-if="hasRenderableLayers" :transform="`translate(${center},${center})`">
            <circle
              :r="availableRadius + 1"
              fill="var(--color-cross-empty-fill)"
              stroke="var(--color-cross-empty-stroke)"
              stroke-width="1"
            />

            <CrossSectionRingLayer
              :items="renderLayers"
              :scale="scale"
              :min-stroke-width="0.4"
              :active-entity="activeEntity"
              @select-entity="handleSelectEntity"
              @hover-entity="handleHoverEntity"
              @leave-entity="handleLeaveEntity"
            />
            <CrossSectionOpenHoleBoundaryLayer :radii="openHoleRadii" :scale="scale" />
            <CrossSectionMarkerLayer
              :items="crossSectionData.markers"
              :scale="scale"
              :active-entity="activeEntity"
              @select-marker="handleSelectEntity"
              @hover-marker="handleHoverEntity"
              @leave-marker="handleLeaveEntity"
            />
            <CrossSectionEquipmentLayer
              :items="crossSectionData.equipment"
              :scale="scale"
              :active-entity="activeEntity"
              @select-equipment="handleSelectEntity"
              @hover-equipment="handleHoverEntity"
              @leave-equipment="handleLeaveEntity"
            />
            <CrossSectionLabels
              :items="crossSectionData.pipeLabels ?? crossSectionData.casingLabels"
              :scale="scale"
              :available-radius="availableRadius"
              :active-entity="activeEntity"
              @select-pipe-label="handleSelectEntity"
              @hover-pipe-label="handleHoverEntity"
              @leave-pipe-label="handleLeaveEntity"
            />
          </g>

          <g v-else class="cross-section-canvas__empty">
            <rect
              x="0"
              y="0"
              :width="viewBoxSize"
              :height="viewBoxSize"
              fill="var(--color-cross-empty-fill)"
            />
          </g>
        </svg>

        <SchematicPlotTooltip
          class="cross-section-canvas__tooltip"
          :visible="tooltipVisible"
          :model="tooltipModel"
          :x="tooltipX"
          :y="tooltipY"
          :container-width="renderSurfaceSize"
          :container-height="renderSurfaceSize"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cross-section-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cross-section-canvas__surface-wrap {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cross-section-canvas__surface {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--color-cross-bg-start) 0%, var(--color-cross-bg-end) 100%);
}

.cross-section-canvas__svg {
  width: 100%;
  height: 100%;
  display: block;
}

.cross-section-canvas__tooltip {
  position: absolute;
  top: 0;
  left: 0;
}
</style>
