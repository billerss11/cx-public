import {
  normalizeEquipmentTypeKey,
  resolveEquipmentRenderConfig,
  resolveEquipmentTypeLabel
} from '@/topology/equipmentDefinitions/index.js';

const RENDER_FAMILY_PACKER_LIKE = 'packerLike';
const RENDER_FAMILY_BRIDGE_PLUG = 'bridgePlug';
const RENDER_FAMILY_INLINE_VALVE = 'inlineValve';
const BRIDGE_PLUG_TYPE_KEY = 'bridge-plug';
const SAFETY_VALVE_TYPE_KEY = 'safety-valve';

export function isPackerLikeEquipmentType(typeValue) {
  return resolveEquipmentRenderConfig(typeValue)?.family === RENDER_FAMILY_PACKER_LIKE;
}

export function isSafetyValveEquipmentType(typeValue) {
  return normalizeEquipmentTypeKey(typeValue) === SAFETY_VALVE_TYPE_KEY;
}

export function resolveEquipmentTypeSemantics(typeValue) {
  const typeKey = normalizeEquipmentTypeKey(typeValue);
  const renderFamily = resolveEquipmentRenderConfig(typeValue)?.family ?? 'unknown';
  return {
    typeKey,
    label: resolveEquipmentTypeLabel(typeValue),
    renderFamily,
    isPackerLike: renderFamily === RENDER_FAMILY_PACKER_LIKE,
    isBridgePlug: renderFamily === RENDER_FAMILY_BRIDGE_PLUG || typeKey === BRIDGE_PLUG_TYPE_KEY,
    isInlineValve: renderFamily === RENDER_FAMILY_INLINE_VALVE,
    isSafetyValve: typeKey === SAFETY_VALVE_TYPE_KEY
  };
}

export default {
  isPackerLikeEquipmentType,
  isSafetyValveEquipmentType,
  resolveEquipmentTypeSemantics
};
