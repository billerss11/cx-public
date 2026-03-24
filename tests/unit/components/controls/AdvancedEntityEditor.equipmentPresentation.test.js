import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrimeVue from 'primevue/config';
import AdvancedEntityEditor from '@/components/controls/AdvancedEntityEditor.vue';
import { setLanguage } from '@/app/i18n.js';

const updateFieldSpy = vi.hoisted(() => vi.fn());

vi.mock('@/composables/useEntityEditorActions.js', () => ({
  useEntityEditorActions: () => ({
    updateField: updateFieldSpy,
    addRow: vi.fn(),
    deleteRow: vi.fn(),
    moveRow: vi.fn(),
    duplicateRow: vi.fn()
  })
}));

function mountEquipmentEditor(equipmentRow) {
  return mount(AdvancedEntityEditor, {
    props: {
      mode: 'advanced'
    },
    global: {
      plugins: [
        PrimeVue,
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            workspace: {
              rightDockEditorMode: 'advanced',
              selectedHierarchyRef: {
                wellId: 'well-1',
                entityType: 'equipment',
                rowId: equipmentRow.rowId
              }
            },
            interaction: {
              interaction: {
                lockedEntity: null,
                hoveredEntity: null
              }
            },
            projectData: {
              casingData: [
                { rowId: 'csg-1', label: 'Casing 1', top: 0, bottom: 5000, od: 9.625 }
              ],
              tubingData: [
                { rowId: 'tbg-1', label: 'Tubing 1', top: 0, bottom: 4500, od: 4.5 }
              ],
              drillStringData: [],
              equipmentData: [equipmentRow],
              horizontalLines: [],
              annotationBoxes: [],
              userAnnotations: [],
              cementPlugs: [],
              annulusFluids: [],
              markers: [],
              topologySources: [],
              trajectory: []
            }
          }
        })
      ]
    }
  });
}

describe('AdvancedEntityEditor equipment presentation', () => {
  beforeEach(() => {
    updateFieldSpy.mockReset();
    setLanguage('en');
  });

  it('shows an equipment behavior summary and keeps advanced seal controls collapsed by default for packers', async () => {
    const wrapper = mountEquipmentEditor({
      rowId: 'eq-packer',
      depth: 1200,
      type: 'Packer',
      attachToDisplay: 'Tubing | #1 (Tubing 1)',
      attachToHostType: 'tubing',
      attachToId: 'tbg-1',
      sealNodeKind: 'ANNULUS_A',
      label: 'Packer 1',
      state: {
        actuationState: '',
        integrityStatus: ''
      },
      properties: {
        boreSeal: '',
        annularSeal: '',
        sealByVolume: {}
      },
      show: true
    });

    expect(wrapper.get('[data-testid="equipment-summary-card"]').text()).toContain('Effective topology behavior');
    expect(wrapper.get('[data-testid="equipment-summary-volumes"]').text()).toContain('ANNULUS_A');
    expect(wrapper.find('[data-testid="advanced-field-properties-annularseal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="advanced-field-properties-boreseal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="equipment-advanced-panel"]').exists()).toBe(false);

    await wrapper.get('[data-testid="equipment-advanced-toggle"]').trigger('click');

    expect(wrapper.get('[data-testid="equipment-advanced-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="advanced-field-properties-boreseal"]').exists()).toBe(true);
  });

  it('hides generic bridge plug seal overrides while still showing the bore-focused explainer', async () => {
    const wrapper = mountEquipmentEditor({
      rowId: 'eq-bridge',
      depth: 1200,
      type: 'Bridge Plug',
      attachToDisplay: 'Tubing | #1 (Tubing 1)',
      attachToHostType: 'tubing',
      attachToId: 'tbg-1',
      sealNodeKind: 'ANNULUS_A',
      label: 'Bridge Plug 1',
      state: {
        actuationState: '',
        integrityStatus: ''
      },
      properties: {
        boreSeal: '',
        annularSeal: '',
        sealByVolume: {
          ANNULUS_A: true
        }
      },
      show: true
    });

    expect(wrapper.get('[data-testid="equipment-summary-volumes"]').text()).toContain('BORE');
    expect(wrapper.get('[data-testid="equipment-summary-notes"]').text()).toContain('Bridge plugs currently behave as bore-focused barriers');
    expect(wrapper.find('[data-testid="advanced-field-properties-boreseal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="advanced-field-properties-annularseal"]').exists()).toBe(false);

    await wrapper.get('[data-testid="equipment-advanced-toggle"]').trigger('click');

    expect(wrapper.find('[data-testid="advanced-field-properties-boreseal"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="advanced-field-properties-annularseal"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="advanced-readonly-properties-sealbyvolume"]').exists()).toBe(true);
  });
});
