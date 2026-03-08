export const DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY = 'conventional-wellhead-stack';

export const ENTITY_KIND_DEVICE = 'device';
export const ENTITY_KIND_BOUNDARY = 'boundary';
export const ENTITY_KIND_TERMINATION = 'termination';
export const ENTITY_KIND_JUNCTION = 'junction';

export const DEVICE_STATE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'open', label: 'Open' }),
  Object.freeze({ value: 'closed', label: 'Closed' }),
]);

export const BOUNDARY_STATE_OPTIONS = Object.freeze([
  Object.freeze({ value: 'sealed', label: 'Sealed' }),
  Object.freeze({ value: 'open', label: 'Open' }),
  Object.freeze({ value: 'leaking', label: 'Leaking' }),
]);

export const TERMINATION_TYPE_DEFINITIONS = Object.freeze({
  flowline: Object.freeze({ typeKey: 'flowline', label: 'Flowline', surfaceState: 'open', blocksSurface: false }),
  'capped-outlet': Object.freeze({ typeKey: 'capped-outlet', label: 'Capped Outlet', surfaceState: 'closed', blocksSurface: true }),
  'vent-line': Object.freeze({ typeKey: 'vent-line', label: 'Vent Line', surfaceState: 'open', blocksSurface: false }),
  'kill-line': Object.freeze({ typeKey: 'kill-line', label: 'Kill Line', surfaceState: 'open', blocksSurface: false }),
  'test-port': Object.freeze({ typeKey: 'test-port', label: 'Test Port', surfaceState: 'open', blocksSurface: false }),
  'tree-cap': Object.freeze({ typeKey: 'tree-cap', label: 'Tree Cap', surfaceState: 'closed', blocksSurface: true }),
  'swab-cap': Object.freeze({ typeKey: 'swab-cap', label: 'Swab Cap', surfaceState: 'closed', blocksSurface: true }),
  none: Object.freeze({ typeKey: 'none', label: 'Not Defined', surfaceState: 'missing', blocksSurface: true }),
});

export const TYPE_LABEL_BY_KEY = Object.freeze({
  'master-valve': 'Master Valve',
  'swab-valve': 'Swab Valve',
  'wing-valve': 'Wing Valve',
  'annulus-valve': 'Annulus Valve',
  choke: 'Choke',
  'tubing-hanger-seal': 'Tubing Hanger Seal',
  packoff: 'Packoff',
  'unitized-packoff': 'Unitized Packoff',
  ...Object.fromEntries(
    Object.values(TERMINATION_TYPE_DEFINITIONS).map((definition) => [definition.typeKey, definition.label])
  ),
});

