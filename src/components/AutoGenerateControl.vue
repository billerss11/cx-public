<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ToggleSwitch from 'primevue/toggleswitch';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import { onLanguageChange, t } from '@/app/i18n.js';

const languageTick = ref(0);
let unsubscribeLanguageChange = null;
const interactionStore = useInteractionStore();

onMounted(() => {
    unsubscribeLanguageChange = onLanguageChange(() => {
        languageTick.value += 1;
    });
});

onBeforeUnmount(() => {
    unsubscribeLanguageChange?.();
    unsubscribeLanguageChange = null;
});

const autoGenerateEnabled = computed({
    get: () => interactionStore.interaction.autoGenerate === true,
    set: (value) => {
        const enabled = value === true;
        interactionStore.setAutoGenerate(enabled);
        if (enabled) {
            requestSchematicRender({ immediate: true });
        }
    }
});

const autoGenerateHintText = computed(() => {
    // Touch languageTick so this recomputes when locale changes.
    void languageTick.value;
    return autoGenerateEnabled.value
        ? t('ui.auto_generate_hint_on')
        : t('ui.auto_generate_hint_off');
});
</script>

<template>
  <div class="mt-3 d-flex flex-column gap-1">
    <div class="d-flex align-items-center gap-2">
      <ToggleSwitch
        input-id="autoGenerateToggle"
        v-model="autoGenerateEnabled"
      />
      <label for="autoGenerateToggle" data-i18n="ui.auto_generate">Auto-update plot</label>
    </div>
    <small id="autoGenerateHint" class="text-muted">{{ autoGenerateHintText }}</small>
  </div>
</template>

