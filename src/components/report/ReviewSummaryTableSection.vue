<script setup>
import Card from 'primevue/card';
import { computed } from 'vue';
import { t } from '@/app/i18n.js';

defineOptions({ name: 'ReviewSummaryTableSection' });

const props = defineProps({
  section: {
    type: Object,
    required: true
  }
});

const columns = computed(() => Array.isArray(props.section?.columns) ? props.section.columns : []);
const rows = computed(() => Array.isArray(props.section?.rows) ? props.section.rows : []);
</script>

<template>
  <Card class="review-summary-section review-summary-section--table">
    <template #title>
      <span>{{ section.title }}</span>
    </template>
    <template #content>
      <p v-if="rows.length === 0" class="review-summary-table__empty">
        {{ t('common.none') }}
      </p>
      <div v-else class="review-summary-table__shell">
        <table class="review-summary-table">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td v-for="column in columns" :key="`${row.key}-${column.key}`">{{ row[column.key] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.review-summary-section {
  border: 1px solid var(--line);
}

.review-summary-table__shell {
  overflow-x: auto;
}

.review-summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.review-summary-table th,
.review-summary-table td {
  border: 1px solid var(--line);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}

.review-summary-table th {
  background: var(--color-surface-subtle);
  font-weight: 700;
}

.review-summary-table__empty {
  margin: 0;
  color: var(--muted);
}
</style>
