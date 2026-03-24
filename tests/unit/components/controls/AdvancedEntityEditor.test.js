import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrimeVue from 'primevue/config';
import AdvancedEntityEditor from '@/components/controls/AdvancedEntityEditor.vue';
import { setLanguage } from '@/app/i18n.js';

const updateFieldSpy = vi.hoisted(() => vi.fn());
const addRowSpy = vi.hoisted(() => vi.fn());
const deleteRowSpy = vi.hoisted(() => vi.fn());
const moveRowSpy = vi.hoisted(() => vi.fn());
const duplicateRowSpy = vi.hoisted(() => vi.fn());

vi.mock('@/composables/useEntityEditorActions.js', () => ({
  resolveEntityEditorDomainKey: (entityType) => {
    const token = String(entityType ?? '').trim().toLowerCase();
    if (token === 'lines' || token === 'line') return 'lines';
    return token;
  },
  useEntityEditorActions: () => ({
    updateField: updateFieldSpy,
    addRow: addRowSpy,
    deleteRow: deleteRowSpy,
    moveRow: moveRowSpy,
    duplicateRow: duplicateRowSpy
  })
}));

vi.mock('@/controls/entityEditor/entityFieldSchema.js', () => ({
  DATA_TAB_READ_ONLY_FIELDS_ENABLED: true,
  ENTITY_EDITOR_CONTROL_TYPES: {
    text: 'text',
    number: 'number',
    toggle: 'toggle',
    select: 'select',
    json: 'json'
  },
  resolveEntityEditorFieldDefinitions: () => ([
    {
      field: 'label',
      label: 'Label',
      controlType: 'text'
    },
    {
      field: 'state.actuationState',
      label: 'Actuation State',
      controlType: 'text'
    },
    {
      field: 'rowId',
      label: 'Row ID',
      controlType: 'text',
      readOnly: true
    }
  ])
}));

describe('AdvancedEntityEditor', () => {
  beforeEach(() => {
    updateFieldSpy.mockReset();
    addRowSpy.mockReset();
    deleteRowSpy.mockReset();
    moveRowSpy.mockReset();
    duplicateRowSpy.mockReset();
    setLanguage('en');
  });

  it('updates selected entity fields through useEntityEditorActions', async () => {
    const wrapper = mount(AdvancedEntityEditor, {
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
                  entityType: 'lines',
                  rowId: 'line-1'
                }
              },
              interaction: {
                interaction: {
                  lockedEntity: null,
                  hoveredEntity: null
                }
              },
              projectData: {
                horizontalLines: [
                  {
                    rowId: 'line-1',
                    depth: 1000,
                    label: 'Line 1',
                    state: {
                      actuationState: 'closed'
                    },
                    show: true
                  }
                ],
                casingData: [],
                tubingData: [],
                drillStringData: [],
                equipmentData: [],
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

    const labelInput = wrapper.get('input[data-testid="advanced-field-label"]');
    const nestedStateInput = wrapper.get('input[data-testid="advanced-field-state-actuationstate"]');
    expect(labelInput.exists()).toBe(true);
    expect(nestedStateInput.exists()).toBe(true);
    expect(nestedStateInput.element.value).toBe('closed');
    expect(wrapper.find('[data-testid="advanced-readonly-rowid"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Read-only Transparency');
    await labelInput.setValue('Updated Line');
    await labelInput.trigger('blur');
    await nestedStateInput.setValue('open');
    await nestedStateInput.trigger('blur');

    expect(updateFieldSpy).toHaveBeenCalledWith({
      entityType: 'lines',
      rowId: 'line-1',
      field: 'label',
      value: 'Updated Line'
    });
    expect(updateFieldSpy).toHaveBeenCalledWith({
      entityType: 'lines',
      rowId: 'line-1',
      field: 'state.actuationState',
      value: 'open'
    });
  });
});
