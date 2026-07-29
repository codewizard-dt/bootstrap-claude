#!/usr/bin/env node
'use strict';

// interpreter-indirection-guard.js — PreToolUse hook (matcher: Bash)
//
// Blocks two forms of interpreter indirection in ANY segment of a Bash command:
//   1. an interpreter given its program as an inline argument — `bash -c '…'`,
//      `sh -c`, `zsh -c`, `python -c`, `python3 -c`, `node -e`, `node --eval`,
//      `ruby -e`, `perl -e`
//   2. an interpreter whose program is a command substitution — `sh -c "$(curl …)"`,
//      `` bash `curl …` ``
//
// Why a hook and not a deny rule: a deny rule matches the literal spelling of a
// command. The entire point of `-c` is that the real command lives inside a
// quoted string, where no permission pattern can reach it — one approved
// `bash -c` can carry a fetcher, a redirect into ~/.zshrc, or an absolute-path
// `rm`. A hook receives the raw, undecomposed string and can parse the
// invocation form itself, and can return a reason explaining the alternative.
//
// The interpreter token is matched on its BASENAME with leading backslashes
// stripped, so `/bin/bash -c`, `env bash -c`, and `\bash -c` are all caught
// where a literal `bash -c` deny pattern is not.

// ---------------------------------------------------------------------------
// False-positive assessment — DENY OUTRIGHT was chosen over a narrow rule.
//
// The narrow alternative considered: allow `bash -c` when the payload contains
// no fetcher, nested interpreter, or redirect. Rejected on two grounds.
//
// 1. It is self-defeating. Inspecting the payload for forbidden substrings is
//    exactly the literal-spelling matching that motivated moving this control
//    out of the deny list. Any one-line obfuscation defeats it
//    (`bash -c 'c=cur;l=l;$c$l http://x'`, base64, `eval`). A control that a
//    trivial rewrite bypasses is worse than no control, because it reads as
//    coverage.
//
// 2. The measured cost of the blunt rule in this repo is near zero. Every
//    `bash -c` / `sh -c` / `node -e` occurrence under `lib/` lives INSIDE a
//    shell script (`setup-runner.sh:73`, `startup.sh:25`/`:37`,
//    `install-mcps.sh:321`). Those run as subprocesses of an already-approved
//    `bash <script>.sh` call and are never seen by a PreToolUse hook, so this
//    guard does not touch them. `bash -n script.sh` — the static gate `/tackle`
//    mandates on every shell change — uses `-n`, not `-c`, and does not match
//    either rule below.
//
// Accepted cost: the common inline-scripting idioms `python3 -c "import json…"`
// and `node -e "…"` are blocked. Escape hatch, named in the deny reason: write
// the script to a file and run the file, so its contents appear in the diff and
// are reviewable before execution.
//
// Known gaps, deliberate: other POSIX shells (`dash`, `ksh`) are not in the
// list, and bundled short flags (`sh -ec '…'`) are not decomposed.
// ---------------------------------------------------------------------------

const { readHookInput, splitSegments, tokenize, deny } = require('./lib/command-parse');

// Interpreter basename → flags that make the NEXT argument an inline program.
const EVAL_FLAGS = new Map([
  ['bash', ['-c']],
  ['sh', ['-c']],
  ['zsh', ['-c']],
  ['python', ['-c']],
  ['python3', ['-c']],
  ['node', ['-e', '--eval']],
  ['ruby', ['-e']],
  ['perl', ['-e']],
]);

// Returns the interpreter basename for a token, or null. Leading backslashes
// are stripped because `\bash` bypasses alias and shell-function lookup, and is
// a spelling a literal deny pattern misses.
function interpreterName(token) {
  const cleaned = token.replace(/^\\+/, '');
  const base = cleaned.slice(cleaned.lastIndexOf('/') + 1);
  return EVAL_FLAGS.has(base) ? base : null;
}

// `startsWith` rather than equality so the unspaced and assigned forms
// (`-c'echo hi'`, `--eval=code`) are caught alongside the spaced form.
function matchedEvalFlag(name, token) {
  return EVAL_FLAGS.get(name).find(flag => token.startsWith(flag)) ?? null;
}

readHookInput(data => {
  if (data.tool_name !== 'Bash') return;

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) return;

  for (const segment of splitSegments(fullCmd)) {
    const tokens = tokenize(segment);

    for (let i = 0; i < tokens.length; i++) {
      const name = interpreterName(tokens[i]);
      if (!name) continue;

      const next = tokens[i + 1];
      const flag = next ? matchedEvalFlag(name, next) : null;
      if (flag) {
        deny(
          `Blocked: \`${name} ${flag}\` — an interpreter invoked with an inline script. ` +
          `The script body is a quoted argument, which is opaque to the permission rules: ` +
          `no deny pattern can see the commands inside it, so a fetcher, a redirect into a ` +
          `protected dotfile, or an absolute-path \`rm\` would execute ungated. ` +
          `Safe alternative: write the script to a file and run the file ` +
          `(\`bash script.sh\`, \`node script.js\`, \`python3 script.py\`), so its contents ` +
          `are reviewable before it runs.`
        );
      }

      // The interpreter's first non-flag argument is where the program name (or,
      // with an eval flag, the program itself) goes. A command substitution
      // there means the code is produced at execution time and never appears in
      // the command being approved.
      const firstArg = tokens.slice(i + 1).find(t => !t.startsWith('-'));
      if (firstArg && /\$\(|`/.test(firstArg)) {
        deny(
          `Blocked: \`${name}\` is being handed a command substitution ` +
          `(\`$(…)\` or backticks) as its program. The code that would run is fetched or ` +
          `generated at execution time, so it never appears in the command being approved ` +
          `and no permission rule can inspect it. ` +
          `Safe alternative: fetch or generate the script into a file, read it, then run the ` +
          `file, so its contents are reviewable before it runs.`
        );
      }
    }
  }
});
