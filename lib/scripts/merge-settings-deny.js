#!/usr/bin/env node
// Merge the canonical permission deny list (templates/settings-deny.json) into
// the user's ~/.claude/settings.json permissions.deny array. Entries cover both
// Bash command patterns and file-tool path patterns (Edit(...) / Read(...)).
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
//        merge-settings-deny.js --set-key <name> --set-value <json> [--target <path>]
//   --target/--source exist as test seams; the install flow passes no args.
//
// --set-key/--set-value is a separate operation: it sets one top-level settings
// key when that key is absent, no-ops when it is already deep-equal, and warns
// and leaves the file alone when it holds a different value. The deny merge does
// not run in this mode. A malformed --set-value is a usage error and exits
// non-zero; a malformed target still fails safe with exit 0.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const opts = {
    target: path.join(os.homedir(), '.claude', 'settings.json'),
    source: path.join(__dirname, 'templates', 'settings-deny.json'),
    setKey: null,
    setValue: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target' && argv[i + 1]) opts.target = argv[++i];
    else if (argv[i] === '--source' && argv[i + 1]) opts.source = argv[++i];
    else if (argv[i] === '--set-key' && argv[i + 1]) opts.setKey = argv[++i];
    else if (argv[i] === '--set-value' && argv[i + 1]) opts.setValue = argv[++i];
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

const { target, source, setKey, setValue } = parseArgs(process.argv.slice(2));
const operation = setKey === null ? 'deny-list merge' : `"${setKey}" update`;

if (setKey !== null || setValue !== null) {
  if (setKey === null) {
    console.error('Error: --set-value requires --set-key <name>');
    process.exit(1);
  }
  if (setValue === null) {
    console.error(`Error: --set-key ${setKey} requires --set-value <json>`);
    process.exit(1);
  }

  let value;
  try {
    value = JSON.parse(setValue);
  } catch (err) {
    console.error(`Error: --set-value is not valid JSON (${err.message})`);
    process.exit(1);
  }

  const rawTarget = readTarget(target);
  const current = parseSettings(rawTarget, target);

  if (Object.prototype.hasOwnProperty.call(current, setKey)) {
    if (deepEqual(current[setKey], value)) {
      console.log(`settings.json: "${setKey}" already set`);
    } else {
      console.error(
        `Warning: settings.json already defines "${setKey}" — keeping it and skipping ${JSON.stringify(value)}`
      );
    }
    process.exit(0);
  }

  current[setKey] = value;
  writeSettings(target, current, detectIndent(rawTarget));
  console.log(`settings.json: "${setKey}" set`);
  process.exit(0);
}

let canonical;
try {
  canonical = JSON.parse(fs.readFileSync(source, 'utf8'));
} catch (err) {
  warnSkip(`settings-deny template missing or invalid (${source})`);
}
if (!Array.isArray(canonical) || !canonical.every((e) => typeof e === 'string')) {
  warnSkip(`settings-deny template is not an array of strings (${source})`);
}

const raw = readTarget(target);
const settings = parseSettings(raw, target);

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

writeSettings(target, settings, detectIndent(raw));

if (raw === null) {
  console.log(`settings.json: created with ${added} deny entries`);
} else {
  console.log(`settings.json: ${added} deny entr${added === 1 ? 'y' : 'ies'} merged`);
}
