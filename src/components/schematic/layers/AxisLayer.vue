<script setup>
import { computed } from 'vue';
import { clamp, formatDepthValue } from '@/utils/general.js';
import { t } from '@/app/i18n.js';

const props = defineProps({
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
    required: true
  },
  maxDepth: {
    type: Number,
    required: true
  },
  xHalf: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    required: true
  },
  svgHeight: {
    type: Number,
    required: true
  },
  maxCasingOuterRadius: {
    type: Number,
    default: 1
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  datumDepth: {
    type: Number,
    default: 0
  },
  unitsLabel: {
    type: String,
    default: 'ft'
  },
  titleText: {
    type: String,
    default: ''
  }
});

const tickValues = computed(() => {
  const depthRange = Math.max(1, props.maxDepth - props.minDepth);
  const axisTicks = Math.max(4, Math.min(12, Math.round(depthRange / 1500)));
  return props.yScale.ticks(axisTicks);
});

const axisX = computed(() => props.xScale(-props.xHalf) - 40);

const surfaceWidth = computed(() => {
  const maxOD = Math.max(0, Number(props.maxCasingOuterRadius) * 2);
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  return (maxOD * diameterScale / 2) * 1.5;
});

const useSideDatumLabel = computed(() => props.minDepth < (props.datumDepth - 1e-6));

const datumLabelX = computed(() => {
  if (!useSideDatumLabel.value) return props.xScale(0);
  return clamp(props.xScale(surfaceWidth.value) + 10, 8, props.width - 8);
});
</script>

<template>
  <g class="axis-layer">
    <text
      v-if="titleText"
      class="axis-layer__title"
      :x="width / 2"
      :y="28"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ titleText }}
    </text>

    <line
      class="axis-layer__y-axis"
      :x1="axisX"
      :y1="yScale(minDepth)"
      :x2="axisX"
      :y2="yScale(maxDepth)"
    />

    <g v-for="tick in tickValues" :key="`tick-${tick}`" class="axis-layer__tick">
      <line
        class="axis-layer__tick-line"
        :x1="axisX - 6"
        :y1="yScale(tick)"
        :x2="axisX"
        :y2="yScale(tick)"
      />
      <text
        class="axis-layer__tick-label"
        :x="axisX - 10"
        :y="yScale(tick)"
        text-anchor="end"
        dominant-baseline="middle"
      >
        {{ Number(tick).toLocaleString() }} {{ unitsLabel }}
      </text>
    </g>

    <line
      class="axis-layer__datum"
      :x1="xScale(-surfaceWidth)"
      :y1="yScale(datumDepth)"
      :x2="xScale(surfaceWidth)"
      :y2="yScale(datumDepth)"
    />

    <text
      class="axis-layer__datum-label"
      :x="datumLabelX"
      :y="yScale(datumDepth) - 10"
      :text-anchor="useSideDatumLabel ? 'start' : 'middle'"
      dominant-baseline="middle"
    >
      {{ t('tooltip.mudline', { depth: formatDepthValue(datumDepth), units: unitsLabel }) }}
    </text>

    <text
      class="axis-layer__depth-label"
      :transform="`rotate(-90)`"
      :x="-svgHeight / 2"
      :y="20"
      text-anchor="middle"
    >
      {{ t('axis.depth', { units: unitsLabel }) }}
    </text>
  </g>
</template>

<style scoped>
.axis-layer__y-axis,
.axis-layer__tick-line {
  stroke: var(--color-outline-subtle);
  stroke-width: 1;
}

.axis-layer__datum {
  stroke: var(--color-brown-accent);
  stroke-width: 4;
}

.axis-layer__tick-label {
  fill: var(--color-ink-mid);
  font-size: 11px;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
}

.axis-layer__title {
  fill: var(--color-ink-strong);
  font-size: 18px;
  font-weight: 700;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
}

.axis-layer__datum-label {
  fill: var(--color-brown-accent);
  font-size: 12px;
  font-weight: 700;
}

.axis-layer__depth-label {
  fill: var(--color-ink-strong);
  font-size: 12px;
}
</style>
