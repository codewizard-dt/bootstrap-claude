#!/usr/bin/env node
'use strict';

// env-content-read-guard.js — PreToolUse hook
// (matcher: Bash|mcp__serena__.*|mcp__plugin_[^_]+_serena__.*)
//
// Stops the CONTENTS of a .env file from reaching the transcript, on the two
// surfaces that can emit them: a Bash command, and a Serena tool call.
//
// This closes a hole that was live in the repo, not a hypothetical one:
// `cat .env` printed secrets into the conversation. Three controls each
// assumed one of the others covered it —
//
//   - `Read(**/.env)` in settings-deny.json is a FILE-TOOL rule. A Bash
//     command never reaches the Read matcher, so it never applies.
//   - env-file-guard.js matches only Read/Write/Edit/MultiEdit — never Bash,
//     never an MCP tool.
//   - serena-bash-grep-block.js intercepts cat/head/tail/less/more/bat, but
//     only when the target is `.md` (:258) or a code extension (:264).
//     `.env` is neither, so the interception never fires. Its grep phase goes
//     further and explicitly ALLOWS `.env` targets (:126, :160, :189) as a
//     "non-code extension" — correct for Serena-first navigation, wrong for
//     secrets.
//
// Why a hook and not a deny entry: a deny rule matches the literal spelling of
// a command. `Bash(cat .env)` would block exactly that string and none of
// `head -n 5 .env`, `strings .env`, `grep KEY .env`, `xxd .env`, `cat < .env`,
// or `cp .env /tmp/x`. The class is only closable by parsing the command.
//
// ---------------------------------------------------------------------------
// `source .env` AND `. .env` REMAIN PERMITTED. THIS IS DELIBERATE.
//
// Do not "close this gap" later — it is not a gap. CLAUDE.md grants it
// ("You are, however, allowed to source an .env file to use the variables in
// the command line") and env-file-guard.js:39 says so in its own deny message.
//
// The reasoning, so it does not have to be rediscovered: sourcing loads values
// into the shell's environment and prints NOTHING. Nothing enters the
// transcript. The leak is sourcing PLUS emission (`source .env && echo $KEY`) —
// and the emission half can be written without `source` at all. So blocking
// `source` would block the safe case while missing the unsafe one. This hook
// therefore governs DISPLAY and DUPLICATION, not USE.
//
// That distinction is what every deny message here has to communicate: the
// values may be used, they may not be shown.
// ---------------------------------------------------------------------------
//
// Placement: both surfaces live in this one file rather than the Serena half
// being folded into serena-bash-grep-block.js. Two reasons, in order of weight:
//
//   1. serena-bash-grep-block.js does not, in fact, inspect Serena tool calls —
//      it exits on `tool_name !== 'Bash'` (:28) and is wired under the `Bash`
//      matcher. It SUGGESTS Serena calls; it never receives one. Putting the
//      Serena rule there would mean broadening its matcher and giving a
//      Serena-first NAVIGATION hook a second, orthogonal concern (secrets).
//   2. Keeping both surfaces here means `isBlockedEnvFile` and the
//      `.env.example` exception exist ONCE for this concern, so the Bash side
//      and the Serena side cannot drift apart. Two `.env` controls that
//      disagree about what `.env` means is a bug waiting to happen.
//
// Known gaps, deliberate — each would cost more than it closes:
//   - A Serena `search_for_pattern` with no `relative_path` scans the project
//     and could match .env lines. Denying every unscoped search would make the
//     tool unusable, and Serena's project scan honours gitignore, where `.env`
//     and `.env.*` (with `!.env.example`) always sit — both in this repo and in
//     the gitignore this repo ships (lib/scripts/templates/gitignore:23-25).
//     Same for a `relative_path` naming a DIRECTORY that contains a .env.
//   - `find . -name .env -exec cat {} +` and `xargs cat .env` put the reader
//     somewhere other than the front of a segment; the verb check looks at the
//     first token only (see below).
//   - `git show HEAD:.env` and `docker exec … cat .env` reach the contents
//     through a tool this hook does not model.
//   - A segment that merely QUOTES a blocked form (`grep -rn "cat .env" docs/`)
//     fires. Accepted for the same reason as protected-write-guard.js:50 —
//     narrowing it means inspecting quoting well enough to reimplement the
//     shell, and the cost of over-firing is one rephrase.

