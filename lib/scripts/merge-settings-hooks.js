#!/usr/bin/env node
// Merge the canonical hook wiring (templates/settings-hooks.json) into the
// user's ~/.claude/settings.json "hooks" key.
//
// This is a sibling of merge-settings-deny.js, not a new mode of it: the deny
// script does simple additive set-union over a flat array and has a frozen
// test suite that must not be disturbed. This script implements a structured,
// block-and-entry-aware "template owns its blocks" merge with materially
// different semantics (ownership, drift adoption, mixed-block handling).
//
// Ownership model:
//   - An "owned" hook entry is one whose `command` references
//     ~/.claude/hooks/<name>.js (or an equivalent absolute-path expansion of
//     the same) where <name> (basename, extension stripped) also appears
//     somewhere in the template. Anything else is "foreign" (user-added) and
//     is never modified, reordered, or removed by this algorithm.
//   - Foreign blocks, and any hooks event not present in the template (e.g.
//     UserPromptSubmit), are completely untouched.
//   - A block containing at least one foreign entry is "mixed": its matcher
//     is never rewritten, and a repo hook found relocated inside it is left
//     in place (with a warning) rather than duplicated into the template's
//     expected block.
//   - A block whose every entry is owned is "pure-owned" and is eligible for
//     drift adoption: if its matcher doesn't match any template matcher for
//     the event, but it shares an owned basename with a template block, its
//     matcher is rewritten to the template's — this propagates a matcher
//     rename shipped in the template without creating a duplicate block.
//
// Always exits 0 — the caller (install-global.sh) runs under `set -euo
// pipefail` and a settings merge must never abort an install. Any state we
// don't understand (unparseable JSON, unexpected shapes) warns and skips,
// leaving the target file untouched.
//
// Usage: merge-settings-hooks.js [--target <path>] [--source <path>]
//   --target/--source exist as test seams; the install flow passes no args.
//   No --set-key/--set-value mode here — that belongs to merge-settings-deny.js.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers below are copied from merge-settings-deny.js (~lines 31-111) rather
// than shared, because that script's additive set-union semantics and frozen
// test suite must not be coupled to this script's block-ownership algorithm.
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    target: path.join(os.homedir(), '.claude', 'settings.json'),
    source: path.join(__dirname, 'templates', 'settings-hooks.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target' && argv[i + 1]) opts.target = argv[++i];
    else if (argv[i] === '--source' && argv[i + 1]) opts.source = argv[++i];
  }
  return opts;
}

function warnSkip(message) {
  console.error(`Warning: ${message} — skipping ${operation}`);
  process.exit(0);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Structural comparison, not JSON.stringify equality: differing key order in an
// equivalent object must still count as a no-op, not a clobber warning.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function readTarget(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    warnSkip(`could not read ${file}`);
  }
}

function parseSettings(text, file) {
  if (text === null) return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    warnSkip(`could not parse ${file} (file untouched)`);
  }
  if (!isPlainObject(parsed)) {
    warnSkip(`${file} is not a JSON object (file untouched)`);
  }
  return parsed;
}

