<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { clamp } from '@/utils/general.js';
import { t } from '@/app/i18n.js';
import {
  USER_ANNOTATION_DEFAULT_STYLE,
  USER_ANNOTATION_DEFAULT_TEXT,
  USER_ANNOTATION_TOOL_MODE_ADD,
  createUserAnnotation
} from '@/utils/userAnnotations.js';

const props = defineProps({
  annotations: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: null
  },
  xScale: {
    type: Function,
    required: true
  },
  yScale: {
    type: Function,
    required: true
  },
  minDepth: {
    type: Number,
    required: true
  },
  maxDepth: {
    type: Number,
    required: true
  },
  xHalf: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  toolMode: {
    type: String,
    default: 'select'
  },
  readonly: {
    type: Boolean,
    default: false
  },
  svgElement: {
    type: Object,
    default: null
  }
});

const emit = defineEmits([
  'create-annotation',
  'update-annotation',
  'select-annotation',
  'delete-annotation'
]);

const dragState = ref(null);
const pendingDragState = ref(null);
const dragPreviewById = ref({});
const editingAnnotationId = ref(null);
const editingTextDraft = ref('');
const inlineEditorInputRefsById = ref({});
const INLINE_EDITOR_FOCUS_RETRIES = 8;
const DRAG_START_THRESHOLD_PX = 4;

const isReadonly = computed(() => props.readonly === true);
const isAddMode = computed(() => props.toolMode === USER_ANNOTATION_TOOL_MODE_ADD);

