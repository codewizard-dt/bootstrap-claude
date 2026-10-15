#!/usr/bin/env node
// Contract checks for the shared work-item ID-resolution procedure
// (TASK-0098). Zero-dependency: node:test + node:assert only, mirroring the
// sibling skill-content suites (test/task-typed-links.test.js,
// test/wiki-work-naming-convention.test.js).
//
// Run: npm test   (or: node --test test/shared-id-resolution.test.js)
//
// WHY THIS IS TESTED AT ALL. The SKILL.md markdown IS the program a future
// agent executes. TASK-0098 replaced the per-skill inline "resolve a path /
// NNN-slug / bare number" tables (each hard-coding a 3- or 4-digit pad and an
// `NNN-*.md` mask) with a single procedure in
// lib/skills/_shared/ID-RESOLUTION.md that every consuming skill points at with
// a one-line wiring block. The risk is drift: a skill quietly re-growing its
// own copy of the mask table (and its own wrong pad width), a wired skill
// losing the pointer, a rename of the shared doc breaking every consumer, or
// the edit clobbering a skill's `argument-hint:` frontmatter.
//
// SCOPE — (a) the shared doc's required content; (b) every wired consumer
// references it; (c) no wired consumer still carries the legacy pad/mask
// text; (d) wired SKILL.md files kept their `argument-hint:` frontmatter.
// ID-RESOLUTION.md itself is deliberately NOT scanned for (c) — it names the
// legacy masks on purpose. Does not exercise the resolution behavior itself,
// and does not scan skills that do number allocation (e.g. bug-create), which is
// a different algorithm.
//
// HERMETIC: reads repo-local files only. No subprocess, no writes.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILLS = path.join(REPO, 'lib', 'skills');
const SHARED = path.join(SKILLS, '_shared', 'ID-RESOLUTION.md');

// 14 SKILL.md files wired per TASK-0098 Step 3, plus task-create (two additional
// resolution sites wired there), plus the UAT-CORE.md shared by the
// uat-walk / uat-auto / uat-auto-plus skills. 17 files total.
const WIRED_SKILLS = [
  'prd-deprecate',
  'adr-deprecate',
  'prd-finalize',
  'prd-compile',
  'adr-extract',
  'adr-finalize',
  'adr-walkthrough',
  'adr-next',
  'roadmap-next',
  'bug-triage',
  'bug-close',
  'tackle',
  'task-close',
  'uat-skip',
  'uat-create',
  'task-create',
];
const WIRED_FILES = [
  ...WIRED_SKILLS.map((s) => path.join(SKILLS, s, 'SKILL.md')),
  path.join(SKILLS, 'uat-walk', 'UAT-CORE.md'),
];

// Wired SKILL.md files that carry `argument-hint:` in their frontmatter
// (verified with Serena search). prd-compile never had one, so it is
// excluded; UAT-CORE.md has no frontmatter at all.
const HAS_ARGUMENT_HINT = WIRED_SKILLS.filter((s) => s !== 'prd-compile');

function read(p) {
  assert.ok(fs.existsSync(p), `${p} does not exist`);
  return fs.readFileSync(p, 'utf8');
}

const rel = (p) => path.relative(REPO, p);

test('wired file list covers 17 files (16 SKILL.md + UAT-CORE.md)', () => {
  assert.equal(WIRED_FILES.length, 17);
});

test('(a) ID-RESOLUTION.md exists and defines prefixes, forms, and legacy fallback', () => {
  const text = read(SHARED);
  for (const prefix of ['PRD', 'REQ', 'ADR', 'DEC', 'ROADMAP', 'TASK', 'UAT', 'BUG']) {
    assert.match(text, new RegExp(`\`${prefix}\``), `missing family prefix ${prefix}`);
  }
  assert.match(text, /Path/, 'missing accepted form: path');
  assert.match(text, /Full ID or ID-slug/, 'missing accepted form: full ID / ID-slug');
  assert.match(text, /NNN-slug/, 'missing accepted form: NNN-slug');
  assert.match(text, /Bare number/, 'missing accepted form: bare number');
  assert.match(text, /Empty \/ free-text/, 'missing accepted form: empty / free-text');
  assert.match(text, /pad3/, 'missing 3-digit pad (pad3) mask');
  assert.match(text, /legacy/i, 'missing legacy 3-digit fallback');
});

