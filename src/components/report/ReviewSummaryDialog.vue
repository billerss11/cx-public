<script setup>
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Card from 'primevue/card';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onLanguageChange, t } from '@/app/i18n.js';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import { buildCurrentReviewSummarySnapshot, loadReviewSummaryDerivedSummary } from '@/reports/reviewSummary.js';
import { buildReviewSummaryModel } from '@/reports/reviewSummaryModel.js';
import ReviewSummaryMetricSection from '@/components/report/ReviewSummaryMetricSection.vue';
import ReviewSummaryTableSection from '@/components/report/ReviewSummaryTableSection.vue';

defineOptions({ name: 'ReviewSummaryDialog' });

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible']);

const REVIEW_SUMMARY_MIN_WIDTH = 640;
const REVIEW_SUMMARY_MIN_HEIGHT = 420;
const REVIEW_SUMMARY_DEFAULT_WIDTH = 980;
const REVIEW_SUMMARY_DEFAULT_HEIGHT = 760;

const dialogVisible = computed({
  get: () => props.visible === true,
  set: (value) => emit('update:visible', value === true)
});

const {
  dialogSize,
  reconcileDialogSize,
  resizeDialogBy,
  startDialogResize,
  stopDialogResize
} = useFloatingDialogResize({
  minWidth: REVIEW_SUMMARY_MIN_WIDTH,
  minHeight: REVIEW_SUMMARY_MIN_HEIGHT,
  defaultWidth: REVIEW_SUMMARY_DEFAULT_WIDTH,
  defaultHeight: REVIEW_SUMMARY_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.96,
  maxViewportHeightRatio: 0.9,
  cursorClass: 'resizing-both'
});

