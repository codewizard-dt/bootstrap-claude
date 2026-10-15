#!/usr/bin/env node
// Contract checks for the /usage-report skill (TASK-0108): the offline
// transcript parser lib/skills/usage-report/scripts/usage-report.js and the
// SKILL.md that wraps it.
// Zero-dependency: node:test + node:assert only, mirroring the sibling
// skill-content suites (test/task-typed-links.test.js).
//
// Run: npm test   (or: node --test test/usage-report.test.js)
//
// WHY THIS IS TESTED AT ALL. The script's JSON output is a stable contract
// (schemaVersion 1) that TASK-0109 consumes, and its counting rules are easy to
// get silently wrong: streaming writes the same API response several times,
// fork context copies it across files, "<synthetic>" rows and malformed lines
// must not count, and per-skill attribution follows a last-invoked-skill
// timeline shared with subagents. Each rule is pinned against a tiny synthetic
// fixture whose sums are hand-computed below.
//
// SCOPE - the script's exported pure functions, its CLI (spawned for realism:
// exit codes and stdout JSON), and the SKILL.md frontmatter/path contract.
//
// HERMETIC: reads only test/fixtures/usage-report/** (obviously fake ids and
// text, no real transcript content) via the env overrides
// USAGE_REPORT_PROJECTS_DIR and USAGE_REPORT_SKILLS_DIR. Never touches
// ~/.claude. The only writes are empty directories under os.tmpdir(), removed
// afterwards.
//
// FIXTURE (projects/-tmp-fixture-proj, i.e. project path /tmp/fixture-proj):
//   sess-0001.jsonl                 main session
//   sess-0001/subagents/agent-abc.jsonl   subagent (its entries carry a
//                                   DIFFERENT sessionId, "sess-9999", to prove
//                                   attribution uses the parent directory)
//   skills/alpha (model: claude-sonnet-5), skills/beta (model: claude-haiku-4-5-20251001)
//
// Counted turns after dedupe (rates USD/MTok from pricing.json):
//   id     model               in    out  cacheW  cacheR  day    skill   cost
//   msg_1  claude-sonnet-5     1000  100  0       0       01-01  (none)  0.003
//          (streamed twice: first copy out=50, last copy out=100 wins)
//   msg_2  claude-sonnet-5     2000  200  1000    10000   01-01  alpha   0.01125
//          (cacheW = 500 @5m 2.5 + 500 @1h 4.0; slash-command invocation)
//   msg_4  claude-haiku-4-5    1000  200  0       0       01-01  beta    0.002
//          (also copied into the subagent file: cross-file duplicate)
//   msg_5  claude-unknown-9    500   50   0       0       01-01  beta    null
//   msg_s1 claude-haiku-4-5    3000  300  0       0       01-01  beta    0.0045
//          (subagent turn, attributed via the PARENT session timeline)
//   msg_6  claude-opus-5       1000  100  0       0       01-02  beta    0.0075
//   beta is invoked by a Skill tool_use on a usage-less entry (msg_tu), so no
//   turn is ambiguous about being credited to the skill it invoked.
// Excluded: msg_syn ("<synthetic>", 999999 tokens), the cost-state row
// (cumulative modelUsage), a quoted "/gamma" inside an array-content user
// message (tool result, not a slash command), the fork-context-ref row, and
// one malformed line (meta.skippedLines === 1).
// Sums: input 8500, output 950, cacheCreation 1000, cacheRead 10000, turns 6,
//   cost 0.02825 (0.003 + 0.01125 + 0.002 + 0.0045 + 0.0075).
//   byModel: sonnet-5 {turns 2, in 3000, out 300, cost 0.01425};
//            opus-5 {1, 1000, 100, 0.0075}; haiku-4-5 {2, 4000, 500, 0.0065};
//            claude-unknown-9 {1, 500, 50, null} (sorted last).
//   bySkill: beta {4, in 5500, out 650, cost 0.014}; alpha {1, 2000, 200,
//            0.01125}; (none) {1, 1000, 100, 0.003}.
//   byDay:   2026-01-01 {turns 5, cost 0.02075}; 2026-01-02 {1, 0.0075}.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'lib', 'skills', 'usage-report', 'scripts', 'usage-report.js');
const PRICING = path.join(REPO, 'lib', 'skills', 'usage-report', 'scripts', 'pricing.json');
const SKILL_MD = path.join(REPO, 'lib', 'skills', 'usage-report', 'SKILL.md');
const FIXTURE = path.join(__dirname, 'fixtures', 'usage-report');
const PROJECTS_DIR = path.join(FIXTURE, 'projects');
const SKILLS_DIR = path.join(FIXTURE, 'skills');
const FIXTURE_PROJECT = '/tmp/fixture-proj';
const MAIN_FILE = path.join(PROJECTS_DIR, '-tmp-fixture-proj', 'sess-0001.jsonl');