const path = require('path');
const { readHookInput, splitSegments, tokenize, deny } = require('./lib/command-parse');

// KEPT BYTE-IDENTICAL WITH env-file-guard.js:6-13. If the allow-list changes,
// change it in both places or in neither — two .env controls that disagree
// about which files are secret is worse than one control. It also matches the
// gitignore this repo ships (`.env`, `.env.*`, `!.env.example`), so "secret" is
// defined the same way by the guard and by the thing that keeps it out of git.
function isBlockedEnvFile(filePath) {
  if (!filePath) return false;
  const basename = path.basename(String(filePath));
  // Block .env exactly, and .env.* variants (e.g. .env.local, .env.production)
  // Allow .env.example — the one permitted exception
  return basename === '.env' ||
    (basename.startsWith('.env.') && basename !== '.env.example');
}

// Commands whose ordinary purpose is to put file contents on stdout. The list
// is wider than the "cat/head/tail" trio the task named, because the narrow
// list would have been theatre: `strings .env`, `xxd .env`, `cut -d= -f2 .env`
// and `grep KEY .env` all print the same secrets with the same ease.
//
// grep-family is included even though serena-bash-grep-block.js allows `.env`
// targets. That allowance is right for its purpose (Serena-first navigation
// does not care about non-code files) and wrong for this one — a grep against
// .env prints the matching lines, which for a credentials file IS the payload.
const READERS = new Set([
  // whole-file dumpers
  'cat', 'tac', 'nl', 'head', 'tail', 'less', 'more', 'most', 'bat',
  'od', 'xxd', 'hexdump', 'strings', 'rev',
  // searchers — they print the matched lines
  'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack',
  // stream processors used as readers
  'sed', 'awk', 'gawk', 'cut', 'sort', 'uniq', 'paste', 'column',
]);

// Duplicating a .env moves live credentials to a path none of the .env rules
// watch, so the copy is readable by everything afterwards. Beyond the `cp` the
// task named, the same one-line operation spelled with a different tool.
const COPIERS = new Set(['cp', 'scp', 'rsync', 'ditto', 'install']);

// Prefixes that push the real command off the front of a segment. `sudo` IS
// treated as a wrapper here, unlike in absolute-path-guard.js — there it is a
// guarded name in its own right, here it is just noise in front of `cat`.
const WRAPPERS = new Set(['env', 'command', 'exec', 'nohup', 'time', 'sudo']);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

// An output redirect with an optional fd prefix. `(?![&>])` keeps `2>&1` from
// being read as a redirect to a file named `&1`.
const OUT_REDIRECT = /^(?:&|\d+)?>>?(?![&>])/;

function stripQuotes(token) {
  return String(token).replace(/^["']+/, '').replace(/["']+$/, '');
}

function basename(token) {
  const cleaned = String(token).replace(/^\\+/, '');
  return cleaned.slice(cleaned.lastIndexOf('/') + 1);
}

/**
 * The tokens of a segment that act as INPUT paths: flags dropped, and — the
 * part that matters — output-redirect DESTINATIONS dropped while input-redirect
 * SOURCES are kept.
 *
 * Direction is the whole point. `cat .env.example > .env` writes a scaffold
 * file and is legitimate; `cat .env > /tmp/x` exfiltrates one. The only thing
 * separating them is which side of the operator the non-example path sits on.
 */
function inputPaths(tokens) {
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    let t = stripQuotes(tokens[i]);
    if (!t) continue;

    const out = OUT_REDIRECT.exec(t);
    if (out) {
      // `> file` puts the destination in the next token; `>file` carries it
      // inline. Either way it is a destination, not something being read.
      if (t.length === out[0].length) i++;
      continue;
    }

    let viaRedirect = false;
    if (t.startsWith('<')) {
      viaRedirect = true;
      t = t.slice(1) || stripQuotes(tokens[++i] ?? '');
    }

    if (!t || t.startsWith('-')) continue;
    found.push({ path: t, viaRedirect, index: i });
  }
  return found;
}

/** Walk past wrapper and env-assignment tokens to the command actually run. */
function resolveCommandToken(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (ENV_ASSIGNMENT.test(t) || WRAPPERS.has(basename(t))) i++;
    else break;
  }
  return { token: tokens[i] ?? null, index: i };
}

