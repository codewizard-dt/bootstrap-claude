#!/usr/bin/env node
'use strict';

// claude-settings-guard.js — PreToolUse hook (matcher: Edit|Write|NotebookEdit|MultiEdit)
//
// Guards the two files that define what an agent is allowed to do
// (~/.claude/settings.json, ~/.claude/settings.local.json) and the directory
// whose contents run on every subsequent tool call (~/.claude/hooks/).
//
// Unlike the other hooks in this directory this one matches FILE TOOLS, not
// Bash — env-file-guard.js is the structural precedent. The Bash-side of the
// same protected paths (`echo … >> ~/.claude/settings.json`) is covered
// separately by protected-write-guard.js.
//
// Why a hook and not deny entries:
//
//   TASK-026 originally shipped `Edit(~/.claude/settings.json)` and
//   `Edit(~/.claude/settings.local.json)` as deny entries. They were removed on
//   2026-07-29 to make room for a bootstrap-claude carve-out, on the belief that
//   THIS repo needs to edit those files because install-global.sh and
//   merge-settings-deny.js manage them.
//
//   THAT BELIEF WAS WRONG, and the carve-out was removed on 2026-07-30. The
//   repo's settings writes go through `node merge-settings-deny.js` *inside*
//   install-global.sh — Bash subprocesses, which no PreToolUse hook and no
//   permission rule ever sees. Nothing in this repo's workflow needs the Edit
//   TOOL on those files. The exception cost real safety and bought nothing:
//   it let any agent running here rewrite its own permission boundary, which
//   was demonstrated live before it was closed.
//
//   The block is now unconditional. To change the permission rules, edit
//   lib/scripts/templates/settings-deny.json and re-run install-global.sh —
//   the same flow this hook's message tells everyone else to use.
//
// Why ~/.claude/hooks/** is ALSO checked here, and is not redundant:
//
//   TASK-026's `Edit(~/.claude/hooks/**)` and `Edit(**/.claude/hooks/**)` deny
//   entries remain in place and are the primary control — this hook does not
//   replace them. But file permission checks consult only `Edit(path)` and
//   `Read(path)`; `Write(...)` rules are accepted by the settings parser and
//   then never consulted (raw/research/bypass-mode-enforcement/index.md:108,
//   sourced to code.claude.com/docs/en/permissions). The Write *tool* still
//   works. So `Write(~/.claude/hooks/evil.js)` has no deny coverage whatsoever,
//   and neither does the MultiEdit/NotebookEdit surface. That is the deny list
//   proving insufficient, not this hook duplicating it.
//
//   The hooks/** block is ABSOLUTE — no bootstrap-claude exception. Even in
//   this repo the canonical flow is: edit lib/hooks/, then run
//   install-global.sh, which rsyncs into ~/.claude/hooks/. Editing the
//   installed copy directly is always wrong; the next install silently
//   overwrites it.
//
// RESIDUAL RISK, stated plainly:
//
//   This hook guards the file TOOLS. An agent with Bash can still write these
//   files another way — `node write-settings.js` reaches them, and no hook here
//   parses inside a script file. protected-write-guard.js catches shell
//   redirects (`echo … >> ~/.claude/settings.json`) and
//   interpreter-indirection-guard.js catches `node -e`, but a script written to
//   disk and then executed is not covered by design.
//
//   So this is a guardrail, not a boundary: it closes the casual and accidental
//   paths, which is most of them, and raises the cost of the deliberate one. The
//   only real containment for a compromised agent is Tier 3 (/sandbox —
//   OS-level confinement). Do not read the unconditional block as a guarantee.
//
// Known gaps, deliberate:
//   - Project-level `.claude/settings.json` files are not guarded here; this
//     hook is scoped to the user-global ~/.claude/ tree per its checkbox.
//   - A write is judged by its resolved target only. An agent that first
//     replaces some unguarded path with a symlink and then writes through it is
//     caught (the target resolves into ~/.claude/), but an agent that writes a
//     script elsewhere and executes it is a Bash concern, not this hook's.
//
// Fails: open — realpathBestEffort() has no error return: when nothing along the
// ancestor chain resolves it hands back the lexical path, so a target whose real
// location could not be determined is classified on its spelling alone and can
// miss. A throw anywhere in the handler exits 0 via lib/command-parse.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readHookInput, deny } = require('./lib/command-parse');

// Upper bound on any parent walk. path.dirname() is purely lexical and reaches
// a fixed point at the filesystem root, so this is belt-and-braces against a
// pathological input rather than a real loop risk — but a hook must never hang.
const MAX_WALK = 64;