// Reuse the file's existing indentation (tabs or N spaces); default 2 spaces.
function detectIndent(text) {
  if (text === null) return '  ';
  if (text.match(/\n(\t+)"/)) return '\t';
  const spaceMatch = text.match(/\n( +)"/);
  return spaceMatch ? spaceMatch[1] : '  ';
}

function writeSettings(file, value, indent) {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(value, null, indent) + '\n');
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    warnSkip(`could not write ${file} (${err.message})`);
  }
}

// ---------------------------------------------------------------------------
// Block-ownership merge algorithm.
// ---------------------------------------------------------------------------

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Extract the "<name>" out of a command referencing .claude/hooks/<name>.js,
// regardless of whether the path is the literal "~/.claude/hooks/..." form
// or an absolute-path expansion of it (e.g. "/Users/xxx/.claude/hooks/...").
// Matching keys off the trailing ".claude/hooks/<name>.js" segment — not a
// bare "hooks/<name>.js" — so a foreign command that happens to reference
// some unrelated .../hooks/ directory (e.g. a project-local lib/hooks/foo.js)
// is never misclassified as an owned ~/.claude hook, even if its basename
// collides with a shipped hook name.
function extractBasename(command) {
  if (typeof command !== 'string') return null;
  const re = /(?:^|[\\/])\.claude[\\/]hooks[\\/]([^\\/\s"']+)\.js\b/g;
  let match;
  let last = null;
  while ((match = re.exec(command)) !== null) last = match[1];
  return last;
}

// Collect every basename referenced anywhere in the template. This is the
// membership test for "owned": a target entry is owned only if its basename
// is one the template ships (and it's shaped like a hooks/<name>.js command).
function collectTemplateBasenames(template) {
  const names = new Set();
  for (const eventName of Object.keys(template)) {
    const blocks = template[eventName];
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!isPlainObject(block) || !Array.isArray(block.hooks)) continue;
      for (const entry of block.hooks) {
        if (!isPlainObject(entry)) continue;
        const name = extractBasename(entry.command);
        if (name) names.add(name);
      }
    }
  }
  return names;
}

function isOwnedEntry(entry, basenames) {
  if (!isPlainObject(entry)) return false;
  const name = extractBasename(entry.command);
  return name !== null && basenames.has(name);
}

function hasOwnedEntry(block, basenames) {
  return isPlainObject(block) && Array.isArray(block.hooks) && block.hooks.some((h) => isOwnedEntry(h, basenames));
}

function hasForeignEntry(block, basenames) {
  return isPlainObject(block) && Array.isArray(block.hooks) && block.hooks.some((h) => !isOwnedEntry(h, basenames));
}

// Pure-owned: every entry in the block is owned, and there's at least one.
function isPureOwned(block, basenames) {
  return (
    isPlainObject(block) &&
    Array.isArray(block.hooks) &&
    block.hooks.length > 0 &&
    block.hooks.every((h) => isOwnedEntry(h, basenames))
  );
}

function sharesBasename(block, templateBlock) {
  if (!isPlainObject(block) || !Array.isArray(block.hooks)) return false;
  const names = new Set(block.hooks.map((h) => (isPlainObject(h) ? extractBasename(h.command) : null)).filter(Boolean));
  return (templateBlock.hooks || []).some((e) => {
    const name = isPlainObject(e) ? extractBasename(e.command) : null;
    return name && names.has(name);
  });
}

// Validate the template's shape strictly — a malformed template must never
// be partially trusted. Returns void; throws on any structural violation.
function validateTemplate(template) {
  if (!isPlainObject(template)) throw new Error('not a JSON object');
  for (const eventName of Object.keys(template)) {
    const blocks = template[eventName];
    if (!Array.isArray(blocks)) throw new Error(`"${eventName}" is not an array`);
    for (const block of blocks) {
      if (!isPlainObject(block) || !Array.isArray(block.hooks)) {
        throw new Error(`"${eventName}" contains a block without a "hooks" array`);
      }
      for (const entry of block.hooks) {
        if (!isPlainObject(entry) || typeof entry.command !== 'string') {
          throw new Error(`"${eventName}" contains a hook entry without a "command" string`);
        }
      }
    }
  }
}

function findMatchingBlock(targetEvent, matcher, basenames) {
  const candidates = targetEvent.filter((b) => isPlainObject(b) && b.matcher === matcher);
  if (!candidates.length) return null;
  return candidates.find((b) => hasOwnedEntry(b, basenames)) || candidates[0];
}

function findDriftCandidate(targetEvent, templateMatchers, templateBlock, basenames) {
  return (
    targetEvent.find(
      (b) =>
        isPureOwned(b, basenames) &&
        !templateMatchers.has(b.matcher) &&
        sharesBasename(b, templateBlock)
    ) || null
  );
}

const { target, source } = parseArgs(process.argv.slice(2));
const operation = 'hooks wiring merge';

let template;
try {
  template = JSON.parse(fs.readFileSync(source, 'utf8'));
  validateTemplate(template);
} catch (err) {
  warnSkip(`hooks template missing or invalid (${source}: ${err.message})`);
}

const templateBasenames = collectTemplateBasenames(template);

const raw = readTarget(target);
const settings = parseSettings(raw, target);

if ('hooks' in settings && !isPlainObject(settings.hooks)) {
  warnSkip(`${target}: "hooks" is not an object (file untouched)`);
}

// Top-level case: no file, or file with no "hooks" key at all — the template
// wins outright; no per-event/per-block logic runs.
if (raw === null || !('hooks' in settings)) {
  settings.hooks = clone(template);
  writeSettings(target, settings, detectIndent(raw));
  console.log('hooks wiring: created');
  process.exit(0);
}

const targetHooks = settings.hooks;
const changes = [];

// Only the events the template ships are ever visited — anything else already
// present in the target's hooks object (e.g. UserPromptSubmit) is untouched.
for (const eventName of Object.keys(template)) {
  const templateEvent = template[eventName];

  let targetEvent;
  if (eventName in targetHooks) {
    targetEvent = targetHooks[eventName];
    if (!Array.isArray(targetEvent)) {
      warnSkip(`${target}: "hooks.${eventName}" is not an array (file untouched)`);
    }
  } else {
    targetEvent = [];
    targetHooks[eventName] = targetEvent;
  }

  const templateMatchers = new Set(templateEvent.map((b) => b.matcher));

  for (const templateBlock of templateEvent) {
    let block = findMatchingBlock(targetEvent, templateBlock.matcher, templateBasenames);

    if (!block) {
      const drifted = findDriftCandidate(targetEvent, templateMatchers, templateBlock, templateBasenames);
      if (drifted) {
        const oldMatcher = drifted.matcher;
        if ('matcher' in templateBlock) drifted.matcher = templateBlock.matcher;
        else delete drifted.matcher;
        changes.push(`  ~ ${eventName} matcher adopted: ${oldMatcher} -> ${templateBlock.matcher}`);
        block = drifted;
      }
    }

    // A fresh placeholder block is NOT pushed into the target event yet: if
    // every template entry turns out to be relocated into a mixed block
    // elsewhere (warn, don't insert), pushing eagerly would persist an empty
    // {matcher, hooks: []} block whenever another block causes a write in the
    // same run. The push is deferred until at least one entry actually lands.
    // Pre-existing blocks (matched or drift-adopted) are never touched by this
    // guard — only a block this run itself created can be withheld.
    let isNewBlock = false;
    if (!block) {
      block = {};
      if ('matcher' in templateBlock) block.matcher = templateBlock.matcher;
      block.hooks = [];
      isNewBlock = true;
    }
    if (!Array.isArray(block.hooks)) block.hooks = [];

    for (const templateEntry of templateBlock.hooks) {
      const basename = extractBasename(templateEntry.command);
      const ownedIdx = block.hooks.findIndex(
        (h) => isOwnedEntry(h, templateBasenames) && extractBasename(h.command) === basename
      );

      if (ownedIdx !== -1) {
        if (!deepEqual(block.hooks[ownedIdx], templateEntry)) {
          block.hooks[ownedIdx] = clone(templateEntry);
          changes.push(`  ~ ${eventName}/${basename} replaced`);
        }
        continue;
      }

      // Not found in this block — check whether it's been relocated into a
      // different, mixed (user-touched) block elsewhere in the same event.
      // Never-remove/duplicate wins: leave it there, warn, don't duplicate.
      let relocated = false;
      for (const other of targetEvent) {
        if (other === block || !isPlainObject(other) || !Array.isArray(other.hooks)) continue;
        const foundHere = other.hooks.some(
          (h) => isPlainObject(h) && extractBasename(h.command) === basename
        );
        if (foundHere && hasForeignEntry(other, templateBasenames)) {
          console.error(
            `Warning: ${eventName}/${basename} appears relocated into a user-modified block — leaving it in place, not duplicating`
          );
          relocated = true;
          break;
        }
      }

      if (!relocated) {
        block.hooks.push(clone(templateEntry));
        changes.push(`  + ${eventName}/${basename} appended`);
      }
    }

    // Deferred push (see above): only a freshly-created block that actually
    // received entries joins the target event array.
    if (isNewBlock && block.hooks.length > 0) targetEvent.push(block);
  }
}

if (changes.length === 0) {
  console.log('hooks wiring already up to date');
  process.exit(0);
}

writeSettings(target, settings, detectIndent(raw));
for (const line of changes) console.log(line);
console.log(`hooks wiring: ${changes.length} change${changes.length === 1 ? '' : 's'} applied`);
