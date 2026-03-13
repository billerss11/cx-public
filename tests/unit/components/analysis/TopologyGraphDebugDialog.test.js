import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TopologyGraphDebugDialog from '@/components/analysis/TopologyGraphDebugDialog.vue';

const fitToContentsMock = vi.fn(() => Promise.resolve());
const panToCenterMock = vi.fn(() => Promise.resolve());
const setViewBoxMock = vi.fn();

const VNetworkGraphStub = defineComponent({
  name: 'VNetworkGraph',
  props: {
    nodes: { type: Object, default: () => ({}) },
    edges: { type: Object, default: () => ({}) },
    layouts: { type: Object, default: () => ({ nodes: {} }) },
    zoomLevel: { type: Number, default: 1 },
    configs: { type: Object, default: () => ({}) },
    eventHandlers: { type: Object, default: () => ({}) }
  },
  emits: ['update:layouts', 'update:zoomLevel'],
  setup(props, { emit, slots, expose }) {
    expose({
      fitToContents: fitToContentsMock,
      panToCenter: panToCenterMock,
      setViewBox: setViewBoxMock
    });

    return () => h('div', {
      class: 'v-network-graph-stub',
      'data-layouts': JSON.stringify(props.layouts ?? {}),
      'data-zoom-level': String(props.zoomLevel)
    }, [
      slots['lane-guides']?.({ scale: 1 }),
      slots['lane-headers']?.({ scale: 1 }),
      h('button', {
        type: 'button',
        class: 'graph-node-click',
        onClick: () => props.eventHandlers?.['node:click']?.({ node: 'node:ANNULUS_A:0:1000' })
      }, 'emit node click'),
      h('button', {
        type: 'button',
        class: 'graph-drag-start',
        onClick: () => props.eventHandlers?.['node:dragstart']?.({
          'node:ANNULUS_A:0:1000': { x: 120, y: 48 }
        })
      }, 'emit drag start'),
      h('button', {
        type: 'button',
        class: 'graph-drag-end',
        onClick: () => props.eventHandlers?.['node:dragend']?.({
          'node:ANNULUS_A:0:1000': { x: 140, y: 60 }
        })
      }, 'emit drag end'),
      h('button', {
        type: 'button',
        class: 'graph-edge-click',
        onClick: () => props.eventHandlers?.['edge:click']?.({ edge: 'edge:vertical:a0-a1' })
      }, 'emit edge click'),
      h('button', {
        type: 'button',
        class: 'graph-layout-update',
        onClick: () => emit('update:layouts', {
          nodes: {
            'node:ANNULUS_A:0:1000': { x: 999, y: 111, fixed: true },
            'node:SURFACE': { x: 180, y: -80, fixed: true }
          }
        })
      }, 'emit layouts update'),
      h('button', {
        type: 'button',
        class: 'graph-zoom-update',
        onClick: () => emit('update:zoomLevel', 2.5)
      }, 'emit zoom update')
    ]);
  }
});

const DialogStub = defineComponent({
  name: 'Dialog',
  props: {
    visible: { type: Boolean, default: false },
    style: { type: Object, default: () => ({}) }
  },
  emits: ['update:visible'],
  template: `
    <section v-if="visible" class="dialog-stub" :style="style">
      <header class="dialog-stub__header"><slot name="header" /></header>
      <div class="dialog-stub__body"><slot /></div>
    </section>
  `
});

const SelectStub = defineComponent({
  name: 'Select',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  template: `
    <select class="select-stub" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  `
});

const ButtonStub = defineComponent({
  name: 'Button',
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
});

function createGraph() {
  return {
    nodes: {
      'node:SURFACE': {
        kind: 'SURFACE',
        displayLabel: 'Surface',
        detailLines: ['Surface'],
        tone: 'var(--color-analysis-graph-node-surface)'
      },
      'node:ANNULUS_A:0:1000': {
        kind: 'ANNULUS_A',
        displayLabel: '0-1,000 ft MD',
        detailLines: ['Annulus A (First Annulus)', '0-1,000 ft MD'],
        tone: 'var(--color-analysis-graph-node-default)'
      }
    },
    edges: {
      'edge:vertical:a0-a1': {
        source: 'node:ANNULUS_A:0:1000',
        target: 'node:SURFACE',
        kind: 'vertical',
        displayLabel: 'Vertical continuity | cost=0',
        tooltipLines: ['Vertical continuity | cost=0', 'Path: Annulus A (First Annulus) -> Surface'],
        detailLines: ['Vertical continuity | cost=0', 'Path: Annulus A (First Annulus) -> Surface'],
        tone: 'var(--color-analysis-graph-line-open)',
        dasharray: 0
      }
    },
    layouts: {
      nodes: {
        'node:ANNULUS_A:0:1000': { x: 120, y: 48, fixed: true },
        'node:SURFACE': { x: 180, y: -80, fixed: true }
      }
    },
    laneHeaders: [
      { kind: 'ANNULUS_A', label: 'Annulus A (First Annulus)', x: 120, y: -112 }
    ],
    laneGuides: [
      { kind: 'ANNULUS_A', x: 120, y: -92, width: 126, height: 208 }
    ],
    nodeCount: 2,
    edgeCount: 1
  };
}