for (const file of WIRED_FILES) {
  test(`(b) ${rel(file)} references ID-RESOLUTION.md`, () => {
    assert.ok(read(file).includes('ID-RESOLUTION.md'));
  });
}

for (const file of WIRED_FILES) {
  test(`(c) ${rel(file)} has no legacy pad-width or NNN-*.md mask text`, () => {
    const text = read(file);
    assert.doesNotMatch(text, /Pad to [34] digits/i);
    assert.doesNotMatch(text, /NNN-\*\.md/); // also catches NNNN-*.md
  });
}

for (const skill of HAS_ARGUMENT_HINT) {
  const file = path.join(SKILLS, skill, 'SKILL.md');
  test(`(d) ${rel(file)} keeps argument-hint in frontmatter`, () => {
    const m = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(m, 'file must start with a frontmatter block');
    assert.match(m[1], /^argument-hint:/m);
  });
}


// ---------------------------------------------------------------------------
// UAT-0098 additions: wiring correctness (not just presence of the pointer),
// family-table fidelity against the real wiki/work/ tree, and delivery.
// Scoped to the ID-RESOLUTION.md pointer lines only, so they stay valid when
// other tasks move the surrounding boilerplate.
// ---------------------------------------------------------------------------

const FAMILIES = {
  requirements: 'PRD',
  decisions: 'ADR',
  roadmaps: 'ROADMAP',
  tasks: 'TASK',
  uat: 'UAT',
  bugs: 'BUG',
};

// Families whose pre-rename prefix is still accepted (Family table Notes).
const LEGACY_PREFIXES = { requirements: 'REQ', decisions: 'DEC' };

// [family, scope] pairs each consumer's wiring line(s) must declare, in order.
// Mirrors the "Caller deltas" table in ID-RESOLUTION.md.
const EXPECTED_WIRING = {
  'prd-deprecate': [['requirements', 'active']],
  'adr-deprecate': [['decisions', 'active']],
  'prd-finalize': [['requirements', 'active']],
  'prd-compile': [['requirements', 'active']],
  'adr-extract': [['requirements', 'active']],
  'adr-finalize': [['decisions', 'active']],
  'adr-walkthrough': [['decisions', 'active']],
  'adr-next': [['decisions', 'active']],
  'roadmap-next': [['roadmaps', 'active']],
  'bug-triage': [['bugs', 'active']],
  'bug-close': [['bugs', 'active-then-archive-gate']],
  tackle: [['tasks', 'active']],
  'task-close': [['tasks', 'active+archive']],
  'uat-skip': [['tasks', 'active']],
  'uat-create': [['tasks', 'active']],
  'task-create': [['decisions', 'active'], ['roadmaps', 'active']],
};

const WIRING_RE =
  /ID-RESOLUTION\.md — family: ([a-z]+) · scope: (active-then-archive-gate|active\+archive|active) · ambiguous: (\S+)/g;

function wiringOf(file) {
  return [...read(file).matchAll(WIRING_RE)].map((m) => ({
    family: m[1],
    scope: m[2],
    ambiguous: m[3],
  }));
}

for (const [skill, expected] of Object.entries(EXPECTED_WIRING)) {
  const file = path.join(SKILLS, skill, 'SKILL.md');
  test(`(e) ${rel(file)} wiring declares family/scope ${JSON.stringify(expected)}`, () => {
    const got = wiringOf(file).map((w) => [w.family, w.scope]);
    assert.deepEqual(got, expected);
  });
}

test('(e) UAT-CORE.md wiring declares family uat, scope active, both ambiguity modes', () => {
  const file = path.join(SKILLS, 'uat-walk', 'UAT-CORE.md');
  const wiring = wiringOf(file);
  assert.equal(wiring.length, 1);
  assert.equal(wiring[0].family, 'uat');
  assert.equal(wiring[0].scope, 'active');
  const line = read(file).split('\n').find((l) => l.includes('ID-RESOLUTION.md'));
  assert.match(line, /interactive for uat-walk/);
  assert.match(line, /headless for uat-auto/);
});

