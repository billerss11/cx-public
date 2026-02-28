<script setup>
defineProps({
  canAdd: {
    type: Boolean,
    default: false
  },
  canMoveUp: {
    type: Boolean,
    default: false
  },
  canMoveDown: {
    type: Boolean,
    default: false
  },
  canDuplicate: {
    type: Boolean,
    default: false
  },
  canDelete: {
    type: Boolean,
    default: false
  }
});

defineEmits(['add', 'move-up', 'move-down', 'duplicate', 'delete']);
</script>

<template>
  <div class="left-hierarchy-node-actions">
    <Button
      type="button"
      size="small"
      icon="pi pi-plus"
      severity="secondary"
      :disabled="!canAdd"
      title="Add"
      @click="$emit('add')"
    />
    <Button
      type="button"
      size="small"
      icon="pi pi-arrow-up"
      severity="secondary"
      :disabled="!canMoveUp"
      title="Move Up"
      @click="$emit('move-up')"
    />
    <Button
      type="button"
      size="small"
      icon="pi pi-arrow-down"
      severity="secondary"
      :disabled="!canMoveDown"
      title="Move Down"
      @click="$emit('move-down')"
    />
    <Button
      type="button"
      size="small"
      icon="pi pi-copy"
      severity="secondary"
      :disabled="!canDuplicate"
      title="Duplicate"
      @click="$emit('duplicate')"
    />
    <Button
      type="button"
      size="small"
      icon="pi pi-trash"
      severity="danger"
      :disabled="!canDelete"
      title="Delete"
      @click="$emit('delete')"
    />
  </div>
</template>

<style scoped>
.left-hierarchy-node-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
