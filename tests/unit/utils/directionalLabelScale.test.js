import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIRECTIONAL_LABEL_SCALE,
  normalizeDirectionalLabelScale,
  resolveDirectionalLabelFontSize
} from '@/utils/directionalLabelScale.js';

describe('directional label scale utilities', () => {
  it('normalizes label scale into the supported readable range', () => {
    expect(DEFAULT_DIRECTIONAL_LABEL_SCALE).toBe(1);
    expect(normalizeDirectionalLabelScale()).toBe(1);
    expect(normalizeDirectionalLabelScale('bad')).toBe(1);
    expect(normalizeDirectionalLabelScale(0.2)).toBe(0.8);
    expect(normalizeDirectionalLabelScale(2.8)).toBe(2.8);
    expect(normalizeDirectionalLabelScale(4.2)).toBe(3);
  });

  it('resolves effective font sizes from base values, fallbacks, and scale', () => {
    expect(resolveDirectionalLabelFontSize(14, { scale: 1.25, fallbackSize: 11 })).toBe(17.5);
    expect(resolveDirectionalLabelFontSize(undefined, { scale: 1.5, fallbackSize: 11 })).toBe(16.5);
    expect(resolveDirectionalLabelFontSize(30, { scale: 1.5, min: 8, max: 20 })).toBe(20);
  });
});