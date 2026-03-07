import * as d3 from 'd3';

const sampled = (interpolator, steps = 12) => d3.quantize(interpolator, steps);

export const COLOR_PALETTES = {
    'Tableau 10': d3.schemeTableau10,
    'Observable 10': d3.schemeObservable10,
    'Category 10': d3.schemeCategory10,
    'Set 1': d3.schemeSet1,
    'Set 2': d3.schemeSet2,
    'Set 3': d3.schemeSet3,
    'Pastel 1': d3.schemePastel1,
    'Pastel 2': d3.schemePastel2,
    'Paired': d3.schemePaired,
    'Dark 2': d3.schemeDark2,
    'Accent': d3.schemeAccent,
    'Bold': ['#1E3A8A', '#BE123C', '#0369A1', '#15803D', '#A16207', '#6D28D9', '#EA580C', '#0F766E', '#4F46E5', '#C2410C'],
    'Ocean': ['#0B3954', '#087E8B', '#2B9EB3', '#8DD3C7', '#D7F2F6', '#2F6690', '#1E3A5F', '#4EA8DE', '#56CFE1', '#80FFDB'],
    'Earth': ['#5F0F40', '#9A031E', '#FB8B24', '#E36414', '#0F4C5C', '#283618', '#606C38', '#DDA15E', '#BC6C25', '#FEFAE0'],
    'Sunset': ['#3A0CA3', '#7209B7', '#F72585', '#F15BB5', '#F8961E', '#F9C74F', '#577590', '#43AA8B', '#90BE6D', '#277DA1'],
    'Viridis 12': sampled(d3.interpolateViridis, 12),
    'Plasma 12': sampled(d3.interpolatePlasma, 12),
    'Inferno 12': sampled(d3.interpolateInferno, 12),
    'Magma 12': sampled(d3.interpolateMagma, 12),
    'Cividis 12': sampled(d3.interpolateCividis, 12),
    'Turbo 12': sampled(d3.interpolateTurbo, 12),
    'Cubehelix 12': sampled(d3.interpolateCubehelixDefault, 12),
    'Warm 12': sampled(d3.interpolateWarm, 12),
    'Cool 12': sampled(d3.interpolateCool, 12),
    'Sinebow 12': sampled(d3.interpolateSinebow, 12),
    'Rainbow 12': sampled(d3.interpolateRainbow, 12)
};

export const COLOR_PALETTE_OPTIONS = Object.keys(COLOR_PALETTES);

export const PALETTE_COLORS = Array.from(
    new Set(Object.values(COLOR_PALETTES).flat())
);

export const NAMED_COLORS = [
    'black', 'dimgray', 'gray', 'darkgray', 'silver', 'lightgray', 'gainsboro', 'whitesmoke', 'white',
    'midnightblue', 'navy', 'darkblue', 'mediumblue', 'blue', 'royalblue', 'cornflowerblue', 'steelblue',
    'dodgerblue', 'deepskyblue', 'lightskyblue', 'skyblue', 'lightblue', 'powderblue', 'aliceblue', 'lightsteelblue',
    'teal', 'darkcyan', 'cadetblue', 'turquoise', 'mediumturquoise', 'paleturquoise', 'aquamarine',
    'darkgreen', 'green', 'forestgreen', 'seagreen', 'mediumseagreen', 'limegreen', 'lime', 'springgreen',
    'olive', 'olivedrab', 'darkolivegreen', 'yellowgreen', 'chartreuse', 'lawngreen',
    'gold', 'goldenrod', 'darkgoldenrod', 'khaki', 'palegoldenrod', 'yellow', 'lightyellow', 'lemonchiffon',
    'orange', 'darkorange', 'coral', 'tomato', 'orangered', 'salmon', 'darksalmon', 'lightsalmon',
    'crimson', 'red', 'firebrick', 'darkred', 'maroon', 'indianred', 'lightcoral',
    'saddlebrown', 'sienna', 'brown', 'peru', 'chocolate', 'tan', 'burlywood', 'wheat', 'navajowhite',
    'purple', 'indigo', 'darkmagenta', 'mediumorchid', 'orchid', 'violet', 'plum', 'thistle', 'lavender',
    'magenta', 'fuchsia', 'deeppink', 'hotpink', 'palevioletred', 'mediumvioletred', 'pink', 'lightpink',
    'beige', 'ivory', 'mintcream', 'honeydew', 'azure', 'linen', 'oldlace', 'snow'
];

