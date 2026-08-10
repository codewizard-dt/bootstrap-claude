#!/usr/bin/env node
// Repeatable checks that lib/scripts/README.md's preference documentation still
// matches lib/scripts/templates/bootstrap-prefs-schema.json.
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/)
//
// Promoted from UAT-050 (TASK-050, ROADMAP-005 Phase 4). TASK-050 added a
// 19-row key registry to lib/scripts/README.md, transcribed by hand from the
// schema. Its own step 8 states the risk plainly: "A drifted doc table is worse
// than none: it is the surface a reader trusts instead of opening the JSON."
// Nothing else in the suite reads the README, so a key added, renamed, or
// re-valued in the schema leaves the table silently stale — the failure mode is
// a confidently wrong document, which is why this is worth a permanent test
// rather than a one-off UAT check.
//
// Static assertions only: no subprocess, no scratch dirs, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const README = path.join(REPO, 'lib', 'scripts', 'README.md');
const SCHEMA = path.join(REPO, 'lib', 'scripts', 'templates', 'bootstrap-prefs-schema.json');

const BACKTICK = String.fromCharCode(96);

function readmeLines() {
  return fs.readFileSync(README, 'utf8').split('\n');
}

function schema() {
  return JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
}

// Split a markdown row on its REAL cell boundaries. An escaped pipe (`\|`) is
// content, not a boundary — nearly every `values` string contains one, and
// splitting naively on `|` silently shreds those rows into extra cells.
function cellsOf(row) {
  const SENTINEL = '';
  return row
    .replace(/\\\|/g, SENTINEL)
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim().split(SENTINEL).join('|'));
}

// Strip markdown code formatting: the README backticks values, paths, and
// filenames that the schema stores bare.
function unCode(s) {
  return s.split(BACKTICK).join('').trim();
}

// Prose comparison modulo code formatting. Backticks AND straight single quotes
// are dropped because the README renders as `update` what the schema writes as
// 'update' — the same word, quoted for a different medium. Everything else is
// compared literally, so a genuinely reworded summary still fails.
function prose(s) {
  return s
    .split(BACKTICK)
    .join('')
    .split("'")
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// How the registry renders a schema `default`. `null` means "no default", which
// the four-state model spells `unset`.
function renderedDefault(value) {
  return value === null ? 'unset' : String(value);
}

// Collect the rows of the first markdown table following a heading matched by
// `headingRe`, returning the parsed cells plus the raw line for cell-count
// diagnostics.
function registryRows(headingRe) {
  const lines = readmeLines();
  const start = lines.findIndex((l) => l.startsWith('####') && headingRe.test(l));
  assert.ok(start >= 0, `registry heading ${headingRe} is missing from lib/scripts/README.md`);

  const rows = [];
  let seenTable = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('|')) {
      seenTable = true;
      // Skip the header row and the |---|---| separator.
      if (/^\|\s*Key\s*\|/.test(line)) continue;
      if (/^\|[\s|:-]+\|$/.test(line)) continue;
      rows.push({ line, cells: cellsOf(line) });
      continue;
    }
    if (seenTable && line.trim() === '') break;
    if (line.startsWith('#')) break;
  }
  assert.ok(rows.length > 0, `no table rows found under ${headingRe}`);
  return rows;
}

function installerRows() {
  return registryRows(/consumer:\s*installer/);
}

function skillRows() {
  return registryRows(/consumer:\s*skill/);
}

// The key cell is the first backticked token; pattern rows additionally carry a
// bold **(pattern)** marker after it.
function keyOf(cells) {
  const m = cells[0].match(new RegExp(BACKTICK + '([^' + BACKTICK + ']+)' + BACKTICK));
  assert.ok(m, `could not read a key out of registry cell: ${cells[0]}`);
  return m[1];
}

test('registry: the two tables together cover every schema key exactly once', () => {
  // BOTH DIRECTIONS. A key added to the schema and not to the table is the
  // common drift; a key deleted from the schema but left in the table is the
  // one that actively misinforms, because the reader has no reason to doubt it.
  const s = schema();
  const documented = [...installerRows(), ...skillRows()].map((r) => keyOf(r.cells));

  const dupes = documented.filter((k, i) => documented.indexOf(k) !== i);
  assert.deepStrictEqual(dupes, [], `key documented more than once in the registry: ${dupes.join(', ')}`);

  assert.deepStrictEqual(
    documented.slice().sort(),
    Object.keys(s).sort(),
    'the registry table and the schema disagree on which keys exist'
  );
});

