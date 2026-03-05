import { describe, expect, it } from 'vitest';
import {
  isTopologyResultSynchronized,
  resolveSynchronizedTopologyResult,
  resolveTopologyOverlaySynchronizationState
} from '@/topology/resultSynchronization.js';

describe('resultSynchronization', () => {
  it('accepts topology result when request ids are synchronized', () => {
    const topologyEntry = {
      latestRequestId: 8,
      loading: false,
      result: {
        requestId: 8,
        minFailureCostToSurface: 1
      }
    };

    expect(isTopologyResultSynchronized(topologyEntry)).toBe(true);
    expect(resolveSynchronizedTopologyResult(topologyEntry)).toEqual(topologyEntry.result);
  });

  it('rejects stale topology result when latest request id has advanced', () => {
    const topologyEntry = {
      latestRequestId: 9,
      loading: true,
      result: {
        requestId: 8
      }
    };

    expect(isTopologyResultSynchronized(topologyEntry)).toBe(false);
    expect(resolveSynchronizedTopologyResult(topologyEntry)).toBeNull();
  });

  it('returns null when no topology result exists', () => {
    const topologyEntry = {
      latestRequestId: 2,
      loading: true,
      result: null
    };

    expect(isTopologyResultSynchronized(topologyEntry)).toBe(false);
    expect(resolveSynchronizedTopologyResult(topologyEntry)).toBeNull();
  });

  it('allows legacy results without request ids when no request tracking exists', () => {
    const topologyEntry = {
      latestRequestId: 0,
      loading: false,
      result: {
        minFailureCostToSurface: 0
      }
    };

    expect(isTopologyResultSynchronized(topologyEntry)).toBe(true);
    expect(resolveSynchronizedTopologyResult(topologyEntry)).toEqual(topologyEntry.result);
  });

  it('reports stale overlay state while a newer topology request is loading', () => {
    const topologyEntry = {
      latestRequestId: 12,
      loading: true,
      result: {
        requestId: 11
      }
    };

    expect(resolveTopologyOverlaySynchronizationState(topologyEntry)).toEqual({
      latestRequestId: 12,
      resultRequestId: 11,
      expectedRequestId: null,
      requireExpectedRequestId: false,
      isLoading: true,
      hasResult: true,
      topologySynchronized: false,
      matchesExpectedRequest: true,
      isSynchronized: false,
      overlaySuppressed: true,
      reason: 'stale_result'
    });
  });

  it('reports synchronized overlay state after latest result arrives', () => {
    const topologyEntry = {
      latestRequestId: 12,
      loading: false,
      result: {
        requestId: 12
      }
    };

    expect(resolveTopologyOverlaySynchronizationState(topologyEntry)).toEqual({
      latestRequestId: 12,
      resultRequestId: 12,
      expectedRequestId: null,
      requireExpectedRequestId: false,
      isLoading: false,
      hasResult: true,
      topologySynchronized: true,
      matchesExpectedRequest: true,
      isSynchronized: true,
      overlaySuppressed: false,
      reason: 'synchronized'
    });
  });

  it('suppresses overlays when expected geometry request id is pending', () => {
    const topologyEntry = {
      latestRequestId: 15,
      loading: false,
      result: {
        requestId: 15
      }
    };

    expect(resolveTopologyOverlaySynchronizationState(topologyEntry, {
      expectedRequestId: null,
      requireExpectedRequestId: true
    })).toEqual({
      latestRequestId: 15,
      resultRequestId: 15,
      expectedRequestId: null,
      requireExpectedRequestId: true,
      isLoading: false,
      hasResult: true,
      topologySynchronized: true,
      matchesExpectedRequest: false,
      isSynchronized: false,
      overlaySuppressed: true,
      reason: 'expected_request_pending'
    });
  });

  it('suppresses overlays when geometry request id mismatches topology result request id', () => {
    const topologyEntry = {
      latestRequestId: 15,
      loading: false,
      result: {
        requestId: 15
      }
    };

    expect(resolveTopologyOverlaySynchronizationState(topologyEntry, {
      expectedRequestId: 14,
      requireExpectedRequestId: true
    })).toEqual({
      latestRequestId: 15,
      resultRequestId: 15,
      expectedRequestId: 14,
      requireExpectedRequestId: true,
      isLoading: false,
      hasResult: true,
      topologySynchronized: true,
      matchesExpectedRequest: false,
      isSynchronized: false,
      overlaySuppressed: true,
      reason: 'request_mismatch'
    });
  });

  it('differentiates result-absent overlay suppression between loading and idle states', () => {
    const cases = [
      {
        label: 'loading_no_result',
        topologyEntry: {
          latestRequestId: 7,
          loading: true,
          result: null
        },
        expected: {
          latestRequestId: 7,
          resultRequestId: null,
          expectedRequestId: null,
          requireExpectedRequestId: false,
          isLoading: true,
          hasResult: false,
          topologySynchronized: false,
          matchesExpectedRequest: true,
          isSynchronized: false,
          overlaySuppressed: true,
          reason: 'loading_no_result'
        }
      },
      {
        label: 'no_result',
        topologyEntry: {
          latestRequestId: 7,
          loading: false,
          result: null
        },
        expected: {
          latestRequestId: 7,
          resultRequestId: null,
          expectedRequestId: null,
          requireExpectedRequestId: false,
          isLoading: false,
          hasResult: false,
          topologySynchronized: false,
          matchesExpectedRequest: true,
          isSynchronized: false,
          overlaySuppressed: false,
          reason: 'no_result'
        }
      }
    ];

    cases.forEach((testCase) => {
      expect(
        resolveTopologyOverlaySynchronizationState(testCase.topologyEntry),
        testCase.label
      ).toEqual(testCase.expected);
    });
  });
});
