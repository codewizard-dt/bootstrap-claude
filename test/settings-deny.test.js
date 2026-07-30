#!/usr/bin/env node
// Repeatable checks for the canonical deny list and its merge script.
// Zero-dependency: node:test + node:assert only, matching the style of
// lib/scripts/merge-settings-deny.js and lib/scripts/wiki-dashboard-server.js.
//
// Run: npm test   (or: node --test test/)
//
// Companion to UAT-026. Everything asserted here is deterministic and file-local;
// the runtime permission-matcher checks (per-subcommand decomposition, startup
// warnings) live in wiki/work/uat/UAT-026-audit-settings-deny-list.md because
// they need a live Claude Code session.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const TEMPLATE = path.join(REPO, 'lib', 'scripts', 'templates', 'settings-deny.json');
const MERGE = path.join(REPO, 'lib', 'scripts', 'merge-settings-deny.js');

const entries = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));

// The 36 rules that shipped before TASK-026. Frozen on purpose: merge-settings-deny.js
// is additive-only with exact-string dedup, so restyling any of these would leave every
// already-installed user holding both spellings forever, with no removal path.
const LEGACY_36 = [
  'Bash(dd *)',
  'Bash(mkfs *)',
  'Bash(fdisk *)',
  'Bash(parted *)',
  'Bash(chown -R *)',
  'Bash(shutdown *)',
  'Bash(reboot *)',
  'Bash(poweroff *)',
  'Bash(init 0 *)',
  'Bash(init 6 *)',
  'Bash(kill -9 -1 *)',
  'Bash(mv ~ *)',
  'Bash(format *)',
  'Bash(diskutil eraseDisk *)',
  'Bash(diskutil eraseVolume *)',
  'Bash(diskutil partitionDisk *)',
  'Bash(diskutil secureErase *)',
  'Bash(tmutil delete *)',
  'Bash(tmutil disable *)',
  'Bash(tmutil deletelocalsnapshots *)',
  'Bash(nvram *)',
  'Bash(csrutil *)',
  'Bash(spctl *)',
  'Bash(git stash:*)',
  'Bash(git restore:*)',
  'Bash(git switch:*)',
  'Bash(git checkout:*)',
  'Bash(sudo *)',
  'Bash(tee /dev/sd*)',
  'Bash(tee /dev/disk*)',
  'Bash(git reset --hard *)',
  'Bash(git clean *)',
  'Bash(git push --force *)',
  'Bash(git push -f *)',
  'Bash(chmod -R 777 *)',
  'Bash(chmod 777 *)',
];

function runMerge(target) {
  return execFileSync(process.execPath, [MERGE, '--target', target, '--source', TEMPLATE], {
    encoding: 'utf8',
  });
}

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deny-uat-'));
}

function run(args) {
  return spawnSync(process.execPath, [MERGE, ...args], { encoding: 'utf8' });
}

function runSetKey(target, key, value) {
  return run(['--target', target, '--set-key', key, '--set-value', value]);
}

const SUGGESTION = '{"type":"command","command":"~/.claude/file-suggestion.sh"}';

test('template is a JSON array of strings', () => {
  assert.ok(Array.isArray(entries), 'template must be a bare JSON array');
  for (const e of entries) {
    assert.strictEqual(typeof e, 'string', `non-string entry: ${JSON.stringify(e)}`);
  }
});

test('the 36 legacy entries are byte-identical and still at indices 0-35', () => {
  assert.deepStrictEqual(entries.slice(0, LEGACY_36.length), LEGACY_36);
});

test('no duplicate entries', () => {
  const seen = new Set();
  const dupes = [];
  for (const e of entries) {
    if (seen.has(e)) dupes.push(e);
    seen.add(e);
  }
  assert.deepStrictEqual(dupes, [], `duplicate deny entries: ${dupes.join(', ')}`);
});

test('zero Write(...) rules — accepted but never consulted, so authoring one is a silent no-op', () => {
  const writes = entries.filter((e) => e.startsWith('Write('));
  assert.deepStrictEqual(writes, []);
});