test('registry: the row counts in the section headings match the schema populations', () => {
  // The headings assert their own counts in prose ("all 19 entries", "14
  // entries", "5 entries"). A reader trusts those numbers to know the table is
  // complete, so they have to be derived facts, not decoration.
  const s = schema();
  const entries = Object.entries(s);
  const installer = entries.filter(([, e]) => e.consumer === 'installer');
  const skill = entries.filter(([, e]) => e.consumer === 'skill');

  assert.strictEqual(installerRows().length, installer.length, 'installer table row count != schema installer keys');
  assert.strictEqual(skillRows().length, skill.length, 'skill table row count != schema skill keys');

  const lines = readmeLines();
  // `level` matters: "consumer: skill" also appears in the ### prose heading
  // that explains the askedBy decision, which carries no count.
  const headingCount = (level, re) => {
    const line = lines.find((l) => l.startsWith(level + ' ') && re.test(l));
    assert.ok(line, `heading ${re} is missing`);
    const m = line.match(/(\d+)\s+entries/);
    assert.ok(m, `heading has no "<N> entries" claim: ${line}`);
    return Number(m[1]);
  };

  assert.strictEqual(
    headingCount('###', /The key registry/),
    entries.length,
    'the registry heading claims the wrong total'
  );
  assert.strictEqual(
    headingCount('####', /consumer:\s*installer/),
    installer.length,
    'installer heading count is wrong'
  );
  assert.strictEqual(headingCount('####', /consumer:\s*skill/), skill.length, 'skill heading count is wrong');
});

test('registry: every row matches its schema entry field-for-field', () => {
  const s = schema();
  const grouped = [
    ['installer', installerRows()],
    ['skill', skillRows()],
  ];

  let checked = 0;
  for (const [expectedConsumer, rows] of grouped) {
    for (const { cells } of rows) {
      const key = keyOf(cells);
      const entry = s[key];
      assert.ok(entry, `registry documents ${key}, which is not in the schema`);

      const [, scope, consumer, values, dflt, askedBy, summary] = cells;

      assert.strictEqual(unCode(scope), entry.scope, `${key}: Scope column`);
      assert.strictEqual(unCode(consumer), entry.consumer, `${key}: Consumer column`);
      // Grouping is load-bearing: --list and the generated companion group by
      // consumer in this same order, so a row filed under the wrong heading
      // makes three surfaces disagree.
      assert.strictEqual(entry.consumer, expectedConsumer, `${key}: filed under the ${expectedConsumer} heading`);
      assert.strictEqual(unCode(values), entry.values, `${key}: Values column`);
      assert.strictEqual(unCode(dflt), renderedDefault(entry.default), `${key}: Default column`);
      assert.strictEqual(unCode(askedBy), entry.askedBy, `${key}: Asked by column`);
      assert.strictEqual(prose(summary), prose(entry.summary), `${key}: "What it does" column`);
      checked += 1;
    }
  }

  assert.strictEqual(checked, Object.keys(s).length, 'not every schema key was checked');
});

test('registry: every row renders as exactly seven cells, so no `values` pipe leaked', () => {
  // THE DEFECT THIS TABLE IS MOST LIKELY TO HAVE. Nearly every `values` string
  // contains a literal `|`; unescaped, it terminates the cell and the row
  // renders with the wrong number of columns — every later column shifted by
  // one, which reads as plausible nonsense rather than as breakage.
  const broken = [...installerRows(), ...skillRows()]
    .filter(({ cells }) => cells.length !== 7)
    .map(({ cells, line }) => `${cells.length} cells: ${line.trim()}`);

  assert.deepStrictEqual(broken, [], 'registry row does not render as 7 cells — an unescaped pipe');
});

test('registry: the two `dynamic` schema keys are marked as patterns, and only those two', () => {
  // A pattern row is a key FAMILY, not a key. Left unmarked, a reader would
  // reasonably try `--set guides.*` and get nothing useful.
  const s = schema();
  const marked = [...installerRows(), ...skillRows()]
    .filter(({ cells }) => /\(pattern\)/.test(cells[0]))
    .map(({ cells }) => keyOf(cells))
    .sort();
  const dynamic = Object.entries(s)
    .filter(([, e]) => e.dynamic === true)
    .map(([k]) => k)
    .sort();

  assert.deepStrictEqual(marked, dynamic, 'the (pattern) markers and the schema `dynamic: true` keys disagree');
});

test('lib/scripts/README.md no longer carries the two pre-ROADMAP-005 stale claims', () => {
  // Both were load-bearing claims a reader would act on: the helper was
  // described as unbuilt long after it shipped, and the file said the per-key
  // table did not exist in it — which is the table above.
  const text = fs.readFileSync(README, 'utf8');
  assert.ok(!text.includes('not built yet'), 'the "(not built yet)" claim about bootstrap-prefs.js is back');
  assert.ok(
    !/is not in this file yet/.test(text),
    'the "the table of what each key does is not in this file yet" claim is back'
  );
});
