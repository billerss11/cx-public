import Aura from '@primevue/themes/aura';
import Lara from '@primevue/themes/lara';
import Material from '@primevue/themes/material';
import Nora from '@primevue/themes/nora';
import { usePreset } from '@primevue/themes';

export const THEME_PREFERENCE_STORAGE_KEY = 'themePreferencesV1';
export const THEME_MODE_SYSTEM = 'system';
export const THEME_MODE_LIGHT = 'light';
export const THEME_MODE_DARK = 'dark';
export const THEME_PRESET_LARA = 'lara';
export const THEME_PRESET_AURA = 'aura';
export const THEME_PRESET_NORA = 'nora';
export const THEME_PRESET_MATERIAL = 'material';
export const DARK_MODE_CLASS_NAME = 'app-dark';

const THEME_PRESET_MAP = Object.freeze({
  [THEME_PRESET_LARA]: Lara,
  [THEME_PRESET_AURA]: Aura,
  [THEME_PRESET_NORA]: Nora,
  [THEME_PRESET_MATERIAL]: Material
});

export const THEME_MODE_OPTIONS = Object.freeze([
  { value: THEME_MODE_SYSTEM, label: 'System', i18nKey: 'ui.theme_mode.system' },
  { value: THEME_MODE_LIGHT, label: 'Light', i18nKey: 'ui.theme_mode.light' },
  { value: THEME_MODE_DARK, label: 'Dark', i18nKey: 'ui.theme_mode.dark' }
]);

export const THEME_PRESET_OPTIONS = Object.freeze([
  { value: THEME_PRESET_LARA, label: 'Lara', i18nKey: 'ui.theme_preset.lara' },
  { value: THEME_PRESET_AURA, label: 'Aura', i18nKey: 'ui.theme_preset.aura' },
  { value: THEME_PRESET_NORA, label: 'Nora', i18nKey: 'ui.theme_preset.nora' },
  { value: THEME_PRESET_MATERIAL, label: 'Material', i18nKey: 'ui.theme_preset.material' }
]);

export function createDefaultThemePreferences() {
  return {
    mode: THEME_MODE_SYSTEM,
    preset: THEME_PRESET_LARA
  };
}

export function normalizeThemeMode(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === THEME_MODE_LIGHT) return THEME_MODE_LIGHT;
  if (token === THEME_MODE_DARK) return THEME_MODE_DARK;
  return THEME_MODE_SYSTEM;
}

export function normalizeThemePreset(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token in THEME_PRESET_MAP) {
    return token;
  }
  return THEME_PRESET_LARA;
}

export function normalizeThemePreferences(preferences) {
  const base = createDefaultThemePreferences();
  return {
    mode: normalizeThemeMode(preferences?.mode ?? base.mode),
    preset: normalizeThemePreset(preferences?.preset ?? base.preset)
  };
}

export function readThemePreferences() {
  if (typeof localStorage === 'undefined') {
    return createDefaultThemePreferences();
  }

  try {
    const raw = localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    if (!raw) {
      return createDefaultThemePreferences();
    }
    return normalizeThemePreferences(JSON.parse(raw));
  } catch (_error) {
    return createDefaultThemePreferences();
  }
}

export function persistThemePreferences(preferences) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      THEME_PREFERENCE_STORAGE_KEY,
      JSON.stringify(normalizeThemePreferences(preferences))
    );
  } catch (_error) {
    // Ignore persistence failures.
  }
}

export function resolveThemePresetDefinition(preset) {
  const normalized = normalizeThemePreset(preset);
  return THEME_PRESET_MAP[normalized];
}

export function applyThemePreset(preset) {
  const normalized = normalizeThemePreset(preset);
  usePreset(resolveThemePresetDefinition(normalized));
  return normalized;
}

export function isSystemDarkTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveIsDarkMode(mode) {
  const normalized = normalizeThemeMode(mode);
  if (normalized === THEME_MODE_DARK) return true;
  if (normalized === THEME_MODE_LIGHT) return false;
  return isSystemDarkTheme();
}

export function applyThemeMode(mode) {
  const normalized = normalizeThemeMode(mode);
  if (typeof document === 'undefined') return normalized;

  const root = document.documentElement;
  const darkModeEnabled = resolveIsDarkMode(normalized);
  root.classList.toggle(DARK_MODE_CLASS_NAME, darkModeEnabled);
  root.setAttribute('data-theme-mode', normalized);
  return normalized;
}

export function applyThemePreferences(preferences, options = {}) {
  const normalized = normalizeThemePreferences(preferences);
  const shouldApplyPreset = options.applyPreset !== false;

  if (shouldApplyPreset) {
    applyThemePreset(normalized.preset);
  }

  applyThemeMode(normalized.mode);
  return normalized;
}

export function getSystemThemeMediaQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia('(prefers-color-scheme: dark)');
}