test('tool composition is 93 Bash / 11 Edit / 12 Read, 116 total', () => {
  const by = (prefix) => entries.filter((e) => e.startsWith(prefix)).length;
  assert.strictEqual(entries.length, 116, 'total entry count');
  assert.strictEqual(by('Bash('), 93, 'Bash entries');
  assert.strictEqual(by('Edit('), 11, 'Edit entries');
  assert.strictEqual(by('Read('), 12, 'Read entries');
  assert.strictEqual(by('Bash(') + by('Edit(') + by('Read('), entries.length, 'unexpected tool prefix present');
});

// ~/.claude/settings*.json protection deliberately lives in TASK-027's claude-settings-guard.js
// hook, NOT here. This repo manages those settings itself (install-global.sh + merge-settings-deny.js),
// so the guard must allow the edit inside a bootstrap-claude checkout and block it everywhere else —
// an exception a deny rule cannot express, since deny beats allow at every scope and a hook cannot
// loosen a deny. Re-adding these entries would silently disable the hook's carve-out.
test('no ~/.claude/settings*.json deny entry — that protection is the settings-guard hook', () => {
  const settingsRules = entries.filter((e) => e.includes('.claude/settings'));
  assert.deepStrictEqual(settingsRules, []);
});

// The hooks lock has no such exception: even inside this repo the canonical flow is to edit
// lib/hooks/ and re-run install-global.sh, so editing the installed copy is always wrong.
test('~/.claude/hooks/** stays denied — no bootstrap-claude exception applies there', () => {
  assert.ok(entries.includes('Edit(~/.claude/hooks/**)'), 'global hooks lock missing');
  assert.ok(entries.includes('Edit(**/.claude/hooks/**)'), 'project hooks lock missing');
});

