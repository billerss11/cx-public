import { defineStore } from 'pinia';
import {
  THEME_MODE_SYSTEM,
  THEME_MODE_OPTIONS,
  THEME_PRESET_OPTIONS,
  applyThemeMode,
  applyThemePreferences,
  applyThemePreset,
  getSystemThemeMediaQuery,
  normalizeThemeMode,
  normalizeThemePreset,
  persistThemePreferences,
  readThemePreferences
} from '@/app/themePreferences.js';

let systemThemeMediaQuery = null;
let detachSystemThemeListener = null;

function attachMediaQueryListener(mediaQueryList, callback) {
  if (!mediaQueryList || typeof callback !== 'function') {
    return () => {};
  }

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', callback);
    return () => mediaQueryList.removeEventListener('change', callback);
  }

  if (typeof mediaQueryList.addListener === 'function') {
    mediaQueryList.addListener(callback);
    return () => mediaQueryList.removeListener(callback);
  }

  return () => {};
}

export const useThemeStore = defineStore('theme', {
  state: () => {
    const persisted = readThemePreferences();
    return {
      mode: persisted.mode,
      preset: persisted.preset
    };
  },
  getters: {
    modeOptions: () => THEME_MODE_OPTIONS,
    presetOptions: () => THEME_PRESET_OPTIONS
  },
  actions: {
    initializeTheme() {
      const normalized = applyThemePreferences({
        mode: this.mode,
        preset: this.preset
      });
      this.mode = normalized.mode;
      this.preset = normalized.preset;
      this.syncSystemThemeListener();
      persistThemePreferences({
        mode: this.mode,
        preset: this.preset
      });
    },
    disposeTheme() {
      this.clearSystemThemeListener();
    },
    setThemeMode(mode) {
      const normalized = normalizeThemeMode(mode);
      if (this.mode === normalized) return false;
      this.mode = normalized;
      applyThemeMode(this.mode);
      this.syncSystemThemeListener();
      persistThemePreferences({
        mode: this.mode,
        preset: this.preset
      });
      return true;
    },
    setThemePreset(preset) {
      const normalized = normalizeThemePreset(preset);
      if (this.preset === normalized) return false;
      this.preset = normalized;
      applyThemePreset(this.preset);
      persistThemePreferences({
        mode: this.mode,
        preset: this.preset
      });
      return true;
    },
    setThemePreferences(preferences = {}) {
      const modeNext = normalizeThemeMode(preferences.mode ?? this.mode);
      const presetNext = normalizeThemePreset(preferences.preset ?? this.preset);
      const modeChanged = this.mode !== modeNext;
      const presetChanged = this.preset !== presetNext;
      if (!modeChanged && !presetChanged) return false;

      this.mode = modeNext;
      this.preset = presetNext;
      applyThemePreferences({
        mode: this.mode,
        preset: this.preset
      });
      this.syncSystemThemeListener();
      persistThemePreferences({
        mode: this.mode,
        preset: this.preset
      });
      return true;
    },
    handleSystemThemeChange() {
      if (this.mode !== THEME_MODE_SYSTEM) return;
      applyThemeMode(this.mode);
    },
    clearSystemThemeListener() {
      detachSystemThemeListener?.();
      detachSystemThemeListener = null;
      systemThemeMediaQuery = null;
    },
    syncSystemThemeListener() {
      this.clearSystemThemeListener();
      if (this.mode !== THEME_MODE_SYSTEM) {
        return;
      }

      systemThemeMediaQuery = getSystemThemeMediaQuery();
      if (!systemThemeMediaQuery) return;

      const onChange = () => this.handleSystemThemeChange();
      detachSystemThemeListener = attachMediaQueryListener(systemThemeMediaQuery, onChange);
    }
  }
});
