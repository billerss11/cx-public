<script setup>
import { computed } from 'vue';
import { resolveVerticalPlugFill } from './verticalHatchPatterns.js';

const props = defineProps({
  slices: {
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
  plugs: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['select-plug', 'hover-plug', 'leave-plug']);

const PLUG_SEGMENT_MERGE_EPSILON = 0.01;

function nearlyEqual(left, right, epsilon = PLUG_SEGMENT_MERGE_EPSILON) {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

function hasEquivalentRects(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((rect, index) => {
    const candidate = right[index];
    return candidate &&
      nearlyEqual(rect?.x, candidate?.x) &&
      nearlyEqual(rect?.width, candidate?.width);
  });
}

function mergePlugSegments(segments = []) {
  const grouped = new Map();
  segments.forEach((segment) => {
    const key = `${Number.isInteger(segment?.index) ? segment.index : 'x'}|${segment?.fill || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(segment);
  });

  const merged = [];
  grouped.forEach((group) => {
    const ordered = [...group].sort((a, b) => Number(a?.y) - Number(b?.y));
    const compact = [];

    ordered.forEach((segment) => {
      const previous = compact[compact.length - 1];
      const nextBottom = segment.y + segment.height;
      if (!previous) {
        compact.push({ ...segment, bottom: nextBottom });
        return;
      }

      const touchesPrevious = nearlyEqual(previous.bottom, segment.y);
      const sameRects = hasEquivalentRects(previous.rects, segment.rects);
      if (touchesPrevious && sameRects) {
        previous.bottom = nextBottom;
        previous.height = previous.bottom - previous.y;
        return;
      }

      compact.push({ ...segment, bottom: nextBottom });
    });

    compact.forEach((segment) => {
      const { bottom, ...rest } = segment;
      merged.push(rest);
    });
  });

  return merged.sort((a, b) => Number(a?.y) - Number(b?.y));
}

const plugVisualModel = computed(() => {
  const slices = Array.isArray(props.slices) ? props.slices : [];
  const plugs = Array.isArray(props.plugs) ? props.plugs : [];
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  const segments = [];

  slices.forEach((slice, sliceIndex) => {
    const yTop = props.yScale(Number(slice?.top));
    const yBottom = props.yScale(Number(slice?.bottom));
    const height = yBottom - yTop;
    if (!Number.isFinite(height) || height <= 0) return;

    (Array.isArray(slice?.stack) ? slice.stack : []).forEach((layer, layerIndex) => {
      if (layer?.material !== 'plug') return;

      const inner = Number(layer?.innerRadius);
      const outer = Number(layer?.outerRadius);
      if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner) return;

      const innerScaled = inner * diameterScale;
      const outerScaled = outer * diameterScale;
      const leftOuterX = props.xScale(-outerScaled);
      const leftInnerX = props.xScale(-innerScaled);
      const rightInnerX = props.xScale(innerScaled);
      const rightOuterX = props.xScale(outerScaled);
      const widthLeft = leftInnerX - leftOuterX;
      const widthRight = rightOuterX - rightInnerX;
      if (widthLeft <= 0 || widthRight <= 0) return;

      const plugIndexRaw = Number(layer?.source?.index);
      const plugIndex = Number.isInteger(plugIndexRaw) ? plugIndexRaw : null;
      const fill = resolveVerticalPlugFill(layer, plugs);
      const centerGap = rightInnerX - leftInnerX;
      const unifiedWidth = rightOuterX - leftOuterX;
      const rects = centerGap <= PLUG_SEGMENT_MERGE_EPSILON && unifiedWidth > 0
        ? [{ x: leftOuterX, width: unifiedWidth }]
        : [
          { x: leftOuterX, width: widthLeft },
          { x: rightInnerX, width: widthRight }
        ];

      segments.push({
        id: `plug-${sliceIndex}-${layerIndex}`,
        index: plugIndex,
        y: yTop,
        height,
        fill,
        rects
      });
    });
  });

  return mergePlugSegments(segments);
});

const plugSegments = computed(() => plugVisualModel.value);

const plugLabels = computed(() => {
  const plugs = Array.isArray(props.plugs) ? props.plugs : [];
  return plugs
    .map((plug, index) => {
      if (plug?.show === false) return null;
      const label = String(plug?.label ?? '').trim();
      if (!label) return null;

      const top = Number(plug?.top);
      const bottom = Number(plug?.bottom);
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

      return {
        id: `plug-label-${index}`,
        index,
        label,
        x: props.xScale(0),
        y: props.yScale((top + bottom) / 2)
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="plug-layer">
    <g
      v-for="segment in plugSegments"
      :key="segment.id"
      class="plug-layer__segment-group"
      :data-plug-index="Number.isInteger(segment.index) ? segment.index : null"
      @click="Number.isInteger(segment.index) && emit('select-plug', segment.index)"
      @mousemove="Number.isInteger(segment.index) && emit('hover-plug', segment.index, $event)"
      @mouseleave="Number.isInteger(segment.index) && emit('leave-plug', segment.index)"
    >
      <rect
        v-for="(rect, rectIndex) in segment.rects"
        :key="`${segment.id}-rect-${rectIndex}`"
        class="plug-layer__segment"
        :x="rect.x"
        :y="segment.y"
        :width="rect.width"
        :height="segment.height"
        :fill="segment.fill"
      />
    </g>

    <text
      v-for="label in plugLabels"
      :key="label.id"
      class="plug-layer__label"
      :x="label.x"
      :y="label.y"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ label.label }}
    </text>
  </g>
</template>

<style scoped>
.plug-layer__segment-group {
  cursor: pointer;
}

.plug-layer__segment {
  stroke: none;
  opacity: 0.95;
}

.plug-layer__label {
  fill: var(--color-ink-strong);
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
}
</style>