test('(e) every wiring line uses a family that exists in the shared family table', () => {
  const text = read(SHARED);
  for (const file of WIRED_FILES) {
    for (const w of wiringOf(file)) {
      assert.ok(w.family in FAMILIES, `${rel(file)}: unknown family '${w.family}'`);
      assert.match(
        text,
        new RegExp(`\\| ${w.family} \\| \`wiki/work/${w.family}/\` \\| \`${FAMILIES[w.family]}\``),
        `${w.family} row missing or wrong in the shared family table`,
      );
    }
  }
});

test('(e) requirements family row declares prefix PRD with the legacy REQ fallback', () => {
  const row = read(SHARED)
    .split('\n')
    .find((l) => l.startsWith('| requirements | `wiki/work/requirements/` |'));
  assert.ok(row, 'requirements family-table row not found');
  assert.match(row, /\| `PRD` \|/, 'requirements row must declare prefix PRD');
  assert.match(row, /legacy prefix `REQ`/, 'requirements row Notes must mention the legacy REQ prefix');
  assert.ok(row.indexOf('`PRD`') < row.indexOf('`REQ`'), 'PRD must be listed before the legacy REQ fallback');
});

test('(e) decisions family row declares prefix ADR with the legacy DEC fallback', () => {
  const row = read(SHARED)
    .split('\n')
    .find((l) => l.startsWith('| decisions | `wiki/work/decisions/` |'));
  assert.ok(row, 'decisions family-table row not found');
  assert.match(row, /\| `ADR` \|/, 'decisions row must declare prefix ADR');
  assert.match(row, /legacy prefix `DEC`/, 'decisions row Notes must mention the legacy DEC prefix');
  assert.ok(row.indexOf('`ADR`') < row.indexOf('`DEC`'), 'ADR must be listed before the legacy DEC fallback');
});

test('(g) worked examples contain DEC-0001#D2 (legacy) and ADR-NNNN#DM rows for the decisions family', () => {
  const text = read(SHARED);
  const section = text.slice(text.indexOf('## Worked examples'), text.indexOf('## CRITICAL rules'));
  const rows = section.split('\n').filter((l) => /\| decisions \|/.test(l));
  assert.ok(rows.some((l) => l.includes('`DEC-0001#D2`')), 'no legacy DEC-0001#D2 worked-example row');
  assert.ok(rows.some((l) => l.includes('`ADR-0001#D2`')), 'no ADR-0001#D2 worked-example row');
});

test('(g) worked examples contain a legacy REQ-0003 row for the requirements family', () => {
  const text = read(SHARED);
  const section = text.slice(text.indexOf('## Worked examples'), text.indexOf('## CRITICAL rules'));
  assert.ok(
    section.split('\n').some((l) => /\| requirements \| `REQ-0003` \|/.test(l)),
    'no legacy REQ-0003 worked-example row',
  );
});

test('(f) family-table directories exist and every item filename fits a 3- or 4-digit mask', () => {
  for (const [family, prefix] of Object.entries(FAMILIES)) {
    const dir = path.join(REPO, 'wiki', 'work', family);
    assert.ok(fs.existsSync(dir), `${rel(dir)} missing`);
    const dirs = [dir];
    if (fs.existsSync(path.join(dir, 'archive'))) dirs.push(path.join(dir, 'archive'));
    for (const d of dirs) {
      for (const name of fs.readdirSync(d)) {
        if (!name.endsWith('.md') || name === 'index.md' || name === 'lifecycle.md') continue;
        const accepted = [prefix, LEGACY_PREFIXES[family]].filter(Boolean).join('|');
        assert.match(
          name,
          new RegExp(`^(?:${accepted})-\\d{3,4}-.+\\.md$`),
          `${rel(path.join(d, name))} is not reachable by PREFIX-<pad4>-*.md or PREFIX-<pad3>-*.md`,
        );
      }
    }
  }
});