function normalizeId(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

const selectedAnnotationId = computed(() => normalizeId(props.selectedId));

function clampDepth(value) {
  const minDepth = Math.min(props.minDepth, props.maxDepth);
  const maxDepth = Math.max(props.minDepth, props.maxDepth);
  return clamp(value, minDepth, maxDepth);
}

function clampXValue(value) {
  const xHalf = Number(props.xHalf);
  if (!Number.isFinite(xHalf) || xHalf <= 0) return value;
  return clamp(value, -xHalf, xHalf);
}

function resolveAnnotationModel(row, index) {
  const id = normalizeId(row?.id) ?? `user-annotation-index-${index}`;
  const anchorDepth = Number(row?.anchor?.depth);
  const anchorX = Number(row?.anchor?.xValue);
  const labelDepth = Number(row?.labelPos?.depth);
  const labelX = Number(row?.labelPos?.xValue);
  const style = {
    ...USER_ANNOTATION_DEFAULT_STYLE,
    ...(row?.style && typeof row.style === 'object' ? row.style : {})
  };
  const fontSize = clamp(Number(style.fontSize), 8, 48);
  const arrowSize = clamp(Number(style.arrowSize), 1, 8);
  const text = String(row?.text ?? '').trim() || t('defaults.new_user_annotation') || USER_ANNOTATION_DEFAULT_TEXT;
  const preview = dragPreviewById.value[id] ?? null;
  const anchor = preview?.anchor ?? {
    depth: Number.isFinite(anchorDepth) ? clampDepth(anchorDepth) : clampDepth(props.minDepth),
    xValue: Number.isFinite(anchorX) ? clampXValue(anchorX) : 0
  };
  const labelPos = preview?.labelPos ?? {
    depth: Number.isFinite(labelDepth) ? clampDepth(labelDepth) : clampDepth(anchor.depth - 120),
    xValue: Number.isFinite(labelX) ? clampXValue(labelX) : clampXValue(anchor.xValue + 12)
  };
  const labelPixelX = props.xScale(labelPos.xValue);
  const labelPixelY = props.yScale(labelPos.depth);
  const approxTextWidth = Math.max(48, text.length * Math.max(7, fontSize * 0.56));
  const hitBoxWidth = approxTextWidth + 14;
  const hitBoxHeight = Math.max(18, fontSize + 10);
  const toolbarWidth = 176;
  const toolbarHeight = 108;
  const toolbarGap = 10;
  const canvasPadding = 8;
  const preferredToolbarX = labelPixelX + hitBoxWidth + toolbarGap;
  const preferredToolbarY = labelPixelY - (toolbarHeight / 2);
  const maxToolbarX = Math.max(canvasPadding, props.width - toolbarWidth - canvasPadding);
  const maxToolbarY = Math.max(canvasPadding, props.height - toolbarHeight - canvasPadding);
  const toolbarX = clamp(preferredToolbarX, canvasPadding, maxToolbarX);
  const toolbarY = clamp(preferredToolbarY, canvasPadding, maxToolbarY);

  return {
    id,
    index,
    anchor,
    labelPos,
    text,
    style: {
      fontSize,
      arrowSize,
      fontColor: String(style.fontColor || USER_ANNOTATION_DEFAULT_STYLE.fontColor),
      arrowColor: String(style.arrowColor || USER_ANNOTATION_DEFAULT_STYLE.arrowColor)
    },
    anchorX: props.xScale(anchor.xValue),
    anchorY: props.yScale(anchor.depth),
    labelX: labelPixelX,
    labelY: labelPixelY,
    hitBoxX: labelPixelX - 7,
    hitBoxY: labelPixelY - (hitBoxHeight / 2),
    hitBoxWidth,
    hitBoxHeight,
    toolbarX,
    toolbarY,
    toolbarWidth,
    toolbarHeight
  };
}

const displayAnnotations = computed(() => (
  (Array.isArray(props.annotations) ? props.annotations : [])
    .map((row, index) => resolveAnnotationModel(row, index))
));

function resolveSvgPoint(event) {
  const svg = props.svgElement;
  const ctm = svg?.getScreenCTM?.();
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!svg || !ctm || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(ctm.inverse());
  return {
    x: local.x,
    y: local.y
  };
}

function resolveDomainFromEvent(event) {
  const point = resolveSvgPoint(event);
  if (!point) return null;

  return {
    depth: clampDepth(props.yScale.invert(point.y)),
    xValue: clampXValue(props.xScale.invert(point.x))
  };
}

function clearPendingDragState() {
  pendingDragState.value = null;
}

function clearDragState() {
  const drag = dragState.value;
  dragState.value = null;
  if (!drag) return;
  const nextPreview = { ...dragPreviewById.value };
  delete nextPreview[drag.id];
  dragPreviewById.value = nextPreview;
}

function clearInlineEditState() {
  editingAnnotationId.value = null;
  editingTextDraft.value = '';
}

function setInlineEditorInputRef(annotationId, element) {
  const id = normalizeId(annotationId);
  if (!id) return;

  const nextRefs = { ...inlineEditorInputRefsById.value };
  const canFocus = element &&
    typeof element.focus === 'function' &&
    typeof element.setSelectionRange === 'function';
  if (canFocus) {
    nextRefs[id] = element;
    if (editingAnnotationId.value === id) {
      focusInlineEditor(id);
    }
  } else {
    delete nextRefs[id];
  }
  inlineEditorInputRefsById.value = nextRefs;
}

function focusInlineEditor(annotationId) {
  const id = normalizeId(annotationId);
  if (!id) return false;

  const input = inlineEditorInputRefsById.value[id];
  if (!input || typeof input.focus !== 'function') return false;
  if (editingAnnotationId.value !== id) return false;

  input.focus();
  if (typeof input.setSelectionRange === 'function') {
    const textLength = String(input.value ?? '').length;
    input.setSelectionRange(textLength, textLength);
  }
  return document?.activeElement === input;
}

function scheduleInlineEditorFocus(annotationId, attempt = 0) {
  const id = normalizeId(annotationId);
  if (!id || editingAnnotationId.value !== id) return;

  const run = () => {
    if (editingAnnotationId.value !== id) return;
    const focused = focusInlineEditor(id);
    if (focused || attempt >= INLINE_EDITOR_FOCUS_RETRIES) return;
    window.setTimeout(() => {
      scheduleInlineEditorFocus(id, attempt + 1);
    }, 16);
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
    return;
  }
  run();
}

function stopDragListeners() {
  window.removeEventListener('mousemove', handleWindowMouseMove);
  window.removeEventListener('mouseup', handleWindowMouseUp);
}

function commitDragPosition() {
  const drag = dragState.value;
  if (!drag) return;
  const preview = dragPreviewById.value[drag.id];
  if (!preview) return;
  emit('update-annotation', {
    id: drag.id,
    index: drag.index,
    patch: {
      anchor: preview.anchor,
      labelPos: preview.labelPos
    }
  });
}

function applyDragDomain(domain) {
  const drag = dragState.value;
  if (!drag || !domain) return;

  const currentPreview = dragPreviewById.value[drag.id];
  if (!currentPreview) return;
  const next = {
    anchor: { ...currentPreview.anchor },
    labelPos: { ...currentPreview.labelPos }
  };
  if (drag.mode === 'anchor') {
    next.anchor = domain;
  } else {
    next.labelPos = domain;
  }
  dragPreviewById.value = {
    ...dragPreviewById.value,
    [drag.id]: next
  };
}

function handleWindowMouseMove(event) {
  if (dragState.value) {
    const domain = resolveDomainFromEvent(event);
    if (!domain) return;
    applyDragDomain(domain);
    return;
  }

  const pending = pendingDragState.value;
  if (!pending) return;

  const currentX = Number(event?.clientX);
  const currentY = Number(event?.clientY);
  if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) return;

  const distance = Math.hypot(currentX - pending.startClientX, currentY - pending.startClientY);
  if (distance < DRAG_START_THRESHOLD_PX) return;

  emit('select-annotation', { id: pending.id, index: pending.index });
  dragPreviewById.value = {
    ...dragPreviewById.value,
    [pending.id]: {
      anchor: { ...pending.anchor },
      labelPos: { ...pending.labelPos }
    }
  };
  dragState.value = {
    id: pending.id,
    index: pending.index,
    mode: pending.mode
  };

  const domain = resolveDomainFromEvent(event);
  if (!domain) return;
  applyDragDomain(domain);
}

