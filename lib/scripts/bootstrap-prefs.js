#!/usr/bin/env node
// Read and write the bootstrap preference store — the single binary every
// ROADMAP-005 consumer goes through (sticky shell prompts, skill consumers,
// /bootstrap-config).
//
// Two values files, both plain flat JSON objects:
//   global   ~/.claude/bootstrap-prefs.json
//   project  <project>/.claude/bootstrap-prefs.json
//
// Four states per key: `unset` / a settled value / `false` / `ask`.
// ABSENCE IS `unset`. `null` is never written and "unset" is never stored as a
// string — deleting a key is how you re-open a question.
//
// Exit codes encode WHOSE fault it is, because these calls run inside
// `set -euo pipefail` installers and inside a /git-commit run:
//   exit 0  the world is in an unexpected state — missing file, malformed JSON,
//           unknown key on read, key not set. A corrupt prefs file must never
//           abort an install or block a commit. Every read path exits 0, so no
//           call site needs `|| true`.
//   exit 1  the caller is wrong — invalid --value for the key's grammar,
//           unknown flag, --set without --value, a write with no layer
//           selector. These are bugs in a calling script and must fail loudly:
//           a typo'd value must never land in the file and read back as `unset`.
//
// Usage:
//   bootstrap-prefs.js --get   <key> [--project <dir>] [--global] [--target <path>]
//   bootstrap-prefs.js --set   <key> --value <v> (--global | --project <dir> | --target <path>)
//   bootstrap-prefs.js --unset <key>             (--global | --project <dir> | --target <path>)
//   bootstrap-prefs.js --list  [--project <dir>] [--target <path>]
//   bootstrap-prefs.js --section-key <title>
//   ... plus [--schema <path>] on any of the above.
//
//   --global / --project <dir> are semantic LAYER SELECTORS.
//   --target <path> is an explicit single file, bypassing layer resolution. It
//   is the test seam (the repo's established name for one) and doubles as the
//   escape hatch for touching exactly one layer.
//
//   On --get, resolution is the DEFAULT, not a flag: forgetting a flag and
//   silently getting `unset` would cause the re-prompt this store exists to
//   remove.
//   On --set/--unset a layer selector is MANDATORY: guessing which file to
//   write is unrecoverable in a way that guessing which to read is not.
//
//   --section-key turns a .gitignore banner title into its schema key
//   (`gitignore.section.<slug>`). It lives here so the slug rule has exactly
//   one implementation, and so it is Unicode-aware — the template's
//   "Claude Code — machine-local MCP registration ..." title contains an em
//   dash, which a byte-wise [^a-z0-9] slugifier expands into three dashes.
//
// Validation comes from the schema's `values` string — no second copy of any
// value list lives in this file; that is the whole reason the schema exists.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const USAGE = [
  'Usage:',
  '  bootstrap-prefs.js --get   <key> [--project <dir>] [--global] [--target <path>]',
  '  bootstrap-prefs.js --set   <key> --value <v> (--global | --project <dir> | --target <path>)',
  '  bootstrap-prefs.js --unset <key>             (--global | --project <dir> | --target <path>)',
  '  bootstrap-prefs.js --list  [--project <dir>] [--target <path>]',
  '  bootstrap-prefs.js --section-key <title>',
  '  (any of the above may add --schema <path>)',
].join('\n');

const FLAGS_WITH_OPERAND = new Set([
  '--get',
  '--set',
  '--unset',
  '--value',
  '--project',
  '--target',
  '--schema',
  '--section-key',
]);

