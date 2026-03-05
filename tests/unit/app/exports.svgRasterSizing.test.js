import { describe, expect, it, vi } from 'vitest';

const projectDataStoreMock = {
  casingData: [],
  tubingData: [],
  drillStringData: [],
  horizontalLines: [],
  annotationBoxes: [],
  userAnnotations: [],
  cementPlugs: [],
  annulusFluids: [],
  markers: [],
  topologySources: [],
  physicsIntervals: [],
  trajectory: []
};

const projectStoreMock = {
  ensureInitialized: vi.fn(),
  syncActiveWellData: vi.fn(),
  serializeProjectPayload: vi.fn(() => ({
    projectName: 'Project',
    projectAuthor: '',
    activeWellId: 'well-1',
    projectConfig: {},
    wells: []
  })),
  projectFileName: '',
  projectFilePath: null,
  hasProjectFileTarget: false,
  setProjectFileContext: vi.fn(),
  markProjectSaved: vi.fn()
};

vi.mock('@/stores/projectDataStore.js', () => ({
  useProjectDataStore: () => projectDataStoreMock
}));

vi.mock('@/stores/viewConfigStore.js', () => ({
  useViewConfigStore: () => ({ config: {} })
}));

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => projectStoreMock
}));

vi.mock('@/stores/viewConfigOwnership.js', () => ({
  composeRuntimeViewConfigForWell: (wellConfig = {}) => ({ ...wellConfig })
}));

vi.mock('@/stores/plotElementsStore.js', () => ({
  usePlotElementsStore: () => ({ getPlotElement: vi.fn() })
}));

vi.mock('@/stores/pinia.js', () => ({
  pinia: {}
}));

vi.mock('@/app/i18n.js', () => ({
  t: (key) => key,
  translateEnum: (_group, value) => value
}));

vi.mock('@/app/alerts.js', () => ({
  showAlert: vi.fn()
}));

vi.mock('@/app/exportPayload.mjs', () => ({
  buildProjectSavePayload: (payload) => payload
}));

vi.mock('@/composables/useHotTableRegistry.js', () => ({
  finishEditingAllHotTables: vi.fn(),
  getHotTableInstance: vi.fn(() => null)
}));

describe('exports svg raster sizing fallback contract', () => {
  it('uses explicit width/height attributes when present', async () => {
    const { resolveSvgRasterDimensions } = await import('@/app/exports.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '1200');
    svg.setAttribute('height', '800');
    svg.setAttribute('viewBox', '0 0 500 300');

    expect(resolveSvgRasterDimensions(svg)).toEqual({
      width: 1200,
      height: 800
    });
  });

  it('prefers explicit export width/height attributes when present', async () => {
    const { resolveSvgRasterDimensions } = await import('@/app/exports.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '1500');
    svg.setAttribute('height', '1200');
    svg.setAttribute('data-export-width', '1000');
    svg.setAttribute('data-export-height', '800');

    expect(resolveSvgRasterDimensions(svg)).toEqual({
      width: 1000,
      height: 800
    });
  });

  it('falls back to viewBox dimensions when width/height attributes are missing', async () => {
    const { resolveSvgRasterDimensions } = await import('@/app/exports.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 960 540');

    expect(resolveSvgRasterDimensions(svg)).toEqual({
      width: 960,
      height: 540
    });
  });

  it('falls back to bounding client rect when attributes and viewBox are unavailable', async () => {
    const { resolveSvgRasterDimensions } = await import('@/app/exports.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 640,
        height: 360,
        top: 0,
        left: 0,
        right: 640,
        bottom: 360,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    });

    expect(resolveSvgRasterDimensions(svg)).toEqual({
      width: 640,
      height: 360
    });
  });

  it('preserves scene transform attributes when serializing svg for export', async () => {
    const { serializeStyledSvg } = await import('@/app/exports.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '1200');
    svg.setAttribute('height', '900');
    svg.setAttribute('data-export-width', '800');
    svg.setAttribute('data-export-height', '600');

    const scene = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    scene.setAttribute('id', 'scene-root');
    scene.setAttribute('transform', 'translate(42 -18) scale(1.75)');
    svg.appendChild(scene);

    const serialized = serializeStyledSvg(svg);
    expect(typeof serialized).toBe('string');
    expect(serialized).toContain('id="scene-root"');
    expect(serialized).toContain('transform="translate(42 -18) scale(1.75)"');
    expect(serialized).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(serialized).toContain('width="800"');
    expect(serialized).toContain('height="600"');
  });

  it('computes tight raster bounds from non-transparent pixels', async () => {
    const { resolveNonTransparentRasterBounds } = await import('@/app/exports.js');

    const width = 7;
    const height = 6;
    const data = new Uint8ClampedArray(width * height * 4);
    const markOpaquePixel = (x, y) => {
      const alphaIndex = ((y * width) + x) * 4 + 3;
      data[alphaIndex] = 255;
    };

    markOpaquePixel(2, 1);
    markOpaquePixel(4, 3);
    markOpaquePixel(3, 2);

    expect(resolveNonTransparentRasterBounds({ data, width, height })).toEqual({
      x: 2,
      y: 1,
      width: 3,
      height: 3
    });
  });

  it('returns null raster bounds when every pixel is transparent', async () => {
    const { resolveNonTransparentRasterBounds } = await import('@/app/exports.js');

    const width = 4;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);

    expect(resolveNonTransparentRasterBounds({ data, width, height })).toBeNull();
  });

  it('expands raster bounds with padding and clamps to image edges', async () => {
    const { resolveNonTransparentRasterBounds } = await import('@/app/exports.js');

    const width = 5;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    const markOpaquePixel = (x, y) => {
      const alphaIndex = ((y * width) + x) * 4 + 3;
      data[alphaIndex] = 255;
    };

    markOpaquePixel(1, 1);
    markOpaquePixel(2, 1);

    expect(resolveNonTransparentRasterBounds({ data, width, height }, { padding: 1 })).toEqual({
      x: 0,
      y: 0,
      width: 4,
      height: 3
    });

    expect(resolveNonTransparentRasterBounds({ data, width, height }, { padding: 10 })).toEqual({
      x: 0,
      y: 0,
      width,
      height
    });
  });
});
