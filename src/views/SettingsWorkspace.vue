<script setup>
defineOptions({ name: 'SettingsWorkspace' });

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Select from 'primevue/select';
import { getLanguage, onLanguageChange, setLanguage } from '@/app/i18n.js';
import { useThemeStore } from '@/stores/themeStore.js';

const selectedLanguage = ref(getLanguage());
const themeStore = useThemeStore();
let unsubscribeLanguageChange = null;

const languageOptions = [
  { value: 'zh', labelKey: 'ui.lang.zh', label: 'Chinese' },
  { value: 'en', labelKey: 'ui.lang.en', label: 'English' }
];

const themeModeModel = computed({
  get: () => themeStore.mode,
  set: (value) => {
    themeStore.setThemeMode(value);
  }
});

const themePresetModel = computed({
  get: () => themeStore.preset,
  set: (value) => {
    themeStore.setThemePreset(value);
  }
});

const themeModeOptions = computed(() => themeStore.modeOptions);
const themePresetOptions = computed(() => themeStore.presetOptions);
const selectedThemeModeOption = computed(() => (
  themeModeOptions.value.find((option) => option.value === themeModeModel.value) ?? null
));
const selectedThemePresetOption = computed(() => (
  themePresetOptions.value.find((option) => option.value === themePresetModel.value) ?? null
));

watch(selectedLanguage, (nextLanguage) => {
  if (nextLanguage !== getLanguage()) {
    setLanguage(nextLanguage);
  }
});

onMounted(() => {
  selectedLanguage.value = getLanguage();
  unsubscribeLanguageChange = onLanguageChange((lang) => {
    if (selectedLanguage.value !== lang) {
      selectedLanguage.value = lang;
    }
  });
});

onBeforeUnmount(() => {
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
});
</script>

<template>
  <div class="settings-workspace">
    <section class="settings-card">
      <p class="settings-eyebrow" data-i18n="ui.settings.eyebrow">Global Settings</p>
      <h2 class="settings-title" data-i18n="ui.settings.title">Application Preferences</h2>
      <p class="settings-description" data-i18n="ui.settings.description">
        Update preferences that apply across all workspaces.
      </p>

      <div class="language-card settings-card__section">
        <label class="form-label" data-i18n="ui.language_label">Language</label>
        <div class="d-flex flex-wrap align-items-center gap-3">
          <div v-for="option in languageOptions" :key="option.value" class="d-flex align-items-center gap-2">
            <RadioButton
              v-model="selectedLanguage"
              :input-id="`settings-lang-${option.value}`"
              name="language"
              :value="option.value"
            />
            <label :for="`settings-lang-${option.value}`" :data-i18n="option.labelKey">{{ option.label }}</label>
          </div>
        </div>
      </div>

      <div class="language-card settings-card__section">
        <label class="form-label" data-i18n="ui.theme_preset_label">Theme Preset</label>
        <Select
          v-model="themePresetModel"
          :options="themePresetOptions"
          option-label="label"
          option-value="value"
          class="settings-card__select"
        >
          <template #value="slotProps">
            <span
              v-if="selectedThemePresetOption"
              :data-i18n="selectedThemePresetOption.i18nKey"
            >
              {{ selectedThemePresetOption.label }}
            </span>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
          <template #option="slotProps">
            <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
          </template>
        </Select>
      </div>

      <div class="language-card settings-card__section">
        <label class="form-label" data-i18n="ui.theme_mode_label">Appearance Mode</label>
        <Select
          v-model="themeModeModel"
          :options="themeModeOptions"
          option-label="label"
          option-value="value"
          class="settings-card__select"
        >
          <template #value="slotProps">
            <span
              v-if="selectedThemeModeOption"
              :data-i18n="selectedThemeModeOption.i18nKey"
            >
              {{ selectedThemeModeOption.label }}
            </span>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
          <template #option="slotProps">
            <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
          </template>
        </Select>
        <small class="settings-card__hint" data-i18n="ui.theme_mode_hint">
          System follows your OS preference. Changes apply immediately.
        </small>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-workspace {
  min-height: 100%;
  display: flex;
  align-items: flex-start;
}

.settings-card {
  width: min(640px, 100%);
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-eyebrow {
  margin: 0;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: var(--p-primary-700);
}

.settings-title {
  margin: 0;
  font-size: 1.25rem;
}

.settings-description {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.settings-card__section {
  margin-top: 2px;
}

.settings-card__select {
  min-width: min(320px, 100%);
}

.settings-card__hint {
  display: block;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.35;
  margin-top: 6px;
}
</style>