function usageError(message) {
  console.error(`Error: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

// Stop cleanly: the world is in a state we do not understand, and the caller is
// a `set -euo pipefail` script that must keep going. Mirrors merge-settings-deny.js.
function warnSkip(message) {
  console.error(`Warning: ${message} — skipping ${operation}`);
  process.exit(0);
}

// Degrade and continue: used where the correct answer is "treat it as unset"
// rather than "stop", so resolution can fall through to the next layer.
function warn(message) {
  console.error(`Warning: ${message}`);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArgs(argv) {
  const opts = {
    op: null,
    key: null,
    value: null,
    title: null,
    global: false,
    projectDir: null,
    target: null,
    schema: path.join(__dirname, 'templates', 'bootstrap-prefs-schema.json'),
  };

  const setOp = (name) => {
    if (opts.op !== null) {
      usageError(`--${name} cannot be combined with --${opts.op}; pick one operation`);
    }
    opts.op = name;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (FLAGS_WITH_OPERAND.has(arg) && argv[i + 1] === undefined) {
      usageError(`${arg} requires an argument`);
    }
    if (arg === '--get') {
      setOp('get');
      opts.key = argv[++i];
    } else if (arg === '--set') {
      setOp('set');
      opts.key = argv[++i];
    } else if (arg === '--unset') {
      setOp('unset');
      opts.key = argv[++i];
    } else if (arg === '--list') {
      setOp('list');
    } else if (arg === '--section-key') {
      setOp('section-key');
      opts.title = argv[++i];
    } else if (arg === '--value') {
      opts.value = argv[++i];
    } else if (arg === '--global') {
      opts.global = true;
    } else if (arg === '--project') {
      opts.projectDir = argv[++i];
    } else if (arg === '--target') {
      opts.target = argv[++i];
    } else if (arg === '--schema') {
      opts.schema = argv[++i];
    } else {
      usageError(`unrecognized argument "${arg}"`);
    }
  }

  if (opts.op === null) {
    usageError('one of --get, --set, --unset, --list, --section-key is required');
  }
  if (opts.value !== null && opts.op !== 'set') {
    usageError('--value is only valid with --set');
  }
  if (opts.op === 'set' && opts.value === null) {
    usageError(`--set ${opts.key} requires --value <v>`);
  }
  if (opts.op === 'set' || opts.op === 'unset') {
    const selectors = [];
    if (opts.global) selectors.push('--global');
    if (opts.projectDir !== null) selectors.push('--project');
    if (opts.target !== null) selectors.push('--target');
    if (selectors.length === 0) {
      usageError(`--${opts.op} requires exactly one of --global, --project <dir>, --target <path>`);
    }
    if (selectors.length > 1) {
      usageError(`--${opts.op} takes exactly one layer selector, got ${selectors.join(' and ')}`);
    }
  }
  return opts;
}

// os.homedir() follows a redirected HOME (proven by TASK-029 step 5), which is
// what makes hermetic testing possible. Never read process.env.HOME directly.
function globalFile() {
  return path.join(os.homedir(), '.claude', 'bootstrap-prefs.json');
}

function projectFile(dir) {
  return path.join(dir, '.claude', 'bootstrap-prefs.json');
}

// ---------------------------------------------------------------- schema ----

// A missing or malformed schema is a warning, not a crash, and not a stop: the
// schema ships in the tarball, but a partial install must not break a
// /git-commit. Without it there is no validation, no defaults, and no --list
// descriptions; --get still resolves from the files and --set still writes.
function loadSchema(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    warn(
      `preference schema not found at ${file} — continuing without validation, ` +
        'defaults, or descriptions (--get still resolves, --set still writes)'
    );
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    warn(
      `preference schema at ${file} is not valid JSON (${err.message}) — continuing ` +
        'without validation, defaults, or descriptions (--get still resolves, --set still writes)'
    );
    return {};
  }
  if (!isPlainObject(parsed)) {
    warn(
      `preference schema at ${file} is not a JSON object — continuing without ` +
        'validation, defaults, or descriptions (--get still resolves, --set still writes)'
    );
    return {};
  }
  return parsed;
}

// Exact key first, then any `dynamic: true` entry whose key ends in `.*`,
// matched on the literal prefix. `guides.evals-framework.md` matches `guides.*`;
// `gitignore.section.node-typescript-javascript` matches `gitignore.section.*`.
function lookupSchema(schema, key) {
  if (Object.prototype.hasOwnProperty.call(schema, key)) return schema[key];
  for (const [pattern, entry] of Object.entries(schema)) {
    if (!isPlainObject(entry) || entry.dynamic !== true) continue;
    if (!pattern.endsWith('.*')) continue;
    const prefix = pattern.slice(0, -1); // keep the trailing '.'
    if (key.length > prefix.length && key.startsWith(prefix)) return entry;
  }
  return null;
}

function allowedValues(entry) {
  if (!entry || typeof entry.values !== 'string') return null;
  return entry.values
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ----------------------------------------------------------------- files ----

const layerCache = new Map();

// Missing file -> {}. Unreadable or unparseable -> {} AFTER a stderr warning
// naming the file. Never throws: a corrupt layer degrades to `unset` and
// resolution continues to the next layer.
function readLayer(file) {
  if (file === null) return {};
  if (layerCache.has(file)) return layerCache.get(file);
  let result = {};
  if (fs.existsSync(file)) {
    let text = null;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      warn(`could not read ${file} (${err.message}) — treating every key in it as unset`);
    }
    if (text !== null) {
      try {
        const parsed = JSON.parse(text);
        if (isPlainObject(parsed)) {
          result = parsed;
        } else {
          warn(`${file} is not a JSON object — treating every key in it as unset`);
        }
      } catch (err) {
        warn(`could not parse ${file} (${err.message}) — treating every key in it as unset`);
      }
    }
  }
  layerCache.set(file, result);
  return result;
}

// Distinguishes "absent" from "present but unreadable": writes must refuse on
// the second, so a hand-edited-into-invalidity file is never clobbered.
function readWritableTarget(file) {
  if (!fs.existsSync(file)) return { text: null, data: {} };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    warnSkip(`could not read ${file} (${err.message}) — fix or delete it, then re-run`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    warnSkip(
      `${file} is not valid JSON (${err.message}) — fix or delete it, then re-run; ` +
        'refusing to overwrite a file that may hold hand-edited answers'
    );
  }
  if (!isPlainObject(parsed)) {
    warnSkip(
      `${file} is not a JSON object — fix or delete it, then re-run; ` +
        'refusing to overwrite a file that may hold hand-edited answers'
    );
  }
  return { text, data: parsed };
}

// Reuse the file's existing indentation (tabs or N spaces); default 2 spaces.
function detectIndent(text) {
  if (text === null || text === undefined) return '  ';
  if (text.match(/\n(\t+)"/)) return '\t';
  const spaceMatch = text.match(/\n( +)"/);
  return spaceMatch ? spaceMatch[1] : '  ';
}

function writeAtomic(file, contents) {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, contents);
    fs.renameSync(tmp, file);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {
      /* nothing to clean up */
    }
    warnSkip(`could not write ${file} (${err.message})`);
  }
}

function writeValues(file, data, indent) {
  writeAtomic(file, JSON.stringify(data, null, indent) + '\n');
}

// ------------------------------------------------------------ resolution ----

function formatValue(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return String(value);
}

// Resolution order is scope-constrained, not universal:
//   either  -> project -> global -> schema default -> unset
//   global  -> global  -> schema default -> unset   (NEVER reads the project file)
//   project -> project -> schema default -> unset   (NEVER reads the global file)
// A global-scope key sitting in a project file is not consulted: honouring it
// would make a machine-wide answer overridable per checkout.
function resolve(key, entry, opts) {
  const files = [];
  if (opts.target !== null) {
    files.push({ layer: 'target', file: opts.target });
  } else if (opts.global) {
    files.push({ layer: 'global', file: globalFile() });
  } else {
    const scope = entry && typeof entry.scope === 'string' ? entry.scope : 'either';
    if (scope !== 'global' && opts.projectDir !== null) {
      files.push({ layer: 'project', file: projectFile(opts.projectDir) });
    }
    if (scope !== 'project') {
      files.push({ layer: 'global', file: globalFile() });
    }
  }

  for (const { layer, file } of files) {
    const data = readLayer(file);
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null) {
      return { value: data[key], layer };
    }
  }
  if (entry && entry.default !== null && entry.default !== undefined) {
    return { value: entry.default, layer: 'default' };
  }
  return { value: null, layer: 'unset' };
}

// ------------------------------------------------------------ slugifying ----

// Unicode-aware on purpose. The `u` flag makes the character class operate on
// code points, so the em dash in the template's
// "Claude Code — machine-local MCP registration ..." banner is one character
// inside one run of non-alphanumerics and collapses to a single '-'.
function slugifySectionTitle(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

// --------------------------------------------------------------- reports ----

function scopePermitsLayer(entry, layerName) {
  if (layerName === 'target') return true;
  const scope = entry && typeof entry.scope === 'string' ? entry.scope : 'either';
  if (scope === 'either') return true;
  return scope === layerName;
}

function escapeCell(text) {
  return String(text === undefined || text === null ? '' : text).replace(/\|/g, '\\|');
}

function companionPath(valuesFile) {
  return path.join(path.dirname(valuesFile), 'bootstrap-prefs.README.md');
}

// The companion is OUTPUT, never input. Regenerated on every successful write
// (including a no-op set — the schema may have changed since the last one).
function renderCompanion(valuesFile, layerName, schema, data) {
  const rows = [];
  for (const [key, entry] of Object.entries(schema)) {
    if (!isPlainObject(entry)) continue;
    if (!scopePermitsLayer(entry, layerName)) continue;

    // Dynamic patterns describe a family; list the concrete keys this file
    // actually holds instead of the `.*` placeholder.
    if (entry.dynamic === true && key.endsWith('.*')) {
      const prefix = key.slice(0, -1);
      const concrete = Object.keys(data).filter((k) => k.length > prefix.length && k.startsWith(prefix));
      if (concrete.length === 0) {
        rows.push({ key, entry, value: null, layer: 'unset' });
      } else {
        for (const k of concrete.sort()) {
          rows.push({ key: k, entry, value: data[k], layer: layerName });
        }
      }
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== null) {
      rows.push({ key, entry, value: data[key], layer: layerName });
    } else if (entry.default !== null && entry.default !== undefined) {
      rows.push({ key, entry, value: entry.default, layer: 'default' });
    } else {
      rows.push({ key, entry, value: null, layer: 'unset' });
    }
  }

  // Anything in the values file that no row above explains is listed verbatim
  // rather than dropped — including a key whose schema scope means THIS layer
  // never consults it. A global-scope answer parked in a project file is inert,
  // and silently hiding it would leave the user believing it took effect.
  const documented = new Set(rows.map((r) => r.key));
  const unrecognized = Object.keys(data)
    .filter((k) => !documented.has(k))
    .sort()
    .map((key) => {
      const entry = lookupSchema(schema, key);
      const scope = entry && typeof entry.scope === 'string' ? entry.scope : null;
      return {
        key,
        value: data[key],
        reason:
          entry === null
            ? 'no entry in the preference schema'
            : `scope is \`${scope}\` — this layer never consults it, so it has no effect here`,
      };
    });

  const installerRows = rows.filter((r) => r.entry.consumer !== 'skill');
  const skillRows = rows.filter((r) => r.entry.consumer === 'skill');

  const header = (title) => [
    '',
    title,
    '',
    '| Key | Current value | Layer | What it does | Asked by |',
    '| --- | --- | --- | --- | --- |',
  ];
  const line = (r) =>
    `| \`${escapeCell(r.key)}\` | \`${escapeCell(r.layer === 'unset' ? 'unset' : formatValue(r.value))}\` | ` +
    `${escapeCell(r.layer)} | ${escapeCell(r.entry.summary)} | ${escapeCell(r.entry.askedBy)} |`;

  const out = [
    '# bootstrap-prefs — stored answers',
    '',
    '**Generated file. Every `--set` and `--unset` rewrites it, and hand edits are',
    'overwritten without warning.** Edit the values file instead, or run',
    '`/bootstrap-config`.',
    '',
    `- Describes: \`${path.basename(valuesFile)}\` in this directory (\`${valuesFile}\`)`,
    `- Layer: **${layerName}**`,
    `- Regenerated: ${new Date().toISOString()}`,
    '',
    'A key that is absent from the values file is **unset** — that is the whole',
    'representation; `null` and the string `"unset"` are never written. Deleting a',
    'key is how you re-open a question.',
    '',
    '**No preference key ever holds a secret** — no API key, token, or password',
    'belongs in the values file or in this companion. Keep it that way when adding',
    'a key.',
  ];

  if (installerRows.length > 0) {
    out.push(...header('## Installer preferences'));
    out.push(...installerRows.map(line));
  }
  if (skillRows.length > 0) {
    out.push(...header('## Skill preferences — changing these changes what a command does'));
    out.push(...skillRows.map(line));
    out.push('');
    out.push('These keys are read by slash commands at run time. Changing one changes the');
    out.push('behaviour of that command everywhere it runs from this layer.');
  }

  out.push('');
  out.push('## Unrecognized keys');
  out.push('');
  if (unrecognized.length === 0) {
    out.push('None — every key in the values file is described above.');
  } else {
    out.push('Present in the values file but not explained by the tables above. They are');
    out.push('kept untouched so a file written by a newer bootstrap round-trips unchanged.');
    out.push('');
    for (const row of unrecognized) {
      out.push(`- \`${row.key}\` = \`${formatValue(row.value)}\` — ${row.reason}`);
    }
  }

  const selector =
    layerName === 'global' ? '--global' : layerName === 'project' ? '--project <dir>' : `--target ${valuesFile}`;
  out.push('');
  out.push('## Changing your mind');
  out.push('');
  out.push('Re-open a question (removes the key, so the next run asks again):');
  out.push('');
  out.push('```');
  out.push(`node lib/scripts/bootstrap-prefs.js --unset <key> ${selector}`);
  out.push('```');
  out.push('');
  out.push('Or run `/bootstrap-config` to view, edit, and reset every stored answer.');
  out.push('');

  return out.join('\n');
}

