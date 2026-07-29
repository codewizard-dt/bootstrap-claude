#!/usr/bin/env node
'use strict';

// absolute-path-guard.js — PreToolUse hook (matcher: Bash)
//
// Blocks EVASIVE SPELLINGS of a small set of destructive commands: the path
// form (`/bin/rm`, `/usr/bin/sudo`, `./rm`), the backslash-escaped form
// (`\rm`), and the wrapper-prefixed form (`env rm`, `FOO=1 rm`).
//
// Why a hook and not more deny entries: a deny rule matches the literal
// spelling of a command, anchored at the start of the string. `Bash(rm -rf ~*)`
// blocks `rm -rf ~` and nothing else — `/bin/rm -rf ~`, `\rm -rf ~`, and
// `env rm -rf ~` all run the identical program and none of them match. Adding
// deny entries per path prefix is unbounded (`/bin`, `/usr/bin`, `/usr/sbin`,
// `/opt/homebrew/bin`, any relative path), so the class has to be closed by
// parsing the invocation instead of enumerating its spellings.

// ---------------------------------------------------------------------------
// THE LINE THIS HOOK DRAWS: it fires on the SPELLING, never on the command.
//
// The deny entries for these commands are deliberately narrow. `rm` is denied
// only for catastrophic targets (`rm -rf ~*`, `rm -rf /Users*`); plain
// `rm build/output.js` is intentionally allowed. Same for `chmod` (only `777`,
// `a+rwx`, `+s` forms are denied — `chmod +x script.sh` is allowed), `chown`
// (only `-R`/`--recursive`), `diskutil` (only the erase/partition
// subcommands), and `launchctl` (only `load`/`bootstrap`/`submit`).
//
// So this hook must NOT block a guarded name on sight. If it did, it would
// break routine `rm build/out.js`, `chmod +x script.sh`, and `chown me file` —
// a regression far worse than the gap being closed.
//
// Instead it fires only when the invocation is written in a form that evades
// literal matching. A plainly-spelled `rm build/out.js` passes straight
// through this hook to the permission engine, which then allows or denies it
// on its own merits.
//
// This is safe precisely BECAUSE the hook grants nothing. It only forces a
// command back into the form the deny list can inspect. The remedy for a false
// positive is to retype the command without the path prefix or wrapper — which
// re-exposes it to the deny rules rather than bypassing them. So the worst
// cost of over-firing is one retype, and the argument-blind rule buys
// immunity from argument-level obfuscation.
//
// Accepted consequence, stated plainly: `/bin/rm file.txt` is blocked even
// though `rm file.txt` is allowed. That is intended. There is no legitimate
// reason to reach for the absolute path here, and the path prefix is itself
// the signal — inspecting the arguments to decide would put us back to
// matching literal spellings, which is the failure this tier exists to escape.
// ---------------------------------------------------------------------------

const { readHookInput, splitSegments, tokenize, deny } = require('./lib/command-parse');

// INTENTIONALLY PARTIAL — the destructive core only, not a mirror of the ~116
// entries in lib/scripts/templates/settings-deny.json. Every name here has at
// least one deny entry that the evasive spellings above would slip past. The
// list stays short and explicit on purpose: each addition costs a class of
// false positives (see the note above), so names are added only when the
// consequence of an ungated run is destructive and irreversible. Widening it
// to cover every denied command would be a much bigger behavioral change than
// it looks, and is not the job of this hook.
const GUARDED = new Set([
  'rm',         // Bash(rm -rf ~*), Bash(rm -rf /Users*), …
  'dd',         // Bash(dd *)
  'mkfs',       // Bash(mkfs *)
  'sudo',       // Bash(sudo *)
  'diskutil',   // Bash(diskutil eraseDisk *), …
  'chmod',      // Bash(chmod 777 *), Bash(chmod +s *), …
  'chown',      // Bash(chown -R *), Bash(chown --recursive *)
  'shutdown',   // Bash(shutdown *)
  'launchctl',  // Bash(launchctl load *), …
  'crontab',    // Bash(crontab *)
  'osascript',  // Bash(osascript *)
]);

// Prefixes that push the real command off the start of the segment, which is
// where an anchored deny pattern expects to find it. `env` and the leading
// `VAR=value` form are the ones the task named; `command`, `exec`, and `nohup`
// are the same class and cost nothing to cover. `sudo` is deliberately NOT
// here — it is a guarded name in its own right, so it must be judged as a
// first token (plainly-spelled `sudo` falls through to `Bash(sudo *)`, which
// already blocks all of it; `/usr/bin/sudo` is caught below).
const WRAPPERS = new Set(['env', 'command', 'exec', 'nohup']);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function basename(token) {
  return token.slice(token.lastIndexOf('/') + 1);
}

// Walk past wrapper and env-assignment tokens to the command actually being
// run, reporting whether anything had to be skipped to reach it.
function resolveCommandToken(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (ENV_ASSIGNMENT.test(t) || WRAPPERS.has(basename(t.replace(/^\\+/, '')))) i++;
    else break;
  }
  return { token: tokens[i] ?? null, wrapped: i > 0 };
}

// Returns a description of HOW this invocation evades literal matching, or
// null when it is spelled plainly and should be left to the deny list.
function evasionKind(token, wrapped) {
  if (token.startsWith('\\')) return 'a backslash-escaped name (`\\rm`), which also skips alias and shell-function lookup';
  if (token.includes('/')) return 'a path (`/bin/rm`, `./rm`) rather than the bare command name';
  if (wrapped) return 'a wrapper or environment-assignment prefix (`env rm`, `FOO=1 rm`)';
  return null;
}

readHookInput(data => {
  if (data.tool_name !== 'Bash') return;

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) return;

  for (const segment of splitSegments(fullCmd)) {
    // Only the first token of a segment is examined, not every token. That is
    // what keeps `echo "use /bin/rm"` and `grep -r chmod .` from firing: those
    // mention a guarded name, they do not invoke one. splitSegments already
    // broke the chain on `;`, `&&`, `||`, and `|`, so a command hidden after a
    // separator still gets its own turn as a first token.
    const { token, wrapped } = resolveCommandToken(tokenize(segment));
    if (!token) continue;

    const name = basename(token.replace(/^\\+/, ''));
    if (!GUARDED.has(name)) continue;

    const kind = evasionKind(token, wrapped);
    if (!kind) continue; // plainly spelled — the deny list decides this one

    deny(
      `Blocked: \`${segment}\` invokes \`${name}\` using ${kind}. ` +
      `The permission deny list matches the literal spelling of a command, so it sees ` +
      `\`${name} …\` but not this form — the rules that would normally govern \`${name}\` ` +
      `never get consulted, which is why this is blocked at the hook layer instead. ` +
      `If the command is legitimate, run it with the plain name (\`${name} …\`). ` +
      `That is not a workaround: it puts the command back in front of the deny rules, ` +
      `which will permit it if it is safe and block it if it is not.`
    );
  }
});
