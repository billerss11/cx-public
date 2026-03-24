<script setup>
import { computed } from 'vue';
import { t } from '@/app/i18n.js';

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  }
});

const visibleRows = computed(() => (
  Array.isArray(props.rows) ? props.rows.filter((row) => Array.isArray(row?.segments) && row.segments.length > 0) : []
));

const isVisible = computed(() => visibleRows.value.length > 0);
</script>

<template>
  <section v-if="isVisible" class="annulus-meaning-card">
    <header class="annulus-meaning-card__header">
      <h3 class="annulus-meaning-card__title" data-i18n="ui.annulus_meaning.title">
        {{ t('ui.annulus_meaning.title') }}
      </h3>
    </header>

    <table class="annulus-meaning-card__table">
      <thead>
        <tr>
          <th class="annulus-meaning-card__heading" data-i18n="ui.annulus_meaning.columns.annulus">
            {{ t('ui.annulus_meaning.columns.annulus') }}
          </th>
          <th class="annulus-meaning-card__heading" data-i18n="ui.annulus_meaning.columns.meaning">
            {{ t('ui.annulus_meaning.columns.meaning') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in visibleRows"
          :key="row.channelKey"
          class="annulus-meaning-card__row"
        >
          <td class="annulus-meaning-card__label">{{ row.label }}</td>
          <td class="annulus-meaning-card__meaning">
            <p
              v-if="row.segments.length === 1"
              class="annulus-meaning-card__segment annulus-meaning-card__segment--single"
            >
              {{ row.segments[0].description }}
            </p>
            <div v-else class="annulus-meaning-card__segment-list">
              <p
                v-for="segment in row.segments"
                :key="`${row.channelKey}-${segment.top}-${segment.bottom}`"
                class="annulus-meaning-card__segment"
              >
                <span class="annulus-meaning-card__depth">{{ segment.depthLabel }}:</span>
                <span>{{ segment.description }}</span>
              </p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.annulus-meaning-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.annulus-meaning-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.annulus-meaning-card__title {
  margin: 0;
  font-size: 0.9rem;
}

.annulus-meaning-card__table {
  width: 100%;
  border-collapse: collapse;
}

.annulus-meaning-card__heading {
  padding: 0 0 6px;
  text-align: left;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}

.annulus-meaning-card__row + .annulus-meaning-card__row td {
  border-top: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
}

.annulus-meaning-card__label,
.annulus-meaning-card__meaning {
  padding: 8px 0;
  vertical-align: top;
  font-size: 0.8rem;
  color: var(--ink);
}

.annulus-meaning-card__label {
  width: 126px;
  min-width: 126px;
  font-weight: 700;
  padding-right: 12px;
}

.annulus-meaning-card__segment-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.annulus-meaning-card__segment {
  margin: 0;
  line-height: 1.35;
}

.annulus-meaning-card__depth {
  font-weight: 600;
  color: var(--muted);
}

@media (max-width: 991px) {
  .annulus-meaning-card__label {
    width: 96px;
    min-width: 96px;
  }
}
</style>