export const SURFACE_ASSEMBLY_FAMILY_DEFINITION_BY_KEY = Object.freeze({
  'conventional-wellhead-stack': Object.freeze({
    familyKey: 'conventional-wellhead-stack',
    label: 'Conventional Wellhead Stack',
    description: 'Stacked wellhead with tubing-bore access and first-annulus outlet.',
    previewTitle: 'Conventional Wellhead Stack',
    packagingKind: 'conventional',
    entryPathTemplates: Object.freeze([
      Object.freeze({ roleKey: 'TUBING_BORE', label: 'Tubing Bore', sourceVolumeKey: 'TUBING_INNER' }),
      Object.freeze({ roleKey: 'ANNULUS_A', label: 'A-Annulus', sourceVolumeKey: 'ANNULUS_A' }),
    ]),
    junctionTemplates: Object.freeze([]),
    deviceSlots: Object.freeze([
      Object.freeze({
        slotKey: 'lowerMasterValve',
        label: 'Lower Master Valve',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['master-valve']),
        defaultTypeKey: 'master-valve',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'annulusValve',
        label: 'A-Annulus Valve',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['annulus-valve']),
        defaultTypeKey: 'annulus-valve',
        defaultState: 'closed',
      }),
    ]),
    boundarySlots: Object.freeze([
      Object.freeze({
        slotKey: 'tubingHangerSeal',
        label: 'Tubing Hanger Seal',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['tubing-hanger-seal']),
        defaultTypeKey: 'tubing-hanger-seal',
        defaultState: 'sealed',
      }),
    ]),
    terminationSlots: Object.freeze([
      Object.freeze({
        slotKey: 'productionOutlet',
        label: 'Production Outlet',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['flowline', 'capped-outlet', 'test-port', 'none']),
        defaultTypeKey: 'flowline',
      }),
      Object.freeze({
        slotKey: 'annulusOutlet',
        label: 'A-Annulus Outlet',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['capped-outlet', 'vent-line', 'kill-line', 'none']),
        defaultTypeKey: 'capped-outlet',
      }),
    ]),
    topologyRoutes: Object.freeze([
      Object.freeze(['entry:TUBING_BORE', 'device:lowerMasterValve', 'termination:productionOutlet']),
      Object.freeze(['entry:ANNULUS_A', 'boundary:tubingHangerSeal', 'device:annulusValve', 'termination:annulusOutlet']),
    ]),
    editorSections: Object.freeze([
      Object.freeze({
        sectionKey: 'tubing-bore',
        title: 'Tubing Bore Access',
        description: 'Main bore path to the surface outlet.',
        entityRefs: Object.freeze(['device:lowerMasterValve', 'termination:productionOutlet']),
      }),
      Object.freeze({
        sectionKey: 'annulus-a',
        title: 'A-Annulus Outlet',
        description: 'First annulus access chain at surface.',
        entityRefs: Object.freeze(['boundary:tubingHangerSeal', 'device:annulusValve', 'termination:annulusOutlet']),
      }),
    ]),
  }),
  'unitized-wellhead': Object.freeze({
    familyKey: 'unitized-wellhead',
    label: 'Unitized Wellhead',
    description: 'Integrated surface head with compact bore and annulus access packaging.',
    previewTitle: 'Unitized Wellhead',
    packagingKind: 'unitized',
    entryPathTemplates: Object.freeze([
      Object.freeze({ roleKey: 'TUBING_BORE', label: 'Tubing Bore', sourceVolumeKey: 'TUBING_INNER' }),
      Object.freeze({ roleKey: 'ANNULUS_A', label: 'A-Annulus', sourceVolumeKey: 'ANNULUS_A' }),
    ]),
    junctionTemplates: Object.freeze([]),
    deviceSlots: Object.freeze([
      Object.freeze({
        slotKey: 'productionValve',
        label: 'Production Valve',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['master-valve']),
        defaultTypeKey: 'master-valve',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'annulusValve',
        label: 'A-Annulus Valve',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['annulus-valve']),
        defaultTypeKey: 'annulus-valve',
        defaultState: 'closed',
      }),
    ]),
    boundarySlots: Object.freeze([
      Object.freeze({
        slotKey: 'unitizedPackoff',
        label: 'Unitized Packoff',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['unitized-packoff']),
        defaultTypeKey: 'unitized-packoff',
        defaultState: 'sealed',
      }),
    ]),
    terminationSlots: Object.freeze([
      Object.freeze({
        slotKey: 'productionOutlet',
        label: 'Production Outlet',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['flowline', 'capped-outlet', 'test-port', 'none']),
        defaultTypeKey: 'flowline',
      }),
      Object.freeze({
        slotKey: 'annulusOutlet',
        label: 'A-Annulus Outlet',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['capped-outlet', 'vent-line', 'kill-line', 'none']),
        defaultTypeKey: 'capped-outlet',
      }),
    ]),
    topologyRoutes: Object.freeze([
      Object.freeze(['entry:TUBING_BORE', 'device:productionValve', 'termination:productionOutlet']),
      Object.freeze(['entry:ANNULUS_A', 'boundary:unitizedPackoff', 'device:annulusValve', 'termination:annulusOutlet']),
    ]),
    editorSections: Object.freeze([
      Object.freeze({
        sectionKey: 'unitized-bore',
        title: 'Tubing Bore Access',
        description: 'Integrated bore control path in the unitized head.',
        entityRefs: Object.freeze(['device:productionValve', 'termination:productionOutlet']),
      }),
      Object.freeze({
        sectionKey: 'unitized-annulus',
        title: 'A-Annulus Outlet',
        description: 'Compact annulus access through the unitized body.',
        entityRefs: Object.freeze(['boundary:unitizedPackoff', 'device:annulusValve', 'termination:annulusOutlet']),
      }),
    ]),
  }),
  'vertical-tree': Object.freeze({
    familyKey: 'vertical-tree',
    label: 'Vertical Tree',
    description: 'Stacked tree with swab access, wing branch, and annulus outlet.',
    previewTitle: 'Vertical Tree',
    packagingKind: 'vertical-tree',
    entryPathTemplates: Object.freeze([
      Object.freeze({ roleKey: 'TUBING_BORE', label: 'Tubing Bore', sourceVolumeKey: 'TUBING_INNER' }),
      Object.freeze({ roleKey: 'ANNULUS_A', label: 'A-Annulus', sourceVolumeKey: 'ANNULUS_A' }),
    ]),
    junctionTemplates: Object.freeze([
      Object.freeze({
        junctionKey: 'productionSplit',
        label: 'Wing Branch',
        pathRoleKey: 'TUBING_BORE',
      }),
    ]),
    deviceSlots: Object.freeze([
      Object.freeze({
        slotKey: 'lowerMasterValve',
        label: 'Lower Master Valve',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['master-valve']),
        defaultTypeKey: 'master-valve',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'upperMasterValve',
        label: 'Upper Master Valve',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['master-valve']),
        defaultTypeKey: 'master-valve',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'swabValve',
        label: 'Swab Valve',
        pathRoleKey: 'SWAB',
        allowedTypeKeys: Object.freeze(['swab-valve']),
        defaultTypeKey: 'swab-valve',
        defaultState: 'closed',
      }),
      Object.freeze({
        slotKey: 'wingValve',
        label: 'Wing Valve',
        pathRoleKey: 'PRODUCTION_WING',
        allowedTypeKeys: Object.freeze(['wing-valve']),
        defaultTypeKey: 'wing-valve',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'annulusValve',
        label: 'A-Annulus Valve',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['annulus-valve']),
        defaultTypeKey: 'annulus-valve',
        defaultState: 'closed',
      }),
    ]),
    boundarySlots: Object.freeze([
      Object.freeze({
        slotKey: 'tubingHangerSeal',
        label: 'Tubing Hanger Seal',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['tubing-hanger-seal']),
        defaultTypeKey: 'tubing-hanger-seal',
        defaultState: 'sealed',
      }),
    ]),
    terminationSlots: Object.freeze([
      Object.freeze({
        slotKey: 'swabOutlet',
        label: 'Swab Outlet',
        pathRoleKey: 'SWAB',
        allowedTypeKeys: Object.freeze(['swab-cap', 'test-port', 'none']),
        defaultTypeKey: 'swab-cap',
      }),
      Object.freeze({
        slotKey: 'productionOutlet',
        label: 'Production Outlet',
        pathRoleKey: 'PRODUCTION_WING',
        allowedTypeKeys: Object.freeze(['flowline', 'capped-outlet', 'test-port', 'none']),
        defaultTypeKey: 'flowline',
      }),
      Object.freeze({
        slotKey: 'annulusOutlet',
        label: 'A-Annulus Outlet',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['capped-outlet', 'vent-line', 'kill-line', 'none']),
        defaultTypeKey: 'capped-outlet',
      }),
    ]),
    topologyRoutes: Object.freeze([
      Object.freeze(['entry:TUBING_BORE', 'device:lowerMasterValve', 'device:upperMasterValve', 'junction:productionSplit']),
      Object.freeze(['junction:productionSplit', 'device:swabValve', 'termination:swabOutlet']),
      Object.freeze(['junction:productionSplit', 'device:wingValve', 'termination:productionOutlet']),
      Object.freeze(['entry:ANNULUS_A', 'boundary:tubingHangerSeal', 'device:annulusValve', 'termination:annulusOutlet']),
    ]),
    editorSections: Object.freeze([
      Object.freeze({
        sectionKey: 'vertical-bore',
        title: 'Tubing Bore Access',
        description: 'Stacked bore control path up the tree centerline.',
        entityRefs: Object.freeze(['device:lowerMasterValve', 'device:upperMasterValve', 'junction:productionSplit', 'device:swabValve', 'termination:swabOutlet']),
      }),
      Object.freeze({
        sectionKey: 'vertical-wing',
        title: 'Wing Branch',
        description: 'Side branch carrying the production outlet.',
        entityRefs: Object.freeze(['device:wingValve', 'termination:productionOutlet']),
      }),
      Object.freeze({
        sectionKey: 'vertical-annulus',
        title: 'A-Annulus Outlet',
        description: 'Surface access chain for the first annulus.',
        entityRefs: Object.freeze(['boundary:tubingHangerSeal', 'device:annulusValve', 'termination:annulusOutlet']),
      }),
    ]),
  }),
  'horizontal-tree': Object.freeze({
    familyKey: 'horizontal-tree',
    label: 'Horizontal Tree',
    description: 'Horizontal tree packaging with bore control, production choke, and annulus outlet.',
    previewTitle: 'Horizontal Tree',
    packagingKind: 'horizontal-tree',
    entryPathTemplates: Object.freeze([
      Object.freeze({ roleKey: 'TUBING_BORE', label: 'Tubing Bore', sourceVolumeKey: 'TUBING_INNER' }),
      Object.freeze({ roleKey: 'ANNULUS_A', label: 'A-Annulus', sourceVolumeKey: 'ANNULUS_A' }),
    ]),
    junctionTemplates: Object.freeze([
      Object.freeze({
        junctionKey: 'productionBranch',
        label: 'Production Branch',
        pathRoleKey: 'TUBING_BORE',
      }),
    ]),
    deviceSlots: Object.freeze([
      Object.freeze({
        slotKey: 'productionMasterValve',
        label: 'Production Master Valve',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['master-valve']),
        defaultTypeKey: 'master-valve',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'productionChoke',
        label: 'Production Choke',
        pathRoleKey: 'PRODUCTION_BRANCH',
        allowedTypeKeys: Object.freeze(['choke']),
        defaultTypeKey: 'choke',
        defaultState: 'open',
      }),
      Object.freeze({
        slotKey: 'annulusValve',
        label: 'A-Annulus Valve',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['annulus-valve']),
        defaultTypeKey: 'annulus-valve',
        defaultState: 'closed',
      }),
    ]),
    boundarySlots: Object.freeze([
      Object.freeze({
        slotKey: 'tubingHangerSeal',
        label: 'Tubing Hanger Seal',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['packoff']),
        defaultTypeKey: 'packoff',
        defaultState: 'sealed',
      }),
    ]),
    terminationSlots: Object.freeze([
      Object.freeze({
        slotKey: 'treeCap',
        label: 'Tree Cap',
        pathRoleKey: 'TUBING_BORE',
        allowedTypeKeys: Object.freeze(['tree-cap', 'none']),
        defaultTypeKey: 'tree-cap',
      }),
      Object.freeze({
        slotKey: 'productionOutlet',
        label: 'Production Outlet',
        pathRoleKey: 'PRODUCTION_BRANCH',
        allowedTypeKeys: Object.freeze(['flowline', 'capped-outlet', 'test-port', 'none']),
        defaultTypeKey: 'flowline',
      }),
      Object.freeze({
        slotKey: 'annulusOutlet',
        label: 'A-Annulus Outlet',
        pathRoleKey: 'ANNULUS_A',
        allowedTypeKeys: Object.freeze(['capped-outlet', 'vent-line', 'kill-line', 'none']),
        defaultTypeKey: 'capped-outlet',
      }),
    ]),
    topologyRoutes: Object.freeze([
      Object.freeze(['entry:TUBING_BORE', 'device:productionMasterValve', 'junction:productionBranch']),
      Object.freeze(['junction:productionBranch', 'termination:treeCap']),
      Object.freeze(['junction:productionBranch', 'device:productionChoke', 'termination:productionOutlet']),
      Object.freeze(['entry:ANNULUS_A', 'boundary:tubingHangerSeal', 'device:annulusValve', 'termination:annulusOutlet']),
    ]),
    editorSections: Object.freeze([
      Object.freeze({
        sectionKey: 'horizontal-bore',
        title: 'Tubing Bore Access',
        description: 'Tree body control path above the tubing bore.',
        entityRefs: Object.freeze(['device:productionMasterValve', 'junction:productionBranch', 'termination:treeCap']),
      }),
      Object.freeze({
        sectionKey: 'horizontal-production',
        title: 'Production Branch',
        description: 'Lateral production branch through the horizontal tree body.',
        entityRefs: Object.freeze(['device:productionChoke', 'termination:productionOutlet']),
      }),
      Object.freeze({
        sectionKey: 'horizontal-annulus',
        title: 'A-Annulus Outlet',
        description: 'First annulus control path in the tree body.',
        entityRefs: Object.freeze(['boundary:tubingHangerSeal', 'device:annulusValve', 'termination:annulusOutlet']),
      }),
    ]),
  }),
});
