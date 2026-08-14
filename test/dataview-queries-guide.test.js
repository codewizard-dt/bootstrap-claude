#!/usr/bin/env node
// Repeatable checks that raw/guides/dataview-queries.md and its dogfooded
// copy wiki/guides/dataview-queries.md stay in sync and keep the content
// TASK-056 requires.
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/)
//
// Promoted from UAT-056 (TASK-056). The task's Approach section is explicit
// that this repo dogfoods its own raw/ -> wiki/ copy-once guide pattern
// ("create the master copy at raw/guides/..., then copy it once into this
// repo's own wiki/guides/..."). Nothing else in the suite reads either file,
// so a future edit to one copy without the other — or a silent drop of one
// of the three required example query blocks or the "illustrative only"
// caveat — would only be caught by a human re-reading prose. That is exactly
// the drift class this suite exists to make cheap and repeatable instead.
//
// Static assertions only: no subprocess, no scratch dirs, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const RAW_GUIDE = path.join(REPO, 'raw', 'guides', 'dataview-queries.md');
const WIKI_GUIDE = path.join(REPO, 'wiki', 'guides', 'dataview-queries.md');

function readRaw() {
  return fs.readFileSync(RAW_GUIDE, 'utf8');
}

function readWiki() {
  return fs.readFileSync(WIKI_GUIDE, 'utf8');
}

test('raw/guides/dataview-queries.md exists', () => {
  assert.ok(fs.existsSync(RAW_GUIDE), `expected ${RAW_GUIDE} to exist`);
});

test('wiki/guides/dataview-queries.md exists', () => {
  assert.ok(fs.existsSync(WIKI_GUIDE), `expected ${WIKI_GUIDE} to exist`);
});

test('raw and wiki copies are byte-identical (copy-once pattern)', () => {
  assert.strictEqual(
    readWiki(),
    readRaw(),
    'wiki/guides/dataview-queries.md has drifted from raw/guides/dataview-queries.md — ' +
      'the copy-once pattern requires them to stay byte-identical'
  );
});

test('contains a TABLE query over wiki/work/tasks grouped/sorted by status', () => {
  const body = readRaw();
  assert.match(body, /```dataview\s*\nTABLE status\s*\nFROM "wiki\/work\/tasks"\s*\nSORT status\s*\n```/);
});

test('contains a LIST query surfacing pages with a contradicts:: typed link', () => {
  const body = readRaw();
  assert.match(
    body,
    /```dataview\s*\nLIST\s*\nFROM "wiki"\s*\nWHERE contains\(file\.text, "contradicts::"\)\s*\n```/
  );
});

test('contains a TABLE query over wiki/knowledge/entities/tools grouped/filtered by tags', () => {
  const body = readRaw();
  assert.match(
    body,
    /```dataview\s*\nTABLE tags\s*\nFROM "wiki\/knowledge\/entities\/tools"\s*\nSORT file\.name\s*\n```/
  );
});

test('every example query block is followed by an "Illustrative only" caveat', () => {
  const body = readRaw();
  const matches = body.match(/Illustrative only/g) || [];
  assert.strictEqual(
    matches.length,
    3,
    `expected 3 "Illustrative only" caveats (one per example query), found ${matches.length}`
  );
});

test('caveat points back to the canonical hand/LLM-maintained index.md convention', () => {
  const body = readRaw();
  assert.match(body, /wiki\/conventions\.md/);
  assert.match(body, /Maps-of-Content convention/);
});