export const DEFAULT_LINE_COLOR = 'steelblue';
export const DEFAULT_BOX_COLOR = 'lightsteelblue';
export const DEFAULT_BOX_FONT_COLOR = 'steelblue';
export const DEFAULT_CEMENT_COLOR = 'lightgray';
export const DEFAULT_CEMENT_PLUG_COLOR = DEFAULT_CEMENT_COLOR;
export const MAGNIFIER_ZOOM_LEVEL_OPTIONS = Object.freeze([2, 4, 6]);
export const DEFAULT_MAGNIFIER_ZOOM_LEVEL = MAGNIFIER_ZOOM_LEVEL_OPTIONS[0];
export const MAGNIFIER_WINDOW_DEFAULTS = Object.freeze({
    width: 240,
    height: 170,
    margin: 14,
    pointerGap: 56,
    edgePadding: 8
});
export const DEFAULT_VERTICAL_SECTION_MODE = 'auto';
export const DEFAULT_VERTICAL_SECTION_AZIMUTH = 0;
export const MARKER_DEFAULT_COLORS = {
    Perforation: 'black',
    Leak: 'firebrick',
    perforation: 'black',
    leak: 'firebrick',
    '射孔': 'black',
    '漏失': 'firebrick'
};

export const RELATIVE_POS_THRESHOLD = 3.0;

export const CASING_NUMERIC_FIELDS = new Set([
    'od',
    'weight',
    'idOverride',
    'manualHoleSize',
    'manualParent',
    'top',
    'bottom',
    'toc',
    'boc',
    'labelXPos',
    'manualLabelDepth',
    'casingLabelFontSize',
    'depthLabelFontSize',
    'depthLabelOffset'
]);
export const TUBING_NUMERIC_FIELDS = new Set([
    'od',
    'weight',
    'idOverride',
    'top',
    'bottom',
    'labelXPos',
    'manualLabelDepth',
    'labelFontSize'
]);
export const DRILL_STRING_NUMERIC_FIELDS = new Set([
    'od',
    'weight',
    'idOverride',
    'top',
    'bottom',
    'labelXPos',
    'manualLabelDepth',
    'labelFontSize'
]);
export const EQUIPMENT_NUMERIC_FIELDS = new Set([
    'depth',
    'scale',
    'labelXPos',
    'manualLabelDepth',
    'labelFontSize'
]);
export const LINE_NUMERIC_FIELDS = new Set(['depth', 'fontSize', 'labelXPos']);
export const BOX_NUMERIC_FIELDS = new Set(['topDepth', 'bottomDepth', 'fontSize', 'labelXPos', 'bandWidth', 'opacity']);
export const PLUG_NUMERIC_FIELDS = new Set(['top', 'bottom', 'manualWidth']);
export const MARKER_NUMERIC_FIELDS = new Set(['top', 'bottom', 'scale']);
export const FLUID_NUMERIC_FIELDS = new Set(['top', 'bottom', 'labelXPos', 'manualDepth', 'fontSize', 'manualOD']);

export const FLUID_PLACEMENT_AUTO_OPTIONS = [
    'Auto: Formation Annulus',
    'Auto: Production Annulus',
    'Auto: A-Annulus',
    'Auto: B-Annulus',
    'Auto: C-Annulus'
];
export const FLUID_PLACEMENT_DEFAULT_OPTION = FLUID_PLACEMENT_AUTO_OPTIONS[0];

