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
// RECURSIVE RE-EVALUATION, not blanket deny (TASK-028). The rule this hook now
// enforces is: *you may not use `bash -c` to do something you could not do
// without it.*
//
// The blanket deny this replaces was justified on the grounds that inspecting
// the payload is defeated by one line of obfuscation
// (`bash -c 'c=cur;l=l;$c$l http://x'`). True — but that argument only bites
// against an adversary, and against an adversary this hook already fails via
// its own documented escape hatch: `printf '…' > /tmp/x.sh && bash /tmp/x.sh`
// runs the identical program and never touches this guard. So blanket deny
// bought nothing extra against the threat it cannot stop, while charging real
// friction against the mistake it actually catches — routine `node -e` and
// `python3 -c` one-liners were simply unavailable.
//
// Why re-evaluation rather than a substring blocklist of dangerous payloads: a
// fixed danger list is a SECOND matching vocabulary that drifts out of sync
// with the guards it duplicates. Re-running the payload through the existing
// guards is exactly as strong as the direct-command path by construction,
// needs no new vocabulary, and has near-zero false positives — anything
// permitted when typed directly is permitted inside `-c`.
//
// Mechanism: the sibling guards are SPAWNED as subprocesses against a
// synthesized PreToolUse payload. They are shipped, globally-installed
// controls; re-evaluation deliberately requires zero changes to them, uses
// them exactly as Claude Code does, and stays in sync automatically. Extracting
// their decision logic into shared pure functions would remove the spawns and
// is the better eventual refactor — it is not done here because it means
// editing five live controls to save a few processes.
//
// The payload is ALSO matched against `permissions.deny`, because the sibling
// guards do not span it: nothing in lib/hooks/ blocks a bare `rm -rf ~` or
// `sudo …`, and re-evaluating through the hooks alone would have opened a hole
// that blanket deny had closed. That check is the one place a second matching
// vocabulary was unavoidable; see DENY_SOURCES / patternToRegExp below.
//
// Known gaps, deliberate: other POSIX shells (`dash`, `ksh`) are not in the
// list, and bundled short flags (`sh -ec '…'`) are not decomposed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readHookInput, deny, splitSegments } = require('./lib/command-parse');

// The other command-class guards, re-run against the extracted payload.
//
// interpreter-indirection-guard.js is DELIBERATELY ABSENT: spawning this hook
// against its own extracted payload would recurse without bound. Nesting is
// handled in-process by MAX_INLINE_DEPTH below, which is why it can be.
const SIBLING_GUARDS = [
  'absolute-path-guard.js',
  'protected-write-guard.js',
  'env-content-read-guard.js',
  'package-install-consent.js',
  'git-protected-ops-block.js',
];

// A wedged sibling must not hang the tool call it was asked about. Exceeding
// this budget is treated as trouble, and trouble denies (see askSibling).
const SIBLING_TIMEOUT_MS = 2000;

// How many interpreter-indirection layers may be unwrapped before the shape
// itself is the objection. `bash -c "bash -c '…'"` is allowed (one nesting);
// a third layer is denied. Nesting is legitimate almost never and is a
// plausible evasion shape, but refusing to nest AT ALL would break the
// occasional real `ssh host bash -c` idiom, so this is a cap, not a ban.
const MAX_INLINE_DEPTH = 2;

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

// Offset-preserving counterparts of splitSegments/tokenize from
// ./lib/command-parse. The shared helpers discard positions, and the payload
// after an eval flag can only be isolated from the raw string (see
// extractPayload), so every match has to carry its index in the command.
function segmentsWithOffsets(cmd) {
  // Capturing split: even indices are segments, odd indices are the separators.
  const parts = String(cmd ?? '').split(/(;|&&|\|\||\|)/);
  const segments = [];
  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) segments.push({ text: parts[i], start: offset });
    offset += parts[i].length;
  }
  return segments;
}

function tokensWithOffsets(segment, base) {
  return [...String(segment ?? '').matchAll(/\S+/g)].map(m => ({ text: m[0], start: base + m.index }));
}

// Returns the interpreter basename for a token, or null. Leading backslashes
// are stripped because `\bash` bypasses alias and shell-function lookup, and is
// a spelling a literal deny pattern misses.
function interpreterName(token) {
  const cleaned = token.replace(/^\\+/, '');
  const base = cleaned.slice(cleaned.lastIndexOf('/') + 1);
  return EVAL_FLAGS.has(base) ? base : null;
}