test('file-tool rules anchor at ~/ or **/ — a single leading slash would resolve under ~/.claude/', () => {
  const fileRules = entries.filter((e) => e.startsWith('Edit(') || e.startsWith('Read('));
  const bad = fileRules.filter((e) => /^(Edit|Read)\(\/[^/]/.test(e));
  assert.deepStrictEqual(bad, [], `settings-source-relative path rules: ${bad.join(', ')}`);
});

test('no fetcher or package-installer rules — restricting internet access is an explicit non-goal', () => {
  // uvx --from git+... (bootstrap-serena.sh:35) and npm install -g @playwright/mcp@latest
  // (install-mcps.sh:197) must survive; deny cannot carry an allowlist exception, so the
  // only safe form is no rule at all. Registry-install consent is a permissions.ask follow-on.
  const forbidden = /\b(curl|wget|uvx|npx|pip3?\s+install|npm\s+install|cargo\s+install|docker)\b/;
  const hits = entries.filter((e) => e.startsWith('Bash(') && forbidden.test(e));
  assert.deepStrictEqual(hits, [], `fetcher/installer rules must not be present: ${hits.join(', ')}`);
});

test('bare-interpreter rules carry no wildcard, so they cannot prefix-match real invocations', () => {
  // Bash(python3) must not swallow `python3 -m pytest`; Bash(node) must not swallow
  // `node script.js`. A trailing * or :* on any of these would be that regression.
  for (const cmd of ['sh', 'bash', 'zsh', 'python', 'python3', 'node', 'ruby', 'perl']) {
    assert.ok(entries.includes(`Bash(${cmd})`), `missing bare-interpreter rule Bash(${cmd})`);
    const widened = entries.filter((e) => e === `Bash(${cmd} *)` || e === `Bash(${cmd}:*)` || e === `Bash(${cmd}*)`);
    assert.deepStrictEqual(widened, [], `widened interpreter rule would break normal invocations: ${widened.join(', ')}`);
  }
});

test('merge appends canonical entries and preserves user entries, order, and other keys', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const before = {
    model: 'opusplan',
    permissions: {
      allow: ['Bash(ls:*)'],
      deny: ['Bash(my-own-rule *)', 'Bash(sudo *)'],
    },
    env: { FOO: 'bar' },
  };
  fs.writeFileSync(target, JSON.stringify(before, null, 2) + '\n');

  runMerge(target);
  const after = JSON.parse(fs.readFileSync(target, 'utf8'));

  assert.strictEqual(after.model, 'opusplan', 'unrelated key dropped');
  assert.deepStrictEqual(after.env, { FOO: 'bar' }, 'unrelated key mutated');
  assert.deepStrictEqual(after.permissions.allow, ['Bash(ls:*)'], 'allow list mutated');

  // User entries survive, in position, and are not deduplicated against the canonical list.
  assert.strictEqual(after.permissions.deny[0], 'Bash(my-own-rule *)');
  assert.strictEqual(after.permissions.deny[1], 'Bash(sudo *)');

  // Every canonical entry present exactly once; the pre-existing 'Bash(sudo *)' was not re-added.
  for (const e of entries) {
    const count = after.permissions.deny.filter((x) => x === e).length;
    assert.strictEqual(count, 1, `entry appears ${count} times: ${e}`);
  }
  assert.strictEqual(after.permissions.deny.length, entries.length + 1, 'user-only entry count');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge is idempotent — a second run adds nothing and creates no duplicates', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify({ permissions: { deny: [] } }, null, 2) + '\n');

  runMerge(target);
  const first = fs.readFileSync(target, 'utf8');

  const out = runMerge(target);
  const second = fs.readFileSync(target, 'utf8');

  assert.match(out, /already up to date/);
  assert.strictEqual(second, first, 'second merge rewrote the file');
  assert.strictEqual(JSON.parse(second).permissions.deny.length, entries.length);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge creates a valid settings file when the target does not exist', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'nested', 'settings.json');

  const out = runMerge(target);
  assert.match(out, /created with \d+ deny entries/);

  const created = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepStrictEqual(created.permissions.deny, entries);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge leaves a malformed target untouched and still exits 0', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const garbage = '{ this is not json ';
  fs.writeFileSync(target, garbage);

  const out = execFileSync(process.execPath, [MERGE, '--target', target, '--source', TEMPLATE], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.strictEqual(fs.readFileSync(target, 'utf8'), garbage, 'malformed target was modified');
  assert.strictEqual(typeof out, 'string');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('merge skips when permissions.deny is not an array, leaving the file untouched', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const original = JSON.stringify({ permissions: { deny: 'nope' } }, null, 2) + '\n';
  fs.writeFileSync(target, original);

  execFileSync(process.execPath, [MERGE, '--target', target, '--source', TEMPLATE], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.strictEqual(fs.readFileSync(target, 'utf8'), original);

  fs.rmSync(dir, { recursive: true, force: true });
});

// --- --set-key mode (TASK-029) ------------------------------------------------
// A separate operation from the deny merge, invoked separately by install-global.sh.
// Same fail-safe contract on the target file; usage errors, by contrast, are loud.

test('--set-key sets an absent key, preserves other keys and the file indentation', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify({ model: 'opusplan', env: { FOO: 'bar' } }, null, 4) + '\n');

  const res = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /"fileSuggestion" set/);

  const text = fs.readFileSync(target, 'utf8');
  assert.match(text, /\n {4}"model"/, 'indentation not preserved');

  const after = JSON.parse(text);
  assert.deepStrictEqual(after.fileSuggestion, JSON.parse(SUGGESTION));
  assert.strictEqual(after.model, 'opusplan');
  assert.deepStrictEqual(after.env, { FOO: 'bar' });

  fs.rmSync(dir, { recursive: true, force: true });
});

test('--set-key creates the settings file when the target does not exist', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'nested', 'settings.json');

  const res = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(target, 'utf8')), {
    fileSuggestion: JSON.parse(SUGGESTION),
  });

  fs.rmSync(dir, { recursive: true, force: true });
});

