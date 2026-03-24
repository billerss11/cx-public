<script setup>
defineOptions({ name: 'CasingRuleExplorerPane' });

import { computed, ref } from 'vue';
import Message from 'primevue/message';
import Select from 'primevue/select';
import {
  getAllRuleExplorerSizeOptions,
  getRuleExplorerDetails
} from '@/utils/casingRules.js';
import { t } from '@/app/i18n.js';

const sizeOptions = getAllRuleExplorerSizeOptions().map((entry) => ({
  label: entry.label,
  value: entry.label
}));
const selectedSizeLabel = ref(sizeOptions[0]?.value ?? '');

const explorerDetails = computed(() => getRuleExplorerDetails(selectedSizeLabel.value));

function getClearanceLabel(entry) {
  return entry?.isLowClearance
    ? t('ui.casing_tools.clearance.low')
    : t('ui.casing_tools.clearance.standard');
}
</script>

<template>
  <section class="casing-rule-explorer-pane">
    <div class="casing-rule-explorer-pane__toolbar" data-test="casing-rule-explorer-select">
      <label class="casing-rule-explorer-pane__label" data-i18n="ui.casing_tools.explorer.select_size">
        Engineering size
      </label>
      <Select
        v-model="selectedSizeLabel"
        :options="sizeOptions"
        option-label="label"
        option-value="value"
        class="w-100"
        filter
      />
    </div>

    <div
      v-if="explorerDetails?.casingRole || explorerDetails?.holeRole"
      class="casing-rule-explorer-pane__sections"
    >
      <section v-if="explorerDetails?.casingRole" class="casing-rule-explorer-pane__section">
        <header class="casing-rule-explorer-pane__section-header">
          <h4 class="casing-rule-explorer-pane__section-title" data-i18n="ui.casing_tools.explorer.casing_role">
            Casing role
          </h4>
          <p class="casing-rule-explorer-pane__section-copy" data-i18n="ui.casing_tools.explorer.casing_role_help">
            What holes accept this casing, and what holes can be drilled next.
          </p>
        </header>

        <div class="casing-rule-explorer-pane__grid">
          <div class="casing-rule-explorer-pane__card">
            <h5 class="casing-rule-explorer-pane__card-title" data-i18n="ui.casing_tools.explorer.accepted_in_holes">
              Accepted in holes
            </h5>
            <table class="casing-rule-explorer-pane__table">
              <tbody>
                <tr v-for="entry in explorerDetails.casingRole.acceptedInHoles" :key="`accepted-${entry.label}`">
                  <td>{{ entry.label }}</td>
                  <td class="casing-rule-explorer-pane__clearance">
                    <span :class="['casing-rule-explorer-pane__clearance-pill', entry.isLowClearance ? 'casing-rule-explorer-pane__clearance-pill--warning' : '']">
                      {{ getClearanceLabel(entry) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="casing-rule-explorer-pane__card">
            <h5 class="casing-rule-explorer-pane__card-title" data-i18n="ui.casing_tools.explorer.drillable_holes">
              Drillable holes
            </h5>
            <table class="casing-rule-explorer-pane__table">
              <tbody>
                <tr v-for="entry in explorerDetails.casingRole.drillableHoles" :key="`drillable-${entry.label}`">
                  <td>{{ entry.label }}</td>
                  <td class="casing-rule-explorer-pane__clearance">
                    <span :class="['casing-rule-explorer-pane__clearance-pill', entry.isLowClearance ? 'casing-rule-explorer-pane__clearance-pill--warning' : '']">
                      {{ getClearanceLabel(entry) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="explorerDetails?.holeRole" class="casing-rule-explorer-pane__section">
        <header class="casing-rule-explorer-pane__section-header">
          <h4 class="casing-rule-explorer-pane__section-title" data-i18n="ui.casing_tools.explorer.hole_role">
            Hole role
          </h4>
          <p class="casing-rule-explorer-pane__section-copy" data-i18n="ui.casing_tools.explorer.hole_role_help">
            What casing can be set in this hole, and what previous casing can reach it.
          </p>
        </header>

        <div class="casing-rule-explorer-pane__grid">
          <div class="casing-rule-explorer-pane__card">
            <h5 class="casing-rule-explorer-pane__card-title" data-i18n="ui.casing_tools.explorer.settable_casing">
              Settable casing
            </h5>
            <table class="casing-rule-explorer-pane__table">
              <tbody>
                <tr v-for="entry in explorerDetails.holeRole.settableCasing" :key="`settable-${entry.label}`">
                  <td>{{ entry.label }}</td>
                  <td class="casing-rule-explorer-pane__clearance">
                    <span :class="['casing-rule-explorer-pane__clearance-pill', entry.isLowClearance ? 'casing-rule-explorer-pane__clearance-pill--warning' : '']">
                      {{ getClearanceLabel(entry) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="casing-rule-explorer-pane__card">
            <h5 class="casing-rule-explorer-pane__card-title" data-i18n="ui.casing_tools.explorer.reachable_from_casing">
              Reachable from casing
            </h5>
            <table class="casing-rule-explorer-pane__table">
              <tbody>
                <tr v-for="entry in explorerDetails.holeRole.reachableFromCasing" :key="`reachable-${entry.label}`">
                  <td>{{ entry.label }}</td>
                  <td class="casing-rule-explorer-pane__clearance">
                    <span :class="['casing-rule-explorer-pane__clearance-pill', entry.isLowClearance ? 'casing-rule-explorer-pane__clearance-pill--warning' : '']">
                      {{ getClearanceLabel(entry) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <Message v-else severity="info">
      <span data-i18n="ui.casing_tools.explorer.empty">
        No rule details are available for the selected engineering size.
      </span>
    </Message>
  </section>
</template>

<style scoped>
.casing-rule-explorer-pane {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.casing-rule-explorer-pane__toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.casing-rule-explorer-pane__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}

.casing-rule-explorer-pane__sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: auto;
}

.casing-rule-explorer-pane__section {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.casing-rule-explorer-pane__section-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.casing-rule-explorer-pane__section-title,
.casing-rule-explorer-pane__card-title {
  margin: 0;
  color: var(--ink);
}

.casing-rule-explorer-pane__section-copy {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
}

.casing-rule-explorer-pane__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.8rem;
}

.casing-rule-explorer-pane__card {
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, transparent);
  padding: 0.85rem 0.95rem;
}

.casing-rule-explorer-pane__table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.55rem;
}

.casing-rule-explorer-pane__table td {
  padding: 0.45rem 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 68%, transparent);
  font-size: 0.84rem;
}

.casing-rule-explorer-pane__table tr:first-child td {
  border-top: none;
}

.casing-rule-explorer-pane__clearance {
  text-align: right;
}

.casing-rule-explorer-pane__clearance-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, #0f766e 16%, transparent);
  color: #115e59;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.casing-rule-explorer-pane__clearance-pill--warning {
  background: color-mix(in srgb, #f59e0b 18%, transparent);
  color: #92400e;
}

@media (max-width: 760px) {
  .casing-rule-explorer-pane__grid {
    grid-template-columns: 1fr;
  }
}
</style>
