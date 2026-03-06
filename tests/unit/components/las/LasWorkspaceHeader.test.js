import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LasWorkspaceHeader from '@/components/las/LasWorkspaceHeader.vue';

function mountHeader(props = {}) {
  return mount(LasWorkspaceHeader, {
    props: {
      activeSession: {
        sessionId: 'session-1',
        fileName: 'demo.las',
        wellName: 'Well-A',
        indexCurve: 'DEPT',
        depthUnit: 'm',
        fileSizeDisplay: '1.2 MB',
      },
      sessionOptions: [{ value: 'session-1', label: 'Well-A' }],
      activeSessionId: 'session-1',
      selectedIndexCurve: 'DEPT',
      indexCurveOptions: [
        { value: 'DEPT', label: 'DEPT (m)' },
        { value: 'BDTI', label: 'BDTI (h)' },
      ],
      overview: {
        dataPoints: 3000,
        indexRangeDisplay: '2000',
      },
      selectedCurveCount: 2,
      indexType: 'depth',
      isLoading: false,
      ...props,
    },
    global: {
      stubs: {
        Button: {
          emits: ['click'],
          template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        Select: {
          props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
          emits: ['update:modelValue'],
          template: `
            <select
              :value="modelValue"
              data-testid="index-select-input"
              @change="$emit('update:modelValue', $event.target.value)"
            >
              <option
                v-for="item in options || []"
                :key="item[optionValue || 'value']"
                :value="item[optionValue || 'value']"
              >
                {{ item[optionLabel || 'label'] }}
              </option>
            </select>
          `,
        },
        InputText: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: `
            <input
              :value="modelValue"
              @input="$emit('update:modelValue', $event.target.value)"
            />
          `,
        },
      },
    },
  });
}

describe('LasWorkspaceHeader', () => {
  it('emits selected index-curve updates from the manual selector', async () => {
    const wrapper = mountHeader();

    await wrapper.get('[data-testid="las-header-index-select"]').setValue('BDTI');

    expect(wrapper.emitted('update:selected-index-curve')).toEqual([['BDTI']]);
  });

  it('renders first-curve rejection diagnostics when parse metadata includes them', () => {
    const wrapper = mountHeader({
      indexSelectionDiagnostics: {
        selectedIndexCurve: 'BDTI',
        firstCurveRejected: true,
        rejectionReasonCode: 'FIRST_CURVE_HAS_NO_NUMERIC_VALUES',
        firstCurve: {
          mnemonic: 'TIME',
          rawNonNullCount: 432000,
          numericNonNullCount: 0,
          numericParseRatio: 0,
        },
      },
    });

    const diagnostics = wrapper.get('[data-testid="las-header-index-diagnostics"]');
    expect(diagnostics.text()).toContain('Auto index skipped TIME');
    expect(diagnostics.text()).toContain('0.0%');
  });

  it('emits time-axis control updates for time-indexed sessions', async () => {
    const wrapper = mountHeader({
      indexType: 'time',
      timeAxisSettings: {
        displayMode: 'elapsed',
        timezone: 'UTC',
        manualStartIso: '',
      },
      timeAxisContext: {
        status: 'anchor-missing',
        message: 'Clock-time display needs DATE/STRTTIME metadata or a manual start time.',
      },
      timeDisplayModeOptions: [
        { label: 'Elapsed', value: 'elapsed' },
        { label: 'Clock Time', value: 'clock' },
      ],
      timeDisplayTimezoneOptions: [
        { label: 'UTC', value: 'UTC' },
        { label: 'Local', value: 'LOCAL' },
      ],
    });

    await wrapper.get('[data-testid="las-header-time-display-select"]').setValue('clock');
    await wrapper.get('[data-testid="las-header-timezone-select"]').setValue('LOCAL');
    await wrapper.get('[data-testid="las-header-time-manual-start"]').setValue('2015-08-03 00:00:05');

    expect(wrapper.emitted('update:time-display-mode')).toEqual([['clock']]);
    expect(wrapper.emitted('update:time-display-timezone')).toEqual([['LOCAL']]);
    expect(wrapper.emitted('update:time-display-manual-start')).toEqual([['2015-08-03 00:00:05']]);
    expect(wrapper.get('[data-testid="las-header-time-status"]').text()).toContain('Clock-time display needs DATE/STRTTIME metadata');
  });
});
