#!/usr/bin/env node
// Merge the canonical Bash deny list (templates/settings-deny.json) into the
// user's ~/.claude/settings.json permissions.deny array.
//
// Additive union only: canonical entries missing from the user's list are
// appended; user entries are never removed, reordered, or deduplicated, and
// every other settings key passes through untouched.
//
// Always exits 0 — the caller (install-global.sh) runs under `set -euo
// pipefail` and a settings merge must never abort an install. Any state we
// don't understand (unparseable JSON, unexpected shapes) warns and skips,
// leaving the target file untouched.
//
// Usage: merge-settings-deny.js [--target <path>] [--source <path>]
//   --target/--source exist as test seams; the install flow passes no args.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const opts = {
    target: path.join(os.homedir(), '.claude', 'settings.json'),
    source: path.join(__dirname, 'templates', 'settings-deny.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target' && argv[i + 1]) opts.target = argv[++i];
    else if (argv[i] === '--source' && argv[i + 1]) opts.source = argv[++i];
  }
  return opts;
}

function warnSkip(message) {
  console.error(`Warning: ${message} — skipping deny-list merge`);
  process.exit(0);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const { target, source } = parseArgs(process.argv.slice(2));

let canonical;
try {
  canonical = JSON.parse(fs.readFileSync(source, 'utf8'));
} catch (err) {
  warnSkip(`settings-deny template missing or invalid (${source})`);
}
if (!Array.isArray(canonical) || !canonical.every((e) => typeof e === 'string')) {
  warnSkip(`settings-deny template is not an array of strings (${source})`);
}

let raw = null;
if (fs.existsSync(target)) {
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch (err) {
    warnSkip(`could not read ${target}`);
  }
}

let settings = {};
if (raw !== null) {
  try {
    settings = JSON.parse(raw);
  } catch (err) {
    warnSkip(`could not parse ${target} (file untouched)`);
  }
  if (!isPlainObject(settings)) {
    warnSkip(`${target} is not a JSON object (file untouched)`);
  }
}

if ('permissions' in settings && !isPlainObject(settings.permissions)) {
  warnSkip(`${target}: "permissions" is not an object (file untouched)`);
}
const permissions = settings.permissions || (settings.permissions = {});
if ('deny' in permissions && !Array.isArray(permissions.deny)) {
  warnSkip(`${target}: "permissions.deny" is not an array (file untouched)`);
}
const deny = permissions.deny || (permissions.deny = []);

const existing = new Set(deny);
let added = 0;
for (const entry of canonical) {
  if (!existing.has(entry)) {
    deny.push(entry);
    console.log(`  + ${entry}`);
    added++;
  }
}

if (added === 0 && raw !== null) {
  console.log('settings.json: deny list already up to date');
  process.exit(0);
}

// Reuse the file's existing indentation (tabs or N spaces); default 2 spaces.
let indent = '  ';
if (raw !== null) {
  const tabMatch = raw.match(/\n(\t+)"/);
  const spaceMatch = raw.match(/\n( +)"/);
  if (tabMatch) indent = '\t';
  else if (spaceMatch) indent = spaceMatch[1];
}

const tmp = `${target}.tmp-${process.pid}`;
try {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(settings, null, indent) + '\n');
  fs.renameSync(tmp, target);
} catch (err) {
  try { fs.unlinkSync(tmp); } catch (_) {}
  warnSkip(`could not write ${target} (${err.message})`);
}

if (raw === null) {
  console.log(`settings.json: created with ${added} deny entries`);
} else {
  console.log(`settings.json: ${added} deny entr${added === 1 ? 'y' : 'ies'} merged`);
}
