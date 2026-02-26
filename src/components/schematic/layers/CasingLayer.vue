<script setup>
import { computed } from 'vue';
import { COLOR_PALETTES, PHYSICS_CONSTANTS } from '@/constants/index.js';
import { estimateCasingID, parseOptionalNumber } from '@/utils/general.js';
import { isOpenHoleRow } from '@/app/domain.js';
import { resolveOpenHoleWaveConfig } from '@/utils/openHoleWave.js';
import { generateWavyPath } from '@/utils/wavyPath.js';

const DEFAULT_DEPTH_LABEL_FONT_SIZE = 9;
const DEFAULT_DEPTH_LABEL_OFFSET = 35;
const FORMATION_THICKNESS = 15;

const props = defineProps({
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
  minDepth: {
    type: Number,
    default: 0
  },
  unitsLabel: {
    type: String,
    default: 'ft'
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  colorPalette: {
    type: String,
    default: 'Tableau 10'
  },
  barriers: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['select-pipe', 'hover-pipe', 'leave-pipe']);

const paletteColors = computed(() => (
  COLOR_PALETTES[props.colorPalette] ?? COLOR_PALETTES['Tableau 10']
));

const linerBarrierByRowIndex = computed(() => {
  const map = new Map();
  const barriers = Array.isArray(props.barriers) ? props.barriers : [];
  barriers.forEach((barrier) => {
    if (barrier?.type !== 'liner_packer') return;
    const rowIndex = Number(barrier?.rowIndex);
    if (!Number.isInteger(rowIndex) || map.has(rowIndex)) return;
    map.set(rowIndex, barrier);
  });
  return map;
});

function resolveDepthAnnotationGeometry(startX, depth, yScale, unitsLabel, depthLabelOffset, depthLabelFontSize) {
  const labelY = yScale(depth);
  if (!Number.isFinite(labelY)) return null;

  const offsetRaw = Number(depthLabelOffset);
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : DEFAULT_DEPTH_LABEL_OFFSET;
  const fontSizeRaw = Number(depthLabelFontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : DEFAULT_DEPTH_LABEL_FONT_SIZE;
  const text = `${Number(depth).toLocaleString()} ${unitsLabel}`;
  const boxWidth = text.length * (fontSize * 0.6) + 10;
  const boxX = startX + offset - 5;
  const boxY = labelY - 10;
  const lineEndX = startX + offset - 5;
  const lineEndY = labelY;
  const arrowTipX = lineEndX;
  const arrowTipY = lineEndY;
  const arrowSize = 3;
  const arrowPoints = [
    `${arrowTipX},${arrowTipY}`,
    `${arrowTipX - arrowSize},${arrowTipY - arrowSize}`,
    `${arrowTipX - arrowSize},${arrowTipY + arrowSize}`
  ].join(' ');

  return {
    lineX1: startX,
    lineY1: labelY,
    lineX2: lineEndX,
    lineY2: lineEndY,
    arrowPoints,
    boxX,
    boxY,
    boxWidth,
    boxHeight: 20,
    text,
    textX: startX + offset,
    textY: labelY,
    fontSize
  };
}

function normalizePipeType(pipeType) {
  const normalized = String(pipeType ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function serializePipeEntity(entity) {
  if (!entity || typeof entity !== 'object') return null;
  const pipeType = normalizePipeType(entity.pipeType ?? entity.type);
  const rowIndex = Number(entity.rowIndex ?? entity.index);
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return null;
  return `${pipeType}:${rowIndex}`;
}

function buildSideHitbox(outerX, innerX, minWidth = 10) {
  const outer = Number(outerX);
  const inner = Number(innerX);
  if (!Number.isFinite(outer) || !Number.isFinite(inner)) {
    return { x: 0, width: 0 };
  }
  const left = Math.min(outer, inner);
  const right = Math.max(outer, inner);
  const width = right - left;
  if (!Number.isFinite(width) || width <= 0) {
    return { x: left, width: 0 };
  }
  if (width >= minWidth) {
    return { x: left, width };
  }
  const center = (left + right) / 2;
  return {
    x: center - (minWidth / 2),
    width: minWidth
  };
}

function compareSegmentRenderOrder(leftSegment, rightSegment) {
  const leftOD = parseOptionalNumber(leftSegment?.row?.od);
  const rightOD = parseOptionalNumber(rightSegment?.row?.od);
  if (Number.isFinite(leftOD) && Number.isFinite(rightOD) && leftOD !== rightOD) {
    return leftOD - rightOD;
  }

  const leftIndex = Number(leftSegment?.index);
  const rightIndex = Number(rightSegment?.index);
  if (Number.isInteger(leftIndex) && Number.isInteger(rightIndex)) {
    return leftIndex - rightIndex;
  }

  return 0;
}

const casingSegments = computed(() => {
  const rows = Array.isArray(props.casingData) ? props.casingData : [];
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  return rows
    .map((row, index) => {
      const od = parseOptionalNumber(row?.od);
      const top = parseOptionalNumber(row?.top);
      const bottom = parseOptionalNumber(row?.bottom);
      if (!Number.isFinite(od) || od <= 0) return null;
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

      const pipeType = normalizePipeType(row?.pipeType);
      const isCasing = pipeType === 'casing';
      const sourceIndex = Number(row?.sourceIndex);
      const sourceRowIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : index;
      const weight = parseOptionalNumber(row?.weight) ?? 0;
      const overrideId = parseOptionalNumber(row?.idOverride);
      const estimatedId = estimateCasingID(od, weight);
      const innerDiameter = Number.isFinite(overrideId) && overrideId > 0
        ? Math.min(overrideId, od)
        : Math.min(estimatedId, od * 0.98);
      const safeInnerDiameter = Number.isFinite(innerDiameter) && innerDiameter > 0
        ? innerDiameter
        : od * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;
      const outerRadiusScaled = (od / 2) * diameterScale;
      const innerRadiusScaled = (safeInnerDiameter / 2) * diameterScale;

      const outerLeft = props.xScale(-outerRadiusScaled);
      const outerRight = props.xScale(outerRadiusScaled);
      const innerLeft = props.xScale(-innerRadiusScaled);
      const innerRight = props.xScale(innerRadiusScaled);
      const yTop = props.yScale(top);
      const yBottom = props.yScale(bottom);
      const wallHeight = yBottom - yTop;
      if (!Number.isFinite(wallHeight) || wallHeight <= 0) return null;

      const symbolHeight = Math.min(15, wallHeight);
      const hasFloatShoe = isCasing && !isOpenHoleRow(row) && Number.isFinite(symbolHeight) && symbolHeight > 0;

      const barrier = linerBarrierByRowIndex.value.get(index);
      const parentInnerDiameter = Number(barrier?.parentInnerDiameter);
      const hasLinerHanger = isCasing && barrier?.type === 'liner_packer' && Number.isFinite(parentInnerDiameter) && parentInnerDiameter > od;
      const hangerDepth = Number.isFinite(Number(barrier?.depth)) ? Number(barrier.depth) : top;
      const hangerY = props.yScale(hangerDepth);
      const hangerOuterHalfWidth = (parentInnerDiameter / 2) * diameterScale;

      const shouldShowTop = isCasing && row?.showTop !== false;
      const shouldShowBottom = isCasing && row?.showBottom !== false;
      const depthLabelOffsetRaw = parseOptionalNumber(row?.depthLabelOffset);
      const depthLabelOffset = Number.isFinite(depthLabelOffsetRaw)
        ? depthLabelOffsetRaw
        : DEFAULT_DEPTH_LABEL_OFFSET;
      const depthLabelFontSizeRaw = parseOptionalNumber(row?.depthLabelFontSize);
      const depthLabelFontSize = Number.isFinite(depthLabelFontSizeRaw)
        ? depthLabelFontSizeRaw
        : DEFAULT_DEPTH_LABEL_FONT_SIZE;
      const annotations = [];
      const buildAnnotation = (depth) => resolveDepthAnnotationGeometry(
        outerRight,
        depth,
        props.yScale,
        props.unitsLabel,
        depthLabelOffset,
        depthLabelFontSize
      );
      if (shouldShowTop && top > props.minDepth) {
        const topAnnotation = buildAnnotation(top);
        if (topAnnotation) annotations.push({ id: `top-${index}`, ...topAnnotation });
      }
      if (shouldShowBottom) {
        const bottomAnnotation = buildAnnotation(bottom);
        if (bottomAnnotation) annotations.push({ id: `bottom-${index}`, ...bottomAnnotation });
      }

      const defaultColor = pipeType === 'tubing'
        ? 'var(--color-pipe-tubing)'
        : (pipeType === 'drillString'
          ? 'var(--color-pipe-drillstring)'
          : (paletteColors.value[index % paletteColors.value.length] ?? 'var(--color-accent-primary)'));
      const pipeEntity = { pipeType, rowIndex: sourceRowIndex };
      const pipeKey = serializePipeEntity(pipeEntity);
      const leftHitbox = buildSideHitbox(outerLeft, innerLeft);
      const rightHitbox = buildSideHitbox(innerRight, outerRight);

      const isOpenHole = isOpenHoleRow(row);
      const openHoleWave = resolveOpenHoleWaveConfig(row);
      const wavyPathOptions = {
        amplitude: openHoleWave.amplitude,
        wavelength: openHoleWave.wavelength,
        seed: index
      };

      const leftWavyPath = isOpenHole
        ? generateWavyPath([[outerLeft, yTop], [outerLeft, yBottom]], wavyPathOptions)
        : '';
      const rightWavyPath = isOpenHole
        ? generateWavyPath([[outerRight, yTop], [outerRight, yBottom]], { ...wavyPathOptions, seed: index + 0.5 })
        : '';

      return {
        id: `${pipeType}-${sourceRowIndex}-${row?.label ?? 'casing'}`,
        index,
        row,
        pipeEntity,
        pipeKey,
        isCasing,
        yTop,
        yBottom,
        wallHeight,
        outerLeft,
        outerRight,
        innerLeft,
        innerRight,
        leftHitbox,
        rightHitbox,
        symbolHeight,
        hasFloatShoe,
        hasLinerHanger,
        hangerY,
        hangerOuterHalfWidth,
        annotations,
        isSelectable: Boolean(pipeKey),
        color: defaultColor,
        isOpenHole,
        leftWavyPath,
        rightWavyPath
      };
    })
    .filter(Boolean)
    // Draw wider pipes last so their transparent hitboxes win overlaps.
    .sort(compareSegmentRenderOrder);
});
</script>

<template>
  <g class="casing-layer">
    <defs>
      <pattern id="formation-dots" patternUnits="userSpaceOnUse" width="8" height="8">
        <g>
          <circle cx="2" cy="2" r="1.2" fill="var(--color-brown-light)" />
          <circle cx="6" cy="6" r="1.2" fill="var(--color-brown-light)" />
        </g>
      </pattern>
    </defs>
    <g
      v-for="segment in casingSegments"
      :key="segment.id"
      class="casing-layer__segment"
      :data-pipe-key="segment.isSelectable ? segment.pipeKey : null"
      :data-casing-index="segment.isSelectable && segment.isCasing ? segment.pipeEntity.rowIndex : null"
      @click="segment.isSelectable && emit('select-pipe', segment.pipeEntity)"
      @mousemove="segment.isSelectable && emit('hover-pipe', segment.pipeEntity, $event)"
      @mouseleave="segment.isSelectable && emit('leave-pipe', segment.pipeEntity)"
    >
      <!-- Regular Casing Wall -->
      <rect
        v-if="!segment.isOpenHole"
        class="casing-layer__wall"
        :x="segment.outerLeft"
        :y="segment.yTop"
        :width="Math.max(0, segment.innerLeft - segment.outerLeft)"
        :height="segment.wallHeight"
        :fill="segment.color"
        stroke="var(--color-ink-strong)"
      />
      <rect
        v-if="!segment.isOpenHole"
        class="casing-layer__wall"
        :x="segment.innerRight"
        :y="segment.yTop"
        :width="Math.max(0, segment.outerRight - segment.innerRight)"
        :height="segment.wallHeight"
        :fill="segment.color"
        stroke="var(--color-ink-strong)"
      />

      <!-- Open Hole Formation -->
      <g v-if="segment.isOpenHole">
        <path
          class="casing-layer__formation-fill"
          :d="`M ${segment.outerLeft},${segment.yTop} ${segment.leftWavyPath.substring(1)} L ${segment.outerLeft},${segment.yBottom} L ${segment.outerLeft - FORMATION_THICKNESS},${segment.yBottom} L ${segment.outerLeft - FORMATION_THICKNESS},${segment.yTop} Z`"
        />
        <path
          class="casing-layer__formation-fill"
          :d="`M ${segment.outerRight},${segment.yTop} ${segment.rightWavyPath.substring(1)} L ${segment.outerRight},${segment.yBottom} L ${segment.outerRight + FORMATION_THICKNESS},${segment.yBottom} L ${segment.outerRight + FORMATION_THICKNESS},${segment.yTop} Z`"
        />
        <path
          class="casing-layer__open-hole-wall"
          :d="segment.leftWavyPath"
        />
        <path
          class="casing-layer__open-hole-wall"
          :d="segment.rightWavyPath"
        />
      </g>

      <polygon
        v-if="segment.hasFloatShoe"
        class="casing-layer__shoe"
        :points="[
          `${segment.innerLeft},${segment.yBottom - segment.symbolHeight}`,
          `${segment.innerLeft},${segment.yBottom}`,
          `${segment.outerLeft},${segment.yBottom}`
        ].join(' ')"
      />
      <polygon
        v-if="segment.hasFloatShoe"
        class="casing-layer__shoe"
        :points="[
          `${segment.innerRight},${segment.yBottom - segment.symbolHeight}`,
          `${segment.innerRight},${segment.yBottom}`,
          `${segment.outerRight},${segment.yBottom}`
        ].join(' ')"
      />
      <rect
        v-if="segment.hasLinerHanger"
        class="casing-layer__liner-hanger"
        :x="xScale(-segment.hangerOuterHalfWidth)"
        :y="segment.hangerY"
        :width="Math.max(0, segment.innerLeft - xScale(-segment.hangerOuterHalfWidth))"
        :height="15"
      />
      <rect
        v-if="segment.hasLinerHanger"
        class="casing-layer__liner-hanger"
        :x="segment.innerRight"
        :y="segment.hangerY"
        :width="Math.max(0, xScale(segment.hangerOuterHalfWidth) - segment.innerRight)"
        :height="15"
      />
      <rect
        class="casing-layer__hitbox"
        :x="segment.leftHitbox.x"
        :y="segment.yTop"
        :width="segment.leftHitbox.width"
        :height="segment.wallHeight"
      />
      <rect
        class="casing-layer__hitbox"
        :x="segment.rightHitbox.x"
        :y="segment.yTop"
        :width="segment.rightHitbox.width"
        :height="segment.wallHeight"
      />

      <g v-for="annotation in segment.annotations" :key="annotation.id" class="casing-layer__depth-annotation">
        <line
          class="casing-layer__depth-line"
          :x1="annotation.lineX1"
          :y1="annotation.lineY1"
          :x2="annotation.lineX2"
          :y2="annotation.lineY2"
        />
        <polygon class="casing-layer__depth-arrow" :points="annotation.arrowPoints" />
        <rect
          class="casing-layer__depth-box"
          :x="annotation.boxX"
          :y="annotation.boxY"
          :width="annotation.boxWidth"
          :height="annotation.boxHeight"
          :rx="3"
        />
        <text
          class="casing-layer__depth-text"
          :x="annotation.textX"
          :y="annotation.textY"
          text-anchor="start"
          dominant-baseline="middle"
          :style="{ fontSize: `${annotation.fontSize}px` }"
        >
          {{ annotation.text }}
        </text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.casing-layer__segment {
  cursor: pointer;
}

.casing-layer__wall {
  stroke-width: 1;
}

.casing-layer__open-hole-wall {
  stroke: var(--color-brown-accent);
  stroke-width: 2;
  fill: none;
}

.casing-layer__formation-fill {
  fill: url(#formation-dots);
  stroke: none;
  opacity: 0.6;
}

.casing-layer__shoe {
  fill: var(--color-ink-strong);
  stroke: none;
}

.casing-layer__liner-hanger {
  fill: var(--color-ink-strong);
  stroke: none;
}

.casing-layer__hitbox {
  fill: transparent;
  stroke: none;
}

.casing-layer__depth-line {
  stroke: var(--color-ink-strong);
  stroke-width: 1;
}

.casing-layer__depth-arrow {
  fill: var(--color-ink-strong);
  stroke: none;
}

.casing-layer__depth-box {
  fill: var(--color-cross-core-fill);
  stroke: var(--color-ink-strong);
  opacity: 0.8;
}

.casing-layer__depth-text {
  fill: var(--color-ink-strong);
}
</style>
