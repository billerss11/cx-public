import {
  ENTITY_KIND_BOUNDARY,
  ENTITY_KIND_DEVICE,
  ENTITY_KIND_JUNCTION,
  ENTITY_KIND_TERMINATION,
  getSurfaceAssemblyFamilySummary,
  getSurfaceAssemblyTerminationDefinition,
  normalizeSurfaceAssembly,
} from '@/utils/surfaceAssemblyModel.js';

const PREVIEW_WIDTH = 560;
const PREVIEW_HEIGHT = 340;
const CENTER_X = PREVIEW_WIDTH / 2;
const SURFACE_BASE_Y = 296;

function createPathSegment(key, points, tone = 'production') {
  return {
    key,
    points,
    tone,
  };
}

function createStructure(key, x, y, width, height, label, kind = 'body') {
  return {
    key,
    x,
    y,
    width,
    height,
    label,
    kind,
  };
}

function createSlot(entityKind, slotKey, x, y, label, typeKey, state, tone = 'production') {
  return {
    entityKey: `${entityKind}:${slotKey}`,
    entityKind,
    slotKey,
    x,
    y,
    label,
    typeKey,
    state,
    tone,
  };
}

function createJunction(junctionKey, x, y, label) {
  return {
    entityKey: `${ENTITY_KIND_JUNCTION}:${junctionKey}`,
    entityKind: ENTITY_KIND_JUNCTION,
    slotKey: junctionKey,
    x,
    y,
    label,
  };
}

function resolveSlotMap(assembly) {
  return {
    devicesByKey: new Map((assembly?.devices ?? []).map((item) => [item.slotKey, item])),
    boundariesByKey: new Map((assembly?.boundaries ?? []).map((item) => [item.slotKey, item])),
    terminationsByKey: new Map((assembly?.terminations ?? []).map((item) => [item.slotKey, item])),
    junctionsByKey: new Map((assembly?.junctions ?? []).map((item) => [item.junctionKey, item])),
  };
}

