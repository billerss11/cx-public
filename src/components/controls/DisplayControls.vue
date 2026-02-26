<script setup>
import { computed } from 'vue';
import Select from 'primevue/select';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { COLOR_PALETTE_OPTIONS, NAMED_COLORS } from '@/constants/index.js';

const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const isCementVisible = computed(() => config.showCement === true);

const hatchStyleOptions = [
  { value: 'none', label: 'None', i18nKey: 'ui.hatch.none' },
  { value: 'diag', label: 'Diagonal', i18nKey: 'ui.hatch.diag' },
  { value: 'cross', label: 'Cross', i18nKey: 'ui.hatch.cross' },
  { value: 'dots', label: 'Dots', i18nKey: 'ui.hatch.dots' },
  { value: 'grid', label: 'Grid', i18nKey: 'ui.hatch.grid' }
];

const colorPaletteModel = computed({
  get: () => config.colorPalette ?? 'Tableau 10',
  set: (value) => {
    viewConfigStore.setColorPalette(value);
  }
});

const showCementModel = computed({
  get: () => config.showCement === true,
  set: (value) => {
    viewConfigStore.setShowCement(value);
  }
});

const cementColorModel = computed({
  get: () => config.cementColor ?? 'lightgray',
  set: (value) => {
    viewConfigStore.setCementColor(value);
  }
});

const cementHatchEnabledModel = computed({
  get: () => config.cementHatchEnabled === true,
  set: (value) => {
    viewConfigStore.setCementHatchEnabled(value);
  }
});

const cementHatchStyleModel = computed({
  get: () => config.cementHatchStyle ?? 'none',
  set: (value) => {
    viewConfigStore.setCementHatchStyle(value);
  }
});

const cementColorOptions = computed(() => {
  const selectedColor = String(cementColorModel.value || 'lightgray').trim();
  const baseOptions = NAMED_COLORS.map((color) => ({ label: color, value: color }));
  if (!selectedColor) return baseOptions;
  const hasSelected = baseOptions.some((option) => option.value.toLowerCase() === selectedColor.toLowerCase());
  if (hasSelected) return baseOptions;
  return [{ label: selectedColor, value: selectedColor }, ...baseOptions];
});

const selectedHatchStyleOption = computed(() => (
  hatchStyleOptions.find((option) => option.value === cementHatchStyleModel.value) ?? null
));
</script>

<template>
  <Card class="control-group">
    <template #content>
      <div class="section-title" data-i18n="ui.display_controls_title">Display Layers & Colors</div>
      <small class="control-helper" data-i18n="ui.display_controls_helper">Control rendering style, color palette, and optional display layers.</small>

      <div class="mb-3">
        <label class="form-label" data-i18n="ui.color_palette">Color Palette:</label>
        <Select input-id="colorPalette" v-model="colorPaletteModel" :options="COLOR_PALETTE_OPTIONS" class="w-100" />
      </div>

      <div class="mb-3">
        <div class="d-flex align-items-center gap-2">
          <Checkbox input-id="showCement" v-model="showCementModel" binary />
          <label for="showCement" data-i18n="ui.show_cement">Show Cement</label>
        </div>
      </div>

      <div class="mb-0" v-show="isCementVisible">
        <label class="form-label" data-i18n="ui.cement_color">Cement Color:</label>
        <div class="d-flex align-items-center gap-2">
          <span class="color-swatch" :style="{ backgroundColor: cementColorModel || 'lightgray' }"></span>
          <Select
            v-model="cementColorModel"
            :options="cementColorOptions"
            option-label="label"
            option-value="value"
            class="w-100"
          />
        </div>
        <div class="mt-2 d-flex align-items-center gap-2">
          <Checkbox input-id="cementHatchEnabled" v-model="cementHatchEnabledModel" binary />
          <label for="cementHatchEnabled" data-i18n="ui.cement_hatch">Use Cement Hatch</label>
        </div>
        <div class="mt-2">
          <label class="form-label mb-1" data-i18n="ui.hatch_style">Hatch Style:</label>
          <Select
            v-model="cementHatchStyleModel"
            :options="hatchStyleOptions"
            option-label="label"
            option-value="value"
            class="w-100"
          >
            <template #value="slotProps">
              <span v-if="selectedHatchStyleOption" :data-i18n="selectedHatchStyleOption.i18nKey">{{ selectedHatchStyleOption.label }}</span>
              <span v-else>{{ slotProps.placeholder }}</span>
            </template>
            <template #option="slotProps">
              <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
            </template>
          </Select>
        </div>
      </div>
    </template>
  </Card>
</template>
