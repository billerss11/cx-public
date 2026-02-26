// Vue Migration Phase 2: Vue shell with legacy app integration
import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from './stores/pinia.js';
import { ensureTranslationObserver, loadLanguagePreference } from './app/i18n.js';

// CSS imports
import 'handsontable/dist/handsontable.full.min.css';
import './assets/theme.css';
import './assets/style.css';
import './assets/ui-primitives.css';
import 'primeicons/primeicons.css';

import PrimeVue from 'primevue/config';
import {
  applyThemeMode,
  readThemePreferences,
  resolveThemePresetDefinition
} from '@/app/themePreferences.js';

// Create and mount Vue app
// The App.vue component runs Vue-side bootstrap and store initialization on mount.
loadLanguagePreference();
ensureTranslationObserver();

const initialThemePreferences = readThemePreferences();
applyThemeMode(initialThemePreferences.mode);

const app = createApp(App);
app.use(pinia);

app.use(PrimeVue, {
  theme: {
    preset: resolveThemePresetDefinition(initialThemePreferences.preset),
    options: {
      darkModeSelector: '.app-dark',
      cssLayer: {
        name: 'primevue',
        order: 'primevue'
      }
    }
  }
});

app.mount('#app');
