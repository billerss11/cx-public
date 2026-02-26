import { DEFAULT_CEMENT_COLOR, DEFAULT_CEMENT_PLUG_COLOR } from '@/constants/index.js';
import { normalizeHatchStyle } from './domain.js';

// Shared visual defaults for profile and cross-section views.
export const PROFILE_STYLE = {
    patternPrefix: 'stack',
    cementStrokeWidth: 0.55,
    cementOpacity: 0.9,
    fluidOpacity: 0.85,
    fluidStrokeWidth: 0.45,
    plugStrokeWidth: 0.6,
    plugOpacity: 0.95,
    steelOpacity: 0.96
};

export const CROSS_SECTION_STYLE = {
    patternPrefix: 'cross',
    cementStrokeWidth: 0.7,
    cementOpacity: 0.9,
    fluidOpacity: 0.9,
    fluidStrokeWidth: 0.7,
    plugStrokeWidth: 0.8,
    plugOpacity: 0.95,
    steelOpacity: 0.96
};

export function sanitizePatternId(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function getHatchStyleKey(style) {
    const normalized = String(normalizeHatchStyle(style) ?? style ?? '').trim().toLowerCase();
    if (!normalized || normalized === 'none') return 'none';
    if (normalized.includes('diag')) return 'diag';
    if (normalized.includes('cross')) return 'cross';
    if (normalized.includes('dot')) return 'dots';
    if (normalized.includes('grid')) return 'grid';
    return 'none';
}

function resolvePatternPrefix(styleConfig = PROFILE_STYLE) {
    const rawPrefix = String(styleConfig?.patternPrefix ?? '').trim();
    return rawPrefix ? `${sanitizePatternId(rawPrefix)}-` : '';
}

export function resolveLayerStyle(layer, context, styleConfig = PROFILE_STYLE) {
    const coreFill = 'var(--color-cross-core-fill)';
    const coreStroke = 'var(--color-cross-core-stroke)';
    const annulusMudFill = 'var(--color-cross-annulus-fill)';
    const annulusMudStroke = 'var(--color-cross-annulus-stroke)';
    const patternPrefix = resolvePatternPrefix(styleConfig);

    if (layer.material === 'wellbore') {
        return { fill: coreFill, stroke: 'none', strokeWidth: 0, opacity: 1.0 };
    }

    if (layer.material === 'steel') {
        const color = context.colorMap
            ? (context.colorMap.get(layer?.source?.index) || 'var(--color-pipe-fallback)')
            : 'var(--color-pipe-fallback)';
        return { fill: color, stroke: 'var(--color-ink-strong)', strokeWidth: 0.8, opacity: styleConfig.steelOpacity };
    }

    if (layer.material === 'cement') {
        if (!context.config.showCement) {
            const fallbackFill = layer.role === 'core' ? coreFill : annulusMudFill;
            const fallbackStroke = layer.role === 'core' ? coreStroke : annulusMudStroke;
            return {
                fill: fallbackFill,
                stroke: fallbackStroke,
                strokeWidth: styleConfig.cementStrokeWidth,
                opacity: styleConfig.cementOpacity
            };
        }
        const baseColor = context.config.cementColor || DEFAULT_CEMENT_COLOR;
        let fill = baseColor;
        if (context.config.cementHatchEnabled) {
            const hatchKey = getHatchStyleKey(context.config.cementHatchStyle);
            if (hatchKey !== 'none') {
                const hatchId = `${patternPrefix}cement-${hatchKey}-${sanitizePatternId(baseColor)}`;
                fill = `url(#${hatchId})`;
            }
        }
        return { fill, stroke: 'var(--color-ink-soft)', strokeWidth: styleConfig.cementStrokeWidth, opacity: styleConfig.cementOpacity };
    }

    if (layer.material === 'fluid') {
        if (layer.role === 'core') {
            return { fill: coreFill, stroke: coreStroke, strokeWidth: styleConfig.fluidStrokeWidth, opacity: 1.0 };
        }
        const baseColor = layer.color || DEFAULT_CEMENT_COLOR;
        let fill = baseColor;
        const hatchKey = getHatchStyleKey(layer.hatchStyle || 'none');
        if (hatchKey !== 'none') {
            const hatchId = `${patternPrefix}fluid-${layer?.source?.index ?? 'x'}-${hatchKey}-${sanitizePatternId(baseColor)}`;
            fill = `url(#${hatchId})`;
        }
        return { fill, stroke: 'var(--color-ink-soft)', strokeWidth: styleConfig.fluidStrokeWidth, opacity: styleConfig.fluidOpacity };
    }

    if (layer.material === 'plug') {
        const baseColor = layer.color || DEFAULT_CEMENT_PLUG_COLOR;
        let fill = baseColor;
        const hatchKey = getHatchStyleKey(layer.hatchStyle || 'none');
        if (hatchKey !== 'none') {
            const hatchId = `${patternPrefix}plug-${layer?.source?.index ?? 'x'}-${hatchKey}-${sanitizePatternId(baseColor)}`;
            fill = `url(#${hatchId})`;
        }
        return { fill, stroke: 'var(--color-ink-strong)', strokeWidth: styleConfig.plugStrokeWidth, opacity: styleConfig.plugOpacity };
    }

    if (layer.material === 'void') {
        return { fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 0 };
    }

    if (layer.role === 'core') {
        return { fill: coreFill, stroke: coreStroke, strokeWidth: 0.45, opacity: 1.0 };
    }

    return { fill: annulusMudFill, stroke: annulusMudStroke, strokeWidth: 0.4, opacity: 0.75 };
}
