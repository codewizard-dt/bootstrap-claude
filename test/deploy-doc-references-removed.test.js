#!/usr/bin/env node
// Repeatable checks that every doc reference to the removed /bootstrap deploy
// feature and this repo's own removed GitHub Actions scaffolding is gone.
// Zero-dependency: node:test + node:assert + node:fs only, mirroring the
// sibling suites (cli-deploy-removed.test.js, github-actions-removed.test.js,
// docker-harness-removed.test.js).
//
// Run: npm test   (or: node --test test/deploy-doc-references-removed.test.js)
//
// Promoted from UAT-081 (TASK-081, ROADMAP-010): raw/guides/deployment-strategy.md
// was deleted via git rm, and every remaining doc reference to /bootstrap deploy,
// GitHub Actions scaffolding, and this repo's own now-removed workflows was
// stripped from lib/scripts/README.md, lib/prompts/README.md, CLAUDE.md,
// lib/scripts/sync-wiki-scaffold.sh, lib/scripts/setup-project.sh, README.md,
// and a handful of files found during the task's repo-wide sweep. This guards
// against any of it regressing back in.
//
// Deliberately narrow patterns: /deploy/i alone false-positives on ordinary
// English ("deployed into other project repositories" in
// .serena/memories/project/overview.md), so every check below matches the
// specific feature name (`setup-deployment`, `deployment-strategy`) or an
// exact removed-feature phrase (`bootstrap deploy`), never a bare "deploy".

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO, relPath), 'utf8');
}

test('raw/guides/deployment-strategy.md no longer exists', () => {
  const file = path.join(REPO, 'raw', 'guides', 'deployment-strategy.md');
  assert.strictEqual(fs.existsSync(file), false, `${file} should have been deleted`);
});

test('lib/scripts/README.md no longer references setup-deployment.sh', () => {
  const contents = read('lib/scripts/README.md');
  assert.doesNotMatch(
    contents,
    /setup-deployment/,
    'lib/scripts/README.md must not reference setup-deployment.sh anymore'
  );
});

test('lib/prompts/README.md no longer references setup-deployment.md', () => {
  const contents = read('lib/prompts/README.md');
  assert.doesNotMatch(
    contents,
    /setup-deployment/,
    'lib/prompts/README.md must not reference setup-deployment.md anymore'
  );
});

test('CLAUDE.md no longer references the deploy command, setup-deployment.sh, or deployment-strategy.md', () => {
  const contents = read('CLAUDE.md');
  assert.doesNotMatch(
    contents,
    /bootstrap deploy|setup-deployment|deployment-strategy/,
    'CLAUDE.md must not describe the removed deploy feature as if it still exists'
  );
});

test('lib/scripts/sync-wiki-scaffold.sh no longer contains legacy deployment-strategy.md migration logic', () => {
  const contents = read('lib/scripts/sync-wiki-scaffold.sh');
  assert.doesNotMatch(
    contents,
    /deployment-strategy/,
    'sync-wiki-scaffold.sh must not contain deployment-strategy.md migration logic anymore'
  );
});

test('lib/scripts/setup-project.sh no longer suggests running bootstrap deploy', () => {
  const contents = read('lib/scripts/setup-project.sh');
  assert.doesNotMatch(
    contents,
    /bootstrap deploy/,
    'setup-project.sh must not suggest running the removed deploy command'
  );
});

test('README.md no longer has a GitHub Actions Templates or CI/CD Pipeline section', () => {
  const contents = read('README.md');
  assert.doesNotMatch(
    contents,
    /GitHub Actions Templates|CI\/CD Pipeline/,
    'README.md must not describe GitHub Actions scaffolding as a current feature'
  );
});

test('README.md architecture diagram(s) no longer have DEPLOY/WORKFLOWS/GHA nodes', () => {
  const contents = read('README.md');
  assert.doesNotMatch(
    contents,
    /\bDEPLOY\b|\bWORKFLOWS\b|\bGHA\b/,
    'README.md diagrams must not reference removed DEPLOY/WORKFLOWS/GHA nodes'
  );
});

test('README.md no longer references .github/workflows/security.yml or build.yml running or existing', () => {
  const contents = read('README.md');
  assert.doesNotMatch(
    contents,
    /\.github\/workflows\/(security|build)\.yml/,
    'README.md must not claim security.yml/build.yml still run or exist'
  );
});

test('README.md no longer has a GITHUB_TOKEN row or GitHub-Actions-dependent observability/testing claims', () => {
  const contents = read('README.md');
  assert.doesNotMatch(
    contents,
    /GITHUB_TOKEN|GitHub Actions logs|Security workflow should pass/,
    'README.md must not carry GitHub-Actions-dependent env vars or operational checks'
  );
});

test('README.md states npm publish is the only release process', () => {
  const contents = read('README.md');
  assert.match(
    contents,
    /does not offer GitHub Actions scaffolding or any other CI\/CD automation as a feature/,
    'README.md must describe npm publish as the only release process'
  );
});

test('the repo-wide sweep files no longer describe the removed deploy feature as live', () => {
  const swept = [
    'lib/scripts/migrate-project.sh',
    'wiki/work/tasks/TASK-031-sandbox-tier3.md',
    'wiki/knowledge/concepts/permission-mode-control-survival.md',
    'wiki/knowledge/sources/bypass-mode-enforcement.md',
    '.serena/memories/project/overview.md',
  ];
  for (const relPath of swept) {
    const contents = read(relPath);
    assert.doesNotMatch(
      contents,
      /bootstrap deploy|setup-deployment|deployment-strategy/,
      `${relPath} must not describe the removed deploy feature as if it still exists`
    );
  }
});