// `startsWith` rather than equality so the unspaced and assigned forms
// (`-c'echo hi'`, `--eval=code`) are caught alongside the spaced form. The
// LONGEST match wins: `--eval=1` also starts with `-e`, and taking that would
// put the payload boundary in the middle of the flag (`val=1`).
function matchedEvalFlag(name, token) {
  return EVAL_FLAGS.get(name)
    .filter(flag => token.startsWith(flag))
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

// Undo the one level of backslash-escaping a double-quoted shell string carries.
// Inside double quotes POSIX treats `\` as literal EXCEPT before `$`, `` ` ``,
// `"`, `\`, and newline — so only those five are unescaped.
//
// This is not cosmetic. Without it the nested form `bash -c "bash -c \"…\""`
// yields a payload still containing `\"`, which re-parses as an UNQUOTED
// argument and silently truncates to `\"bash` — the depth cap below would then
// never see the third layer it exists to stop.
function unescapeDoubleQuoted(body) {
  return body.replace(/\\([$`"\\\n])/g, '$1');
}

// Index of the quote closing the one at `open`, or -1 if it never closes.
// Single quotes take no escapes in POSIX shells; inside double quotes a
// backslash-escaped quote does not close the string.
function findClosingQuote(raw, open) {
  const quote = raw[open];
  for (let i = open + 1; i < raw.length; i++) {
    if (quote === '"' && raw[i] === '\\') { i += 1; continue; }
    if (raw[i] === quote) return i;
  }
  return -1;
}

// Isolate the inline program that follows a matched eval flag, stripping the
// one layer of quoting the shell already consumed (tool_input.command carries
// the quotes literally).
//
// Reads the RAW command string, never the token array, because tokens lose the
// payload twice over: whitespace splitting shears `bash -c 'echo a b'` down to
// `'echo`, and segment splitting cuts on `;`/`|` with no regard for quoting, so
// `bash -c 'echo a; echo b'` is already truncated before tokenizing. Both are
// silent truncations — the extracted payload would look well-formed and be a
// fragment of the real one.
//
// Returns { interpreter, flag, payload, quote } for the caller to act on, or
// null when no payload can be isolated (flag last, unbalanced quoting, glued
// concatenation). null means DENY: an unparseable payload is not an allowed one.
function extractPayload(raw, interpreter, flag, flagStart) {
  let i = flagStart + flag.length;

  if (raw[i] === '=') i += 1;                                    // --eval=code
  else while (i < raw.length && /\s/.test(raw[i])) i += 1;       // -c 'code' (fused -c'code' needs neither)

  if (i >= raw.length) return null;

  const quote = raw[i];
  if (quote === "'" || quote === '"') {
    const close = findClosingQuote(raw, i);
    if (close === -1) return null;
    // Anything glued to the closing quote is shell concatenation
    // (`bash -c 'echo '"$X"`): the program is not the quoted span alone, and
    // reassembling it would require expanding the parts we cannot see.
    const after = raw[close + 1];
    if (after !== undefined && !/\s/.test(after)) return null;
    const body = raw.slice(i + 1, close);
    return {
      interpreter,
      flag,
      payload: quote === '"' ? unescapeDoubleQuoted(body) : body,
      quote,
    };
  }

  const end = raw.slice(i).search(/\s/);
  const payload = end === -1 ? raw.slice(i) : raw.slice(i, i + end);
  return payload ? { interpreter, flag, payload, quote: null } : null;
}

// Ask one sibling guard about a synthesized payload.
//
// Returns null when the guard allowed, or { kind, reason } where kind is
// 'deny' (the guard decided against it) or 'trouble' (the guard's verdict is
// unknown). BOTH block. A guard whose verdict cannot be obtained has not
// approved anything, and a control that degrades to permissive under load or
// after a botched install is worse than one that occasionally over-blocks.
function askSibling(guard, hookPayload) {
  const script = path.join(__dirname, guard);

  try {
    // These hooks are installed by rsync into ~/.claude/hooks/, file by file.
    // An absent sibling is a control that silently stopped applying — the one
    // case where "skip that check" is exactly the wrong response.
    if (!fs.existsSync(script)) {
      return { kind: 'trouble', reason: `\`${guard}\` is not installed alongside this hook (looked in ${__dirname}), so its check could not be run` };
    }

    const r = spawnSync(process.execPath, [script], {
      input: hookPayload,
      encoding: 'utf8',
      timeout: SIBLING_TIMEOUT_MS,
    });

    // spawnSync reports a timeout as an error, a signal, or both, depending on
    // platform and on where the child was when the timer fired.
    if (r.error) {
      return { kind: 'trouble', reason: `\`${guard}\` could not be run (${r.error.code || r.error.message})` };
    }
    if (r.signal) {
      return { kind: 'trouble', reason: `\`${guard}\` was killed by ${r.signal} — it did not answer within ${SIBLING_TIMEOUT_MS}ms` };
    }

    // stdout is read BEFORE the exit code, because that is the ordering Claude
    // Code itself uses: the decision is the envelope, not the status.
    const stdout = String(r.stdout ?? '').trim();
    if (stdout) {
      let envelope;
      try {
        envelope = JSON.parse(stdout);
      } catch {
        return { kind: 'trouble', reason: `\`${guard}\` wrote something that is not a decision envelope` };
      }
      const decision = envelope?.hookSpecificOutput?.permissionDecision;
      if (decision === 'deny') {
        return {
          kind: 'deny',
          reason: String(envelope.hookSpecificOutput.permissionDecisionReason ?? `\`${guard}\` denied it`),
        };
      }
    }

    // Every sibling exits 0 on every path by design, including its denials, so
    // a non-zero status means it crashed rather than decided. Its verdict is
    // unknown, which blocks for the same reason a timeout does.
    if (r.status !== 0) {
      return { kind: 'trouble', reason: `\`${guard}\` exited ${r.status} without reaching a decision` };
    }

    return null;
  } catch (err) {
    // readHookInput's own catch exits 0 (allow). Anything thrown in here must
    // therefore be converted to a decision HERE, or fail-closed becomes
    // fail-open at the outermost layer.
    return { kind: 'trouble', reason: `\`${guard}\` could not be consulted (${err && err.message})` };
  }
}

// ---------------------------------------------------------------------------
// The deny list, re-checked
//
// The sibling guards do NOT cover everything `permissions.deny` covers. No hook
// in this directory objects to a bare `rm -rf ~`, `sudo …`, `crontab -r` or
// `git push --force` — the deny list does, and Claude Code applies it to the
// literal command string, which means it never sees inside `bash -c '…'`.
// Re-evaluating the payload through the hooks ALONE would therefore open a hole
// that the blanket deny this hook replaced had closed. So the extracted payload
// is matched against the deny list as well.
//
// This is the one place where a second matching vocabulary is unavoidable:
// Claude Code does not expose its permission matcher, so the semantics have to
// be reproduced here. It is kept to the four the shipped list actually depends
// on, and no further — see patternToRegExp for what is deliberately NOT
// reproduced.
// ---------------------------------------------------------------------------

// Where the rules come from, in preference order. Both are resolved from
// __dirname so one code path serves both locations this file lives in:
//   ~/.claude/hooks/   → ../settings.json  — the LIVE list Claude Code enforces,
//                        including the user's own additions
//   <repo>/lib/hooks/  → ../scripts/templates/settings-deny.json — the template
// Only one of the two exists on any given machine, so the ordering is a
// fallback rather than a precedence question.
const DENY_SOURCES = [
  { file: path.join(__dirname, '..', 'settings.json'), pick: j => j && j.permissions && j.permissions.deny },
  { file: path.join(__dirname, '..', 'scripts', 'templates', 'settings-deny.json'), pick: j => j },
];

// Translate one `Bash(...)` deny pattern into a matcher.
//
// Reproduced, because the shipped list depends on all four:
//   `dd *`            a trailing space-star is a WORD BOUNDARY, not a plain
//                     wildcard: it matches `dd` and `dd if=…`, but not `ddrescue`
//   `git stash:*`     `:*` is recognized only as a suffix, where it means
//                     exactly the same thing as a trailing ` *`
//   `sh`              no wildcard at all is an EXACT match — it must not catch
//                     `sh -c` or `shellcheck`
//   `git * --force*`  `*` is an ordinary wildcard at ANY position, not just at
//                     the end; this is the entry that catches
//                     `git -C /elsewhere push --force`, so first-token matching
//                     would not have been enough
//
// NOT reproduced, deliberately:
//   - `Edit(…)` / `Read(…)` entries. They are file-tool rules and cannot match a
//     command string at all, so they are skipped rather than mis-applied.
//   - `permissions.allow` / `ask` and their precedence. This is a deny-only
//     check, which matches Claude Code in the direction that matters: deny wins.
//   - Project-scoped `.claude/settings.json` and `.claude/settings.local.json`.
//     Only the user-scope list is consulted.
//   - Claude Code's own command decomposition. Segments come from the shared
//     `splitSegments`, which splits on `;`/`&&`/`||`/`|` without regard for
//     quoting, so `bash -c "git commit -m 'a; sudo b'"` over-blocks. That errs
//     toward blocking, never toward allowing.
function patternToRegExp(pattern) {
  // `:*` carries meaning only as a suffix, where it is exactly a trailing ` *`.
  let p = pattern.endsWith(':*') ? pattern.slice(0, -2) + ' *' : pattern;

  const boundary = p.endsWith(' *');
  if (boundary) p = p.slice(0, -2);

  // Split on `*` first so it is the only character that survives escaping.
  const body = p.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');

  // The boundary form matches the bare command too: `dd *` blocks `dd`.
  return new RegExp('^' + body + (boundary ? '( .*)?' : '') + '$');
}

// Read and compiled AT MOST ONCE per process, on first use.
//
// Not at module load, because this hook runs on every Bash call and the vast
// majority carry no interpreter at all: those must not pay for an fs read and
// 93 regex compiles they will never consult. Not per call either — `scan`
// recurses and asks again at each nesting level. So: lazy, then cached, with
// `loaded` distinguishing "not tried yet" from "tried and found nothing".
//
// A load failure is RECORDED, not thrown. The decision belongs at decision time
// (denyListVerdict, which denies), because a throw here would exit non-zero and
// Claude Code reads that as a broken hook rather than as a block.
let denyRules = null;
let denyRulesLoaded = false;

function loadDenyRules() {
  if (denyRulesLoaded) return denyRules;
  denyRulesLoaded = true;

  for (const source of DENY_SOURCES) {
    try {
      if (!fs.existsSync(source.file)) continue;
      const list = source.pick(JSON.parse(fs.readFileSync(source.file, 'utf8')));
      if (!Array.isArray(list)) continue;

      const rules = [];
      for (const entry of list) {
        if (typeof entry !== 'string') continue;
        const m = /^Bash\((.*)\)$/.exec(entry);
        if (m) rules.push({ pattern: m[1], re: patternToRegExp(m[1]) });
      }
      if (rules.length) {
        denyRules = { rules, file: source.file };
        return denyRules;
      }
    } catch {
      // Unreadable or malformed — try the next source, and if there is none,
      // denyRules stays null, which denies.
    }
  }
  return denyRules;
}

// Match the extracted payload against the deny list, segment by segment, so a
// denied command cannot hide behind `cd /tmp && rm -rf ~`.
//
// Same contract as askSibling: null means nothing objected; 'deny' means a rule
// matched; 'trouble' means the rules could not be consulted, which blocks. A
// guard that silently stops checking because it could not find its rule file is
// indistinguishable, from the outside, from a guard that approved the command.
function denyListVerdict(payload) {
  const loaded = loadDenyRules();
  if (!loaded) {
    return {
      kind: 'trouble',
      reason:
        'the permission deny list could not be read from ' +
        DENY_SOURCES.map(s => `\`${s.file}\``).join(' or ') +
        ', so the rules that block what no hook covers (`rm -rf ~`, `sudo …`, ' +
        '`git push --force`) could not be applied to it',
    };
  }

  for (const segment of splitSegments(payload)) {
    for (const rule of loaded.rules) {
      if (rule.re.test(segment)) {
        return {
          kind: 'deny',
          reason: `\`${segment}\` matches the permission deny rule \`Bash(${rule.pattern})\``,
        };
      }
    }
  }

  return null;
}

// Re-run the deny list and every sibling guard against `payload` as if it had
// been typed directly. Denies — and never returns — the moment one objects.
function reEvaluate(payload, cwd, context) {
  // `cwd` is carried through from the original call, not defaulted here:
  // protected-write-guard.js resolves relative redirect targets against it, so
  // dropping it would silently weaken that check for `bash -c 'echo x > .zshrc'`.
  const hookPayload = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: payload },
    ...(cwd ? { cwd } : {}),
  });

  // Every source of a verdict funnels through here so the two kinds are phrased
  // once. `deny` exits the process, so this never returns on an objection.
  const judge = verdict => {
    if (!verdict) return;

    if (verdict.kind === 'deny') {
      // The objecting check's OWN reason is surfaced, merely prefixed. A generic
      // "blocked inside bash -c" would tell the caller that something was
      // wrong without telling them what, which is how a block gets worked
      // around instead of fixed.
      deny(
        `Blocked inside \`${context}\` — ${verdict.reason}\n\n` +
        `(The inline program was extracted and re-evaluated as if you had typed it directly. ` +
        `\`${context}\` grants no permission that the same command typed plainly would not: ` +
        `fix the command itself rather than re-wrapping it.)`
      );
    }

    deny(
      `Blocked inside \`${context}\` — the inline program could not be fully checked: ` +
      `${verdict.reason}. ` +
      `The payload is re-evaluated through the other command-class guards and the permission ` +
      `deny list before it is allowed to run, and a check that cannot be completed is treated ` +
      `as a block, not as a pass. Run the command outside \`${context}\` so the ordinary rules ` +
      `apply to it, or repair the installation (\`./lib/scripts/install-global.sh\`).`
    );
  };

  // The deny list first: it is a pure in-process match against an already-parsed
  // list, so it costs nothing, and it covers precisely the commands the siblings
  // do not.
  judge(denyListVerdict(payload));

  for (const guard of SIBLING_GUARDS) judge(askSibling(guard, hookPayload));
}

// Walk one command level: find each interpreter+eval-flag invocation, isolate
// its program, and judge it. Recurses into the extracted program so a nested
// `bash -c` is judged too.
//
// `depth` is an ordinary in-process argument rather than an environment
// variable threaded through subprocesses, because nesting is resolved entirely
// in-process — extractPayload already hands back the inner program, so there is
// nothing to spawn and therefore no process boundary for a counter to cross.
// The siblings that DO run as subprocesses never re-enter this hook (it is
// deliberately absent from SIBLING_GUARDS), so no depth needs to reach them.
function scan(raw, depth, cwd) {
  for (const segment of segmentsWithOffsets(raw)) {
    const tokens = tokensWithOffsets(segment.text, segment.start);

    for (let i = 0; i < tokens.length; i++) {
      const name = interpreterName(tokens[i].text);
      if (!name) continue;

      const next = tokens[i + 1];
      const flag = next ? matchedEvalFlag(name, next.text) : null;
      if (flag) {
        const context = `${name} ${flag}`;
        const inline = extractPayload(raw, name, flag, next.start);

        // Unconditional, and deliberately never re-evaluated: with `$(…)` or
        // backticks the program does not exist until execution time, so there
        // is genuinely nothing in this command to inspect — no payload to
        // re-run the other guards against, and no later check can recover one.
        if (inline && /\$\(|`/.test(inline.payload)) {
          deny(
            `Blocked: \`${context}\` — the inline program is a command substitution ` +
            `(\`$(…)\` or backticks). The code that would run is fetched or generated at ` +
            `execution time, so it does not exist in the command being approved: it cannot be ` +
            `inspected, and this block is not subject to any further check. ` +
            `Safe alternative: fetch or generate the script into a file, read it, then run the ` +
            `file, so its contents are reviewable before it runs.`
          );
        }

        // Extraction failed — flag last, unbalanced quoting, or shell
        // concatenation. An unparseable payload is not an allowed payload: the
        // whole basis for permitting `-c` is that its program can be read.
        if (!inline) {
          deny(
            `Blocked: \`${context}\` — the inline script could not be isolated from the ` +
            `command, so it could not be checked. The program a \`-c\`/\`-e\` flag introduces ` +
            `is only permitted because it can be extracted and re-evaluated against the same ` +
            `rules as a plainly-typed command; when extraction fails there is nothing to ` +
            `evaluate, and an unreadable program is not an approved one. ` +
            `This usually means the quoting is unbalanced or the script is assembled by ` +
            `concatenation (\`bash -c 'echo '"$X"\`). ` +
            `Safe alternative: write the script to a file and run the file ` +
            `(\`bash script.sh\`, \`node script.js\`, \`python3 script.py\`), so its contents ` +
            `are reviewable before it runs.`
          );
        }

        if (depth >= MAX_INLINE_DEPTH) {
          deny(
            `Blocked: \`${context}\` nested ${depth + 1} levels deep. One interpreter carrying ` +
            `an inline program is ordinary; an inline program that is ITSELF an interpreter ` +
            `carrying an inline program is allowed once, and beyond that the shape is the ` +
            `objection rather than the contents — each layer of quoting is another chance for ` +
            `what actually executes to differ from what was read. ` +
            `Safe alternative: write the innermost script to a file and run the file.`
          );
        }

        // Only reached once a segment genuinely contains an interpreter plus an
        // eval flag, which is what keeps the five spawns off the common path.
        reEvaluate(inline.payload, cwd, context);
        scan(inline.payload, depth + 1, cwd);
      }

      // The interpreter's first non-flag argument is where the program name (or,
      // with an eval flag, the program itself) goes. A command substitution
      // there means the code is produced at execution time and never appears in
      // the command being approved.
      const firstArg = tokens.slice(i + 1).map(t => t.text).find(t => !t.startsWith('-'));
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
}

readHookInput(data => {
  if (data.tool_name !== 'Bash') return;

  const fullCmd = String(data.tool_input?.command ?? '').trim();
  if (!fullCmd) return;

  const cwd = typeof data.cwd === 'string' && data.cwd ? data.cwd : '';

  scan(fullCmd, 0, cwd);
});
