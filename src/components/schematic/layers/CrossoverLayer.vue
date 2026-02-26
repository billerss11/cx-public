<script setup>
import { computed } from 'vue';
import { COLOR_PALETTES, PHYSICS_CONSTANTS } from '@/constants/index.js';
import { estimateCasingID, parseOptionalNumber } from '@/utils/general.js';
import { isOpenHoleRow } from '@/app/domain.js';

const props = defineProps({
  connections: {
    type: Array,
    default: () => []
  },
  pipeData: {
    type: Array,
    default: () => []
  },
  casingData: {
    type: Array,
    default: () => []
  },
  xScale: {
    type: Function,
    required: true
  },
  yScale: {
    type: Function,
    required: true
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  crossoverPixelHalfHeight: {
    type: Number,
    default: 5
  },
  colorPalette: {
    type: String,
    default: 'Tableau 10'
  }
});

const paletteColors = computed(() => (
  COLOR_PALETTES[props.colorPalette] ?? COLOR_PALETTES['Tableau 10']
));

function normalizePipeType(pipeType) {
  const normalized = String(pipeType ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function resolveInnerDiameter(row, od) {
  const overrideId = Number(row?.idOverride);
  const weight = parseOptionalNumber(row?.weight) ?? 0;
  const estimatedId = estimateCasingID(od, weight);
  const finalId = Number.isFinite(overrideId) && overrideId > 0 ? overrideId : estimatedId;
  if (Number.isFinite(finalId) && finalId > 0) {
    return Math.min(finalId, od);
  }
  return od * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;
}

const normalizedRows = computed(() => {
  const rows = Array.isArray(props.pipeData) && props.pipeData.length > 0
    ? props.pipeData
    : (Array.isArray(props.casingData) ? props.casingData : []);
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  return rows.map((row, index) => {
    const od = parseOptionalNumber(row?.od);
    if (!Number.isFinite(od) || od <= 0) return null;
    const innerDiameter = resolveInnerDiameter(row, od);
    const wallThickness = ((od - innerDiameter) / 2) * diameterScale;
    const pipeType = normalizePipeType(row?.pipeType);
    const sourceRowIndex = Number.isInteger(Number(row?.sourceIndex))
      ? Number(row.sourceIndex)
      : index;
    return {
      pipeType,
      index: sourceRowIndex,
      od,
      outerLeft: -(od / 2) * diameterScale,
      outerRight: (od / 2) * diameterScale,
      wallThickness,
      isOpenHole: isOpenHoleRow(row)
    };
  });
});

const crossovers = computed(() => {
  const byKey = new Map();
  normalizedRows.value.forEach((row) => {
    if (!row) return;
    byKey.set(`${row.pipeType}:${row.index}`, row);
  });

  const pxHalf = Number(props.crossoverPixelHalfHeight);
  const crossoverHalfHeight = Number.isFinite(pxHalf) && pxHalf >= 0 ? pxHalf : 5;

  const connections = Array.isArray(props.connections) ? props.connections : [];
  return connections
    .map((connection) => {
      const pipeType = normalizePipeType(connection?.pipeType);
      const upperIndex = Number(connection?.upperIndex);
      const lowerIndex = Number(connection?.lowerIndex);
      if (!Number.isInteger(upperIndex) || !Number.isInteger(lowerIndex)) return null;

      const prev = byKey.get(`${pipeType}:${upperIndex}`);
      const curr = byKey.get(`${pipeType}:${lowerIndex}`);
      if (!prev || !curr) return null;

      const wallThickness = Math.min(prev.wallThickness || 0, curr.wallThickness || 0);
      if (!Number.isFinite(wallThickness) || wallThickness <= 0) return null;

      const connectionTop = Number.isFinite(Number(connection?.depthTop))
        ? Number(connection.depthTop)
        : Number.NaN;
      const connectionBottom = Number.isFinite(Number(connection?.depthBottom))
        ? Number(connection.depthBottom)
        : Number.NaN;
      if (!Number.isFinite(connectionTop) || !Number.isFinite(connectionBottom)) return null;

      const yTop = props.yScale(connectionTop) - crossoverHalfHeight;
      const yBottom = props.yScale(connectionBottom) + crossoverHalfHeight;
      if (!Number.isFinite(yTop) || !Number.isFinite(yBottom) || yBottom <= yTop) return null;

      const leftPoints = [
        [props.xScale(prev.outerLeft), yTop],
        [props.xScale(prev.outerLeft + wallThickness), yTop],
        [props.xScale(curr.outerLeft + wallThickness), yBottom],
        [props.xScale(curr.outerLeft), yBottom]
      ];

      const rightPoints = [
        [props.xScale(prev.outerRight - wallThickness), yTop],
        [props.xScale(prev.outerRight), yTop],
        [props.xScale(curr.outerRight), yBottom],
        [props.xScale(curr.outerRight - wallThickness), yBottom]
      ];

      const isOpenHoleTransition = prev.isOpenHole || curr.isOpenHole;
      const defaultColor = pipeType === 'tubing'
        ? 'var(--color-pipe-tubing)'
        : (pipeType === 'drillString'
          ? 'var(--color-pipe-drillstring)'
          : (paletteColors.value[upperIndex % paletteColors.value.length] ?? 'var(--color-accent-primary)'));

      return {
        id: `${pipeType}-${upperIndex}-${lowerIndex}-${connectionTop}-${connectionBottom}`,
        leftPoints: leftPoints.map((point) => point.join(',')).join(' '),
        rightPoints: rightPoints.map((point) => point.join(',')).join(' '),
        fill: isOpenHoleTransition ? 'none' : defaultColor,
        stroke: isOpenHoleTransition ? 'var(--color-brown-accent)' : 'var(--color-ink-strong)',
        strokeDasharray: isOpenHoleTransition ? '5,5' : null
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="crossover-layer">
    <g
      v-for="crossover in crossovers"
      :key="crossover.id"
      class="crossover-layer__group"
    >
      <polygon
        class="crossover-layer__wall"
        :points="crossover.leftPoints"
        :fill="crossover.fill"
        :stroke="crossover.stroke"
        :stroke-dasharray="crossover.strokeDasharray"
      />
      <polygon
        class="crossover-layer__wall"
        :points="crossover.rightPoints"
        :fill="crossover.fill"
        :stroke="crossover.stroke"
        :stroke-dasharray="crossover.strokeDasharray"
      />
    </g>
  </g>
</template>

<style scoped>
.crossover-layer__wall {
  stroke-width: 1;
}
</style>
