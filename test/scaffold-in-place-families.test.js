#!/usr/bin/env node
// Scaffold contract for TASK-0121: roadmaps, decisions and requirements no longer
// carry an archive/ directory; tasks, uat and bugs still do.
//
// Run: npm test   (or: node --test test/scaffold-in-place-families.test.js)
//
// WHY THIS IS TESTED AT ALL. sync-wiki-scaffold.sh has no per-family archive
// logic: it `mkdir -p`s the six family dirs and copies lib/scripts/templates/wiki/
// with `rsync --ignore-existing`. The archive/ dirs therefore come SOLELY from the
// template tree, and TASK-0121 deleted the three in-place families' template
// archive/ dirs. This suite pins the observable result against the REAL script:
// (1) a fresh scaffold creates no archive/ for the in-place families and does
// create archive/index.md for tasks/uat/bugs, (2) a legacy archive/ already in the
// target (un-migrated project, TASK-0123 territory) survives a re-scaffold
// untouched, (3) the three index templates carry `## Active` and `## Closed`.
//
// HERMETIC: runs the real script against scratch temp dirs with a curated env
// (scratch HOME, no BOOTSTRAP_ASSUME_TTY, no --interactive) so no prompt is
// reachable and nothing outside the scratch dirs is written. Never touches the
// real ~/.claude or this checkout.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SYNC_SCAFFOLD = path.join(REPO, 'lib', 'scripts', 'sync-wiki-scaffold.sh');
const TEMPLATE_WORK = path.join(REPO, 'lib', 'scripts', 'templates', 'wiki', 'work');

const IN_PLACE = ['roadmaps', 'decisions', 'requirements'];
const ARCHIVING = ['tasks', 'uat', 'bugs'];

function scratch(prefix) {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function withScratch(body) {
  const home = scratch('in-place-scaffold-home-');
  const projectDir = scratch('in-place-scaffold-project-');
  try {
    return body({ home, projectDir });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

function runScaffold({ home, projectDir }) {
  const env = { HOME: home, PATH: process.env.PATH };
  for (const k of ['TMPDIR', 'LANG', 'LC_ALL']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  const r = spawnSync('bash', [SYNC_SCAFFOLD, projectDir], {
    encoding: 'utf8',
    env,
    cwd: home,
    input: '',
  });
  assert.equal(r.status, 0, `scaffold failed:\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  return r;
}

const work = (projectDir, ...p) => path.join(projectDir, 'wiki', 'work', ...p);

test('fresh scaffold creates no archive/ for roadmaps, decisions, requirements', () => {
  withScratch((S) => {
    runScaffold(S);
    for (const fam of IN_PLACE) {
      assert.ok(fs.existsSync(work(S.projectDir, fam)), `${fam}/ family dir missing`);
      assert.ok(!fs.existsSync(work(S.projectDir, fam, 'archive')), `wiki/work/${fam}/archive must not be scaffolded`);
    }
  });
});

test('fresh scaffold still creates archive/index.md for tasks, uat, bugs', () => {
  withScratch((S) => {
    runScaffold(S);
    for (const fam of ARCHIVING) {
      assert.ok(
        fs.existsSync(work(S.projectDir, fam, 'archive', 'index.md')),
        `wiki/work/${fam}/archive/index.md must be scaffolded`
      );
    }
  });
});

test('fresh scaffold delivers Active + Closed family indexes for the in-place families', () => {
  withScratch((S) => {
    runScaffold(S);
    for (const fam of IN_PLACE) {
      const text = fs.readFileSync(work(S.projectDir, fam, 'index.md'), 'utf8');
      assert.match(text, /^## Active\s*$/m, `${fam}/index.md missing ## Active`);
      assert.match(text, /^## Closed\s*$/m, `${fam}/index.md missing ## Closed`);
    }
  });
});

test('a legacy decisions/archive/x.md already in the target survives a second scaffold run untouched', () => {
  withScratch((S) => {
    const legacyDir = work(S.projectDir, 'decisions', 'archive');
    fs.mkdirSync(legacyDir, { recursive: true });
    const legacyFile = path.join(legacyDir, 'x.md');
    const body = '---\nid: DEC-0001\n---\n\n# legacy archived decision\n';
    fs.writeFileSync(legacyFile, body);

    runScaffold(S);
    assert.equal(fs.readFileSync(legacyFile, 'utf8'), body, 'first scaffold run altered the legacy archived file');
    const mtime = fs.statSync(legacyFile).mtimeMs;

    runScaffold(S);
    assert.equal(fs.readFileSync(legacyFile, 'utf8'), body, 'second scaffold run altered the legacy archived file');
    assert.equal(fs.statSync(legacyFile).mtimeMs, mtime, 'second scaffold run rewrote the legacy archived file');
    assert.deepEqual(fs.readdirSync(legacyDir), ['x.md'], 'scaffold added or removed files in the legacy archive/');
  });
});

test('a second scaffold run does not create archive/ for the in-place families either', () => {
  withScratch((S) => {
    runScaffold(S);
    runScaffold(S);
    for (const fam of IN_PLACE) {
      assert.ok(!fs.existsSync(work(S.projectDir, fam, 'archive')), `wiki/work/${fam}/archive appeared on re-run`);
    }
  });
});

for (const fam of IN_PLACE) {
  test(`template ${fam}/index.md contains both ## Active and ## Closed, and the template tree has no ${fam}/archive`, () => {
    const text = fs.readFileSync(path.join(TEMPLATE_WORK, fam, 'index.md'), 'utf8');
    assert.match(text, /^## Active\s*$/m, 'template index missing ## Active');
    assert.match(text, /^## Closed\s*$/m, 'template index missing ## Closed');
    assert.ok(
      text.search(/^## Active\s*$/m) < text.search(/^## Closed\s*$/m),
      '## Active must precede ## Closed'
    );
    assert.ok(!fs.existsSync(path.join(TEMPLATE_WORK, fam, 'archive')), `template ${fam}/archive/ must be deleted`);
  });
}

for (const fam of ARCHIVING) {
  test(`template ${fam}/archive/index.md is still present`, () => {
    assert.ok(fs.existsSync(path.join(TEMPLATE_WORK, fam, 'archive', 'index.md')));
  });
}