function handleWindowMouseUp() {
  if (dragState.value) {
    commitDragPosition();
  }
  clearDragState();
  clearPendingDragState();
  stopDragListeners();
}

function startDrag(item, mode, event) {
  if (isReadonly.value) return;
  if (!item?.id) return;

  const startClientX = Number(event?.clientX);
  const startClientY = Number(event?.clientY);

  pendingDragState.value = {
    id: item.id,
    index: item.index,
    mode,
    startClientX: Number.isFinite(startClientX) ? startClientX : 0,
    startClientY: Number.isFinite(startClientY) ? startClientY : 0,
    anchor: { ...item.anchor },
    labelPos: { ...item.labelPos }
  };

  stopDragListeners();
  window.addEventListener('mousemove', handleWindowMouseMove);
  window.addEventListener('mouseup', handleWindowMouseUp);
}

function isEditing(id) {
  return editingAnnotationId.value === normalizeId(id);
}

function startInlineTextEdit(item) {
  if (isReadonly.value || !item?.id) return;
  selectAnnotation(item);
  clearPendingDragState();
  clearDragState();
  stopDragListeners();
  editingAnnotationId.value = item.id;
  editingTextDraft.value = item.text;
  scheduleInlineEditorFocus(item.id);
}

function startInlineTextEditById(id) {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return false;
  const item = displayAnnotations.value.find((row) => row.id === normalizedId) ?? null;
  if (!item) return false;
  startInlineTextEdit(item);
  return true;
}

defineExpose({
  startInlineTextEditById
});

function commitInlineTextEdit(item) {
  if (!item?.id || !isEditing(item.id)) return;
  const fallbackText = t('defaults.new_user_annotation') || USER_ANNOTATION_DEFAULT_TEXT;
  const nextText = String(editingTextDraft.value ?? '').trim() || fallbackText;
  if (nextText !== item.text) {
    emit('update-annotation', {
      id: item.id,
      index: item.index,
      patch: { text: nextText }
    });
  }
  clearInlineEditState();
}

function cancelInlineTextEdit() {
  clearInlineEditState();
}

function handleLabelMouseDown(item, event) {
  if (isEditing(item?.id)) return;
  if (Number(event?.button) !== 0) return;
  startDrag(item, 'label', event);
}

function handleAnchorMouseDown(item, event) {
  if (Number(event?.button) !== 0) return;
  startDrag(item, 'anchor', event);
}

