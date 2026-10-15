#!/usr/bin/env node
// Interactive terminal menu for the bootstrap preference store — view, edit,
// and reset any bootstrap-prefs.json key from a plain terminal, with no Claude
// Code session. It is the readline port of the /bootstrap-config skill's
// Step A-G algorithm (lib/skills/bootstrap-config/SKILL.md).
//
// THE ENGINE IS THE ONLY WRITER. Every read (--list / --get / --section-key)
// and every write (--set / --unset) is a child-process call to the sibling
// bootstrap-prefs.js. This file never require()s the engine and never writes
// bootstrap-prefs.json or bootstrap-prefs.README.md itself, so schema
// validation, the scope-refusal rule (BUG-0009), true/false coercion, and
// atomic writes are inherited unchanged. A non-zero engine exit is surfaced
// verbatim and never retried or worked around.
//
// Scope is bootstrap-prefs.json only — never Claude Code's settings.json.
//
// Usage:
//   bootstrap-prefs-tui.js [--global] [--project <dir>] [--schema <path>]
//   bootstrap-prefs-tui.js -h | --help
//
//   --global          pin every edit/reset to the global layer
//   --project <dir>   use <dir> as the project (and pin edits to the project layer)
//   --schema <path>   alternate schema; forwarded to the engine only when it is
//                     not the default templates/bootstrap-prefs-schema.json
//
// The pure helpers (parseArgs, parseValues, resolveEntry, permittedLayers,
// parseListOutput, groupRows, resolveProjectDir, formatRow, renderSummary,
// buildKeyOptions, renderKeyDetail, familyExamples) are exported for tests, along
// with the input helpers (createReader, ask, pickFromList); the menu only runs
// under `require.main === module`.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, 'bootstrap-prefs.js');
const DEFAULT_SCHEMA = path.join(__dirname, 'templates', 'bootstrap-prefs-schema.json');

const USAGE = [
  'Usage:',
  '  bootstrap-prefs-tui.js [--global] [--project <dir>] [--schema <path>]',
  '  bootstrap-prefs-tui.js -h | --help',
].join('\n');

const ROW_RE = /^ {2}(\S+) = (.*?) {2}\[(target|project|global|default|unset)\]\s*$/;
const SUMMARY_RE = /^ {6}(\S.*?)\s*$/;
const GROUP_HEADER_RE = /^(\S+) — (.*)$/;
const TRAILER_RE = /^(Showing .*|No --project given.*|Layers: .*)$/;

const CONSUMER_TITLES = {
  installer: 'Installer preferences',
  skill: 'Skill preferences',
  unrecognized: 'Unrecognized keys',
};

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

// parseArgs(argv) -> { help, global, project, schema, pin, error }
//   argv     process.argv.slice(2)
//   project  the --project <dir> operand, or null
//   schema   the --schema <path> operand, or null
//   pin      'global' | 'project' | null — the layer pinned by a flag
//   error    usage-error message, or null. The caller prints it plus USAGE to
//            stderr and exits 2.
function parseArgs(argv) {
  const out = { help: false, global: false, project: null, schema: null, pin: null, error: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.help = true;
    } else if (arg === '--global') {
      out.global = true;
    } else if (arg === '--project' || arg === '--schema') {
      const operand = argv[i + 1];
      if (operand === undefined || operand.startsWith('--')) {
        out.error = `${arg} requires an operand`;
        return out;
      }
      out[arg.slice(2)] = operand;
      i++;
    } else {
      out.error = `unknown argument: ${arg}`;
      return out;
    }
  }
  if (out.global && out.project !== null) {
    out.error = '--global and --project are mutually exclusive';
    return out;
  }
  out.pin = out.global ? 'global' : out.project !== null ? 'project' : null;
  return out;
}

// ---------------------------------------------------------------------------
// Engine wrapper
// ---------------------------------------------------------------------------

