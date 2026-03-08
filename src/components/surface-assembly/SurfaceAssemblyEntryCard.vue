<script setup>
const props = defineProps({
  hasAssembly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['open-composer']);

function handleOpen(event) {
  emit('open-composer', event);
}
</script>

<template>
  <section class="surface-assembly-entry-card" data-testid="surface-assembly-entry-card">
    <div class="surface-assembly-entry-card__copy">
      <p class="surface-assembly-entry-card__eyebrow">Surface Engineering Model</p>
      <h4 class="surface-assembly-entry-card__title">
        {{ hasAssembly ? 'Committed surface configuration is available.' : 'No surface configuration has been built yet.' }}
      </h4>
      <p class="surface-assembly-entry-card__description">
        {{
          hasAssembly
            ? 'Open the guided engineering surface model to revise the active family, outlet chains, and valve states.'
            : 'Open the guided engineering surface model to choose a surface family and configure the required outlet chains.'
        }}
      </p>
    </div>

    <Button
      type="button"
      class="surface-assembly-entry-card__button"
      icon="pi pi-sitemap"
      data-testid="surface-assembly-entry-open"
      @click="handleOpen"
    >
      <span>{{ hasAssembly ? 'Edit Surface Configuration' : 'Build Surface Configuration' }}</span>
    </Button>
  </section>
</template>

<style scoped>
.surface-assembly-entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid color-mix(in srgb, var(--color-accent-primary) 28%, var(--line));
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent-primary) 12%, transparent), transparent 45%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-elevated) 96%, white), var(--color-surface-subtle));
}

.surface-assembly-entry-card__copy {
  min-width: 0;
}

.surface-assembly-entry-card__eyebrow {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent-primary-strong);
}

.surface-assembly-entry-card__title {
  margin: 0 0 4px;
  font-size: 0.96rem;
  color: var(--color-ink-strong);
}

.surface-assembly-entry-card__description {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  color: var(--muted);
}

.surface-assembly-entry-card__button {
  flex: 0 0 auto;
  white-space: nowrap;
}

@media (max-width: 991px) {
  .surface-assembly-entry-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
