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
  minXData: {
    type: Number,
    required: true
  },
  maxXData: {
    type: Number,
    required: true
  },
  minYData: {
    type: Number,
    required: true
  },
  maxYData: {
    type: Number,
    required: true
  },
  svgHeight: {
    type: Number,
    required: true
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
  },
  xExaggeration: {
    type: Number,
    default: 1
  },
  xOrigin: {
    type: Number,
    default: 0
  }
});

const yTicks = computed(() => props.yScale.ticks(10));
const xTicks = computed(() => props.xScale.ticks(10));

const yAxisX = computed(() => props.xScale(props.minXData) - 40);
const xAxisY = computed(() => props.yScale(props.maxYData) + 4);

const titleX = computed(() => (props.xScale(props.minXData) + props.xScale(props.maxXData)) / 2);

const datumLabelX = computed(() => (
  clamp(
    props.xScale(props.minXData) + 6,
    6,
    props.xScale(props.maxXData) - 6
  )
));

const depthAxisLabelX = computed(() => {
  const midY = (props.yScale(props.minYData) + props.yScale(props.maxYData)) / 2;
  return -midY;
});

function formatOffsetTick(value) {
  const exaggeration = Number.isFinite(Number(props.xExaggeration)) && Number(props.xExaggeration) !== 0
    ? Number(props.xExaggeration)
    : 1;
  const actualX = Number(props.xOrigin) + ((Number(value) - Number(props.xOrigin)) / exaggeration);
  return formatDepthValue(actualX);
}
</script>

<template>
  <g class="directional-axis-layer">
    <text
      v-if="titleText"
      class="directional-axis-layer__title"
      :x="titleX"
      :y="28"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ titleText }}
    </text>

    <line
      class="directional-axis-layer__y-axis"
      :x1="yAxisX"
      :y1="yScale(minYData)"
      :x2="yAxisX"
      :y2="yScale(maxYData)"
    />

    <g v-for="tick in yTicks" :key="`y-${tick}`">
      <line
        class="directional-axis-layer__tick-line"
        :x1="yAxisX - 6"
        :y1="yScale(tick)"
        :x2="yAxisX"
        :y2="yScale(tick)"
      />
      <text
        class="directional-axis-layer__tick-label"
        :x="yAxisX - 10"
        :y="yScale(tick)"
        text-anchor="end"
        dominant-baseline="middle"
      >
        {{ formatDepthValue(tick) }} {{ unitsLabel }}
      </text>
    </g>

    <line
      class="directional-axis-layer__x-axis"
      :x1="xScale(minXData)"
      :y1="xAxisY"
      :x2="xScale(maxXData)"
      :y2="xAxisY"
    />

    <g v-for="tick in xTicks" :key="`x-${tick}`">
      <line
        class="directional-axis-layer__tick-line"
        :x1="xScale(tick)"
        :y1="xAxisY"
        :x2="xScale(tick)"
        :y2="xAxisY + 6"
      />
      <text
        class="directional-axis-layer__tick-label"
        :x="xScale(tick)"
        :y="xAxisY + 20"
        text-anchor="middle"
        dominant-baseline="middle"
      >
        {{ formatOffsetTick(tick) }}
      </text>
    </g>

    <line
      class="directional-axis-layer__datum"
      :x1="xScale(minXData)"
      :y1="yScale(datumDepth)"
      :x2="xScale(maxXData)"
      :y2="yScale(datumDepth)"
    />

    <text
      class="directional-axis-layer__datum-label"
      :x="datumLabelX"
      :y="yScale(datumDepth) - 8"
      text-anchor="start"
      dominant-baseline="middle"
    >
      {{ t('tooltip.mudline', { depth: formatDepthValue(datumDepth), units: unitsLabel }) }}
    </text>

    <text
      class="directional-axis-layer__depth-label"
      :transform="`rotate(-90)`"
      :x="depthAxisLabelX"
      :y="20"
      text-anchor="middle"
    >
      {{ t('axis.tvd', { units: unitsLabel }) }}
    </text>
  </g>
</template>

<style scoped>
.directional-axis-layer__y-axis,
.directional-axis-layer__x-axis,
.directional-axis-layer__tick-line {
  stroke: var(--color-outline-subtle);
  stroke-width: 1;
}

.directional-axis-layer__datum {
  stroke: var(--color-brown-accent);
  stroke-width: 3.2;
}

.directional-axis-layer__tick-label {
  fill: var(--color-ink-mid);
  font-size: 11px;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
}

.directional-axis-layer__title {
  fill: var(--color-ink-strong);
  font-size: 18px;
  font-weight: 700;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
}

.directional-axis-layer__datum-label {
  fill: var(--color-brown-accent);
  font-size: 11px;
  font-weight: 700;
}

.directional-axis-layer__depth-label {
  fill: var(--color-ink-strong);
  font-size: 12px;
}
</style>