test('(g) every filename cited in the Worked examples section exists on disk', () => {
  const text = read(SHARED);
  const start = text.indexOf('## Worked examples');
  const end = text.indexOf('## CRITICAL rules');
  assert.ok(start !== -1 && end > start, 'Worked examples section not found');
  const cited = [
    ...text
      .slice(start, end)
      .matchAll(/wiki\/work\/[a-z]+\/(?:archive\/)?[A-Z]+-\d+-[\w-]+\.md/g),
  ].map((m) => m[0]);
  assert.ok(cited.length >= 5, `expected several cited files, found ${cited.length}`);
  for (const rp of new Set(cited)) {
    assert.ok(fs.existsSync(path.join(REPO, rp)), `worked example cites missing file ${rp}`);
  }
});

test('(g) worked examples cover every accepted form and the 0-match case', () => {
  const text = read(SHARED);
  const section = text.slice(text.indexOf('## Worked examples'), text.indexOf('## CRITICAL rules'));
  for (const form of ['1 Path', '2 Full ID', '2 ID-slug', '2 Legacy ID', '3 NNNN-slug', '3 NNN-slug', '4 Bare number', '5 Empty']) {
    assert.ok(section.includes(`| ${form} |`), `no worked example row for form '${form}'`);
  }
  assert.match(section, /No tasks matching '9999' found\./);
});

test('(h) _shared/ is not a slash command and ships through install + pack', () => {
  assert.ok(fs.existsSync(SHARED));
  assert.ok(
    !fs.existsSync(path.join(SKILLS, '_shared', 'SKILL.md')),
    '_shared/ must not carry a SKILL.md or it registers as a skill',
  );
  const install = read(path.join(REPO, 'lib', 'scripts', 'install-global.sh'));
  assert.match(install, /rsync[^\n]*"\$TEMPLATE_DIR\/lib\/skills\/"/, 'install-global.sh must rsync lib/skills/');
  const pkg = JSON.parse(read(path.join(REPO, 'package.json')));
  assert.ok(pkg.files.includes('lib/'), 'package.json files must include lib/');
  assert.ok(!pkg.files.some((f) => /^!.*_shared/.test(f)), '_shared/ must not be negated from the tarball');
});


// Reference implementation of the documented mask procedure (Procedure step 3-4):
// integer -> for each of [current prefix, legacy prefix (if any)]: PREFIX-<pad4>-*.md,
// then PREFIX-<pad3>-*.md; first non-empty wins (so ADR-<pad4>, ADR-<pad3>,
// DEC-<pad4>, DEC-<pad3> for the decisions family).
function resolveByMasks(family, input, { archive = false } = {}) {
  const prefixes = [FAMILIES[family], LEGACY_PREFIXES[family]].filter(Boolean);
  const n = parseInt(String(input).match(/\d+/)[0], 10);
  const dirs = [path.join(REPO, 'wiki', 'work', family)];
  if (archive) dirs.push(path.join(dirs[0], 'archive'));
  const files = dirs.flatMap((d) =>
    fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.md')) : [],
  );
  for (const prefix of prefixes) {
    for (const width of [4, 3]) {
      const head = `${prefix}-${String(n).padStart(width, '0')}-`;
      const hits = files.filter((f) => f.startsWith(head));
      if (hits.length) return hits;
    }
  }
  return [];
}

test('(i) documented masks resolve the documented worked examples on the real tree', () => {
  assert.deepEqual(resolveByMasks('tasks', '86'), ['TASK-0086-uat-fail-offers-bug-file.md']);
  assert.deepEqual(resolveByMasks('tasks', 'TASK-074'), ['TASK-074-serena-project-from-cwd.md']);
  assert.deepEqual(resolveByMasks('tasks', '074-serena-project-from-cwd'), ['TASK-074-serena-project-from-cwd.md']);
  assert.deepEqual(resolveByMasks('roadmaps', '11'), ['ROADMAP-011-build-bootstrap-prefs-tui.md']);
  assert.deepEqual(resolveByMasks('bugs', '6'), ['BUG-0006-mv-guard-segment-split-omits-pipe.md']);
  assert.equal(resolveByMasks('uat', '87').length, 1);
  assert.deepEqual(resolveByMasks('decisions', 'DEC-0001#D2', { archive: true }), [
    'DEC-0001-wiki-cross-family-linking-schema.md',
  ]);
  assert.deepEqual(resolveByMasks('decisions', 'ADR-0001#D2', { archive: true }), [
    'DEC-0001-wiki-cross-family-linking-schema.md',
  ]);
  assert.deepEqual(resolveByMasks('tasks', '9999'), []);
});