export const PHYSICS_CONSTANTS = Object.freeze({
    STEEL_DENSITY_FACTOR_IMPERIAL: 10.68,
    DEFAULT_ID_RATIO: 0.90,
    MIN_WALL_RATIO: 0.01,
    MAX_WALL_RATIO: 0.15,
    DEFAULT_CROSSOVER_EPSILON: 30,
    CONNECTION_BOUNDARY_TOLERANCE: 0.05
});

export const LAYOUT_CONSTANTS = Object.freeze({
    DEFAULT_CASING_LABEL_X_RATIO: 0.85,
    DEFAULT_HORIZONTAL_LINE_HALF_WIDTH_RATIO: 0.90,
    DEFAULT_RIGHT_LABEL_X_RATIO: 0.90,
    HORIZONTAL_ANCHOR_CENTER_THRESHOLD_RATIO: 0.05,
    INTERVAL_CALLOUT_GLOBAL_STANDOFF_MIN_PX: 24,
    INTERVAL_CALLOUT_GLOBAL_STANDOFF_MAX_PX: 140,
    INTERVAL_CALLOUT_GLOBAL_STANDOFF_DEFAULT_PX: 64,
    INTERVAL_CALLOUT_X_NUDGE_MAX_PX: 8,
    INTERVAL_CALLOUT_VERTICAL_STANDOFF_RATIO: 0.075,
    INTERVAL_CALLOUT_VERTICAL_STANDOFF_MIN_PX: 40,
    INTERVAL_CALLOUT_VERTICAL_STANDOFF_MAX_PX: 80,
    INTERVAL_CALLOUT_DIRECTIONAL_STANDOFF_RATIO: 0.08,
    INTERVAL_CALLOUT_DIRECTIONAL_STANDOFF_MIN_PX: 48,
    INTERVAL_CALLOUT_DIRECTIONAL_STANDOFF_MAX_PX: 96,
    INTERVAL_CALLOUT_DIRECTIONAL_MIN_CONNECTOR_PX: 30
});

export const SURVEY_CONSTANTS = Object.freeze({
    COURSE_LENGTH_FT: 100,
    COURSE_LENGTH_M: 30
});

export const SCALABILITY_CONSTANTS = Object.freeze({
    LARGE_PROJECT_ROW_COUNT: 250,
    VERY_LARGE_PROJECT_ROW_COUNT: 600,
    LARGE_PROJECT_COMPLEXITY_SCORE: 1200,
    VERY_LARGE_PROJECT_COMPLEXITY_SCORE: 2500,
    COMPLEXITY_WEIGHTS: Object.freeze({
        casingData: 6,
        tubingData: 5,
        drillStringData: 5,
        horizontalLines: 2,
        annotationBoxes: 2,
        userAnnotations: 1,
        cementPlugs: 3,
        annulusFluids: 3,
        markers: 4,
        trajectory: 1
    }),
    DEFAULT_PLOT_DEBOUNCE_MS: 350,
    LARGE_PLOT_DEBOUNCE_MS: 600,
    VERY_LARGE_PLOT_DEBOUNCE_MS: 900,
    DEFAULT_TOOLTIP_THROTTLE_MS: 0,
    LARGE_TOOLTIP_THROTTLE_MS: 30,
    VERY_LARGE_TOOLTIP_THROTTLE_MS: 60,
    DEFAULT_TRAJECTORY_SAMPLE_STEP_MD: 20,
    LARGE_TRAJECTORY_SAMPLE_STEP_MD: 30,
    VERY_LARGE_TRAJECTORY_SAMPLE_STEP_MD: 45,
    DEFAULT_PERFORATION_SYMBOL_MAX: 48,
    LARGE_PERFORATION_SYMBOL_MAX: 32,
    VERY_LARGE_PERFORATION_SYMBOL_MAX: 20
});