function resolveFamilyLayout(assembly) {
  const slotMap = resolveSlotMap(assembly);
  const familyKey = assembly.familyKey;

  if (familyKey === 'conventional-wellhead-stack') {
    return {
      structures: [
        createStructure('casing-head', 220, 232, 120, 46, 'Casing Head'),
        createStructure('tubing-head', 228, 176, 104, 42, 'Tubing Head'),
      ],
      paths: [
        createPathSegment('tubing-bore', `280,320 280,88`, 'production'),
        createPathSegment('annulus-a', `240,196 80,196`, 'annulus'),
      ],
      slots: [
        createSlot(ENTITY_KIND_DEVICE, 'lowerMasterValve', 280, 136, slotMap.devicesByKey.get('lowerMasterValve')?.label, slotMap.devicesByKey.get('lowerMasterValve')?.typeKey, slotMap.devicesByKey.get('lowerMasterValve')?.state, 'production'),
        createSlot(ENTITY_KIND_TERMINATION, 'productionOutlet', 280, 74, slotMap.terminationsByKey.get('productionOutlet')?.label, slotMap.terminationsByKey.get('productionOutlet')?.typeKey, null, 'production'),
        createSlot(ENTITY_KIND_BOUNDARY, 'tubingHangerSeal', 202, 196, slotMap.boundariesByKey.get('tubingHangerSeal')?.label, slotMap.boundariesByKey.get('tubingHangerSeal')?.typeKey, slotMap.boundariesByKey.get('tubingHangerSeal')?.state, 'annulus'),
        createSlot(ENTITY_KIND_DEVICE, 'annulusValve', 144, 196, slotMap.devicesByKey.get('annulusValve')?.label, slotMap.devicesByKey.get('annulusValve')?.typeKey, slotMap.devicesByKey.get('annulusValve')?.state, 'annulus'),
        createSlot(ENTITY_KIND_TERMINATION, 'annulusOutlet', 78, 196, slotMap.terminationsByKey.get('annulusOutlet')?.label, slotMap.terminationsByKey.get('annulusOutlet')?.typeKey, null, 'annulus'),
      ],
      junctions: [],
    };
  }

  if (familyKey === 'unitized-wellhead') {
    return {
      structures: [
        createStructure('unitized-body', 226, 158, 108, 122, 'Unitized Body', 'integrated'),
      ],
      paths: [
        createPathSegment('tubing-bore', `280,320 280,78`, 'production'),
        createPathSegment('annulus-a', `226,206 80,206`, 'annulus'),
      ],
      slots: [
        createSlot(ENTITY_KIND_DEVICE, 'productionValve', 280, 142, slotMap.devicesByKey.get('productionValve')?.label, slotMap.devicesByKey.get('productionValve')?.typeKey, slotMap.devicesByKey.get('productionValve')?.state, 'production'),
        createSlot(ENTITY_KIND_TERMINATION, 'productionOutlet', 280, 66, slotMap.terminationsByKey.get('productionOutlet')?.label, slotMap.terminationsByKey.get('productionOutlet')?.typeKey, null, 'production'),
        createSlot(ENTITY_KIND_BOUNDARY, 'unitizedPackoff', 206, 206, slotMap.boundariesByKey.get('unitizedPackoff')?.label, slotMap.boundariesByKey.get('unitizedPackoff')?.typeKey, slotMap.boundariesByKey.get('unitizedPackoff')?.state, 'annulus'),
        createSlot(ENTITY_KIND_DEVICE, 'annulusValve', 144, 206, slotMap.devicesByKey.get('annulusValve')?.label, slotMap.devicesByKey.get('annulusValve')?.typeKey, slotMap.devicesByKey.get('annulusValve')?.state, 'annulus'),
        createSlot(ENTITY_KIND_TERMINATION, 'annulusOutlet', 78, 206, slotMap.terminationsByKey.get('annulusOutlet')?.label, slotMap.terminationsByKey.get('annulusOutlet')?.typeKey, null, 'annulus'),
      ],
      junctions: [],
    };
  }

  if (familyKey === 'horizontal-tree') {
    return {
      structures: [
        createStructure('horizontal-body', 198, 214, 164, 52, 'Tree Body'),
        createStructure('horizontal-cap-housing', 242, 146, 76, 38, 'Cap Housing'),
      ],
      paths: [
        createPathSegment('tubing-bore-rise', `280,320 280,188`, 'production'),
        createPathSegment('production-branch', `280,188 470,188`, 'production'),
        createPathSegment('tree-cap', `280,188 280,108`, 'production'),
        createPathSegment('annulus-a', `214,236 80,236`, 'annulus'),
      ],
      slots: [
        createSlot(ENTITY_KIND_DEVICE, 'productionMasterValve', 280, 188, slotMap.devicesByKey.get('productionMasterValve')?.label, slotMap.devicesByKey.get('productionMasterValve')?.typeKey, slotMap.devicesByKey.get('productionMasterValve')?.state, 'production'),
        createSlot(ENTITY_KIND_DEVICE, 'productionChoke', 388, 188, slotMap.devicesByKey.get('productionChoke')?.label, slotMap.devicesByKey.get('productionChoke')?.typeKey, slotMap.devicesByKey.get('productionChoke')?.state, 'production'),
        createSlot(ENTITY_KIND_TERMINATION, 'productionOutlet', 474, 188, slotMap.terminationsByKey.get('productionOutlet')?.label, slotMap.terminationsByKey.get('productionOutlet')?.typeKey, null, 'production'),
        createSlot(ENTITY_KIND_TERMINATION, 'treeCap', 280, 100, slotMap.terminationsByKey.get('treeCap')?.label, slotMap.terminationsByKey.get('treeCap')?.typeKey, null, 'production'),
        createSlot(ENTITY_KIND_BOUNDARY, 'tubingHangerSeal', 204, 236, slotMap.boundariesByKey.get('tubingHangerSeal')?.label, slotMap.boundariesByKey.get('tubingHangerSeal')?.typeKey, slotMap.boundariesByKey.get('tubingHangerSeal')?.state, 'annulus'),
        createSlot(ENTITY_KIND_DEVICE, 'annulusValve', 144, 236, slotMap.devicesByKey.get('annulusValve')?.label, slotMap.devicesByKey.get('annulusValve')?.typeKey, slotMap.devicesByKey.get('annulusValve')?.state, 'annulus'),
        createSlot(ENTITY_KIND_TERMINATION, 'annulusOutlet', 78, 236, slotMap.terminationsByKey.get('annulusOutlet')?.label, slotMap.terminationsByKey.get('annulusOutlet')?.typeKey, null, 'annulus'),
      ],
      junctions: [
        createJunction('productionBranch', 328, 168, slotMap.junctionsByKey.get('productionBranch')?.label ?? 'Production Branch'),
      ],
    };
  }

  return {
    structures: [
      createStructure('tree-base', 226, 234, 108, 44, 'Tubing Head'),
      createStructure('tree-body', 238, 118, 84, 86, 'Tree Body'),
    ],
    paths: [
      createPathSegment('tubing-bore-rise', `280,320 280,66`, 'production'),
      createPathSegment('wing-branch', `280,132 454,132`, 'production'),
      createPathSegment('annulus-a', `238,244 80,244`, 'annulus'),
    ],
    slots: [
      createSlot(ENTITY_KIND_DEVICE, 'lowerMasterValve', 280, 204, slotMap.devicesByKey.get('lowerMasterValve')?.label, slotMap.devicesByKey.get('lowerMasterValve')?.typeKey, slotMap.devicesByKey.get('lowerMasterValve')?.state, 'production'),
      createSlot(ENTITY_KIND_DEVICE, 'upperMasterValve', 280, 154, slotMap.devicesByKey.get('upperMasterValve')?.label, slotMap.devicesByKey.get('upperMasterValve')?.typeKey, slotMap.devicesByKey.get('upperMasterValve')?.state, 'production'),
      createSlot(ENTITY_KIND_DEVICE, 'swabValve', 280, 88, slotMap.devicesByKey.get('swabValve')?.label, slotMap.devicesByKey.get('swabValve')?.typeKey, slotMap.devicesByKey.get('swabValve')?.state, 'production'),
      createSlot(ENTITY_KIND_TERMINATION, 'swabOutlet', 280, 56, slotMap.terminationsByKey.get('swabOutlet')?.label, slotMap.terminationsByKey.get('swabOutlet')?.typeKey, null, 'production'),
      createSlot(ENTITY_KIND_DEVICE, 'wingValve', 366, 132, slotMap.devicesByKey.get('wingValve')?.label, slotMap.devicesByKey.get('wingValve')?.typeKey, slotMap.devicesByKey.get('wingValve')?.state, 'production'),
      createSlot(ENTITY_KIND_TERMINATION, 'productionOutlet', 458, 132, slotMap.terminationsByKey.get('productionOutlet')?.label, slotMap.terminationsByKey.get('productionOutlet')?.typeKey, null, 'production'),
      createSlot(ENTITY_KIND_BOUNDARY, 'tubingHangerSeal', 204, 244, slotMap.boundariesByKey.get('tubingHangerSeal')?.label, slotMap.boundariesByKey.get('tubingHangerSeal')?.typeKey, slotMap.boundariesByKey.get('tubingHangerSeal')?.state, 'annulus'),
      createSlot(ENTITY_KIND_DEVICE, 'annulusValve', 144, 244, slotMap.devicesByKey.get('annulusValve')?.label, slotMap.devicesByKey.get('annulusValve')?.typeKey, slotMap.devicesByKey.get('annulusValve')?.state, 'annulus'),
      createSlot(ENTITY_KIND_TERMINATION, 'annulusOutlet', 78, 244, slotMap.terminationsByKey.get('annulusOutlet')?.label, slotMap.terminationsByKey.get('annulusOutlet')?.typeKey, null, 'annulus'),
    ],
    junctions: [
      createJunction('productionSplit', 316, 118, slotMap.junctionsByKey.get('productionSplit')?.label ?? 'Wing Branch'),
    ],
  };
}

