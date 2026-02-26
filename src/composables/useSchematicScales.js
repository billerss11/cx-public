import * as d3 from 'd3';
import { computed, unref } from 'vue';

function toFiniteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveContainerDimension(value, fallback = 1) {
    const numeric = toFiniteNumber(unref(value), fallback);
    return Math.max(1, numeric);
}

function resolveMargin(margin = {}) {
    return {
        top: Math.max(0, toFiniteNumber(margin?.top, 20)),
        right: Math.max(0, toFiniteNumber(margin?.right, 20)),
        bottom: Math.max(0, toFiniteNumber(margin?.bottom, 20)),
        left: Math.max(0, toFiniteNumber(margin?.left, 20))
    };
}

export function useSchematicScales(input = {}, containerWidth, containerHeight) {
    const margin = computed(() => resolveMargin(input?.margin));

    const width = computed(() => resolveContainerDimension(containerWidth));
    const height = computed(() => resolveContainerDimension(containerHeight));

    const plotWidth = computed(() => {
        const currentMargin = margin.value;
        return Math.max(1, width.value - currentMargin.left - currentMargin.right);
    });

    const plotHeight = computed(() => {
        const currentMargin = margin.value;
        return Math.max(1, height.value - currentMargin.top - currentMargin.bottom);
    });

    const normalizedMinDepth = computed(() => toFiniteNumber(unref(input?.minDepth), 0));
    const normalizedMaxDepth = computed(() => {
        const maxDepth = toFiniteNumber(unref(input?.maxDepth), normalizedMinDepth.value + 1);
        return maxDepth > normalizedMinDepth.value ? maxDepth : normalizedMinDepth.value + 1;
    });

    const normalizedXHalf = computed(() => {
        const xHalf = toFiniteNumber(unref(input?.xHalf), 1);
        return xHalf > 0 ? xHalf : 1;
    });

    const xScale = computed(() => {
        const currentMargin = margin.value;
        return d3.scaleLinear()
            .domain([-normalizedXHalf.value, normalizedXHalf.value])
            .range([currentMargin.left, currentMargin.left + plotWidth.value]);
    });

    const yScale = computed(() => {
        const currentMargin = margin.value;
        // Engineering convention: depth increases downward, so pixel Y grows with depth.
        return d3.scaleLinear()
            .domain([normalizedMinDepth.value, normalizedMaxDepth.value])
            .range([currentMargin.top, currentMargin.top + plotHeight.value]);
    });

    return {
        width,
        height,
        margin,
        plotWidth,
        plotHeight,
        minDepth: normalizedMinDepth,
        maxDepth: normalizedMaxDepth,
        xHalf: normalizedXHalf,
        xScale,
        yScale
    };
}