export function normalizeMagnifierZoomLevel(value, fallback = DEFAULT_MAGNIFIER_ZOOM_LEVEL) {
    const numeric = Number(value);
    if (MAGNIFIER_ZOOM_LEVEL_OPTIONS.includes(numeric)) {
        return numeric;
    }
    const fallbackNumeric = Number(fallback);
    if (MAGNIFIER_ZOOM_LEVEL_OPTIONS.includes(fallbackNumeric)) {
        return fallbackNumeric;
    }
    return DEFAULT_MAGNIFIER_ZOOM_LEVEL;
}

const SCALABILITY_STATE_KEYS = Object.freeze([
    'casingData',
    'tubingData',
    'drillStringData',
    'horizontalLines',
    'annotationBoxes',
    'userAnnotations',
    'cementPlugs',
    'annulusFluids',
    'markers',
    'trajectory'
]);

function resolveScalabilityLoadMetrics(state = {}) {
    const weights = SCALABILITY_CONSTANTS.COMPLEXITY_WEIGHTS;
    return SCALABILITY_STATE_KEYS.reduce((metrics, key) => {
        const count = Array.isArray(state?.[key]) ? state[key].length : 0;
        metrics.rowCount += count;
        metrics.complexityScore += count * (Number(weights[key]) || 0);
        return metrics;
    }, {
        rowCount: 0,
        complexityScore: 0
    });
}

export function estimateProjectRowCount(state = {}) {
    return resolveScalabilityLoadMetrics(state).rowCount;
}

export function estimateProjectComplexityScore(state = {}) {
    return resolveScalabilityLoadMetrics(state).complexityScore;
}

export function resolveScalabilityProfile(state = {}) {
    const { rowCount, complexityScore } = resolveScalabilityLoadMetrics(state);

    if (complexityScore >= SCALABILITY_CONSTANTS.VERY_LARGE_PROJECT_COMPLEXITY_SCORE) {
        return {
            rowCount,
            complexityScore,
            tier: 'very-large',
            plotDebounceMs: SCALABILITY_CONSTANTS.VERY_LARGE_PLOT_DEBOUNCE_MS,
            tooltipThrottleMs: SCALABILITY_CONSTANTS.VERY_LARGE_TOOLTIP_THROTTLE_MS,
            trajectorySampleStepMd: SCALABILITY_CONSTANTS.VERY_LARGE_TRAJECTORY_SAMPLE_STEP_MD,
            perforationSymbolMax: SCALABILITY_CONSTANTS.VERY_LARGE_PERFORATION_SYMBOL_MAX
        };
    }

    if (complexityScore >= SCALABILITY_CONSTANTS.LARGE_PROJECT_COMPLEXITY_SCORE) {
        return {
            rowCount,
            complexityScore,
            tier: 'large',
            plotDebounceMs: SCALABILITY_CONSTANTS.LARGE_PLOT_DEBOUNCE_MS,
            tooltipThrottleMs: SCALABILITY_CONSTANTS.LARGE_TOOLTIP_THROTTLE_MS,
            trajectorySampleStepMd: SCALABILITY_CONSTANTS.LARGE_TRAJECTORY_SAMPLE_STEP_MD,
            perforationSymbolMax: SCALABILITY_CONSTANTS.LARGE_PERFORATION_SYMBOL_MAX
        };
    }

    return {
        rowCount,
        complexityScore,
        tier: 'default',
        plotDebounceMs: SCALABILITY_CONSTANTS.DEFAULT_PLOT_DEBOUNCE_MS,
        tooltipThrottleMs: SCALABILITY_CONSTANTS.DEFAULT_TOOLTIP_THROTTLE_MS,
        trajectorySampleStepMd: SCALABILITY_CONSTANTS.DEFAULT_TRAJECTORY_SAMPLE_STEP_MD,
        perforationSymbolMax: SCALABILITY_CONSTANTS.DEFAULT_PERFORATION_SYMBOL_MAX
    };
}
