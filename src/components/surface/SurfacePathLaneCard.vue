<script setup>
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed } from 'vue';
import { toSurfaceChannelLabel } from '@/surface/model.js';

const props = defineProps({
  path: {
    type: Object,
    required: true
  },
  outlets: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'select-path',
  'update-path',
  'add-barrier',
  'add-pass-through',
  'update-item',
  'remove-item',
  'move-item',
  'add-outlet',
  'remove-outlet',
  'select-outlet'
]);

const stateOptions = Object.freeze([
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
  { label: 'Static', value: 'static' }
]);

const integrityOptions = Object.freeze([
  { label: 'Intact', value: 'intact' },
  { label: 'Leaking', value: 'leaking' },
  { label: 'Failed Open', value: 'failed_open' },
  { label: 'Failed Closed', value: 'failed_closed' }
]);

const laneTitle = computed(() => (
  String(props.path?.label ?? '').trim() || toSurfaceChannelLabel(props.path?.channelKey)
));

function emitItemPatch(item, patch) {
  emit('update-item', { pathId: props.path?.rowId, itemId: item?.rowId, patch });
}
</script>

<template>
  <article class="surface-path-lane-card">
    <header class="surface-path-lane-card__header">
      <button type="button" class="surface-path-lane-card__title" @click="emit('select-path', path.rowId)">
        {{ laneTitle }}
      </button>
      <div class="surface-path-lane-card__actions">
        <Button
          type="button"
          size="small"
          text
          label="Add Barrier"
          @click="emit('add-barrier', path.rowId)"
        />
        <Button
          type="button"
          size="small"
          text
          label="Add Pass-through"
          @click="emit('add-pass-through', path.rowId)"
        />
        <Button
          type="button"
          size="small"
          text
          label="Add Outlet"
          @click="emit('add-outlet', path.rowId)"
        />
      </div>
    </header>

    <div class="surface-path-lane-card__items">
      <div
        v-for="(item, itemIndex) in path.items || []"
        :key="item.rowId"
        class="surface-path-lane-card__item"
      >
        <InputText
          class="surface-path-lane-card__item-label"
          :model-value="item.label"
          @update:model-value="emitItemPatch(item, { label: $event })"
        />
        <Select
          v-if="item.itemType === 'barrier'"
          :model-value="item.state?.actuationState || 'open'"
          :options="stateOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="surface-path-lane-card__select"
          @update:model-value="emitItemPatch(item, { state: { ...(item.state || {}), actuationState: $event } })"
        />
        <Select
          v-if="item.itemType === 'barrier'"
          :model-value="item.state?.integrityStatus || 'intact'"
          :options="integrityOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="surface-path-lane-card__select"
          @update:model-value="emitItemPatch(item, { state: { ...(item.state || {}), integrityStatus: $event } })"
        />
        <span v-else class="surface-path-lane-card__item-kind">Pass-through</span>
        <div class="surface-path-lane-card__item-actions">
          <Button type="button" size="small" text icon="pi pi-arrow-up" @click="emit('move-item', { pathId: path.rowId, itemId: item.rowId, direction: 'up' })" />
          <Button type="button" size="small" text icon="pi pi-arrow-down" @click="emit('move-item', { pathId: path.rowId, itemId: item.rowId, direction: 'down' })" />
          <Button type="button" size="small" text icon="pi pi-trash" @click="emit('remove-item', { pathId: path.rowId, itemId: item.rowId })" />
        </div>
      </div>
    </div>

    <div v-if="outlets.length > 0" class="surface-path-lane-card__outlets">
      <button
        v-for="outlet in outlets"
        :key="outlet.rowId"
        type="button"
        class="surface-path-lane-card__outlet"
        @click="emit('select-outlet', outlet.rowId)"
      >
        <span>{{ outlet.label }}</span>
        <Button
          type="button"
          size="small"
          text
          icon="pi pi-times"
          @click.stop="emit('remove-outlet', outlet.rowId)"
        />
      </button>
    </div>
  </article>
</template>

<style scoped>
.surface-path-lane-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.surface-path-lane-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.surface-path-lane-card__title {
  border: 0;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 0;
  color: var(--ink);
  text-align: left;
}

.surface-path-lane-card__actions,
.surface-path-lane-card__item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.surface-path-lane-card__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.surface-path-lane-card__item {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(120px, 0.9fr) minmax(140px, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.surface-path-lane-card__item-label,
.surface-path-lane-card__select {
  width: 100%;
}

.surface-path-lane-card__item-kind {
  color: var(--muted);
  font-size: 0.82rem;
}

.surface-path-lane-card__outlets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.surface-path-lane-card__outlet {
  border: 1px solid var(--line);
  background: var(--color-surface-subtle);
  border-radius: 999px;
  padding: 4px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 991px) {
  .surface-path-lane-card__item {
    grid-template-columns: 1fr;
  }

  .surface-path-lane-card__header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