// Every deny message ends with this, because a block that does not say what to
// do instead just gets worked around.
const ALTERNATIVE =
  'You can USE these values without seeing them: `source .env` in the same Bash command ' +
  '(`source .env && ./script.sh`) loads them into the environment and prints nothing. ' +
  'Sourcing a .env file is explicitly permitted; displaying its contents is not. ' +
  'If you only need to know which keys exist, read `.env.example` — that one is allowed.';

const WHY_SECRET =
  'A .env file holds live credentials. Once they are printed they are in the conversation ' +
  'history, in anything that logs it, and in every context window that follows — there is ' +
  'no way to un-print them.';

/**
 * One pass of the verb rules over a command scope (a segment, or the whole
 * command — see the call site for why both).
 */
function checkScope(scope, displayCmd) {
  const tokens = tokenize(scope);
  if (tokens.length === 0) return;

  const inputs = inputPaths(tokens);
  const blocked = inputs.filter(p => isBlockedEnvFile(p.path));
  if (blocked.length === 0) return; // no .env is being read here — nothing to judge

  // Rule 1: an input redirect. The verb is irrelevant — `< .env` hands the
  // file's contents to whatever runs, and the two commands that would normally
  // want that (`source`, `.`) do not use a redirect to get it.
  const redirected = blocked.find(p => p.viaRedirect);
  if (redirected) {
    deny(
      `Blocked: \`${displayCmd}\` feeds \`${redirected.path}\` into a command on stdin. ` +
      `${WHY_SECRET} ` +
      `An input redirect is not a recognised file-read, so neither the \`Read(**/.env)\` deny ` +
      `entry nor env-file-guard.js sees it. ` +
      `${ALTERNATIVE}`
    );
  }

  const { token: verbToken, index: verbIndex } = resolveCommandToken(tokens);
  if (!verbToken) return;
  const verb = basename(verbToken);

  // Rule 2: a content-emitting reader pointed at a .env.
  if (READERS.has(verb)) {
    deny(
      `Blocked: \`${displayCmd}\` would print the contents of \`${blocked[0].path}\` into the ` +
      `transcript. ${WHY_SECRET} ` +
      `Nothing else stops this: \`Read(**/.env)\` is a file-tool permission rule that a Bash ` +
      `command never reaches, and env-file-guard.js matches only Read/Write/Edit/MultiEdit. ` +
      `${ALTERNATIVE}`
    );
  }

  // Rule 3: a copy whose SOURCE is a .env. The last operand is the
  // destination, so `cp .env.example .env` — ordinary scaffolding — falls
  // through untouched, while `cp .env /tmp/x` does not.
  if (COPIERS.has(verb)) {
    const operands = inputs.filter(p => p.index > verbIndex);
    const sources = operands.slice(0, -1);
    const leaked = sources.find(p => isBlockedEnvFile(p.path));
    if (leaked) {
      deny(
        `Blocked: \`${displayCmd}\` copies \`${leaked.path}\` somewhere else. That is a leak by ` +
        `duplication rather than by display: the copy lands at a path none of the .env rules ` +
        `watch, and everything downstream can read it freely. ${WHY_SECRET} ` +
        `Copying .env.example INTO place (\`cp .env.example .env\`) is unaffected — only a .env ` +
        `used as the SOURCE is blocked. ` +
        `${ALTERNATIVE}`
      );
    }
  }
}