function writeCompanion(valuesFile, layerName, schema, data) {
  writeAtomic(companionPath(valuesFile), renderCompanion(valuesFile, layerName, schema, data));
}

// ------------------------------------------------------------------ main ----

const opts = parseArgs(process.argv.slice(2));
const operation =
  opts.op === 'list' || opts.op === 'section-key' ? `--${opts.op}` : `--${opts.op} ${opts.key}`;

if (opts.op === 'section-key') {
  const slug = slugifySectionTitle(opts.title);
  if (slug === '') {
    console.error(`Error: "${opts.title}" slugifies to an empty string; it cannot name a preference key`);
    process.exit(1);
  }
  console.log(`gitignore.section.${slug}`);
  process.exit(0);
}

const schema = loadSchema(opts.schema);

if (opts.op === 'get') {
  const entry = lookupSchema(schema, opts.key);
  const { value, layer } = resolve(opts.key, entry, opts);
  // Print the literal word `unset`, never an empty line: an empty capture is
  // indistinguishable from a crashed script and a shell caller would read it
  // as a decline.
  console.log(layer === 'unset' ? 'unset' : formatValue(value));
  process.exit(0);
}

if (opts.op === 'list') {
  const consulted = [];
  if (opts.target !== null) {
    consulted.push({ layer: 'target', file: opts.target });
  } else {
    if (opts.projectDir !== null) consulted.push({ layer: 'project', file: projectFile(opts.projectDir) });
    consulted.push({ layer: 'global', file: globalFile() });
  }

  const groups = new Map();
  const dynamicPrefixes = [];
  const add = (consumer, row) => {
    if (!groups.has(consumer)) groups.set(consumer, []);
    groups.get(consumer).push(row);
  };
  for (const [key, entry] of Object.entries(schema)) {
    if (!isPlainObject(entry)) continue;
    const consumer = typeof entry.consumer === 'string' ? entry.consumer : 'other';

    // A `dynamic: true` pattern names a family, not a key. Show the concrete
    // keys the consulted files actually hold; fall back to the pattern itself
    // so the family is still documented when nothing has been answered.
    if (entry.dynamic === true && key.endsWith('.*')) {
      const prefix = key.slice(0, -1);
      dynamicPrefixes.push(prefix);
      const concrete = new Set();
      for (const { file } of consulted) {
        for (const k of Object.keys(readLayer(file))) {
          if (k.length > prefix.length && k.startsWith(prefix)) concrete.add(k);
        }
      }
      if (concrete.size === 0) {
        add(consumer, { key, entry, value: null, layer: 'unset' });
      } else {
        for (const k of [...concrete].sort()) {
          const r = resolve(k, entry, opts);
          add(consumer, { key: k, entry, value: r.value, layer: r.layer });
        }
      }
      continue;
    }

    const { value, layer } = resolve(key, entry, opts);
    add(consumer, { key, entry, value, layer });
  }

  const order = ['installer', 'skill'];
  const consumers = [
    ...order.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !order.includes(c)).sort(),
  ];

  for (const consumer of consumers) {
    console.log('');
    console.log(
      consumer === 'skill'
        ? 'skill — read by slash commands at run time; changing these changes what a command does'
        : `${consumer} — read by the setup/update scripts`
    );
    for (const row of groups.get(consumer)) {
      const shown = row.layer === 'unset' ? 'unset' : formatValue(row.value);
      console.log(`  ${row.key} = ${shown}  [${row.layer}]`);
      if (row.entry.summary) console.log(`      ${row.entry.summary}`);
    }
  }

  const seen = new Map();
  for (const { layer, file } of consulted) {
    for (const key of Object.keys(readLayer(file))) {
      if (Object.prototype.hasOwnProperty.call(schema, key)) continue;
      if (dynamicPrefixes.some((p) => key.length > p.length && key.startsWith(p))) continue;
      if (!seen.has(key)) seen.set(key, { layer, value: readLayer(file)[key] });
    }
  }
  if (seen.size > 0) {
    console.log('');
    console.log('unrecognized — present in a values file, absent from the schema (kept untouched)');
    for (const [key, info] of [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${key} = ${formatValue(info.value)}  [${info.layer}]`);
    }
  }

  console.log('');
  if (opts.target !== null) {
    console.log(`Showing ${opts.target} only (--target bypasses layer resolution).`);
  } else if (opts.projectDir === null) {
    console.log('No --project given: the project layer was not consulted; showing the global layer only.');
  } else {
    console.log(`Layers: project (${projectFile(opts.projectDir)}) then global (${globalFile()}).`);
  }
  process.exit(0);
}

// ------------------------------------------------------------- write ops ----

const targetFile =
  opts.target !== null ? opts.target : opts.global ? globalFile() : projectFile(opts.projectDir);
const targetLayer = opts.target !== null ? 'target' : opts.global ? 'global' : 'project';

if (opts.op === 'set') {
  if (opts.value === 'unset' || opts.value === 'null') {
    console.error(
      `Error: "${opts.value}" is not a storable value — absence is how a key is unset. ` +
        `Use: --unset ${opts.key}`
    );
    process.exit(1);
  }

  const entry = lookupSchema(schema, opts.key);
  if (entry === null) {
    // Forward compatibility: a values file written by a newer bootstrap must
    // round-trip through an older helper unchanged. Unfamiliar KEYS are fine;
    // invalid VALUES are the thing that must hard-fail.
    warn(`"${opts.key}" is not in the preference schema — writing it anyway`);
  } else {
    const allowed = allowedValues(entry);
    if (allowed !== null && !allowed.includes(opts.value)) {
      console.error(
        `Error: "${opts.value}" is not a legal value for ${opts.key} — expected one of: ${allowed.join(', ')}`
      );
      process.exit(1);
    }

    // BUG-0009: --set validated the value grammar but never the key's scope,
    // so a global-scope key could be written into a project file (or vice
    // versa) — the write succeeded, printed an affirmative line, and landed
    // in a layer resolve() never walks for that scope, so it silently did
    // nothing. --target is exempt (scopePermitsLayer returns true for it
    // unconditionally); --unset is deliberately left permissive elsewhere,
    // since unsetting an inert key is harmless and is the documented
    // workaround for a key already stuck in the wrong layer.
    if (!scopePermitsLayer(entry, targetLayer)) {
      const correctLayer =
        entry.scope === 'global' ? '--global' : entry.scope === 'project' ? '--project <dir>' : '--global or --project <dir>';
      console.error(
        `Error: "${opts.key}" is scope: ${entry.scope} — the ${targetLayer} layer never reads it, so this write ` +
          `would be inert. Use ${correctLayer} instead, or --target <path> to force a specific file.`
      );
      process.exit(1);
    }
  }

  // 'true'/'false' become JSON booleans; everything else is a JSON string.
  // Storing "false" as a string would be truthy in every shell test and would
  // read back as a settled true.
  const coerced = opts.value === 'true' ? true : opts.value === 'false' ? false : opts.value;

  const { text, data } = readWritableTarget(targetFile);
  const unchanged = Object.prototype.hasOwnProperty.call(data, opts.key) && data[opts.key] === coerced;
  data[opts.key] = coerced;
  writeValues(targetFile, data, detectIndent(text));
  writeCompanion(targetFile, targetLayer, schema, data);
  console.log(
    unchanged
      ? `${targetLayer}: ${opts.key} already ${formatValue(coerced)}`
      : `${targetLayer}: ${opts.key} = ${formatValue(coerced)}`
  );
  process.exit(0);
}

if (opts.op === 'unset') {
  if (!fs.existsSync(targetFile)) {
    console.log(`${targetLayer}: ${opts.key} was already unset (no preferences file at ${targetFile})`);
    process.exit(0);
  }
  const { text, data } = readWritableTarget(targetFile);
  const present = Object.prototype.hasOwnProperty.call(data, opts.key);
  if (present) {
    delete data[opts.key];
    writeValues(targetFile, data, detectIndent(text));
  }
  writeCompanion(targetFile, targetLayer, schema, data);
  console.log(
    present
      ? `${targetLayer}: ${opts.key} unset — the question is re-opened`
      : `${targetLayer}: ${opts.key} was already unset`
  );
  process.exit(0);
}
