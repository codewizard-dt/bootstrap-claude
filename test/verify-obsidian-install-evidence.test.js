#!/usr/bin/env node
// Repeatable checks that TASK-058's recorded manual-verification evidence
// stays intact, and that its BUG-0011 cross-reference stays correctly wired.
// Zero-dependency: node:test + node:assert only, mirroring the sibling suites.
//
// Run: npm test   (or: node --test test/)
//
// Promoted from UAT-058 (TASK-058, ROADMAP-006 Phase 4). TASK-058 was itself a
// manual verification task — it ran lib/scripts/install-obsidian.sh against
// this repo's real vault and recorded the command, stdout, and resulting file
// tree directly in its own Notes section, then filed BUG-0011 for the
// discrepancy found (manifest.json never copied into installed plugin
// folders). There is nothing left to *re-run*: the verification already
// happened. What is worth protecting permanently is that the evidence trail
// itself does not silently rot — a future edit that strips the recorded
// command/output or de-links BUG-0011 would erase the only record that this
// verification ever took place.
//
// Static assertions only: no subprocess, no scratch dirs, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TASK = path.join(REPO, 'wiki', 'work', 'tasks', 'archive', 'TASK-058-verify-obsidian-install.md');
const BUG = path.join(REPO, 'wiki', 'work', 'bugs', 'archive', 'BUG-0011-obsidian-plugin-manifest-not-copied.md');

function taskBody() {
  return fs.readFileSync(TASK, 'utf8');
}

function bugBody() {
  return fs.readFileSync(BUG, 'utf8');
}

test('TASK-058 Notes record the exact command run and its exit code', () => {
  const body = taskBody();
  assert.match(
    body,
    /bash lib\/scripts\/install-obsidian\.sh --project-dir "\$\(pwd\)"/,
    'the recorded command line is missing or changed'
  );
  assert.match(body, /Exit code:\s*`0`/, 'the recorded exit code is missing');
});

test('TASK-058 Notes record all three plugin folders and the community-plugins.json ids', () => {
  const body = taskBody();
  for (const id of ['dataview', 'graph-link-types', 'breadcrumbs']) {
    assert.ok(
      body.includes(id),
      `expected the recorded evidence to mention plugin id "${id}"`
    );
  }
  assert.match(
    body,
    /\["dataview", "graph-link-types", "breadcrumbs"\]/,
    'the recorded community-plugins.json contents are missing or changed'
  );
});

test('TASK-058 Notes cross-reference BUG-0011 for the manifest.json discrepancy', () => {
  const body = taskBody();
  assert.match(
    body,
    /\[BUG-0011\]\(\.\.\/bugs\/BUG-0011-obsidian-plugin-manifest-not-copied\.md\)/,
    'TASK-058 no longer links BUG-0011 by its expected relative path'
  );
  assert.match(
    body,
    /manifest\.json/,
    'TASK-058 no longer mentions the manifest.json discrepancy that BUG-0011 tracks'
  );
});

test('BUG-0011 links back to TASK-058, is verified/closed with a recorded fix commit, and keeps the recorded root cause', () => {
  const body = bugBody();
  assert.match(body, /linked_task:\s*"\[\[TASK-058\]\]"/, 'BUG-0011 frontmatter no longer back-links TASK-058');
  assert.match(body, /status:\s*verified/, 'BUG-0011 status changed from verified (update this test if the outcome changed)');
  assert.match(body, /\|\s*Fix commit\s*\|\s*`[0-9a-f]{6,}`\s*\|/, 'BUG-0011 Resolution table is missing a real fix-commit SHA');
  const normalized = body.replace(/\s+/g, ' ');
  assert.ok(
    normalized.includes('deleted without ever being copied into `$plugin_dir/manifest.json`'),
    'BUG-0011 no longer documents the specific root cause (manifest_tmp discarded without copying)'
  );
});
