#!/usr/bin/env node
'use strict';

// package-install-consent.js — PreToolUse hook (matcher: Bash)
//
// Implements the standing requirement that no package enters this machine or
// this project without explicit human consent. Every package-manager install
// invocation is denied, and the deny reason hands the user the exact command
// back so they can run it themselves if they approve.
//
// Why a hook and not a deny rule: a deny rule cannot carry an exception. This
// repo bootstraps Serena with `uvx --from git+https://github.com/oraios/serena`
// on every setup, and that one invocation must stay allowed while every other
// `uvx --from` is gated. There is no deny pattern that expresses "block this
// class except this member" — deny beats allow at every scope, and a hook
// returning `allow` cannot loosen a deny rule either. A hook can simply not
// deny. That exception is the main reason this control lives here.
//
// Why not `permissions.ask`: `ask` is the natural fit for consent and it works
// correctly in an interactive session. But this repo routinely runs headless
// (`claude -p` under /uat-auto-plus and power-mode), where there is no one to
// answer the prompt — the call then either blocks or hangs, and a consent gate
// that hangs an unattended run is worse than one that denies with instructions.
// A hook behaves identically in both: deny + a copy-pasteable command.
//   NOTE: that headless-`ask` behavior is recorded as INFERENCE, not primary
//   source, in raw/research/bypass-mode-enforcement/index.md. UAT should
//   confirm it before this rationale is repeated as fact elsewhere.
//
// Scope note — installs inside shell scripts are NOT gated, by construction.
// PreToolUse sees only the command Claude asks to run. When that command is
// `bash lib/scripts/install-mcps.sh`, everything the script executes is a
// subprocess of an already-approved call and never reaches a hook. So
// install-mcps.sh:197 (`npm install -g @playwright/mcp@latest`),
// install-mcps.sh:297 and bootstrap-serena.sh:35/:51 (the uvx/serena
// invocations) all run unaffected. A user or agent typing that same
// `npm install -g @playwright/mcp@latest` at the prompt IS gated. Both are
// correct: consent was given once for the setup script as a whole; an ad-hoc
// install carries no such consent.
//
// Fails: open — matching is pure token inspection with no external input, and a
// throw exits 0 via lib/command-parse.js. The asymmetry that matters here is
// coverage rather than failure: a manager or invocation form absent from the
// tables below is allowed, which is also why the scope note above holds.

const { readHookInput, splitSegments, tokenize, deny } = require('./lib/command-parse');

// Manager basename → install subcommand phrases (space-separated so multi-token
// forms like `uv pip install` are expressible). `uvx` is absent here: its
// trigger is a flag, not a subcommand, and is handled separately below.
const INSTALL_SUBCOMMANDS = new Map([
  ['npm', ['install', 'i', 'add']],
  ['pnpm', ['add', 'install']],
  ['yarn', ['add']],
  ['pip', ['install']],
  ['pip3', ['install']],
  ['uv', ['pip install']],
  ['pipx', ['install']],
  ['gem', ['install']],
  ['cargo', ['install']],
  ['go', ['install']],
  ['brew', ['install']],
]);

// Read-only and lockfile-driven subcommands are simply absent from the lists
// above, so `npm ci`, `npm test`, `npm run build`, `pip list`, `cargo build`,
// `brew list`, and `yarn install` never match. `yarn install` is deliberately
// omitted for the same reason as `npm ci`: it installs what the lockfile
// already records, adding nothing the repo has not already consented to.

// An install that resolves nothing and writes nothing is not a package
// addition, so it needs no consent.
const NON_INSTALLING_FLAGS = new Set(['--dry-run', '--help', '-h']);

// The one allowlisted package source: Serena, this repo's own MCP dependency.
// Matched on the repo URL rather than on `uvx --from` generally, so any other
// `--from` target is still gated. An optional `.git` suffix and an optional
// `@ref` pin are accepted because both are ordinary spellings of the same repo.
const SERENA_SOURCE = /^git\+https:\/\/github\.com\/oraios\/serena(\.git)?(@[^\s]*)?$/;

function basename(token) {
  const cleaned = token.replace(/^\\+/, '');
  return cleaned.slice(cleaned.lastIndexOf('/') + 1);
}

// Drop leading environment assignments and wrappers so `FOO=1 npm install` and
// `sudo /usr/local/bin/npm install` reach the same matcher as `npm install`.
function stripInvocationPrefix(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) || ['env', 'sudo'].includes(basename(t))) i++;
    else break;
  }
  return tokens.slice(i);
}

// `uvx --from X` fetches and runs X, so it is an install in everything but
// name. The flag is located anywhere in the segment rather than at a fixed
// position, because `uvx --python 3.12 --from X` is equally valid.
//
// NOTE: bare `uvx <pkg>` (no `--from`) returns null here and is therefore
// ALLOWED, even though it fetches and runs a package by the same reasoning
// above. Whether that is a deliberate scope choice or an oversight is not
// recoverable from this file or from lib/hooks/README.md — verify before
// changing, and do not treat the current behaviour as intentional coverage.
function uvxSource(tokens) {
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === '--from') return tokens[i + 1] ?? '';
    if (tokens[i].startsWith('--from=')) return tokens[i].slice('--from='.length);
  }
  return null;
}

// Returns the matched install phrase (e.g. `npm install`, `uv pip install`) or
// null. The phrase is used only in the human-readable reason; the command the
// user is told to run is always the original segment, never a reconstruction.
function matchedInstall(tokens) {
  const name = basename(tokens[0]);

  if (name === 'uvx') {
    const source = uvxSource(tokens);
    if (source === null) return null;
    return SERENA_SOURCE.test(source) ? null : 'uvx --from';
  }

  const phrases = INSTALL_SUBCOMMANDS.get(name);
  if (!phrases) return null;

  for (const phrase of phrases) {
    const words = phrase.split(' ');
    if (words.every((w, n) => tokens[n + 1] === w)) return `${name} ${phrase}`;
  }
  return null;
}

readHookInput(data => {
  if (data.tool_name !== 'Bash') return;

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) return;

  for (const segment of splitSegments(fullCmd)) {
    const tokens = stripInvocationPrefix(tokenize(segment));
    if (!tokens.length) continue;

    if (tokens.some(t => NON_INSTALLING_FLAGS.has(t))) continue;

    const install = matchedInstall(tokens);
    if (!install) continue;

    // The segment is echoed verbatim, not rebuilt from tokens: the entire value
    // of this gate over a deny rule is that the user can copy the exact string
    // back out and run it. Re-joining tokens would silently drop quoting.
    deny(
      `Package install blocked pending consent (\`${install}\`). No package is added ` +
      `without an explicit human decision. To approve, run it yourself:\n\n` +
      `    ${segment}\n\n` +
      `If the dependency is not actually needed, say so and it will be dropped rather ` +
      `than worked around.`
    );
  }
});
