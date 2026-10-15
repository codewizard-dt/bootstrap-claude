#!/usr/bin/env node
// Stand-in for the /usage-report script, used only by test/wiki-dashboard-usage.test.js.
// The dashboard server runs it as `node usage-stub.js --project <dir>` via the
// WIKI_DASHBOARD_USAGE_SCRIPT override. It never reads real transcripts.
//
// Behavior is selected by the STUB_MODE env var (inherited from the server):
//   (unset) | count  print the fixed valid report JSON
//   fail             print a sentinel to stderr and exit 1
//   garbage          print non-JSON to stdout
//   array            print "[]" (valid JSON, wrong shape)
//   slow             sleep 20 s, past the server's 15 s timeout, then print the report
//
// When STUB_COUNT_FILE is set, one JSON line holding the argv (after the script
// path) is appended to it on every invocation, so tests can count runs and
// inspect exactly what the server passed.

'use strict';

const fs = require('node:fs');

const REPORT = {
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  totals: {
    sessions: 3,
    inputTokens: 1200,
    outputTokens: 800,
    cacheReadTokens: 5000,
    cacheCreationTokens: 400,
    costUsd: 1.25,
  },
  models: [
    { model: 'stub-model', inputTokens: 1200, outputTokens: 800, costUsd: 1.25 },
  ],
  skills: [{ skill: 'stub-skill', invocations: 2, costUsd: 0.5 }],
  days: [{ date: '2026-01-01', inputTokens: 1200, outputTokens: 800, costUsd: 1.25 }],
};

const STDERR_SENTINEL = 'STUB_STDERR_SENTINEL_9f3a';

if (process.env.STUB_COUNT_FILE) {
  fs.appendFileSync(process.env.STUB_COUNT_FILE, JSON.stringify(process.argv.slice(2)) + '\n');
}

const mode = process.env.STUB_MODE || '';

if (mode === 'fail') {
  process.stderr.write(STDERR_SENTINEL + '\n');
  process.exit(1);
} else if (mode === 'garbage') {
  process.stdout.write('this is not json');
} else if (mode === 'array') {
  process.stdout.write('[]');
} else if (mode === 'slow') {
  setTimeout(() => process.stdout.write(JSON.stringify(REPORT)), 20000);
} else {
  process.stdout.write(JSON.stringify(REPORT));
}