function handleLabelDoubleClick(item) {
  startInlineTextEdit(item);
}

function updateAnnotationStyle(item, stylePatch) {
  if (!item?.id || !stylePatch || typeof stylePatch !== 'object') return;
  emit('update-annotation', {
    id: item.id,
    index: item.index,
    patch: {
      style: stylePatch
    }
  });
}

function handleAnnotationTextColorInput(item, event) {
  const color = String(event?.target?.value ?? '').trim();
  if (!color) return;
  updateAnnotationStyle(item, { fontColor: color });
}

function handleAnnotationArrowColorInput(item, event) {
  const color = String(event?.target?.value ?? '').trim();
  if (!color) return;
  updateAnnotationStyle(item, { arrowColor: color });
}

function changeAnnotationFontSize(item, delta) {
  const next = clamp(Number(item?.style?.fontSize) + delta, 8, 48);
  updateAnnotationStyle(item, { fontSize: next });
}

function changeAnnotationArrowSize(item, delta) {
  const next = clamp(Number(item?.style?.arrowSize) + delta, 1, 8);
  updateAnnotationStyle(item, { arrowSize: next });
}

function deleteAnnotation(item) {
  emit('delete-annotation', {
    id: item?.id ?? null,
    index: item?.index ?? null
  });
}

function handleCreateAnnotation(event) {
  if (isReadonly.value || !isAddMode.value) return;
  const domain = resolveDomainFromEvent(event);
  if (!domain) return;

  const next = createUserAnnotation(domain, {
    minDepth: props.minDepth,
    maxDepth: props.maxDepth,
    xHalf: props.xHalf,
    text: t('defaults.new_user_annotation') || USER_ANNOTATION_DEFAULT_TEXT
  });

  emit('create-annotation', next);
  emit('select-annotation', { id: next.id, index: null });
}

function isSelected(id) {
  return id === selectedAnnotationId.value;
}

function selectAnnotation(item) {
  emit('select-annotation', {
    id: item?.id ?? null,
    index: item?.index ?? null
  });
}

watch(
  displayAnnotations,
  (rows) => {
    const selectedId = selectedAnnotationId.value;
    const editedId = editingAnnotationId.value;

    if (editedId) {
      const editedRowStillExists = rows.some((row) => row.id === editedId);
      if (!editedRowStillExists) {
        clearInlineEditState();
      }
    }

    if (!selectedId) return;
    const stillExists = rows.some((row) => row.id === selectedId);
    if (!stillExists) {
      emit('select-annotation', { id: null, index: null });
      clearDragState();
      clearPendingDragState();
      stopDragListeners();
      clearInlineEditState();
    }
  }
);

watch(
  () => props.toolMode,
  () => {
    clearDragState();
    clearPendingDragState();
    stopDragListeners();
    clearInlineEditState();
  }
);

watch(
  selectedAnnotationId,
  (id) => {
    if (!editingAnnotationId.value) return;
    if (id !== editingAnnotationId.value) {
      clearInlineEditState();
    }
  }
);

watch(
  editingAnnotationId,
  async (id) => {
    if (!id) return;
    await nextTick();
    scheduleInlineEditorFocus(id);
  }
);

onBeforeUnmount(() => {
  stopDragListeners();
  clearPendingDragState();
  clearInlineEditState();
});
</script>

