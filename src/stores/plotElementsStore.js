import { defineStore } from 'pinia';
import { shallowReactive } from 'vue';

export const usePlotElementsStore = defineStore('plotElements', () => {
    const elements = shallowReactive({
        schematicSvg: null,
        plotTooltip: null
    });

    function setPlotElement(key, element) {
        if (!(key in elements)) return false;
        elements[key] = element ?? null;
        return true;
    }

    function getPlotElement(key) {
        if (!(key in elements)) return null;
        return elements[key] ?? null;
    }

    return {
        setPlotElement,
        getPlotElement
    };
});