// runEngine(args, opts) -> { status, stdout, stderr }
//   args        engine argv, e.g. ['--list', '--project', dir]
//   opts.schema schema path; forwarded as --schema only when it differs from
//               DEFAULT_SCHEMA
// Never throws on a non-zero exit. A spawn failure yields status 1 with the
// error message in stderr.
function runEngine(args, opts) {
  const schema = opts && opts.schema;
  const schemaArgs =
    schema && path.resolve(schema) !== path.resolve(DEFAULT_SCHEMA) ? ['--schema', schema] : [];
  const result = spawnSync(process.execPath, [ENGINE, ...args, ...schemaArgs], {
    encoding: 'utf8',
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// loadSchema(file) -> schema object (flat map key -> entry). A missing or
// malformed schema warns on stderr and yields {} — the menu still runs, with
// no descriptions or value lists, exactly as the engine degrades.
function loadSchema(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    process.stderr.write(`Warning: cannot read preference schema at ${file} (${err.message})\n`);
    return {};
  }
  if (!isPlainObject(parsed)) {
    process.stderr.write(`Warning: preference schema at ${file} is not a JSON object\n`);
    return {};
  }
  return parsed;
}

// resolveEntry(schema, key) -> entry | null
// Exact match first (this also matches the `guides.*` / `gitignore.section.*`
// pattern rows themselves), then a dynamic-prefix match mirroring the engine's
// lookupSchema: a `dynamic: true` pattern `<prefix>.*` matches any key that is
// longer than `<prefix>.` and starts with it.
function resolveEntry(schema, key) {
  if (Object.prototype.hasOwnProperty.call(schema, key)) return schema[key];
  for (const [pattern, entry] of Object.entries(schema)) {
    if (!isPlainObject(entry) || entry.dynamic !== true || !pattern.endsWith('.*')) continue;
    const prefix = pattern.slice(0, -1);
    if (key.length > prefix.length && key.startsWith(prefix)) return entry;
  }
  return null;
}

// parseValues(entry) -> string[]
// The legal values, from the entry's `values` string ("a | b | c"). Empty array
// when there is no entry or no values string. Never hardcode a value list.
function parseValues(entry) {
  if (!entry || typeof entry.values !== 'string') return [];
  return entry.values
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// permittedLayers(entry, projectDir, pin) -> { layers, error }
//   entry       schema entry or null (null is treated as scope 'either')
//   projectDir  resolved project directory or null
//   pin         'global' | 'project' | null
//   layers      [{ layer: 'project'|'global', args: [...engine layer flags] }]
//               project -> ['--project', projectDir]; global -> ['--global']
//   error       null, or a plain-language reason no layer is available (layers
//               is then [])
//
// Scope rules: project -> project only; global -> global only; either -> both
// (project only when projectDir is set). A pin restricts the result to that
// layer and is returned even when it contradicts the scope, so the engine's own
// refusal is what the user sees. A project layer is never offered without a
// projectDir, and scope 'project' never falls back to global.
function permittedLayers(entry, projectDir, pin) {
  const scope = entry && typeof entry.scope === 'string' ? entry.scope : 'either';
  const projectLayer = () => ({ layer: 'project', args: ['--project', projectDir] });
  const globalLayer = () => ({ layer: 'global', args: ['--global'] });
  const noProject = (why) => ({
    layers: [],
    error: `${why} but no project directory was found (no .git or .claude/ above the current directory and no --project given). Run from a project, or pass --project <dir>.`,
  });

  if (pin === 'project') {
    return projectDir ? { layers: [projectLayer()], error: null } : noProject('The project layer is pinned');
  }
  if (pin === 'global') return { layers: [globalLayer()], error: null };

  if (scope === 'project') {
    return projectDir ? { layers: [projectLayer()], error: null } : noProject('This key is project-scoped');
  }
  if (scope === 'global') return { layers: [globalLayer()], error: null };
  return {
    layers: projectDir ? [projectLayer(), globalLayer()] : [globalLayer()],
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Engine --list parsing and grouping
// ---------------------------------------------------------------------------

// parseListOutput(text) -> { rows, groups, unrecognized, trailer }
//   rows          flat, in printed order:
//                 { key, value, layer, summary, group, placeholder }
//                   value        text as printed ('unset' when layer is unset)
//                   layer        'target'|'project'|'global'|'default'|'unset'
//                   summary      the 6-space-indented line under the row, or ''
//                                (unrecognized rows never have one)
//                   group        the header's leading word ('installer',
//                                'skill', 'unrecognized', ...); '' if a row
//                                appears before any header
//                   placeholder  true for a dynamic-family pattern row such as
//                                `guides.* = unset  [unset]` (key ends '.*')
//   groups        [{ name, header, rows }] in printed order
//   unrecognized  the rows whose group is 'unrecognized'
//   trailer       the engine's closing line ('Showing ...' / 'No --project
//                 given...' / 'Layers: ...'), or null
// Rows have exactly two leading spaces and summaries six, so indentation, not
// the row regex alone, separates them. Unmatched lines are ignored.
function parseListOutput(text) {
  const rows = [];
  const groups = [];
  let group = null;
  let last = null;
  let trailer = null;

  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim() === '') continue;

    const summary = line.match(SUMMARY_RE);
    if (summary && last && /^ {6}\S/.test(line)) {
      last.summary = summary[1];
      continue;
    }

    const row = line.match(ROW_RE);
    if (row) {
      last = {
        key: row[1],
        value: row[2],
        layer: row[3],
        summary: '',
        group: group ? group.name : '',
        placeholder: row[1].endsWith('.*'),
      };
      rows.push(last);
      if (group) group.rows.push(last);
      continue;
    }

    if (/^\S/.test(line)) {
      if (TRAILER_RE.test(line)) {
        trailer = line;
        last = null;
        group = null;
        continue;
      }
      const header = line.match(GROUP_HEADER_RE);
      if (header) {
        group = { name: header[1], header: line, rows: [] };
        groups.push(group);
        last = null;
      }
    }
  }

  return {
    rows,
    groups,
    unrecognized: rows.filter((r) => r.group === 'unrecognized'),
    trailer,
  };
}

// groupRows(rows, schema) -> [{ consumer, title, rows }]
// Groups parsed rows by their schema entry's `consumer`, in the skill's order:
// installer, skill, any other consumer (alphabetical), then unrecognized.
// A row is unrecognized when the engine grouped it that way or the schema has
// no entry for its key. Each returned row is a copy carrying `entry` (the
// schema entry or null) and a `summary` filled from the schema when the engine
// printed none. Empty groups are omitted.
function groupRows(rows, schema) {
  const buckets = new Map();
  const put = (consumer, row) => {
    if (!buckets.has(consumer)) buckets.set(consumer, []);
    buckets.get(consumer).push(row);
  };

  for (const row of rows) {
    const entry = resolveEntry(schema, row.key);
    const consumer =
      row.group === 'unrecognized' || !entry
        ? 'unrecognized'
        : typeof entry.consumer === 'string'
          ? entry.consumer
          : 'installer';
    put(consumer, { ...row, entry, summary: row.summary || (entry && entry.summary) || '' });
  }

  const others = [...buckets.keys()]
    .filter((c) => c !== 'installer' && c !== 'skill' && c !== 'unrecognized')
    .sort();
  return ['installer', 'skill', ...others, 'unrecognized']
    .filter((c) => buckets.has(c))
    .map((c) => ({ consumer: c, title: CONSUMER_TITLES[c] || c, rows: buckets.get(c) }));
}

// ---------------------------------------------------------------------------
// State read and grouped summary (Step A, B, B2)
// ---------------------------------------------------------------------------

const CONSUMER_NOTES = {
  installer: 'read by the setup/update scripts',
  skill: 'read by slash commands at run time; changing these changes what a command does',
  unrecognized: 'present in a values file, absent from the schema (kept untouched)',
};

const FAMILY_NOTES = {
  'guides.*':
    'family: one key per optional guide (guides.<name>) holding the remembered install answer for that guide. None stored yet.',
  'gitignore.section.*':
    'family: one key per .gitignore section (gitignore.section.<slug>); each holds only `false`, a permanently declined section. None stored yet.',
};

// resolveProjectDir(cwd, projectFlag) -> absolute project dir | null
// --project <dir> wins (resolved to an absolute path). Otherwise the nearest
// ancestor of cwd (cwd included) holding a `.git` (file or directory) or a
// `.claude/` directory. The home directory is not treated as a project on the
// strength of its `.claude/` alone: ~/.claude/bootstrap-prefs.json is the global
// layer, so calling ~ a project would make both layers the same file. No match
// gives null (global layer only).
function resolveProjectDir(cwd, projectFlag) {
  if (projectFlag) return path.resolve(projectFlag);
  const home = path.resolve(os.homedir());
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (dir !== home && fs.existsSync(path.join(dir, '.claude'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// readState(ctx) -> { ok, status, stderr, rows, groups, unrecognized, trailer }
//   ctx  { schemaPath, projectDir, ... }
// Runs `--list` (always with `--project <dir>` when a project is resolved, since
// omitting it silently hides project answers) and parses the text. ok is false
// on a non-zero engine exit; stderr then carries the engine's message verbatim
// (on success it may still hold engine warnings). Rows are as parseListOutput
// returns them.
function readState(ctx) {
  const projectArgs = ctx && ctx.projectDir ? ['--project', ctx.projectDir] : [];
  const result = runEngine(['--list', ...projectArgs], { schema: ctx && ctx.schemaPath });
  const parsed = parseListOutput(result.stdout);
  return { ok: result.status === 0, status: result.status, stderr: result.stderr, ...parsed };
}

// describeRow(row) -> string — the value column, with its meaning spelled out.
// `false` is a remembered decline only for installer keys (and a declined
// section for gitignore.section.*); on a skill key it is an ordinary setting.
function describeRow(row) {
  const entry = row.entry || null;
  const consumer = entry && typeof entry.consumer === 'string' ? entry.consumer : 'installer';
  if (row.layer === 'unset') {
    if (row.placeholder) return 'unset';
    if (consumer === 'skill') {
      const fallback = entry && entry.default !== null && entry.default !== undefined
        ? `falls back to ${entry.default}`
        : 'no stored answer';
      return `unset (${fallback})`;
    }
    return 'unset (not answered yet, the installer will ask)';
  }
  if (row.value === 'false') {
    if (row.key.startsWith('gitignore.section.')) return 'false (declined section)';
    if (consumer === 'installer') return 'false (remembered decline)';
    return 'false';
  }
  if (row.value === 'ask') return 'ask (prompts each time)';
  return row.value;
}

// formatRow(row) -> string (no trailing newline)
//   row  a groupRows() row: { key, value, layer, summary, placeholder, entry }
// Line 1: `  <key> = <described value>  [<layer>]`; `[default]` is spelled out as
// "no stored answer". Then the summary (6-space indent) and, for a dynamic
// family placeholder, a one-line family explanation.
function formatRow(row) {
  const layerTag = row.layer === 'default' ? '[default: no stored answer]' : `[${row.layer}]`;
  const lines = [`  ${row.key} = ${describeRow(row)}  ${layerTag}`];
  if (row.summary) lines.push(`      ${row.summary}`);
  if (row.placeholder) {
    const family = FAMILY_NOTES[row.key] || (row.entry && row.entry.detail) || '';
    if (family) lines.push(`      ${family}`);
  }
  return lines.join('\n');
}

// renderSummary(rows, schema, opts) -> string (ends with a newline)
//   rows  parseListOutput().rows
//   opts  { trailer } — the engine's closing line, passed through when present
//         (notably "No --project given: ..."). Nothing is printed for a null
//         trailer.
// Groups by schema consumer in the skill's order (Installer, Skill, other
// consumers, Unrecognized). Pure: returns the text, writes nothing.
function renderSummary(rows, schema, opts) {
  const blocks = groupRows(rows, schema).map((g) => {
    const header = `${g.title} — ${CONSUMER_NOTES[g.consumer] || `read by ${g.consumer}`}`;
    return [header, ...g.rows.map(formatRow)].join('\n');
  });
  let text = blocks.length ? `${blocks.join('\n\n')}\n` : 'No preferences to show.\n';
  const trailer = opts && opts.trailer;
  if (trailer) text += `\n${trailer}\n`;
  return text;
}

// printSummary(rows, schema, opts) — writes renderSummary(...) to stdout.
function printSummary(rows, schema, opts) {
  process.stdout.write(`\n${renderSummary(rows, schema, opts)}\n`);
}

// ---------------------------------------------------------------------------
// Interactive menu
// ---------------------------------------------------------------------------

// --- Input: a line-queue reader ---------------------------------------------
//
// readline on a piped (non-TTY) stdin can emit 'close' before every queued line
// has been consumed by a question callback, so rl.question() loses scripted
// answers. Instead every 'line' event is pushed onto a queue (or handed straight
// to a pending ask) and 'close' only marks EOF; queued lines are always drained
// first. EOF surfaces as an EofError thrown from ask(), which runMenu catches
// once at the top — callers never need to test for it.

class EofError extends Error {
  constructor() {
    super('end of input');
    this.name = 'EofError';
  }
}

const EOF = Symbol('eof');

// createReader(input, output) -> reader { rl, input, output, tty, queue,
//   waiters, closed, close() }. Defaults to process.stdin / process.stdout.
// Ctrl-C on a TTY closes the reader, which reads as EOF.
function createReader(input, output) {
  const inp = input || process.stdin;
  const out = output || process.stdout;
  const tty = Boolean(inp.isTTY && out.isTTY);
  const rl = readline.createInterface({ input: inp, output: out, terminal: tty });
  const reader = {
    rl,
    input: inp,
    output: out,
    tty,
    queue: [],
    waiters: [],
    closed: false,
    close() {
      if (!reader.closed) rl.close();
    },
  };
  rl.on('line', (line) => {
    const waiter = reader.waiters.shift();
    if (waiter) waiter(line);
    else reader.queue.push(line);
  });
  rl.on('close', () => {
    reader.closed = true;
    for (const waiter of reader.waiters.splice(0)) waiter(EOF);
  });
  rl.on('SIGINT', () => rl.close());
  return reader;
}

// ask(rl, prompt) -> Promise<string> — the next input line, trimmed.
//   rl  a createReader() reader
// Throws EofError at end of input (after every queued line has been consumed).
// On a non-TTY input the prompt and the answer are echoed to the output so a
// piped session leaves a readable transcript.
async function ask(rl, prompt) {
  const echo = !rl.tty;
  if (rl.queue.length === 0 && rl.closed) throw new EofError();
  if (echo) rl.output.write(prompt);

  let line;
  if (rl.queue.length > 0) {
    line = rl.queue.shift();
  } else {
    if (!echo) {
      rl.rl.setPrompt(prompt);
      rl.rl.prompt();
    }
    line = await new Promise((resolve) => rl.waiters.push(resolve));
    if (line === EOF) {
      rl.output.write('\n');
      throw new EofError();
    }
  }
  if (echo) rl.output.write(`${line}\n`);
  return line.trim();
}

function isBackToken(answer) {
  const a = answer.toLowerCase();
  return a === '0' || a === 'b' || a === 'back';
}

// askNonEmpty(rl, prompt) -> Promise<string | null>
// Re-prompts on empty input. Returns null when the user types b / back / 0.
async function askNonEmpty(rl, prompt) {
  for (;;) {
    const answer = await ask(rl, prompt);
    if (answer === '') {
      process.stdout.write('Please type a value, or b to go back.\n');
      continue;
    }
    if (isBackToken(answer)) return null;
    return answer;
  }
}

// pickFromList(rl, title, options, opts) -> Promise<option | null>
//   options  [{ label, group?, ...anything }] — printed as a numbered list; a
//            changed `group` string prints a heading line above that option
//   opts     { backLabel } — text of the Back entry (numbered 0; 'b' / 'back'
//            also accepted). Default 'Back'. Pass backLabel: null for a menu
//            with no Back entry (the main menu, whose Quit is an option).
// Returns the chosen option object, or null for Back. Re-prompts on empty,
// non-numeric, or out-of-range input.
async function pickFromList(rl, title, options, opts) {
  const backLabel = opts && opts.backLabel !== undefined ? opts.backLabel : 'Back';
  if (options.length === 0) return null;

  const lines = [''];
  if (title) lines.push(title);
  let group;
  options.forEach((option, i) => {
    if (option.group && option.group !== group) {
      group = option.group;
      lines.push(`  ${group}`);
    }
    lines.push(`   ${String(i + 1).padStart(2)}) ${option.label}`);
  });
  if (backLabel) lines.push(`    0) ${backLabel}`);
  process.stdout.write(`${lines.join('\n')}\n`);

  const range = `1-${options.length}${backLabel ? ', 0 = back' : ''}`;
  for (;;) {
    const answer = await ask(rl, `Choose [${range}]: `);
    if (backLabel && isBackToken(answer)) return null;
    if (/^\d+$/.test(answer)) {
      const n = Number(answer);
      if (n >= 1 && n <= options.length) return options[n - 1];
    }
    process.stdout.write(
      `Please enter a number from 1 to ${options.length}${backLabel ? ' (or 0 to go back)' : ''}.\n`
    );
  }
}

// --- Key picker (Step D) ----------------------------------------------------

const GROUP_HEADINGS = {
  installer: 'Installer preferences (only change what setup/update ask)',
  skill: 'Skill preferences (change what a slash command does)',
  unrecognized: 'Unrecognized keys (not in the schema)',
};

const FAMILY_ACTIONS = {
  'gitignore.section.*': 'derive a slug from a section title, or type one',
  'guides.*': 'enter a guide name',
};

// describeCurrent(row) -> '<value>, <layer>' | 'unset' — the parenthesised part
// of a picker label.
function describeCurrent(row) {
  if (row.layer === 'unset') return 'unset';
  return `${row.value}, ${row.layer}`;
}

function familyOption(pattern, entry, summary) {
  const action = FAMILY_ACTIONS[pattern] || 'enter a key under this family';
  const text = summary || (entry && entry.summary) || '';
  return {
    action: 'family',
    key: pattern,
    pattern,
    consumer: entry && typeof entry.consumer === 'string' ? entry.consumer : 'installer',
    label: `${pattern}${text ? ` — ${text}` : ''} (family: ${action})`,
  };
}

// buildKeyOptions(rows, schema, opts) -> { options, hidden }
//   rows    parseListOutput().rows
//   opts    { mode: 'edit' | 'reset', pin: 'global' | 'project' | null }
//   options picker entries in group order (installer, skill, ...), each
//           { action: 'key' | 'family' | 'free', key, label, group, consumer,
//             row?, pattern? }. `group` is the heading; consumer:skill keys and
//           consumer:installer keys therefore print under separate headings.
//           Labels read `<key> — <summary> (<value>, <layer>)`.
//   hidden  reset mode only: [{ key, layer }] for keys left out because nothing
//           is stored for them in a writable layer ([unset] / [default] /
//           [target], or a layer other than the pinned one)
// Edit mode lists every schema-known key, one option per stored concrete
// dynamic-family key, and one family action per dynamic pattern (from the
// engine's placeholder row, or synthesized from the schema when concrete keys
// hide the placeholder). Reset mode lists only rows whose layer is writable,
// plus unrecognized keys stored there. A free-text entry closes both lists.
function buildKeyOptions(rows, schema, opts) {
  const mode = opts && opts.mode === 'reset' ? 'reset' : 'edit';
  const pin = (opts && opts.pin) || null;
  const writable = pin ? [pin] : ['project', 'global'];
  const groups = [];
  const hidden = [];

  for (const g of groupRows(rows, schema)) {
    if (g.consumer === 'unrecognized' && mode === 'edit') continue;
    const options = [];
    for (const row of g.rows) {
      if (row.placeholder) {
        if (mode === 'edit') options.push(familyOption(row.key, row.entry, row.summary));
        continue;
      }
      if (mode === 'reset' && !writable.includes(row.layer)) {
        hidden.push({ key: row.key, layer: row.layer });
        continue;
      }
      options.push({
        action: 'key',
        key: row.key,
        consumer: g.consumer,
        row,
        label: `${row.key}${row.summary ? ` — ${row.summary}` : ''} (${describeCurrent(row)})`,
      });
    }
    groups.push({ consumer: g.consumer, options });
  }

  if (mode === 'edit') {
    for (const [pattern, entry] of Object.entries(schema)) {
      if (!isPlainObject(entry) || entry.dynamic !== true || !pattern.endsWith('.*')) continue;
      if (groups.some((g) => g.options.some((o) => o.pattern === pattern))) continue;
      const consumer = typeof entry.consumer === 'string' ? entry.consumer : 'installer';
      let group = groups.find((g) => g.consumer === consumer);
      if (!group) {
        group = { consumer, options: [] };
        groups.push(group);
      }
      group.options.push(familyOption(pattern, entry, entry.summary));
    }
  }

  const options = [];
  for (const g of groups) {
    const heading = GROUP_HEADINGS[g.consumer] || `${g.consumer} preferences`;
    for (const o of g.options) options.push({ ...o, group: heading });
  }
  options.push({ action: 'free', key: null, label: 'Enter a key by name', group: 'Other' });
  return { options, hidden };
}

// skillCommand(entry) -> '/command' | null — the slash command a skill
// preference affects, read from the entry's summary (`How /git-commit ...`).
function skillCommand(entry) {
  const text = `${entry.summary || ''}`;
  const m = text.match(/(?:^|[\s(])(\/[a-z][a-z0-9-]*)/);
  return m ? m[1] : null;
}

// renderKeyDetail(schema, key) -> string (ends with a newline)
// The schema `detail` in full, then the framing for the key's consumer: the
// heavier "skill preference" banner (naming the affected command) or the lighter
// installer framing.
function renderKeyDetail(schema, key) {
  const entry = resolveEntry(schema, key);
  const lines = ['', key];
  if (!entry) {
    lines.push(
      '  This key is not in the preference schema, so there is no description or value list for it.'
    );
    return `${lines.join('\n')}\n`;
  }
  if (entry.summary) lines.push(`  ${entry.summary}`);
  if (entry.detail) lines.push('', entry.detail);
  lines.push('');
  if (entry.consumer === 'skill') {
    const command = skillCommand(entry);
    lines.push(
      'This is a SKILL PREFERENCE. Changing it changes what a slash command actually does the next time it runs — not merely whether the installer asks you a question.'
    );
    lines.push(
      command
        ? `Affected command: ${command}`
        : `Affects: ${entry.summary || 'a slash command or hook'}`
    );
  } else {
    lines.push(
      `This is an installer preference. It only affects whether ${
        entry.askedBy ? `${entry.askedBy} (a setup/update script)` : 'a setup/update script'
      } prompts you; it does not change what any slash command does.`
    );
  }
  return `${lines.join('\n')}\n`;
}

// familyExamples(entry, prefix) -> string[] — example key suffixes mentioned in
// the family entry's `detail` (e.g. 'evals-framework.md' for `guides.`).
function familyExamples(entry, prefix) {
  if (!entry || typeof entry.detail !== 'string') return [];
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = entry.detail.match(new RegExp(`${escaped}[A-Za-z0-9][\\w.-]*`, 'g')) || [];
  const suffixes = found.map((k) => k.slice(prefix.length).replace(/[.-]+$/, ''));
  return [...new Set(suffixes.filter((s) => s.length > 0))];
}

// resolveFamilyKey(ctx, rl, pattern) -> Promise<string | null>
// Turns a dynamic-family pattern (`guides.*`, `gitignore.section.*`) into one
// concrete key. gitignore.section.* offers "derive a slug from a section title"
// (engine --section-key, never a hand-rolled slugify) and states the false-only
// grammar; guides.* asks for a free-text guide name with examples from the
// schema detail. Returns null on Back or on an engine failure (its stderr is
// printed verbatim).
async function resolveFamilyKey(ctx, rl, pattern) {
  const entry = resolveEntry(ctx.schema, pattern);
  const prefix = pattern.slice(0, -1);

  if (pattern === 'gitignore.section.*') {
    process.stdout.write(
      '\ngitignore.section.<slug> — one key per titled .gitignore template section. The only storable value is `false` (a permanently declined section); there is no `true`, because an accepted section is deliberately never recorded.\n'
    );
    const how = await pickFromList(rl, 'How do you want to name the section?', [
      { label: 'Derive a slug from a section title', value: 'derive' },
      { label: 'Type a slug directly', value: 'type' },
    ]);
    if (!how) return null;
    if (how.value === 'derive') {
      const title = await askNonEmpty(rl, 'Section banner title (b to go back): ');
      if (title === null) return null;
      const result = runEngine(['--section-key', title], { schema: ctx.schemaPath });
      if (result.status !== 0) {
        process.stdout.write(`${result.stderr || 'The engine could not derive a section key.\n'}`);
        return null;
      }
      const derived = result.stdout.trim();
      if (!derived.startsWith(prefix)) {
        process.stdout.write(`Unexpected --section-key output: ${derived}\n`);
        return null;
      }
      process.stdout.write(`Derived key: ${derived}\n`);
      return derived;
    }
  }

  const examples = familyExamples(entry, prefix);
  const noun = pattern === 'guides.*' ? 'Guide name' : `Name after "${prefix}"`;
  const hint = examples.length ? ` (e.g. ${examples.join(' or ')})` : '';
  for (;;) {
    const name = await askNonEmpty(rl, `${noun}${hint}, b to go back: `);
    if (name === null) return null;
    if (/\s/.test(name)) {
      process.stdout.write('A key cannot contain whitespace.\n');
      continue;
    }
    return name.startsWith(prefix) ? name : `${prefix}${name}`;
  }
}

// chooseKey(ctx, rl, state, mode) -> Promise<string | null>
// Step D: numbered key picker (skill and installer keys under separate
// headings), free-text key entry, family actions, and Back (null). Reset mode
// lists only keys stored in a writable layer and says which keys it left out.
// Prints the schema detail and the consumer banner before returning the key.
async function chooseKey(ctx, rl, state, mode) {
  const writable = ctx.pin ? [ctx.pin] : ['project', 'global'];
  for (;;) {
    const { options, hidden } = buildKeyOptions(state.rows, ctx.schema, { mode, pin: ctx.pin });

    if (mode === 'reset') {
      if (hidden.length) {
        process.stdout.write(
          `\nNot listed — nothing stored in a writable layer (${writable.join(' or ')}), so there is nothing to reset: ${hidden
            .map((h) => `${h.key} [${h.layer}]`)
            .join(', ')}\n`
        );
      }
      if (!options.some((o) => o.action === 'key')) {
        process.stdout.write('\nNothing is stored in a writable layer, so there is nothing to reset.\n');
        return null;
      }
    }

    const title =
      mode === 'edit'
        ? 'Which preference do you want to edit?'
        : 'Which preference do you want to reset? (keys stored in a writable layer)';
    const picked = await pickFromList(rl, title, options, { backLabel: 'Back / No changes' });
    if (!picked) return null;

    let key;
    if (picked.action === 'family') {
      key = await resolveFamilyKey(ctx, rl, picked.pattern);
    } else if (picked.action === 'free') {
      key = await askNonEmpty(rl, 'Key name (b to go back): ');
      if (key !== null && /\s/.test(key)) {
        process.stdout.write('A key cannot contain whitespace.\n');
        continue;
      }
      const pattern = key !== null && isPlainObject(ctx.schema[key]) && ctx.schema[key].dynamic === true;
      if (pattern) key = await resolveFamilyKey(ctx, rl, key);
    } else {
      key = picked.key;
    }
    if (key === null) continue;

    if (mode === 'reset') {
      const row = state.rows.find((r) => r.key === key);
      if (!row || !writable.includes(row.layer)) {
        process.stdout.write(
          `\n${key} is ${row ? `[${row.layer}]` : 'not stored anywhere'} — nothing is stored in a writable layer, so there is nothing to reset.\n`
        );
        continue;
      }
    }

    process.stdout.write(renderKeyDetail(ctx.schema, key));
    return key;
  }
}

// --- Actions: edit, reset, re-verify (Steps E, F, G) ------------------------
//
// Every write below is a single runEngine() call; nothing here touches
// bootstrap-prefs.json or its README. All engine output (success line, warnings,
// refusals) is printed verbatim to stdout so a piped session leaves one
// readable, correctly ordered transcript.

const SECRET_WARNING =
  'Reminder: a preference file never holds a secret. No API key, token, or password belongs in it — not in the values file, not in the generated README, not in a new schema key.';

// shellQuote(text) -> string — quoted only when the text has shell-special
// characters, so the printed command can be copy-pasted as shown.
function shellQuote(text) {
  return /^[A-Za-z0-9_@%+=:,./~-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

// displayCommand(ctx, engineArgs) -> string — the exact command runEngine() will
// run, including --schema when the schema is not the default.
function displayCommand(ctx, engineArgs) {
  const schema = ctx.schemaPath;
  const schemaArgs =
    schema && path.resolve(schema) !== path.resolve(DEFAULT_SCHEMA) ? ['--schema', schema] : [];
  return ['node', ENGINE, ...engineArgs, ...schemaArgs].map(shellQuote).join(' ');
}

// confirmCommand(ctx, rl, engineArgs) -> Promise<boolean>
// Prints the exact command and asks y/N. Default is No; only y / yes proceeds.
async function confirmCommand(ctx, rl, engineArgs) {
  process.stdout.write(`\nAbout to run:\n  ${displayCommand(ctx, engineArgs)}\n`);
  const answer = (await ask(rl, 'Apply this change? [y/N]: ')).toLowerCase();
  if (answer === 'y' || answer === 'yes') return true;
  process.stdout.write('Cancelled. Nothing was written.\n');
  return false;
}

function layerLabel(layer, ctx) {
  return layer.layer === 'project'
    ? `Project layer (${ctx.projectDir}/.claude/bootstrap-prefs.json) — applies to this project only and wins over global, per key`
    : 'Global layer (~/.claude/bootstrap-prefs.json) — applies to every project that has no project answer for the key';
}

// pickLayer(ctx, rl, layers, explain) -> Promise<{ layer, args } | null>
// One permitted layer is stated, not asked. Two are asked, with the
// project-wins-over-global explanation. null means Back.
async function pickLayer(ctx, rl, layers, explain) {
  if (layers.length === 1) {
    process.stdout.write(`\nLayer: ${layerLabel(layers[0], ctx)}\n`);
    return layers[0];
  }
  return pickFromList(
    rl,
    `${explain}\nWhich layer?`,
    layers.map((l) => ({ ...l, label: layerLabel(l, ctx) })),
    { backLabel: 'Back / No changes' }
  );
}

// changedRows(before, after, schema, key) -> groupRows()-shaped rows
// Rows whose value or layer differs from `before` (or that are new), plus the
// written key itself — synthesized as unset when a reset removed its row.
function changedRows(before, after, schema, key) {
  const signature = (r) => `${r.value}\u0000${r.layer}`;
  const prior = new Map(before.map((r) => [r.key, signature(r)]));
  const rows = groupRows(after, schema).flatMap((g) => g.rows);
  const out = rows.filter(
    (r) => r.key === key || (!r.placeholder && prior.get(r.key) !== signature(r))
  );
  if (!out.some((r) => r.key === key)) {
    const entry = resolveEntry(schema, key);
    out.push({
      key,
      value: 'unset',
      layer: 'unset',
      summary: (entry && entry.summary) || '',
      placeholder: false,
      entry,
    });
  }
  return out;
}

// commitWrite(ctx, state, key, engineArgs, layer) -> boolean — true on success.
// Runs the engine once. A non-zero exit prints stderr verbatim and returns false
// with no retry. On success: the engine's stdout line and any warnings, then
// Step G — re-read, print the changed rows with their layers, the README
// regeneration note, and the secret warning.
function commitWrite(ctx, state, key, engineArgs, layer) {
  const result = runEngine(engineArgs, { schema: ctx.schemaPath });
  if (result.status !== 0) {
    const message =
      result.stderr || result.stdout || `The engine exited ${result.status} with no message.`;
    process.stdout.write(`\n${message}${message.endsWith('\n') ? '' : '\n'}Nothing was written.\n`);
    return false;
  }

  process.stdout.write(`\n${result.stdout}`);
  if (result.stdout && !result.stdout.endsWith('\n')) process.stdout.write('\n');
  if (result.stderr) {
    process.stdout.write(result.stderr);
    if (!result.stderr.endsWith('\n')) process.stdout.write('\n');
  }

  const after = readState(ctx);
  if (after.ok) {
    process.stdout.write('\nChanged rows (as the engine now reports them):\n');
    const rows = changedRows(state.rows, after.rows, ctx.schema, key);
    process.stdout.write(`${rows.map(formatRow).join('\n')}\n`);
    if (after.trailer && /^No --project given/.test(after.trailer)) {
      process.stdout.write(`\n${after.trailer}\n`);
    }
  } else {
    process.stdout.write(
      `\nThe write succeeded, but re-reading the preferences failed:\n${after.stderr || `engine --list exited ${after.status}\n`}`
    );
  }
  process.stdout.write(
    `\nbootstrap-prefs.README.md next to the ${layer} values file was regenerated. It is generated output — read it, never hand-edit it.\n${SECRET_WARNING}\n`
  );
  return true;
}

// editKey(ctx, rl, state, key) -> Promise<boolean> — true when a write happened.
// Step E: value picker (from the schema `values` string), layer picker (per the
// entry's scope and any pin), exact-command confirmation, engine --set. A key
// with no value list (unrecognized) takes a free-text value; the engine remains
// the judge of legality and of `unset` / `null`, and its refusal is shown as-is.
async function editKey(ctx, rl, state, key) {
  const entry = resolveEntry(ctx.schema, key);
  const { layers, error } = permittedLayers(entry, ctx.projectDir, ctx.pin);
  if (error) {
    process.stdout.write(`\nCannot edit ${key}: ${error}\nNothing was written.\n`);
    return false;
  }

  const values = parseValues(entry);
  const current = state.rows.find((r) => r.key === key);
  let value;
  if (values.length > 0) {
    if (values.length === 1) {
      process.stdout.write(`\n${key} has exactly one storable value: ${values[0]}.\n`);
    }
    const picked = await pickFromList(
      rl,
      `New value for ${key}?`,
      values.map((v) => ({
        value: v,
        label: current && current.layer !== 'unset' && current.value === v ? `${v}  (current)` : v,
      })),
      { backLabel: 'Back / No changes' }
    );
    if (!picked) return false;
    value = picked.value;
  } else {
    process.stdout.write(
      `\nThe schema lists no value grammar for ${key}, so type the value yourself. The engine will refuse anything it does not accept.\n`
    );
    value = await askNonEmpty(rl, `New value for ${key} (b to go back): `);
    if (value === null) return false;
  }

  const layer = await pickLayer(
    ctx,
    rl,
    layers,
    'This key can live in either layer. Project wins over global, per key.'
  );
  if (!layer) return false;

  const engineArgs = ['--set', key, '--value', value, ...layer.args];
  if (!(await confirmCommand(ctx, rl, engineArgs))) return false;
  return commitWrite(ctx, state, key, engineArgs, layer.layer);
}

// storedLayers(ctx, state, key) -> [{ layer, args }] — the writable layers that
// hold the key. --list shows only the winning layer, so:
//   * winner is [global]  -> project holds nothing (project would have won) ->
//     global only.
//   * winner is [project] -> the global layer may also hold it; ask the engine
//     (`--get <key> --global` reads the global file alone). Both is reported so
//     the user can choose; a pin restricts to the pinned layer (no probe).
// The probe inherits the engine's scope filtering: a global value the key's scope
// never consults reads as `unset` there, so it is not offered — the same "inert
// layer" rule the edit path follows.
function storedLayers(ctx, state, key) {
  const projectLayer = { layer: 'project', args: ['--project', ctx.projectDir] };
  const globalLayer = { layer: 'global', args: ['--global'] };
  const row = state.rows.find((r) => r.key === key);
  if (!row) return [];
  if (ctx.pin) return row.layer === ctx.pin ? [ctx.pin === 'project' ? projectLayer : globalLayer] : [];
  if (row.layer === 'global') return [globalLayer];
  if (row.layer !== 'project' || !ctx.projectDir) return [];
  const probe = runEngine(['--get', key, '--global'], { schema: ctx.schemaPath });
  const alsoGlobal = probe.status === 0 && probe.stdout.trim() !== '' && probe.stdout.trim() !== 'unset';
  return alsoGlobal ? [projectLayer, globalLayer] : [projectLayer];
}

// resetKey(ctx, rl, state, key) -> Promise<boolean> — true when a write happened.
// Step F: layer from the [layer] annotation (asked when the key is stored in
// both), exact-command confirmation, engine --unset. Reset deletes the key: the
// next installer run or skill invocation asks the question again.
async function resetKey(ctx, rl, state, key) {
  const layers = storedLayers(ctx, state, key);
  if (layers.length === 0) {
    process.stdout.write(
      `\n${key} is not stored in a writable layer, so there is nothing to reset. Nothing was written.\n`
    );
    return false;
  }

  process.stdout.write(
    '\nReset deletes the key from the values file. The next installer run or skill invocation will ask that question again.\n'
  );
  const layer = await pickLayer(
    ctx,
    rl,
    layers,
    `${key} is stored in BOTH layers. Clearing the project layer alone re-exposes the global answer instead of re-opening the question; clear both (one reset per layer) to re-open it.`
  );
  if (!layer) return false;

  const engineArgs = ['--unset', key, ...layer.args];
  if (!(await confirmCommand(ctx, rl, engineArgs))) return false;
  return commitWrite(ctx, state, key, engineArgs, layer.layer);
}

// --- Main menu (Step C) -----------------------------------------------------

// runMenu(ctx, io) -> Promise<number> (process exit code)
//   ctx = { schema, schemaPath, projectDir, pin }
//   io  optional { reader } to inject a createReader() reader (tests)
// Steps A/B/B2 first: read the state and print the grouped summary before any
// prompt. Then the Step C loop: Edit / Reset / View again / Quit. Quit, EOF and
// Ctrl-C all exit 0 and write nothing themselves; the closing line is "No
// changes." unless a write happened this session, then "Done." After every
// successful editKey/resetKey the state is re-read.
async function runMenu(ctx, io) {
  let state = readState(ctx);
  if (!state.ok) {
    process.stderr.write(state.stderr || `Error: engine --list exited ${state.status}\n`);
    return 1;
  }
  if (state.stderr) process.stderr.write(state.stderr);
  printSummary(state.rows, ctx.schema, { trailer: state.trailer });
  if (ctx.pin) {
    process.stdout.write(`Writes are pinned to the ${ctx.pin} layer.\n`);
  }

  const rl = (io && io.reader) || createReader();
  const session = { wrote: false };
  const closing = () => (session.wrote ? 'Done.' : 'No changes.');
  const onSigint = () => rl.close();
  process.on('SIGINT', onSigint);

  const refresh = () => {
    const next = readState(ctx);
    if (!next.ok) {
      process.stderr.write(next.stderr || `Error: engine --list exited ${next.status}\n`);
      return;
    }
    if (next.stderr) process.stderr.write(next.stderr);
    state = next;
  };

  try {
    for (;;) {
      const choice = await pickFromList(
        rl,
        'What would you like to do?',
        [
          { label: 'Edit a preference', value: 'edit' },
          { label: 'Reset a preference', value: 'reset' },
          { label: 'View again', value: 'view' },
          { label: session.wrote ? 'Quit' : 'Quit (No changes)', value: 'quit' },
        ],
        { backLabel: null }
      );

      if (choice.value === 'quit') {
        process.stdout.write(`${closing()}\n`);
        return 0;
      }
      if (choice.value === 'view') {
        refresh();
        printSummary(state.rows, ctx.schema, { trailer: state.trailer });
        continue;
      }

      const key = await chooseKey(ctx, rl, state, choice.value);
      if (key === null) continue;
      const wrote =
        choice.value === 'edit'
          ? await editKey(ctx, rl, state, key)
          : await resetKey(ctx, rl, state, key);
      if (wrote) {
        session.wrote = true;
        refresh();
      }
    }
  } catch (err) {
    if (err instanceof EofError) {
      process.stdout.write(`${closing()}\n`);
      return 0;
    }
    throw err;
  } finally {
    process.removeListener('SIGINT', onSigint);
    rl.close();
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    process.stderr.write(`Error: ${args.error}\n${USAGE}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const schemaPath = args.schema || DEFAULT_SCHEMA;
  const schema = loadSchema(schemaPath);
  return runMenu({
    schema,
    schemaPath,
    projectDir: resolveProjectDir(process.cwd(), args.project),
    pin: args.pin,
  });
}

module.exports = {
  ENGINE,
  DEFAULT_SCHEMA,
  parseArgs,
  runEngine,
  loadSchema,
  resolveEntry,
  parseValues,
  permittedLayers,
  parseListOutput,
  groupRows,
  resolveProjectDir,
  readState,
  formatRow,
  renderSummary,
  printSummary,
  EofError,
  createReader,
  ask,
  askNonEmpty,
  pickFromList,
  buildKeyOptions,
  renderKeyDetail,
  familyExamples,
  resolveFamilyKey,
  chooseKey,
  displayCommand,
  changedRows,
  storedLayers,
  editKey,
  resetKey,
  runMenu,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`Error: ${err && err.message ? err.message : err}\n`);
      process.exit(1);
    }
  );
}