test('(i) the decisions mask order is ADR-<pad4>, ADR-<pad3>, DEC-<pad4>, DEC-<pad3> (current prefix first, then legacy)', () => {
  const text = read(SHARED);
  assert.match(text, /`DEC-<pad4>-\*\.md`, `DEC-<pad3>-\*\.md`/, 'legacy DEC masks must be listed as pad4 then pad3');
  assert.deepEqual(
    [FAMILIES.decisions, LEGACY_PREFIXES.decisions],
    ['ADR', 'DEC'],
    'decisions family declares ADR as current and DEC as legacy',
  );
});

test('(i) the retired 3-digit-only and raw-input masks would have matched nothing (regression for the broken masks)', () => {
  // The old req-*/decision-* masks carried no family prefix, so they can never
  // match a real 'PREFIX-NNNN-slug.md' filename; the shared doc's masks always do.
  for (const family of ['tasks', 'roadmaps', 'bugs', 'uat']) {
    const dir = path.join(REPO, 'wiki', 'work', family);
    const items = fs.readdirSync(dir).filter((f) => /^[A-Z]+-\d+-/.test(f));
    assert.ok(items.length > 0, `${family} has no items to check against`);
    for (const f of items) assert.doesNotMatch(f, /^\d+-/, `${f} is prefix-less`);
    const n = parseInt(items[0].match(/-(\d+)-/)[1], 10);
    assert.ok(resolveByMasks(family, n).length >= 1, `${family}: documented masks miss ${items[0]}`);
  }
});

test('(i) within each consumer search scope, no item number is ambiguous between 4- and 3-digit filenames', () => {
  // Scopes actually used by consumers: every family 'active' (its own directory),
  // plus tasks 'active+archive' (task-close). A width collision inside one scope
  // (e.g. TASK-0085 vs TASK-085) would make a bare number resolve ambiguously.
  const scopes = [
    ...Object.keys(FAMILIES).map((f) => [f, [path.join(REPO, 'wiki', 'work', f)]]),
    [
      'tasks',
      [path.join(REPO, 'wiki', 'work', 'tasks'), path.join(REPO, 'wiki', 'work', 'tasks', 'archive')],
    ],
  ];
  for (const [family, dirs] of scopes) {
    const seen = new Map();
    for (const d of dirs.filter((x) => fs.existsSync(x))) {
      for (const f of fs.readdirSync(d)) {
        const m = f.match(/^[A-Z]+-(\d{3,4})-.+\.md$/);
        if (!m) continue;
        const n = parseInt(m[1], 10);
        assert.ok(!seen.has(n), `${family}: number ${n} used by both ${seen.get(n)} and ${f}`);
        seen.set(n, f);
      }
    }
  }
});

test('(a2) shared doc defines both ambiguity modes, the zero-match STOP, and the #DM split', () => {
  const text = read(SHARED);
  assert.match(text, /\*\*interactive\*\*[^\n]*AskUserQuestion/);
  assert.match(text, /\*\*headless\*\*[^\n]*never prompt/);
  assert.match(text, /No <family> matching '<input>' found\./);
  assert.match(text, /File not found: <path>/);
  assert.match(text, /Strip the suffix \*\*before\*\* resolving the file/);
  for (const scope of ['active', 'active+archive', 'active-then-archive-gate']) {
    assert.ok(text.includes(`\`${scope}\``), `search scope '${scope}' not defined`);
  }
});