<template>
  <g class="user-annotation-layer">
    <defs>
      <marker
        id="user-annotation-arrowhead"
        markerWidth="10"
        markerHeight="8"
        refX="8"
        refY="4"
        orient="auto"
      >
        <path d="M0,0 L10,4 L0,8 z" fill="context-stroke" />
      </marker>
    </defs>

    <rect
      v-if="isAddMode && !isReadonly"
      class="user-annotation-layer__surface"
      :x="0"
      :y="0"
      :width="width"
      :height="height"
      @click.stop="handleCreateAnnotation"
    />

    <TransitionGroup name="user-annotation-fade" tag="g">
      <g
        v-for="item in displayAnnotations"
        :key="item.id"
        class="user-annotation-layer__item"
        :data-user-annotation-id="item.id"
      >
        <line
          class="user-annotation-layer__arrow"
          :x1="item.labelX"
          :y1="item.labelY"
          :x2="item.anchorX"
          :y2="item.anchorY"
          :stroke="item.style.arrowColor"
          :stroke-width="item.style.arrowSize"
          marker-end="url(#user-annotation-arrowhead)"
          @click.stop="selectAnnotation(item)"
          @dblclick.stop.prevent="handleLabelDoubleClick(item)"
        />

        <g
          class="user-annotation-layer__label"
          :class="{ 'user-annotation-layer__label--selected': isSelected(item.id) }"
          @click.stop="selectAnnotation(item)"
          @dblclick.stop.prevent="handleLabelDoubleClick(item)"
          @mousedown.stop="handleLabelMouseDown(item, $event)"
        >
          <rect
            class="user-annotation-layer__label-hitbox"
            :x="item.hitBoxX"
            :y="item.hitBoxY"
            :width="item.hitBoxWidth"
            :height="item.hitBoxHeight"
            rx="4"
            ry="4"
            :stroke="item.style.fontColor"
            :fill="isSelected(item.id) ? 'var(--color-user-annotation-label-fill-selected)' : 'var(--color-user-annotation-label-fill)'"
          />
          <text
            v-if="!isEditing(item.id)"
            class="user-annotation-layer__text"
            :x="item.labelX"
            :y="item.labelY"
            text-anchor="start"
            dominant-baseline="middle"
            :fill="item.style.fontColor"
            :style="{ fontSize: `${item.style.fontSize}px` }"
          >
            {{ item.text }}
          </text>
          <foreignObject
            v-else
            class="user-annotation-layer__editor"
            :x="item.hitBoxX"
            :y="item.hitBoxY"
            :width="Math.max(140, item.hitBoxWidth + 24)"
            :height="Math.max(26, item.hitBoxHeight + 8)"
            @click.stop
            @mousedown.stop
          >
            <div xmlns="http://www.w3.org/1999/xhtml" class="user-annotation-layer__editor-shell">
              <input
                :ref="(el) => setInlineEditorInputRef(item.id, el)"
                v-model="editingTextDraft"
                type="text"
                class="user-annotation-layer__editor-input"
                @blur="commitInlineTextEdit(item)"
                @keydown.enter.stop.prevent="commitInlineTextEdit(item)"
                @keydown.escape.stop.prevent="cancelInlineTextEdit"
              />
            </div>
          </foreignObject>
        </g>

        <circle
          v-if="isSelected(item.id)"
          class="user-annotation-layer__anchor-handle"
          :cx="item.anchorX"
          :cy="item.anchorY"
          r="5"
          @mousedown.stop="handleAnchorMouseDown(item, $event)"
        />

        <foreignObject
          v-if="isSelected(item.id) && !isReadonly && !isAddMode && !isEditing(item.id)"
          class="user-annotation-layer__toolbar"
          :x="item.toolbarX"
          :y="item.toolbarY"
          :width="item.toolbarWidth"
          :height="item.toolbarHeight"
          @click.stop
          @mousedown.stop
        >
          <div xmlns="http://www.w3.org/1999/xhtml" class="user-annotation-toolbar">
            <div class="user-annotation-toolbar__row">
              <label class="user-annotation-toolbar__color" data-i18n-title="ui.annotation_toolbar.text_color" title="Text color">
                <span class="user-annotation-toolbar__caption" data-i18n="ui.annotation_toolbar.text_color">Text color</span>
                <input
                  type="color"
                  :value="item.style.fontColor"
                  @input="handleAnnotationTextColorInput(item, $event)"
                />
              </label>
              <label class="user-annotation-toolbar__color" data-i18n-title="ui.annotation_toolbar.arrow_color" title="Arrow color">
                <span class="user-annotation-toolbar__caption" data-i18n="ui.annotation_toolbar.arrow_color">Arrow color</span>
                <input
                  type="color"
                  :value="item.style.arrowColor"
                  @input="handleAnnotationArrowColorInput(item, $event)"
                />
              </label>
            </div>

            <div class="user-annotation-toolbar__row">
              <div class="user-annotation-toolbar__stepper">
                <button
                  type="button"
                  class="user-annotation-toolbar__stepper-button"
                  data-i18n-title="ui.annotation_toolbar.font_size_down"
                  title="Decrease text size"
                  @click="changeAnnotationFontSize(item, -1)"
                >
                  <i class="pi pi-minus"></i>
                </button>
                <span>{{ item.style.fontSize }}</span>
                <button
                  type="button"
                  class="user-annotation-toolbar__stepper-button"
                  data-i18n-title="ui.annotation_toolbar.font_size_up"
                  title="Increase text size"
                  @click="changeAnnotationFontSize(item, 1)"
                >
                  <i class="pi pi-plus"></i>
                </button>
              </div>

              <div class="user-annotation-toolbar__stepper">
                <button
                  type="button"
                  class="user-annotation-toolbar__stepper-button"
                  data-i18n-title="ui.annotation_toolbar.arrow_size_down"
                  title="Decrease arrow size"
                  @click="changeAnnotationArrowSize(item, -1)"
                >
                  <i class="pi pi-angle-down"></i>
                </button>
                <span>{{ item.style.arrowSize }}</span>
                <button
                  type="button"
                  class="user-annotation-toolbar__stepper-button"
                  data-i18n-title="ui.annotation_toolbar.arrow_size_up"
                  title="Increase arrow size"
                  @click="changeAnnotationArrowSize(item, 1)"
                >
                  <i class="pi pi-angle-up"></i>
                </button>
              </div>
            </div>

            <div class="user-annotation-toolbar__actions">
              <button
                type="button"
                class="user-annotation-toolbar__delete"
                data-i18n-title="ui.delete_row"
                title="Delete row"
                @click="deleteAnnotation(item)"
              >
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>
        </foreignObject>
      </g>
    </TransitionGroup>
  </g>