export function buildSurfaceAssemblyLayout(assembly) {
  const normalized = normalizeSurfaceAssembly(assembly);
  if (!normalized) {
    return {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      centerX: CENTER_X,
      hasContent: false,
      familyTitle: '',
      familyDescription: '',
      guideSegments: [],
      pathSegments: [],
      structures: [],
      slots: [],
      junctions: [],
    };
  }

  const familySummary = getSurfaceAssemblyFamilySummary(normalized);
  const familyLayout = resolveFamilyLayout(normalized);

  return {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    centerX: CENTER_X,
    hasContent: true,
    familyTitle: familySummary?.previewTitle ?? familySummary?.label ?? normalized.label,
    familyDescription: familySummary?.description ?? '',
    guideSegments: [
      createPathSegment('well-centerline', `${CENTER_X},${SURFACE_BASE_Y} ${CENTER_X},${PREVIEW_HEIGHT}`, 'guide'),
    ],
    pathSegments: familyLayout.paths,
    structures: familyLayout.structures,
    slots: familyLayout.slots.filter((slot) => Boolean(slot?.entityKey)),
    junctions: familyLayout.junctions,
  };
}

export function resolveSurfaceSlotGlyph(slot) {
  if (slot?.entityKind === ENTITY_KIND_BOUNDARY) return 'seal';
  if (slot?.entityKind === ENTITY_KIND_TERMINATION) {
    return getSurfaceAssemblyTerminationDefinition(slot?.typeKey)?.blocksSurface ? 'cap' : 'outlet';
  }
  if (slot?.typeKey === 'choke') return 'choke';
  return 'valve';
}

export default {
  buildSurfaceAssemblyLayout,
  resolveSurfaceSlotGlyph,
};