/**
 * Resolve a path all the way to its real location, tolerating targets that do
 * not exist yet.
 *
 * realpathSync() throws on a path that has not been created, which is the
 * normal case for a Write. So walk up to the nearest ancestor that DOES exist,
 * resolve that, and re-attach the components below it. A symlinked parent
 * directory pointing into ~/.claude/ is therefore still caught even when the
 * file itself is brand new.
 */
function realpathBestEffort(input) {
  const absolute = path.resolve(input);
  const tail = [];
  let current = absolute;

  for (let i = 0; i < MAX_WALK; i++) {
    try {
      const real = fs.realpathSync(current);
      return tail.length ? path.join(real, ...[...tail].reverse()) : real;
    } catch {
      // Does not exist yet (or is unreadable) — try its parent.
    }
    const parent = path.dirname(current);
    if (parent === current) break; // hit the filesystem root
    tail.push(path.basename(current));
    current = parent;
  }

  // Nothing along the chain resolved; the lexical path is the best answer.
  return absolute;
}

// `~` is not expanded by the shell when it arrives inside a JSON tool_input, so
// a literal "~/.claude/settings.json" reaches this hook unexpanded.
function expandHome(input, home) {
  const s = String(input);
  if (s === '~') return home;
  if (s.startsWith('~/')) return path.join(home, s.slice(2));
  return s;
}

const HOME = realpathBestEffort(os.homedir());

const SETTINGS_FILES = [
  path.join(HOME, '.claude', 'settings.json'),
  path.join(HOME, '.claude', 'settings.local.json'),
];
const HOOKS_DIR = path.join(HOME, '.claude', 'hooks');

/** Returns 'settings' | 'hooks' | null. */
function classify(resolved) {
  if (SETTINGS_FILES.includes(resolved)) return 'settings';
  if (resolved === HOOKS_DIR || resolved.startsWith(HOOKS_DIR + path.sep)) return 'hooks';
  return null;
}

function reasonForSettings(resolved) {
  return (
    `Blocked: editing \`${resolved}\`. This file decides what every agent session is ` +
    `permitted to do, so a write to it is a change to your own permission boundary ` +
    `rather than a change to a project. There is no exception — not even inside the ` +
    `bootstrap-claude repo, which manages these settings through ` +
    `\`install-global.sh\` (a shell subprocess this hook never sees) rather than through ` +
    `the Edit tool. To change the permission rules, edit ` +
    `\`lib/scripts/templates/settings-deny.json\` in the bootstrap-claude repo and re-run ` +
    `\`install-global.sh\`, which merges it in — that way the change is reviewable in git ` +
    `instead of being a local mutation nobody sees.`
  );
}

function reasonForHooks(resolved) {
  return (
    `Blocked: editing \`${resolved}\`. \`~/.claude/hooks/\` holds the installed COPY of ` +
    `the hook scripts, which run on every subsequent tool call. There is no exception to ` +
    `this one, including inside bootstrap-claude itself: the canonical flow is to edit ` +
    `\`lib/hooks/\` in the bootstrap-claude repo and run \`install-global.sh\`, which rsyncs ` +
    `the result here. Editing the installed copy directly means the change is untracked and ` +
    `the next install silently overwrites it.`
  );
}

// MultiEdit carries an array of edits; NotebookEdit names its target
// `notebook_path` rather than `file_path`. Collect every path a single tool
// call would touch, so a protected target cannot ride along in a batch.
function targetsOf(toolName, toolInput) {
  if (!toolInput) return [];
  if (toolName === 'MultiEdit') {
    const edits = Array.isArray(toolInput.edits) ? toolInput.edits : [];
    return edits.map(e => e && e.file_path).filter(Boolean);
  }
  const single = toolInput.file_path || toolInput.notebook_path;
  return single ? [single] : [];
}

const GUARDED_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];

readHookInput(data => {
  if (!GUARDED_TOOLS.includes(data.tool_name)) return;

  const targets = targetsOf(data.tool_name, data.tool_input);
  if (!targets.length) return;

  // Relative paths resolve against the session's directory, not this process's.
  const baseDir = typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd();

  for (const target of targets) {
    const resolved = realpathBestEffort(path.resolve(baseDir, expandHome(target, HOME)));
    const kind = classify(resolved);
    if (!kind) continue;

    // Both kinds block unconditionally. There is no cwd-dependent branch here
    // any more — see the header for why the bootstrap-claude carve-out was
    // removed rather than narrowed.
    deny(kind === 'hooks' ? reasonForHooks(resolved) : reasonForSettings(resolved));
  }
});