const dialogStyle = computed(() => ({
  width: `${dialogSize.value.width}px`,
  height: `${dialogSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '90vh'
}));

const summaryModel = ref(null);
const currentSnapshot = ref(null);
const currentDerivedState = ref({ status: 'loading' });
const loadError = ref('');
const isRefreshing = ref(false);
let unsubscribeLanguageChange = null;
let detachWindowResizeListener = null;
let refreshSequence = 0;

const warningDigestSection = computed(() => summaryModel.value?.warningDigest ?? null);
const orderedSections = computed(() => {
  if (!summaryModel.value) return [];
  return Array.isArray(summaryModel.value.sections) ? summaryModel.value.sections : [];
});

function resolveSectionModel(section) {
  const modelKey = String(section?.modelKey ?? '').trim();
  return modelKey ? summaryModel.value?.[modelKey] ?? null : null;
}

function handleResizerKeydown(event) {
  const key = String(event?.key ?? '');
  const step = event?.shiftKey === true ? 36 : 18;
  if (key === 'ArrowRight') {
    event.preventDefault();
    resizeDialogBy(step, 0);
    return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    resizeDialogBy(-step, 0);
    return;
  }
  if (key === 'ArrowDown') {
    event.preventDefault();
    resizeDialogBy(0, step);
    return;
  }
  if (key === 'ArrowUp') {
    event.preventDefault();
    resizeDialogBy(0, -step);
  }
}

function rebuildModel() {
  if (!currentSnapshot.value) return;
  summaryModel.value = buildReviewSummaryModel(currentSnapshot.value, {
    derivedState: currentDerivedState.value
  });
}

async function refreshSummary() {
  const requestId = ++refreshSequence;
  isRefreshing.value = true;
  loadError.value = '';
  let snapshotBuilt = false;

  try {
    const snapshot = buildCurrentReviewSummarySnapshot();
    currentSnapshot.value = snapshot;
    currentDerivedState.value = { status: 'loading' };
    rebuildModel();
    snapshotBuilt = true;

    const derivedState = await loadReviewSummaryDerivedSummary(snapshot);
    if (requestId !== refreshSequence) return;
    currentDerivedState.value = derivedState;
    rebuildModel();
  } catch (error) {
    if (requestId !== refreshSequence) return;
    const message = error?.message || String(error ?? t('common.none'));
    if (snapshotBuilt && currentSnapshot.value) {
      currentDerivedState.value = {
        status: 'error',
        error: message
      };
      rebuildModel();
      return;
    }
    loadError.value = message;
  } finally {
    if (requestId === refreshSequence) {
      isRefreshing.value = false;
    }
  }
}

watch(dialogVisible, (isVisible) => {
  if (!isVisible) {
    stopDialogResize();
    return;
  }
  void refreshSummary();
}, { immediate: true });

onMounted(() => {
  reconcileDialogSize();
  const handleResize = () => {
    reconcileDialogSize();
  };
  window.addEventListener('resize', handleResize);
  detachWindowResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
  unsubscribeLanguageChange = onLanguageChange(() => {
    if (!currentSnapshot.value) return;
    rebuildModel();
  });
});

onBeforeUnmount(() => {
  stopDialogResize();
  detachWindowResizeListener?.();
  detachWindowResizeListener = null;
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
  refreshSequence += 1;
});
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    data-vue-owned="true"
    class="review-summary-dialog"
    :modal="false"
    :draggable="true"
    :style="dialogStyle"
    :breakpoints="{ '1200px': '94vw', '768px': '98vw' }"
  >
    <template #header>
      <div class="review-summary-dialog__header">
        <span>{{ t('ui.review_summary.title') }}</span>
        <Button
          type="button"
          size="small"
          outlined
          data-test="review-summary-refresh"
          :disabled="isRefreshing"
          @click="refreshSummary"
        >
          <span>{{ t('ui.review_summary.refresh') }}</span>
        </Button>
      </div>
    </template>

    <div class="review-summary-dialog__body">
      <p v-if="loadError" class="review-summary-dialog__error">
        {{ loadError }}
      </p>

      <template v-if="summaryModel">
        <template v-for="section in orderedSections" :key="section.id">
          <ReviewSummaryMetricSection
            v-if="section.kind === 'metrics'"
            :section="resolveSectionModel(section)"
          />
          <ReviewSummaryTableSection
            v-else-if="section.kind === 'table'"
            :section="resolveSectionModel(section)"
          />
          <Card
            v-else-if="section.kind === 'warning-list'"
            class="review-summary-section review-summary-section--warnings"
          >
            <template #title>
              <span>{{ warningDigestSection?.title }}</span>
            </template>
            <template #content>
              <p v-if="warningDigestSection?.status === 'loading'" class="review-summary-dialog__meta">
                {{ warningDigestSection.loadingText }}
              </p>
              <p v-else-if="warningDigestSection?.status === 'error'" class="review-summary-dialog__error">
                {{ t('ui.review_summary.derived_error') }} {{ warningDigestSection.error }}
              </p>
              <template v-else>
                <ul v-if="warningDigestSection?.rows?.length" class="review-summary-dialog__warning-list">
                  <li
                    v-for="warning in warningDigestSection.rows"
                    :key="warning.key"
                    class="review-summary-dialog__warning-item"
                  >
                    <strong v-if="warning.code" class="review-summary-dialog__warning-code">[{{ warning.code }}]</strong>
                    <span>{{ warning.message }}</span>
                  </li>
                </ul>
                <p v-else class="review-summary-dialog__meta">{{ t('common.none') }}</p>
                <p v-if="warningDigestSection?.remainingCount > 0" class="review-summary-dialog__meta">
                  {{ warningDigestSection.moreLabel }}
                </p>
              </template>
            </template>
          </Card>
        </template>
      </template>
    </div>

    <button
      type="button"
      class="review-summary-dialog__resizer"
      aria-label="Resize review summary dialog"
      @keydown="handleResizerKeydown"
      @pointerdown="startDialogResize"
    ></button>
  </Dialog>
</template>

<style scoped>
.review-summary-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.review-summary-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: auto;
  position: relative;
  box-sizing: border-box;
  padding-right: 18px;
  padding-bottom: 18px;
}

.review-summary-dialog__meta,
.review-summary-dialog__error {
  margin: 0;
  font-size: 0.86rem;
}

.review-summary-dialog__error {
  color: var(--color-status-error-text);
}

.review-summary-section {
  border: 1px solid var(--line);
}

.review-summary-dialog__warning-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-summary-dialog__warning-item {
  font-size: 0.82rem;
  color: var(--ink);
}

.review-summary-dialog__warning-code {
  margin-right: 4px;
}

.review-summary-dialog__resizer {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  border: 0;
  padding: 0;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 0 0 2px 0;
  background: transparent;
  cursor: nwse-resize;
  z-index: 3;
}

:deep(.review-summary-dialog .p-dialog-content) {
  height: calc(100% - 0.25rem);
  padding-top: 0.5rem;
}
</style>
