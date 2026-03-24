<script setup>
defineOptions({ name: 'CasingPlannerPane' });

import { computed, ref, watch } from 'vue';
import Message from 'primevue/message';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import {
  findFeasiblePrograms,
  getAllCasingSizeOptions,
  getAllHoleSizeOptions,
  getPlannerStageRange
} from '@/utils/casingRules.js';
import { t } from '@/app/i18n.js';

const MAX_VISIBLE_PROGRAMS = 12;

const targetTypeOptions = Object.freeze([
  { label: t('ui.casing_tools.planner.target_type.casing'), value: 'casing' },
  { label: t('ui.casing_tools.planner.target_type.hole'), value: 'hole' }
]);

const startCasingOptions = getAllCasingSizeOptions().map((entry) => ({
  label: entry.label,
  value: entry.label
}));
const targetCasingOptions = startCasingOptions.slice();
const targetHoleOptions = getAllHoleSizeOptions().map((entry) => ({
  label: entry.label,
  value: entry.label
}));

const startCasingLabel = ref(startCasingOptions[0]?.value ?? '');
const targetType = ref('casing');
const targetLabel = ref(targetCasingOptions[0]?.value ?? '');
const maxStages = ref('1');

const activeTargetOptions = computed(() => (
  targetType.value === 'hole'
    ? targetHoleOptions
    : targetCasingOptions
));

watch(targetType, (nextTargetType) => {
  const nextOptions = nextTargetType === 'hole' ? targetHoleOptions : targetCasingOptions;
  const hasCurrentTarget = nextOptions.some((option) => option.value === targetLabel.value);
  if (!hasCurrentTarget) {
    targetLabel.value = nextOptions[0]?.value ?? '';
  }
});

const maxStageOptions = computed(() => {
  return getPlannerStageRange({
    startCasingLabel: startCasingLabel.value,
    targetType: targetType.value
  }).map((value) => ({
    label: value,
    value
  }));
});

watch(maxStageOptions, (nextOptions) => {
  const currentValue = String(maxStages.value);
  const hasCurrentValue = nextOptions.some((option) => option.value === currentValue);
  if (!hasCurrentValue) {
    maxStages.value = String(nextOptions[nextOptions.length - 1]?.value ?? '1');
  }
}, { immediate: true });

const visiblePrograms = computed(() => (
  findFeasiblePrograms({
    startCasingLabel: startCasingLabel.value,
    targetType: targetType.value,
    targetLabel: targetLabel.value,
    maxStages: Number(maxStages.value)
  }).slice(0, MAX_VISIBLE_PROGRAMS)
));

function formatProgramSummary(program) {
  const summaryParts = [
    t('ui.casing_tools.planner.stages', { count: program.stageCount }),
    t('ui.casing_tools.planner.low_clearance_count', { count: program.lowClearanceCount })
  ];
  return summaryParts.join(' | ');
}

function formatStartHoleOptions(program) {
  const options = Array.isArray(program?.startHoleOptions) ? program.startHoleOptions : [];
  if (options.length === 0) return '';
  const formattedOptions = options.map((option) => (
    `${option.label} (${option.isLowClearance ? t('ui.casing_tools.planner.start_hole_label.low') : t('ui.casing_tools.planner.start_hole_label.standard')})`
  ));
  return `${t('ui.casing_tools.planner.start_hole_options')}: ${formattedOptions.join(', ')}`;
}
</script>

<template>
  <section class="casing-planner-pane">
    <div class="casing-planner-pane__controls">
      <div class="casing-planner-pane__field" data-test="casing-planner-start">
        <label class="casing-planner-pane__label" data-i18n="ui.casing_tools.planner.start_casing">
          Start casing
        </label>
        <Select
          v-model="startCasingLabel"
          :options="startCasingOptions"
          option-label="label"
          option-value="value"
          class="w-100"
        />
      </div>

      <div class="casing-planner-pane__field" data-test="casing-planner-target-type">
        <label class="casing-planner-pane__label" data-i18n="ui.casing_tools.planner.target_type">
          Final target type
        </label>
        <SelectButton
          v-model="targetType"
          :options="targetTypeOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="casing-planner-pane__field" data-test="casing-planner-target">
        <label class="casing-planner-pane__label" data-i18n="ui.casing_tools.planner.target_size">
          Final target size
        </label>
        <Select
          v-model="targetLabel"
          :options="activeTargetOptions"
          option-label="label"
          option-value="value"
          class="w-100"
        />
      </div>

      <div class="casing-planner-pane__field" data-test="casing-planner-max-stages">
        <label class="casing-planner-pane__label" data-i18n="ui.casing_tools.planner.max_stages">
          Maximum stages
        </label>
        <Select
          v-model="maxStages"
          :options="maxStageOptions"
          option-label="label"
          option-value="value"
          class="w-100"
        />
      </div>
    </div>

    <div v-if="visiblePrograms.length > 0" class="casing-planner-pane__results" data-test="casing-planner-results">
      <article
        v-for="program in visiblePrograms"
        :key="program.displayText"
        class="casing-planner-pane__result-card"
      >
        <p class="casing-planner-pane__result-sequence">{{ program.displayText }}</p>
        <p class="casing-planner-pane__result-summary">{{ formatProgramSummary(program) }}</p>
        <p
          v-if="program.startHoleOptions.length > 0"
          class="casing-planner-pane__result-context"
          data-test="casing-planner-start-hole-options"
        >
          {{ formatStartHoleOptions(program) }}
        </p>
        <div class="casing-planner-pane__badges">
          <span
            v-if="program.lowClearanceCount > 0"
            class="casing-planner-pane__badge casing-planner-pane__badge--warning"
            data-i18n="ui.casing_tools.clearance.low"
          >
            Low clearance
          </span>
          <span
            v-else
            class="casing-planner-pane__badge casing-planner-pane__badge--standard"
            data-i18n="ui.casing_tools.clearance.standard"
          >
            Standard clearance
          </span>
        </div>
      </article>
    </div>

    <Message v-else severity="info" class="casing-planner-pane__empty">
      <span data-i18n="ui.casing_tools.planner.empty">
        No feasible casing program matches the selected start and target.
      </span>
    </Message>
  </section>
</template>

<style scoped>
.casing-planner-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.casing-planner-pane__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.9rem;
}

.casing-planner-pane__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.casing-planner-pane__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}

.casing-planner-pane__results {
  display: grid;
  gap: 0.8rem;
  overflow: auto;
}

.casing-planner-pane__result-card {
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, transparent);
  padding: 0.85rem 0.95rem;
}

.casing-planner-pane__result-sequence {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.casing-planner-pane__result-summary {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
}

.casing-planner-pane__result-context {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  color: color-mix(in srgb, var(--ink) 78%, var(--muted));
}

.casing-planner-pane__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.casing-planner-pane__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.casing-planner-pane__badge--warning {
  background: color-mix(in srgb, #f59e0b 18%, transparent);
  color: #92400e;
}

.casing-planner-pane__badge--standard {
  background: color-mix(in srgb, #0f766e 16%, transparent);
  color: #115e59;
}

.casing-planner-pane__empty {
  margin: 0;
}

@media (max-width: 760px) {
  .casing-planner-pane__controls {
    grid-template-columns: 1fr;
  }
}
</style>
