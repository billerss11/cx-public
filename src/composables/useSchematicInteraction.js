const SCHEMATIC_INTERACTIVE_TARGETS = [
  '[data-pipe-key]',
  '[data-casing-index]',
  '[data-line-index]',
  '[data-box-index]',
  '[data-marker-index]',
  '[data-plug-index]',
  '[data-fluid-index]',
  '[data-equipment-index]',
  '[data-user-annotation-id]'
];

const NON_PIPE_ENTITY_TYPES = new Set(['line', 'box', 'marker', 'plug', 'fluid', 'equipment']);
const PIPE_ENTITY_TYPES = new Set(['casing', 'tubing', 'drillString']);
const INTERACTION_ENTITY_TYPES = new Set([
  ...Array.from(NON_PIPE_ENTITY_TYPES),
  ...Array.from(PIPE_ENTITY_TYPES)
]);
const INTERACTION_ATTRIBUTE_MAP = Object.freeze([
  { attr: 'data-pipe-key', type: 'pipe' },
  { attr: 'data-casing-index', type: 'casing' },
  { attr: 'data-line-index', type: 'line' },
  { attr: 'data-box-index', type: 'box' },
  { attr: 'data-marker-index', type: 'marker' },
  { attr: 'data-plug-index', type: 'plug' },
  { attr: 'data-fluid-index', type: 'fluid' },
  { attr: 'data-equipment-index', type: 'equipment' }
]);

export const SCHEMATIC_INTERACTIVE_TARGET_SELECTOR = SCHEMATIC_INTERACTIVE_TARGETS.join(',');

export function normalizePipeType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'casing') return 'casing';
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return null;
}

export function normalizeInteractionType(value, options = {}) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'pipe') {
    if (options.allowPipeAlias !== true) return null;
    const fallbackPipeType = normalizePipeType(options.fallbackPipeType);
    return fallbackPipeType ?? 'casing';
  }

  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }

  if (NON_PIPE_ENTITY_TYPES.has(normalized) || normalized === 'casing' || normalized === 'tubing') {
    return normalized;
  }

  return null;
}

function normalizeInteractionId(value) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '' || normalized === null || normalized === undefined) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function createInteractionEntity(type, id) {
  const normalizedType = normalizeInteractionType(type, { allowPipeAlias: false });
  const normalizedId = normalizeInteractionId(id);
  if (!normalizedType || normalizedId === null) return null;
  if (!INTERACTION_ENTITY_TYPES.has(normalizedType)) return null;
  return { type: normalizedType, id: normalizedId };
}

function parsePipeKeyEntity(value) {
  const key = String(value ?? '').trim();
  if (!key) return null;
  const [pipeType, rawId] = key.split(':');
  if (!pipeType || rawId === undefined) return null;
  return createInteractionEntity(pipeType, rawId);
}

export function normalizeInteractionEntity(value, fallbackType = null) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const fromPipeKey = parsePipeKeyEntity(value);
    if (fromPipeKey) return fromPipeKey;
    return createInteractionEntity(fallbackType, value);
  }

  if (typeof value === 'number') {
    const type = normalizeInteractionType(fallbackType, { allowPipeAlias: true });
    return createInteractionEntity(type, value);
  }

  if (typeof value !== 'object') return null;

  if ('type' in value && 'id' in value) {
    return createInteractionEntity(value.type, value.id);
  }

  const pipeType = normalizePipeType(value.pipeType ?? value.type ?? fallbackType);
  const pipeId = normalizeInteractionId(value.rowIndex ?? value.index ?? value.id);
  if (pipeType && pipeId !== null) {
    return createInteractionEntity(pipeType, pipeId);
  }

  const normalizedFallback = normalizeInteractionType(fallbackType, { allowPipeAlias: true });
  if (!normalizedFallback) return null;
  return createInteractionEntity(normalizedFallback, value.id ?? value.index ?? value.rowIndex);
}

export function resolveInteractionEntityFromPayload(typeOrPayload, maybeId = null) {
  if (typeof typeOrPayload === 'string') {
    const normalizedType = normalizeInteractionType(typeOrPayload, {
      allowPipeAlias: true,
      fallbackPipeType: maybeId?.pipeType
    });
    if (!normalizedType) return null;
    if (normalizedType === 'casing' || normalizedType === 'tubing' || normalizedType === 'drillString') {
      return normalizeInteractionEntity(maybeId, normalizedType);
    }
    return createInteractionEntity(normalizedType, maybeId);
  }
  return normalizeInteractionEntity(typeOrPayload);
}

export function isPipeInteractionType(type) {
  return PIPE_ENTITY_TYPES.has(normalizeInteractionType(type, { allowPipeAlias: false }));
}

export function isSameInteractionEntity(left, right) {
  const a = normalizeInteractionEntity(left);
  const b = normalizeInteractionEntity(right);
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id;
}

export function serializeInteractionEntity(entity) {
  const normalized = normalizeInteractionEntity(entity);
  if (!normalized) return null;
  return `${normalized.type}:${normalized.id}`;
}

function resolveEntityFromAttribute(type, rawValue) {
  if (type === 'pipe') {
    return parsePipeKeyEntity(rawValue);
  }
  return createInteractionEntity(type, rawValue);
}

function isElementNode(target) {
  return typeof Element !== 'undefined' && target instanceof Element;
}

export function resolveInteractionEntityFromElement(target) {
  if (!isElementNode(target)) return null;

  for (const descriptor of INTERACTION_ATTRIBUTE_MAP) {
    const owner = target.closest(`[${descriptor.attr}]`);
    if (!owner) continue;
    const value = owner.getAttribute(descriptor.attr);
    const entity = resolveEntityFromAttribute(descriptor.type, value);
    if (entity) return entity;
  }
  return null;
}

export function resolveTopmostInteractionEntity(event, fallbackTarget = null) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  const target = isElementNode(fallbackTarget) ? fallbackTarget : event?.target;
  const ownerDocument = target?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  const canUseStackHitTest = ownerDocument &&
    typeof ownerDocument.elementsFromPoint === 'function' &&
    Number.isFinite(clientX) &&
    Number.isFinite(clientY);

  if (canUseStackHitTest) {
    const stack = ownerDocument.elementsFromPoint(clientX, clientY);
    for (const element of stack) {
      const entity = resolveInteractionEntityFromElement(element);
      if (entity) return entity;
    }
  }

  return resolveInteractionEntityFromElement(target);
}

export function resolveSvgPointerPosition(svgElement, event) {
  const svg = svgElement;
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
  if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
  return { x: local.x, y: local.y };
}

export function hasInteractiveSchematicTarget(target) {
  if (!isElementNode(target)) return false;
  if (resolveInteractionEntityFromElement(target)) return true;
  return Boolean(target.closest('[data-user-annotation-id]'));
}
