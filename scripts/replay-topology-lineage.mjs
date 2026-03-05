#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildTopologyAuditReplayRows,
  buildTopologyAuditReplaySummary,
  resolveTopologyAuditReplayRequest
} from '../src/topology/requestLineageReplay.js';

function parseArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const options = {
    filePath: null,
    wellId: null,
    requestId: null,
    asJson: false
  };

  while (tokens.length > 0) {
    const token = String(tokens.shift() ?? '').trim();
    if (!token) continue;
    if (token === '--well') {
      options.wellId = String(tokens.shift() ?? '').trim() || null;
      continue;
    }
    if (token === '--request') {
      const requestId = Number(tokens.shift());
      options.requestId = Number.isInteger(requestId) && requestId > 0 ? requestId : null;
      continue;
    }
    if (token === '--json') {
      options.asJson = true;
      continue;
    }
    if (!options.filePath) {
      options.filePath = token;
    }
  }

  return options;
}

function printUsage() {
  console.log('Usage: node scripts/replay-topology-lineage.mjs <audit-json-path> [--well <wellId>] [--request <requestId>] [--json]');
}

function formatCountMap(map = {}) {
  return Object.entries(map)
    .map(([key, value]) => `${key}=${Number(value ?? 0)}`)
    .join(' | ');
}

function printSummary(summary = {}) {
  console.log(`wells=${summary.wellCount} | requests=${summary.requestCount} | events=${summary.eventCount}`);
  console.log(`request_status: ${formatCountMap(summary.requestStatusCounts)}`);
  console.log(`event_types: ${formatCountMap(summary.eventTypeCounts)}`);
  console.log(`anomalies: ${formatCountMap(summary.anomalyCounts)}`);
}

function printRows(rows = [], limit = 15) {
  const trimmed = rows.slice(0, limit);
  trimmed.forEach((row) => {
    console.log([
      row.eventAt ?? 'N/A',
      row.wellId ?? 'N/A',
      `request=${row.requestId ?? 'N/A'}`,
      row.eventType ?? 'unknown',
      `status=${row.requestStatus ?? 'unknown'}`,
      `geometry=${row.geometryStatus ?? 'unknown'}`
    ].join(' | '));
  });
  if (rows.length > limit) {
    console.log(`... (${rows.length - limit} additional event rows omitted)`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.filePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), args.filePath);
  const raw = await readFile(resolvedPath, 'utf8');
  const bundle = JSON.parse(String(raw).replace(/^\uFEFF/, ''));
  const replayOptions = args.wellId ? { wellIds: [args.wellId] } : {};

  const summary = buildTopologyAuditReplaySummary(bundle, replayOptions);
  const rows = buildTopologyAuditReplayRows(bundle, replayOptions);
  const requestReplay = (args.wellId && args.requestId)
    ? resolveTopologyAuditReplayRequest(bundle, args.wellId, args.requestId)
    : null;

  if (args.asJson) {
    const payload = {
      sourcePath: resolvedPath,
      summary,
      rows,
      requestReplay
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Topology lineage replay: ${resolvedPath}`);
  printSummary(summary);
  console.log('---');
  printRows(rows);

  if (requestReplay) {
    console.log('---');
    console.log(`request replay: well=${requestReplay.wellId} request=${requestReplay.requestId}`);
    requestReplay.events.forEach((event) => {
      console.log(`${event.at ?? 'N/A'} | ${event.type} | status=${event.status} | geometry=${event.geometryStatus}`);
    });
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