test('--set-key no-ops on a deep-equal value even when key order differs', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  // Keys deliberately in the opposite order from SUGGESTION: a JSON.stringify
  // comparison would call this "different" and skip a legitimate no-op.
  const original =
    JSON.stringify(
      { fileSuggestion: { command: '~/.claude/file-suggestion.sh', type: 'command' } },
      null,
      2
    ) + '\n';
  fs.writeFileSync(target, original);

  const res = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /already set/);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), original, 'no-op rewrote the file');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('--set-key warns and changes nothing when the key holds a different value', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const original =
    JSON.stringify({ fileSuggestion: { type: 'command', command: '~/mine.sh' } }, null, 2) + '\n';
  fs.writeFileSync(target, original);

  const res = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(res.status, 0, 'must exit 0 — install-global.sh runs under set -e');
  assert.match(res.stderr, /already defines "fileSuggestion"/);
  assert.match(res.stderr, /file-suggestion\.sh/, 'warning must name the skipped value');
  assert.strictEqual(res.stderr.trim().split('\n').length, 1, 'warning must be one line');
  assert.strictEqual(fs.readFileSync(target, 'utf8'), original, 'existing value was clobbered');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('--set-key leaves a malformed target untouched and still exits 0', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const garbage = '{ this is not json ';
  fs.writeFileSync(target, garbage);

  const res = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(res.status, 0);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), garbage, 'malformed target was modified');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('a malformed --set-value is a usage error: non-zero exit, nothing written', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const original = JSON.stringify({ model: 'opusplan' }, null, 2) + '\n';
  fs.writeFileSync(target, original);

  const res = runSetKey(target, 'fileSuggestion', '{not json');
  assert.notStrictEqual(res.status, 0, 'garbage --set-value must fail loudly');
  assert.match(res.stderr, /not valid JSON/);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), original);

  const missing = run(['--target', target, '--set-key', 'fileSuggestion']);
  assert.notStrictEqual(missing.status, 0, '--set-key without --set-value must fail loudly');
  assert.strictEqual(fs.readFileSync(target, 'utf8'), original);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('--set-key does not run the deny merge — the two operations are independent', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify({ model: 'opusplan' }, null, 2) + '\n');

  const res = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(res.status, 0, res.stderr);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.strictEqual('permissions' in after, false, 'deny merge ran in --set-key mode');

  fs.rmSync(dir, { recursive: true, force: true });
});

// install-global.sh writes to the SAME settings.json twice in a row: the deny merge
// (step 4), then the fileSuggestion registration (step 5). Each run re-reads and
// re-serialises the whole file, so a bug in either could silently drop the other's
// work. Neither single-mode test above can see that; this one runs both in order.
test('install order — the deny merge then --set-key: both survive, in one file', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify({ model: 'opusplan' }, null, 2) + '\n');

  const deny = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(deny.status, 0, deny.stderr);

  const key = runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(key.status, 0, key.stderr);
  assert.match(key.stdout, /"fileSuggestion" set/);

  const after = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepStrictEqual(after.permissions.deny, entries, 'registering fileSuggestion dropped deny entries');
  assert.strictEqual(after.permissions.deny.length, 116, 'deny entry count changed');
  assert.deepStrictEqual(after.fileSuggestion, JSON.parse(SUGGESTION));
  assert.strictEqual(after.model, 'opusplan', 'unrelated key lost across the two writes');

  // And re-running the whole install is a no-op on both halves.
  const before = fs.readFileSync(target, 'utf8');
  run(['--target', target, '--source', TEMPLATE]);
  runSetKey(target, 'fileSuggestion', SUGGESTION);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), before, 'a second install rewrote the file');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('default deny merge is unchanged by --set-key mode: no flags still merges, preserving tabs', () => {
  const dir = scratchDir();
  const target = path.join(dir, 'settings.json');
  const before = { model: 'opusplan', permissions: { deny: ['Bash(my-own-rule *)'] } };
  fs.writeFileSync(target, JSON.stringify(before, null, '\t') + '\n');

  const res = run(['--target', target, '--source', TEMPLATE]);
  assert.strictEqual(res.status, 0, res.stderr);
  assert.match(res.stdout, /deny entries merged|deny entr(y|ies) merged/);

  const text = fs.readFileSync(target, 'utf8');
  assert.match(text, /\n\t"model"/, 'tab indentation not preserved');

  const after = JSON.parse(text);
  assert.strictEqual(after.model, 'opusplan');
  assert.strictEqual(after.permissions.deny[0], 'Bash(my-own-rule *)');
  assert.deepStrictEqual(after.permissions.deny.slice(1), entries, 'canonical list not appended verbatim');
  assert.strictEqual('fileSuggestion' in after, false, 'set-key path leaked into the default merge');

  fs.rmSync(dir, { recursive: true, force: true });
});
