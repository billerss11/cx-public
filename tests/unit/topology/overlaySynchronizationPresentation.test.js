import { describe, expect, it } from 'vitest';
import {
  formatTopologyOverlayHintDetail,
  resolveTopologyOverlayHintKey
} from '@/topology/overlaySynchronizationPresentation.js';

describe('overlaySynchronizationPresentation', () => {
  it('maps synchronization reasons to stable hint i18n keys', () => {
    expect(resolveTopologyOverlayHintKey({ reason: 'stale_result' }))
      .toBe('ui.analysis.topology.overlay_sync.stale_result');
    expect(resolveTopologyOverlayHintKey({ reason: 'expected_request_pending' }))
      .toBe('ui.analysis.topology.overlay_sync.geometry_pending');
    expect(resolveTopologyOverlayHintKey({ reason: 'request_mismatch' }))
      .toBe('ui.analysis.topology.overlay_sync.request_mismatch');
    expect(resolveTopologyOverlayHintKey({ reason: 'unexpected_reason' }))
      .toBe('ui.analysis.topology.overlay_sync.updating');
  });

  it('formats detail with geometry request id when expected request id is available', () => {
    const detail = formatTopologyOverlayHintDetail({
      latestRequestId: 9,
      resultRequestId: 7,
      expectedRequestId: 9,
      reason: 'request_mismatch'
    });
    expect(detail).toBe('overlay_request=7 | geometry_request=9 | latest_request=9');
  });

  it('formats detail with pending geometry request for expected-request-pending state', () => {
    const detail = formatTopologyOverlayHintDetail({
      latestRequestId: 5,
      resultRequestId: 5,
      expectedRequestId: null,
      reason: 'expected_request_pending'
    });
    expect(detail).toBe('overlay_request=5 | geometry_request=pending | latest_request=5');
  });

  it('formats compact detail when geometry request id is not available', () => {
    const detail = formatTopologyOverlayHintDetail({
      latestRequestId: 2,
      resultRequestId: 1,
      reason: 'stale_result'
    });
    expect(detail).toBe('overlay_request=1 | latest_request=2');
  });

  it('coerces numeric strings and returns empty detail when required ids are missing', () => {
    expect(formatTopologyOverlayHintDetail({
      latestRequestId: '11',
      resultRequestId: '8',
      expectedRequestId: '11',
      reason: 'request_mismatch'
    })).toBe('overlay_request=8 | geometry_request=11 | latest_request=11');

    expect(formatTopologyOverlayHintDetail({
      latestRequestId: null,
      resultRequestId: 1,
      reason: 'stale_result'
    })).toBe('');
    expect(formatTopologyOverlayHintDetail({
      latestRequestId: 1,
      resultRequestId: null,
      reason: 'stale_result'
    })).toBe('');
  });

  it('keeps non-suppressed and no-result states on fallback hint behavior', () => {
    expect(resolveTopologyOverlayHintKey({ reason: 'synchronized' }))
      .toBe('ui.analysis.topology.overlay_sync.updating');
    expect(resolveTopologyOverlayHintKey({ reason: 'loading_no_result' }))
      .toBe('ui.analysis.topology.overlay_sync.updating');
    expect(resolveTopologyOverlayHintKey({ reason: 'no_result' }))
      .toBe('ui.analysis.topology.overlay_sync.updating');

    expect(formatTopologyOverlayHintDetail({
      latestRequestId: 4,
      resultRequestId: 4,
      expectedRequestId: 4,
      reason: 'synchronized'
    })).toBe('overlay_request=4 | geometry_request=4 | latest_request=4');

    expect(formatTopologyOverlayHintDetail({
      latestRequestId: 4,
      resultRequestId: null,
      reason: 'loading_no_result'
    })).toBe('');
    expect(formatTopologyOverlayHintDetail({
      latestRequestId: 4,
      resultRequestId: null,
      reason: 'no_result'
    })).toBe('');
  });
});