function checkBash(data) {
  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) return;

  // Each `;`/`&&`/`||`/`|` segment gets its own turn, so a reader hidden after
  // a separator is still judged as a first token — the same reasoning as
  // absolute-path-guard.js:118.
  for (const segment of splitSegments(fullCmd)) checkScope(segment, segment);

  // …and then, in one narrow case, the whole command as a single scope.
  // splitSegments splits on `|` without regard for quoting, so
  // `grep "KEY|TOKEN" .env` is torn into `grep "KEY` and `TOKEN" .env` — and the
  // second piece's first token is not a reader, so the per-segment pass misses
  // it entirely. Re-running over the full string puts `grep` back in front of
  // `.env`.
  //
  // Gated on the command containing BOTH a quote and a pipe, which is exactly
  // the condition under which a segment can have been torn mid-token. Without
  // the gate this pass would fire on `cat a.txt | grep x && echo .env`, where
  // the `.env` belongs to a segment that never reads it.
  if (/["']/.test(fullCmd) && fullCmd.includes('|')) checkScope(fullCmd, fullCmd);
}

// ── Serena surface ─────────────────────────────────────────────────────────
//
// Closing only Bash would move the leak rather than seal it. serena-bash-grep-
// block.js actively redirects Bash greps toward Serena, and Serena's
// search_for_pattern returns the matched lines — so the blocked `grep KEY .env`
// has an approved-looking replacement that prints exactly the same secrets.

/** Strip the mcp__serena__ / mcp__plugin_<x>_serena__ prefix from a tool name. */
function bareSerenaTool(toolName) {
  const m = /^mcp__(?:plugin_[^_]+_)?serena__(.+)$/.exec(String(toolName));
  return m ? m[1] : '';
}

// Serena tools that return FILE CONTENTS. `find_file` and `list_dir` return
// paths and names only — knowing that a .env exists is not a leak, so they are
// deliberately absent.
const SERENA_READERS = new Set([
  'read_file',
  'search_for_pattern',
  'find_symbol',              // include_body=true returns bodies
  'find_referencing_symbols', // returns the code around each reference
  'get_symbols_overview',
]);

// Serena tools that MUTATE a file. Not a leak, but env-file-guard.js's own
// message says a .env "cannot be read or written", and these tools reach the
// file without passing any control that enforces the second half. Included for
// parity: the .env write ban should not depend on which tool is holding the pen.
const SERENA_WRITERS = new Set([
  'create_text_file',
  'replace_content',
  'replace_in_files',
  'replace_lines',
  'delete_lines',
  'insert_at_line',
]);

// Serena addresses files by `relative_path` throughout; the others are accepted
// defensively so a renamed or plugin-wrapped parameter cannot slip past.
// `paths_include_glob` is checked because scoping a search with `**/.env` is
// just another way of naming the target.
const SERENA_PATH_KEYS = ['relative_path', 'file_path', 'path', 'paths_include_glob'];

function checkSerena(tool, input) {
  const reading = SERENA_READERS.has(tool);
  const writing = SERENA_WRITERS.has(tool);
  if (!reading && !writing) return;

  const target = SERENA_PATH_KEYS
    .map(key => input?.[key])
    .find(value => typeof value === 'string' && isBlockedEnvFile(value));
  if (!target) return;

  if (reading) {
    deny(
      `Blocked: this Serena call targets \`${target}\`, and \`${tool}\` returns file contents. ` +
      `${WHY_SECRET} ` +
      `Blocking \`cat .env\` on the Bash side while leaving this open would only move the leak: ` +
      `serena-bash-grep-block.js redirects Bash greps to Serena, so search_for_pattern is the ` +
      `first thing reached for after a Bash block. ` +
      `${ALTERNATIVE}`
    );
  }

  deny(
    `Blocked: this Serena call would modify \`${target}\`. A .env file can be neither read nor ` +
    `written by an agent — env-file-guard.js enforces that for Read/Write/Edit/MultiEdit, and ` +
    `Serena's editing tools reach the same file without passing through it. ` +
    `Edit the file yourself if its contents need to change. ` +
    `${ALTERNATIVE}`
  );
}

readHookInput(data => {
  // A hook that throws exits non-zero and reads as a hook failure, so an
  // unexpected payload shape must degrade to "allow", never to a crash.
  try {
    const tool = String(data?.tool_name ?? '');
    if (tool === 'Bash') return checkBash(data);

    const serenaTool = bareSerenaTool(tool);
    if (serenaTool) return checkSerena(serenaTool, data?.tool_input);
  } catch {
    /* malformed input — fall through to allow */
  }
});