</template>

<style scoped>
.user-annotation-layer__surface {
  fill: transparent;
  cursor: crosshair;
}

.user-annotation-layer__item {
  cursor: pointer;
}

.user-annotation-layer__label {
  cursor: move;
}

.user-annotation-layer__arrow {
  pointer-events: stroke;
  cursor: pointer;
}

.user-annotation-layer__label-hitbox {
  stroke-width: 1;
}

.user-annotation-layer__label--selected .user-annotation-layer__label-hitbox {
  stroke-width: 1.4;
}

.user-annotation-layer__text {
  pointer-events: none;
}

.user-annotation-layer__editor {
  overflow: visible;
}

.user-annotation-layer__editor-shell {
  width: 100%;
  height: 100%;
}

.user-annotation-layer__editor-input {
  width: 100%;
  height: 100%;
  border: 1px solid var(--color-user-editor-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.2;
  color: var(--ink);
  background: var(--color-surface-elevated);
}

.user-annotation-layer__editor-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-user-editor-focus);
}

.user-annotation-layer__anchor-handle {
  fill: var(--color-surface-elevated);
  stroke: var(--color-ink-strong);
  stroke-width: 1.2;
  cursor: move;
}

.user-annotation-layer__toolbar {
  overflow: visible;
}

.user-annotation-toolbar {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-user-annotation-toolbar-bg);
  box-shadow: var(--shadow-user-editor);
  padding: 8px;
  display: grid;
  gap: 8px;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
}

.user-annotation-toolbar__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.user-annotation-toolbar__caption {
  font-size: 11px;
  color: var(--muted);
}

.user-annotation-toolbar__color {
  display: grid;
  gap: 4px;
}

.user-annotation-toolbar__color input {
  width: 100%;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0;
  background: var(--color-surface-elevated);
}

.user-annotation-toolbar__stepper {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 5px;
  font-size: 12px;
}

.user-annotation-toolbar__stepper-button {
  width: 24px;
  height: 24px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--color-surface-elevated);
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.user-annotation-toolbar__actions {
  display: flex;
  justify-content: flex-end;
}

.user-annotation-toolbar__delete {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-user-editor-danger-border);
  border-radius: 999px;
  background: var(--color-user-editor-danger-bg);
  color: var(--color-user-editor-danger);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.user-annotation-fade-enter-active,
.user-annotation-fade-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.user-annotation-fade-enter-from,
.user-annotation-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
