import { useProjectStore } from '@/stores/projectStore.js';
import { pinia } from '@/stores/pinia.js';
import { finishEditingAllHotTables } from '@/composables/useHotTableRegistry.js';
import { getLanguage } from '@/app/i18n.js';
import { buildActiveWellReportSnapshot } from '@/reports/reportSnapshot.js';
import {
  buildTopologyModelInWorker,
  isTopologyWorkerCancelledError
} from '@/composables/useTopologyWorker.js';

const projectStore = useProjectStore(pinia);

export function buildCurrentReviewSummarySnapshot(options = {}) {
  projectStore.ensureInitialized();
  finishEditingAllHotTables();
  projectStore.syncActiveWellData();

  const projectPayload = projectStore.serializeProjectPayload();
  return buildActiveWellReportSnapshot(projectPayload, {
    language: options.language ?? getLanguage(),
    generatedAt: options.generatedAt
  });
}

export async function loadReviewSummaryDerivedSummary(snapshot = {}, options = {}) {
  try {
    const topologyResult = await buildTopologyModelInWorker(snapshot?.stateSnapshot ?? {}, {
      wellId: snapshot?.well?.id ?? null,
      supersedeInFlight: options.supersedeInFlight
    });

    return {
      status: 'ready',
      metrics: {
        minFailureCost: topologyResult?.minFailureCostToSurface ?? null,
        warningCount: Array.isArray(topologyResult?.validationWarnings) ? topologyResult.validationWarnings.length : 0,
        sourceCount: Array.isArray(topologyResult?.sourceEntities) ? topologyResult.sourceEntities.length : 0,
        nodeCount: Array.isArray(topologyResult?.nodes) ? topologyResult.nodes.length : 0,
        edgeCount: Array.isArray(topologyResult?.edges) ? topologyResult.edges.length : 0
      },
      warnings: Array.isArray(topologyResult?.validationWarnings) ? topologyResult.validationWarnings : []
    };
  } catch (error) {
    if (isTopologyWorkerCancelledError?.(error)) {
      throw error;
    }

    return {
      status: 'error',
      error: error?.message || String(error ?? 'Review summary update failed.'),
      metrics: null,
      warnings: []
    };
  }
}
