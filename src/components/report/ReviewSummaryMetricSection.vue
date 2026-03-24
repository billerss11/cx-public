<script setup>
import Card from 'primevue/card';
import { computed } from 'vue';
import { t } from '@/app/i18n.js';

defineOptions({ name: 'ReviewSummaryMetricSection' });

const props = defineProps({
  section: {
    type: Object,
    required: true
  }
});

const resolvedStatus = computed(() => String(props.section?.status ?? 'ready').trim().toLowerCase());
const resolvedItems = computed(() => Array.isArray(props.section?.items) ? props.section.items : []);
const loadingText = computed(() => props.section?.loadingText || t('ui.review_summary.derived_loading'));
const errorText = computed(() => props.section?.error || t('ui.review_summary.derived_error'));
</script>

<template>
  <Card class="review-summary-section review-summary-section--metrics">
    <template #title>
      <span>{{ section.title }}</span>
    </template>
    <template #content>
      <p v-if="resolvedStatus === 'loading'" class="review-summary-section__meta">
        {{ loadingText }}
      </p>
      <p v-else-if="resolvedStatus === 'error'" class="review-summary-section__error">
        {{ t('ui.review_summary.derived_error') }} {{ errorText }}
      </p>
      <div v-else class="review-summary-metric-grid">
        <article
          v-for="item in resolvedItems"
          :key="item.key"
          class="review-summary-metric-grid__card"
        >
          <p class="review-summary-metric-grid__label">{{ item.label }}</p>
          <p class="review-summary-metric-grid__value">{{ item.value }}</p>
        </article>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.review-summary-section {
  border: 1px solid var(--line);
}

.review-summary-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.review-summary-metric-grid__card {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  padding: 10px 12px;
}

.review-summary-metric-grid__label {
  margin: 0 0 4px;
  font-size: 0.74rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.review-summary-metric-grid__value {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.review-summary-section__meta,
.review-summary-section__error {
  margin: 0;
  font-size: 0.86rem;
}

.review-summary-section__error {
  color: var(--color-status-error-text);
}
</style>
