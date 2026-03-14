<script setup>
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed } from 'vue';
import { toSurfaceChannelLabel } from '@/surface/model.js';

const props = defineProps({
  transfers: {
    type: Array,
    default: () => []
  },
  availableChannels: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['add-transfer', 'update-transfer', 'remove-transfer', 'select-transfer']);

const transferTypeOptions = Object.freeze([
  { label: 'Leak', value: 'leak' },
  { label: 'Crossover', value: 'crossover' }
]);

const directionOptions = Object.freeze([
  { label: 'Bidirectional', value: 'bidirectional' },
  { label: 'Forward', value: 'forward' },
  { label: 'Reverse', value: 'reverse' }
]);

const channelOptions = computed(() => (
  props.availableChannels.map((channelKey) => ({
    label: toSurfaceChannelLabel(channelKey),
    value: channelKey
  }))
));
</script>

<template>
  <section class="surface-transfer-list">
    <header class="surface-transfer-list__header">
      <h3 class="surface-transfer-list__title">Transfers</h3>
      <Button
        type="button"
        size="small"
        text
        label="Add Transfer"
        @click="emit('add-transfer')"
      />
    </header>

    <div class="surface-transfer-list__items">
      <div
        v-for="transfer in transfers"
        :key="transfer.rowId"
        class="surface-transfer-list__item"
      >
        <button type="button" class="surface-transfer-list__select" @click="emit('select-transfer', transfer.rowId)">
          {{ transfer.label || 'Surface Transfer' }}
        </button>
        <InputText
          class="surface-transfer-list__field"
          :model-value="transfer.label"
          @update:model-value="emit('update-transfer', { rowId: transfer.rowId, patch: { label: $event } })"
        />
        <Select
          class="surface-transfer-list__field"
          :model-value="transfer.transferType || 'leak'"
          :options="transferTypeOptions"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="emit('update-transfer', { rowId: transfer.rowId, patch: { transferType: $event } })"
        />
        <Select
          class="surface-transfer-list__field"
          :model-value="transfer.fromChannelKey"
          :options="channelOptions"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="emit('update-transfer', { rowId: transfer.rowId, patch: { fromChannelKey: $event } })"
        />
        <Select
          class="surface-transfer-list__field"
          :model-value="transfer.toChannelKey"
          :options="channelOptions"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="emit('update-transfer', { rowId: transfer.rowId, patch: { toChannelKey: $event } })"
        />
        <Select
          class="surface-transfer-list__field"
          :model-value="transfer.direction || 'bidirectional'"
          :options="directionOptions"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="emit('update-transfer', { rowId: transfer.rowId, patch: { direction: $event } })"
        />
        <Button
          type="button"
          size="small"
          text
          icon="pi pi-trash"
          @click="emit('remove-transfer', transfer.rowId)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.surface-transfer-list {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.surface-transfer-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.surface-transfer-list__title {
  margin: 0;
  font-size: 0.95rem;
}

.surface-transfer-list__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.surface-transfer-list__item {
  display: grid;
  grid-template-columns: minmax(140px, 1.2fr) repeat(5, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: center;
}

.surface-transfer-list__select {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0;
  color: var(--ink);
  font-weight: 600;
}

.surface-transfer-list__field {
  width: 100%;
}

@media (max-width: 991px) {
  .surface-transfer-list__item {
    grid-template-columns: 1fr;
  }
}
</style>