const lib = require(SCRIPT);

function closeTo(actual, expected, msg) {
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) < 1e-9,
    `${msg || 'value'}: expected ${expected}, got ${actual}`,
  );
}

function run(args, envOverrides) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: {
      ...process.env,
      USAGE_REPORT_PROJECTS_DIR: PROJECTS_DIR,
      USAGE_REPORT_SKILLS_DIR: SKILLS_DIR,
      ...envOverrides,
    },
  });
  return res;
}

function runJson(args, envOverrides) {
  const res = run(args, envOverrides);
  assert.equal(res.status, 0, `exit ${res.status}; stderr: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function findBy(rows, key, value) {
  const row = rows.find((r) => r[key] === value);
  assert.ok(row, `no row with ${key}=${value}`);
  return row;
}

test('encodeProjectDir replaces every non-alphanumeric char with "-"', () => {
  assert.equal(lib.encodeProjectDir('/Users/a.b/c_d'), '-Users-a-b-c-d');
  assert.equal(lib.encodeProjectDir('/tmp/fixture-proj'), '-tmp-fixture-proj');
  assert.equal(lib.encodeProjectDir('/Users/x/.claude'), '-Users-x--claude');
});

test('listTranscripts finds the main and subagent JSONL files', () => {
  const files = lib.listTranscripts(path.join(PROJECTS_DIR, '-tmp-fixture-proj'));
  assert.equal(files.length, 2);
  assert.ok(files.some((f) => f.endsWith(path.join('sess-0001.jsonl'))));
  assert.ok(files.some((f) => f.endsWith(path.join('subagents', 'agent-abc.jsonl'))));
  assert.deepEqual(lib.listTranscripts(path.join(os.tmpdir(), 'usage-report-does-not-exist')), []);
});

test('parseTranscript skips the malformed line and the <synthetic> entry', async () => {
  const parsed = await lib.parseTranscript(MAIN_FILE);
  assert.equal(parsed.skipped, 1, 'exactly one malformed line');
  assert.ok(!parsed.records.some((r) => r.model === '<synthetic>'));
  assert.ok(!parsed.records.some((r) => r.id === 'msg_syn'));
  // msg_1 (x2 streamed), msg_2, msg_4, msg_5, msg_6; msg_tu has no usage.
  assert.equal(parsed.records.length, 6);
  assert.equal(parsed.records.filter((r) => r.id === 'msg_1').length, 2);
});

test('parseTranscript detects Skill tool_use and slash-command events, not quoted ones', async () => {
  const parsed = await lib.parseTranscript(MAIN_FILE);
  const skills = parsed.events.map((e) => e.skill).sort();
  assert.deepEqual(skills, ['alpha', 'beta']);
  assert.ok(!skills.includes('gamma'), 'array-content (tool result) match must be ignored');
});

test('dedupe collapses the streaming duplicate and the last copy wins', async () => {
  const parsed = await lib.parseTranscript(MAIN_FILE);
  const deduped = lib.dedupe(parsed.records);
  assert.equal(deduped.length, 5);
  const msg1 = deduped.filter((r) => r.id === 'msg_1');
  assert.equal(msg1.length, 1);
  assert.equal(msg1[0].output, 100);
});

test('dedupe works globally across files (subagent copy of msg_4)', async () => {
  const files = lib.listTranscripts(path.join(PROJECTS_DIR, '-tmp-fixture-proj'));
  let records = [];
  for (const f of files) records = records.concat((await lib.parseTranscript(f)).records);
  assert.equal(records.length, 8); // 6 main + msg_s1 + copied msg_4
  const deduped = lib.dedupe(records);
  assert.equal(deduped.length, 6);
  assert.equal(deduped.filter((r) => r.id === 'msg_4').length, 1);
});

test('price: tokens x per-model rates, 1h cache-write split, unknown model -> null', () => {
  const table = JSON.parse(fs.readFileSync(PRICING, 'utf8'));
  const base = { input: 0, output: 0, cacheCreation: 0, cacheCreation1h: 0, cacheRead: 0 };
  closeTo(lib.price({ ...base, model: 'claude-sonnet-5', input: 1000, output: 100 }, table), 0.003);
  closeTo(
    lib.price({
      ...base, model: 'claude-sonnet-5', input: 2000, output: 200,
      cacheCreation: 1000, cacheCreation1h: 500, cacheRead: 10000,
    }, table),
    0.01125,
  );
  // dated id resolves by prefix
  closeTo(lib.price({ ...base, model: 'claude-haiku-4-5-20251001', input: 1000, output: 200 }, table), 0.002);
  assert.equal(lib.price({ ...base, model: 'claude-unknown-9', input: 500 }, table), null);
  assert.equal(lib.tierOf('claude-unknown-9', table), 'other');
  assert.equal(lib.tierOf('claude-haiku-4-5-20251001', table), 'haiku');
});

test('readDeclaredModel reads frontmatter model:, null when absent or invalid', () => {
  withEnv({ USAGE_REPORT_SKILLS_DIR: SKILLS_DIR }, () => {
    assert.equal(lib.readDeclaredModel('alpha'), 'claude-sonnet-5');
    assert.equal(lib.readDeclaredModel('beta'), 'claude-haiku-4-5-20251001');
    assert.equal(lib.readDeclaredModel('no-such-skill'), null);
    assert.equal(lib.readDeclaredModel('../alpha'), null);
  });
});

test('CLI: fixture totals equal the hand-computed sums', () => {
  const r = runJson(['--project', FIXTURE_PROJECT]);
  assert.equal(r.totals.input, 8500);
  assert.equal(r.totals.output, 950);
  assert.equal(r.totals.cacheCreation, 1000);
  assert.equal(r.totals.cacheRead, 10000);
  assert.equal(r.totals.turns, 6);
  closeTo(r.totals.cost, 0.02825, 'totals.cost');
});

test('CLI: meta reflects files, skipped lines, unpriced models, pricing date', () => {
  const r = runJson(['--project', FIXTURE_PROJECT]);
  const pricing = JSON.parse(fs.readFileSync(PRICING, 'utf8'));
  assert.equal(r.meta.files, 2);
  assert.equal(r.meta.skippedLines, 1);
  assert.deepEqual(r.meta.unpricedModels, ['claude-unknown-9']);
  assert.equal(r.meta.pricingAsOf, pricing.asOf);
  assert.equal(r.meta.attribution, 'last-invoked-skill');
  assert.equal(r.scope.project, FIXTURE_PROJECT);
  assert.equal(r.scope.encodedDir, '-tmp-fixture-proj');
  assert.equal(r.scope.allProjects, false);
  assert.deepEqual(r.range, { since: null, until: null });
});

test('CLI: byModel sums, tiers, and unknown model has cost null (sorted last)', () => {
  const r = runJson(['--project', FIXTURE_PROJECT]);
  assert.deepEqual(r.byModel.map((m) => m.model), [
    'claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001', 'claude-unknown-9',
  ]);
  const sonnet = findBy(r.byModel, 'model', 'claude-sonnet-5');
  assert.equal(sonnet.tier, 'sonnet');
  assert.equal(sonnet.turns, 2);
  assert.equal(sonnet.input, 3000);
  assert.equal(sonnet.output, 300);
  assert.equal(sonnet.cacheCreation, 1000);
  assert.equal(sonnet.cacheRead, 10000);
  closeTo(sonnet.cost, 0.01425, 'sonnet cost');

  const opus = findBy(r.byModel, 'model', 'claude-opus-5');
  assert.equal(opus.tier, 'opus');
  closeTo(opus.cost, 0.0075, 'opus cost');

  const haiku = findBy(r.byModel, 'model', 'claude-haiku-4-5-20251001');
  assert.equal(haiku.tier, 'haiku');
  assert.equal(haiku.turns, 2);
  assert.equal(haiku.input, 4000);
  assert.equal(haiku.output, 500);
  closeTo(haiku.cost, 0.0065, 'haiku cost');

  const unknown = findBy(r.byModel, 'model', 'claude-unknown-9');
  assert.equal(unknown.cost, null);
  assert.equal(unknown.tier, 'other');
  assert.equal(unknown.turns, 1);
  assert.equal(unknown.input, 500);
  assert.equal(unknown.output, 50);
});

test('CLI: bySkill follows last-invoked-skill (slash form, Skill tool_use, (none), subagent via parent)', () => {
  const r = runJson(['--project', FIXTURE_PROJECT]);
  assert.deepEqual(r.bySkill.map((s) => s.skill), ['beta', 'alpha', '(none)']);

  const none = findBy(r.bySkill, 'skill', '(none)');
  assert.equal(none.turns, 1, 'turn before any invocation');
  assert.equal(none.input, 1000);
  assert.equal(none.output, 100);
  assert.equal(none.declaredModel, null);
  closeTo(none.cost, 0.003, '(none) cost');

  const alpha = findBy(r.bySkill, 'skill', 'alpha');
  assert.equal(alpha.turns, 1, 'slash-command form attributes msg_2');
  assert.equal(alpha.input, 2000);
  assert.equal(alpha.cacheCreation, 1000);
  assert.equal(alpha.cacheRead, 10000);
  assert.equal(alpha.declaredModel, 'claude-sonnet-5');
  assert.deepEqual(alpha.models, { 'claude-sonnet-5': 1 });
  closeTo(alpha.cost, 0.01125, 'alpha cost');

  // beta: Skill tool_use form; includes the subagent turn msg_s1 (whose own
  // sessionId is "sess-9999") and NOT a phantom "gamma" from the quoted result.
  const beta = findBy(r.bySkill, 'skill', 'beta');
  assert.equal(beta.turns, 4);
  assert.equal(beta.input, 5500);
  assert.equal(beta.output, 650);
  assert.equal(beta.declaredModel, 'claude-haiku-4-5-20251001');
  assert.deepEqual(beta.models, {
    'claude-haiku-4-5-20251001': 2,
    'claude-unknown-9': 1,
    'claude-opus-5': 1,
  });
  closeTo(beta.cost, 0.014, 'beta cost (unpriced turn excluded from sum)');
  assert.ok(!r.bySkill.some((s) => s.skill === 'gamma'));
});

test('CLI: byDay buckets by date ascending', () => {
  const r = runJson(['--project', FIXTURE_PROJECT]);
  assert.equal(r.byDay.length, 2);
  assert.equal(r.byDay[0].date, '2026-01-01');
  assert.equal(r.byDay[0].turns, 5);
  closeTo(r.byDay[0].cost, 0.02075, '01-01 cost');
  assert.equal(r.byDay[1].date, '2026-01-02');
  assert.equal(r.byDay[1].turns, 1);
  closeTo(r.byDay[1].cost, 0.0075, '01-02 cost');
});

test('CLI: --since/--until filter turns but keep skill attribution from the full timeline', () => {
  const r = runJson(['--project', FIXTURE_PROJECT, '--since', '2026-01-02']);
  assert.equal(r.range.since, '2026-01-02T00:00:00.000Z');
  assert.equal(r.range.until, null);
  assert.equal(r.totals.turns, 1);
  assert.equal(r.totals.input, 1000);
  assert.equal(r.totals.output, 100);
  assert.deepEqual(r.bySkill.map((s) => s.skill), ['beta']);

  const until = runJson(['--project', FIXTURE_PROJECT, '--until', '2026-01-01']);
  assert.equal(until.range.until, '2026-01-01T23:59:59.999Z');
  assert.equal(until.totals.turns, 5);
});

test('CLI: --all-projects scans every project dir', () => {
  const r = runJson(['--all-projects']);
  assert.equal(r.scope.allProjects, true);
  assert.equal(r.scope.project, null);
  assert.equal(r.scope.encodedDir, null);
  assert.equal(r.totals.turns, 6);
});

test('CLI: --pretty emits indented JSON, default is single-line', () => {
  const compact = run(['--project', FIXTURE_PROJECT]).stdout;
  const pretty = run(['--project', FIXTURE_PROJECT, '--pretty']).stdout;
  assert.equal(compact.trim().split('\n').length, 1);
  assert.ok(pretty.trim().split('\n').length > 10);
  assert.doesNotThrow(() => JSON.parse(pretty));
});

test('CLI: output validates against the schemaVersion 1 contract keys', () => {
  const r = runJson(['--project', FIXTURE_PROJECT]);
  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(r), [
    'byDay', 'byModel', 'bySkill', 'generatedAt', 'meta', 'range', 'schemaVersion', 'scope', 'totals',
  ]);
  assert.equal(r.schemaVersion, 1);
  assert.ok(!Number.isNaN(Date.parse(r.generatedAt)));
  assert.equal(new Date(r.generatedAt).toISOString(), r.generatedAt);
  assert.deepEqual(keys(r.scope), ['allProjects', 'encodedDir', 'project']);
  assert.deepEqual(keys(r.range), ['since', 'until']);
  assert.deepEqual(keys(r.totals), ['cacheCreation', 'cacheRead', 'cost', 'input', 'output', 'turns']);
  assert.deepEqual(keys(r.meta), ['attribution', 'files', 'pricingAsOf', 'skippedLines', 'unpricedModels']);
  assert.ok(r.byModel.length > 0 && r.bySkill.length > 0 && r.byDay.length > 0);
  for (const row of r.byModel) {
    assert.deepEqual(keys(row), ['cacheCreation', 'cacheRead', 'cost', 'input', 'model', 'output', 'tier', 'turns']);
    assert.ok(['haiku', 'sonnet', 'opus', 'other'].includes(row.tier));
  }
  for (const row of r.bySkill) {
    assert.deepEqual(keys(row), [
      'cacheCreation', 'cacheRead', 'cost', 'declaredFamily', 'declaredModel', 'input', 'modelCheck', 'models',
      'output', 'skill', 'turns',
    ]);
    assert.equal(typeof row.models, 'object');
  }
  for (const row of r.byDay) {
    assert.deepEqual(keys(row), ['cost', 'date', 'turns']);
    assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('CLI: empty project dir yields valid zero-total JSON and exit 0', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-report-empty-'));
  try {
    // 1) projects root exists but holds nothing for this project
    const missing = run(['--project', FIXTURE_PROJECT], { USAGE_REPORT_PROJECTS_DIR: tmp });
    assert.equal(missing.status, 0, missing.stderr);
    // 2) the encoded project dir exists but is empty
    fs.mkdirSync(path.join(tmp, '-tmp-fixture-proj'));
    const empty = run(['--project', FIXTURE_PROJECT], { USAGE_REPORT_PROJECTS_DIR: tmp });
    assert.equal(empty.status, 0, empty.stderr);
    for (const res of [missing, empty]) {
      const r = JSON.parse(res.stdout);
      assert.equal(r.schemaVersion, 1);
      assert.deepEqual(r.totals, {
        input: 0, output: 0, cacheCreation: 0, cacheRead: 0, cost: 0, turns: 0,
      });
      assert.deepEqual(r.byModel, []);
      assert.deepEqual(r.bySkill, []);
      assert.deepEqual(r.byDay, []);
      assert.equal(r.meta.files, 0);
      assert.equal(r.meta.skippedLines, 0);
      assert.deepEqual(r.meta.unpricedModels, []);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: unknown flag exits 2 with usage on stderr and nothing on stdout', () => {
  const res = run(['--bogus']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unknown argument: --bogus/);
  assert.match(res.stderr, /usage: node usage-report\.js/);
  assert.equal(res.stdout, '');
});

test('CLI: missing flag value and malformed dates exit 2', () => {
  assert.equal(run(['--project']).status, 2);
  assert.equal(run(['--since']).status, 2);
  assert.equal(run(['--since', 'yesterday']).status, 2);
  assert.equal(run(['--until', '2026-13-45']).status, 2);
});

test('SKILL.md contract: frontmatter name + model, references the script path', () => {
  assert.ok(fs.existsSync(SKILL_MD), `${SKILL_MD} does not exist`);
  const text = fs.readFileSync(SKILL_MD, 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  assert.ok(fm, 'SKILL.md must start with a frontmatter block');
  assert.match(fm[1], /^name:[ \t]*usage-report[ \t]*$/m);
  assert.match(fm[1], /^model:[ \t]*\S+/m);
  assert.ok(text.includes('scripts/usage-report.js'), 'SKILL.md must reference scripts/usage-report.js');
  assert.ok(fs.existsSync(SCRIPT), 'referenced script must exist');
});

// --- UAT-0108 promotions: offline/read-only guarantee, metadata, registration ---

test('script is offline and read-only: node fs/path/os/readline only, no write or network API', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const required = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(required, ['node:fs', 'node:os', 'node:path', 'node:readline']);
  assert.ok(
    !/\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|truncate)\s*\(/.test(src),
    'script must not call any fs write/delete API',
  );
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket)\b\s*\(?/.test(src), 'script must not use a network API');
});

function snapshotTree(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(`${path.relative(FIXTURE, p)}:${fs.statSync(p).size}:${fs.readFileSync(p, 'utf8').length}`);
    }
  })(dir);
  return out.join('\n');
}

test('running the CLI leaves the transcript and skill fixtures untouched (read-only)', () => {
  const before = snapshotTree(FIXTURE);
  runJson(['--project', FIXTURE_PROJECT]);
  runJson(['--all-projects', '--pretty']);
  assert.equal(snapshotTree(FIXTURE), before);
});

test('script is a node executable: shebang, strict mode, executable bit', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(src.startsWith('#!/usr/bin/env node\n'), 'first line must be the node shebang');
  assert.match(src, /^'use strict';$/m);
  assert.ok((fs.statSync(SCRIPT).mode & 0o111) !== 0, 'script must be executable');
});

test('pricing.json: asOf date and complete numeric rates for the current tiers', () => {
  const table = JSON.parse(fs.readFileSync(PRICING, 'utf8'));
  assert.match(table.asOf, /^\d{4}-\d{2}-\d{2}$/);
  for (const prefix of ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5']) {
    assert.ok(table.models[prefix], `missing ${prefix}`);
  }
  for (const [prefix, rates] of Object.entries(table.models)) {
    assert.ok(['haiku', 'sonnet', 'opus', 'other'].includes(rates.tier), `${prefix} tier`);
    for (const k of ['input', 'output', 'cacheWrite', 'cacheRead']) {
      assert.ok(typeof rates[k] === 'number' && rates[k] >= 0, `${prefix}.${k} must be a non-negative number`);
    }
  }
  assert.equal(table.models['claude-haiku-4-5'].tier, 'haiku');
  assert.equal(table.models['claude-sonnet-5'].tier, 'sonnet');
  assert.equal(table.models['claude-opus-5'].tier, 'opus');
});

test('SKILL.md metadata and required statements (read-only, estimates, heuristic, mismatch, unpriced)', () => {
  const text = fs.readFileSync(SKILL_MD, 'utf8');
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)[1];
  assert.match(fm, /^category:[ \t]*researching[ \t]*$/m);
  assert.match(fm, /^model:[ \t]*claude-haiku-4-5-20251001[ \t]*$/m);
  assert.match(fm, /^disable-model-invocation:[ \t]*false[ \t]*$/m);
  assert.match(fm, /^user-invocable:[ \t]*true[ \t]*$/m);
  assert.match(fm, /^argument-hint:[ \t]*"\[--all-projects\] \[--since YYYY-MM-DD\]"[ \t]*$/m);
  assert.match(fm, /^description:[ \t]*\S+/m);
  assert.match(text, /\*\*Prereqs:\*\*/);
  assert.match(text, /read-only and offline/i);
  assert.match(text, /writes no files/i);
  assert.match(text, /no network request/i);
  assert.match(text, /estimates/i);
  assert.match(text, /heuristic/i);
  assert.match(text, /declared vs observed/i);
  assert.match(text, /MISMATCH/);
  assert.match(text, /\(none\)/);
  assert.match(text, /meta\.unpricedModels/);
  assert.match(text, /No usage found for/);
  assert.match(text, /Top 5 cost days/i);
  assert.match(text, /\$ARGUMENTS/);
});

test('registration: exactly one usage-report row in lib/skills/README.md and in CLAUDE.md', () => {
  const readme = fs.readFileSync(path.join(REPO, 'lib', 'skills', 'README.md'), 'utf8');
  const claude = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
  const readmeRows = readme.split('\n').filter((l) => /^\|\s*`usage-report`\s*\|/.test(l));
  const claudeRows = claude.split('\n').filter((l) => /^\|\s*`\/usage-report\b[^`]*`\s*\|/.test(l));
  assert.equal(readmeRows.length, 1, 'lib/skills/README.md');
  assert.equal(claudeRows.length, 1, 'CLAUDE.md');
  assert.match(readmeRows[0], /offline, read-only/);
  assert.match(claudeRows[0], /\[--all-projects\] \[--since YYYY-MM-DD\]/);
});