// ---------------------------------------------------------------------------
// TASK-0121: roadmaps, decisions and requirements no longer archive. The archive
// scopes are confined to tasks/uat/bugs, and the three in-place families keep a
// permanent legacy fallback to <family>/archive/ for un-migrated projects.
// ---------------------------------------------------------------------------

const ARCHIVING_FAMILIES = ['tasks', 'uat', 'bugs'];
const IN_PLACE_FAMILIES = ['requirements', 'decisions', 'roadmaps'];

test('(j) shared doc states archive scopes are valid only for tasks/uat/bugs', () => {
  const text = read(SHARED);
  const scopeSection = text.slice(text.indexOf('## Search scope'), text.indexOf('## `#DM` suffix'));
  assert.match(
    scopeSection,
    /`active\+archive` and `active-then-archive-gate` are valid only for `tasks`, `uat`, and `bugs`/,
    'Search scope must restrict the archive scopes to tasks, uat and bugs',
  );
});

test('(j) shared doc carries the permanent legacy-fallback rule for the three in-place families', () => {
  const text = read(SHARED);
  const scopeSection = text.slice(text.indexOf('## Search scope'), text.indexOf('## `#DM` suffix'));
  assert.match(scopeSection, /Legacy fallback \(permanent\)/, 'legacy-fallback rule heading missing');
  const rule = scopeSection.split('\n').find((l) => l.includes('Legacy fallback (permanent)'));
  for (const fam of IN_PLACE_FAMILIES) {
    assert.ok(rule.includes(`\`${fam}\``), `legacy-fallback rule must name ${fam}`);
  }
  assert.match(rule, /`scope: active` searches the family directory and, on zero matches, falls back to `<family>\/archive\/` if that directory exists/);
  assert.match(rule, /legacy location/, 'legacy-fallback rule must report the hit as a legacy location');
  assert.match(rule, /New code never writes to that `archive\/`/, 'legacy-fallback rule must forbid new writes to archive/');
});

test('(j) family-table closing sentence: only tasks/uat/bugs keep terminal items in archive/', () => {
  const text = read(SHARED);
  assert.match(
    text,
    /Terminal items live in the `archive\/` subdirectory for `tasks`, `uat`, and `bugs` only; `requirements`, `decisions`, and `roadmaps` keep finished items in place/,
  );
});

test('(j) active+archive / active-then-archive-gate are consumed only by tasks/uat/bugs skills', () => {
  for (const [skill, pairs] of Object.entries(EXPECTED_WIRING)) {
    for (const [family, scope] of pairs) {
      if (scope === 'active') continue;
      assert.ok(
        ARCHIVING_FAMILIES.includes(family),
        `${skill} declares scope '${scope}' on family '${family}', which no longer archives`,
      );
    }
  }
  // And the on-disk wiring lines agree (not just the expectation map).
  for (const file of WIRED_FILES) {
    for (const w of wiringOf(file)) {
      if (w.scope === 'active') continue;
      assert.ok(
        ARCHIVING_FAMILIES.includes(w.family),
        `${rel(file)} wires scope '${w.scope}' on family '${w.family}', which no longer archives`,
      );
    }
  }
  // The in-place families are wired at scope `active` everywhere they appear.
  for (const file of WIRED_FILES) {
    for (const w of wiringOf(file)) {
      if (IN_PLACE_FAMILIES.includes(w.family)) {
        assert.equal(w.scope, 'active', `${rel(file)}: ${w.family} must use scope active`);
      }
    }
  }
});

test('(j) Caller deltas rows for the in-place families note the legacy archive/ fallback', () => {
  const text = read(SHARED);
  const deltas = text.slice(text.indexOf('## Caller deltas'));
  const rows = deltas
    .split('\n')
    .filter((l) => /\| (requirements|decisions|roadmaps) \|/.test(l));
  assert.ok(rows.length >= 3, 'expected requirements/decisions/roadmaps rows in Caller deltas');
  for (const row of rows) {
    assert.match(row, /legacy `archive\/` fallback/i, `Caller deltas row lacks the legacy fallback note: ${row.slice(0, 60)}`);
  }
});