function mountDialog(props = {}) {
  return mount(TopologyGraphDebugDialog, {
    props: {
      visible: true,
      scope: 'min_path',
      scopeOptions: [
        { value: 'min_path', label: 'Min-cost path', i18nKey: 'ui.analysis.topology.graph.scope.min_path' }
      ],
      graph: createGraph(),
      selectedNodeIds: [],
      selectedEdgeIds: ['edge:vertical:a0-a1'],
      requiresBarrierSelection: false,
      ...props
    },
    global: {
      stubs: {
        Dialog: DialogStub,
        Select: SelectStub,
        Button: ButtonStub,
        VNetworkGraph: VNetworkGraphStub
      }
    }
  });
}

describe('TopologyGraphDebugDialog', () => {
  beforeEach(() => {
    fitToContentsMock.mockClear();
    panToCenterMock.mockClear();
    setViewBoxMock.mockClear();
  });

  it('renders the edge legend in the top toolbar and shows selected details', () => {
    const wrapper = mountDialog();

    const toolbar = wrapper.find('.analysis-topology__graph-toolbar');
    expect(toolbar.exists()).toBe(true);
    expect(toolbar.find('.analysis-topology__graph-legend').exists()).toBe(true);
    expect(wrapper.find('.analysis-topology__graph-hover-detail').exists()).toBe(true);
    expect(wrapper.text()).toContain('Solid line = open continuity (cost 0)');
    expect(wrapper.text()).toContain('Vertical continuity | cost=0');
    expect(wrapper.text()).toContain('Path: Annulus A (First Annulus) -> Surface');
  });

  it('renders a keyboard-accessible resize handle and resizes the dialog shell', async () => {
    const wrapper = mountDialog();

    const dialogShell = wrapper.find('.dialog-stub');
    const initialStyle = dialogShell.attributes('style');
    expect(initialStyle).toContain('width:');

    const resizer = wrapper.find('.analysis-topology__graph-resizer');
    expect(resizer.exists()).toBe(true);

    await resizer.trigger('keydown', { key: 'ArrowLeft' });
    await nextTick();

    expect(wrapper.find('.dialog-stub').attributes('style')).not.toBe(initialStyle);
  });

  it('emits graph selection events and resets temporary layout state', async () => {
    const wrapper = mountDialog();

    await wrapper.find('.graph-node-click').trigger('click');
    await wrapper.find('.graph-edge-click').trigger('click');
    expect(wrapper.emitted('node-click')).toEqual([[ 'node:ANNULUS_A:0:1000' ]]);
    expect(wrapper.emitted('edge-click')).toEqual([[ 'edge:vertical:a0-a1' ]]);

    await wrapper.find('.graph-layout-update').trigger('click');
    await wrapper.find('.graph-zoom-update').trigger('click');
    await nextTick();
    expect(wrapper.find('.v-network-graph-stub').attributes('data-layouts')).toContain('999');
    expect(wrapper.find('.v-network-graph-stub').attributes('data-zoom-level')).toBe('2.5');

    fitToContentsMock.mockClear();
    await wrapper.find('[data-test="topology-graph-reset-layout"]').trigger('click');
    await nextTick();
    expect(wrapper.find('.v-network-graph-stub').attributes('data-layouts')).toContain('120');
    expect(fitToContentsMock).toHaveBeenCalled();

    panToCenterMock.mockClear();
    await wrapper.find('[data-test="topology-graph-reset-zoom"]').trigger('click');
    await nextTick();
    expect(wrapper.find('.v-network-graph-stub').attributes('data-zoom-level')).toBe('1');
    expect(panToCenterMock).toHaveBeenCalled();

    fitToContentsMock.mockClear();
    await wrapper.find('[data-test="topology-graph-fit"]').trigger('click');
    expect(fitToContentsMock).toHaveBeenCalled();
  });

  it('drops temporary dragged positions when the dialog reopens', async () => {
    const wrapper = mountDialog();

    await wrapper.find('.graph-layout-update').trigger('click');
    await nextTick();
    expect(wrapper.find('.v-network-graph-stub').attributes('data-layouts')).toContain('999');

    await wrapper.setProps({ visible: false });
    await wrapper.setProps({ visible: true });
    await nextTick();

    expect(wrapper.find('.v-network-graph-stub').attributes('data-layouts')).toContain('120');
  });

  it('switches into a lighter drag mode while a node drag is active', async () => {
    const wrapper = mountDialog();

    const graphComponent = wrapper.findComponent(VNetworkGraphStub);
    expect(graphComponent.props('configs').node.label.visible).toBe(true);
    expect(wrapper.find('.analysis-topology__graph-canvas-shell').classes()).not.toContain(
      'analysis-topology__graph-canvas-shell--dragging'
    );

    await wrapper.find('.graph-drag-start').trigger('click');
    await nextTick();

    expect(wrapper.find('.analysis-topology__graph-canvas-shell').classes()).toContain(
      'analysis-topology__graph-canvas-shell--dragging'
    );
    expect(wrapper.findComponent(VNetworkGraphStub).props('configs').node.label.visible).toBe(false);

    await wrapper.find('.graph-drag-end').trigger('click');
    await nextTick();

    expect(wrapper.find('.analysis-topology__graph-canvas-shell').classes()).not.toContain(
      'analysis-topology__graph-canvas-shell--dragging'
    );
    expect(wrapper.findComponent(VNetworkGraphStub).props('configs').node.label.visible).toBe(true);
  });
});
