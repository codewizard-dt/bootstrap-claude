#!/usr/bin/env node
'use strict';

/**
 * serena-bash-grep-block.js — PreToolUse / Bash
 *
 * Blocks: shell commands that navigate or edit code the way Serena should — the grep
 *   family aimed at code symbols, cat/head/tail/sed/awk reads of code and markdown
 *   files, ls/tree/find over source directories, and in-place edits of code files
 *   (sed -i, awk -i inplace, perl -i, and redirect writes).
 * Why a hook: a deny rule matches a literal command spelling; the verdict here depends
 *   on the command's *pattern argument* and its *target's extension*. `grep UserService
 *   src/` must block while `grep -c error app.log` must not — same verb, same flags.
 *   No settings.json pattern can read a quoted regex, classify its tokens as code
 *   symbols, and then check what file the operand names.
 * Fails: open — every failure path exits 0 and allows. Unparseable stdin, a non-Bash
 *   payload, `CLAUDE_MIGRATION=1`, and an unhealthy Serena (`shouldEnforceSerena()`
 *   false) all pass straight through, so a crashed or hung MCP server cannot trap the
 *   agent between broken Serena calls and blocked shell fallbacks.
 * False positives: a command that merely *mentions* a guarded form fires the rule that
 *   owns it, because nothing here parses shell quoting. The load-bearing case in this
 *   repo is an arrow function followed by a `.js` string — `x => require("a.js")` reads
 *   as `>` redirecting into a code file. Escape hatch: write `function () {}` instead
 *   of `=>` (pinned in UAT-033 and UAT-034, whose inline scripts are deliberately
 *   arrow-free). Second known case: this file's own name. `git log -- lib/hooks/
 *   serena-bash-grep-block.js` blocks because `-grep-` satisfies `\bgrep\b`; escape
 *   hatch is a glob that omits the word, e.g. `'lib/hooks/serena-bash-*.js'`.
 * See README.md § "Serena-first enforcement hooks (ported from
 *   `claude-code-lsp-enforcement-kit`)" for this hook's row, and § "Health tracking &
 *   fail-open enforcement" for the fail-open contract every Serena guard shares.
 *
 * Structure: three ordered phases inside checkSegment() — see the PHASE banners there.
 */

// NOTE: `path` is imported but never referenced anywhere in this file. Harmless, but it
// is dead — do not take its presence as evidence that path resolution happens here; the
// real resolution lives in lib/serena.js (`isAllowedPath`, `isOutsideProject`).
const path = require('path');
const {
  buildSuggestion, buildStructuredBlockResponse, buildBashFsSuggestion, isAllowedPath,
  extractSymbolsFromPattern,
  getStateFilePath, readStateFile, shouldEnforceSerena, isOutsideProject,
} = require('./lib/serena');

// Zero-width / formatting chars that would split tokens invisibly and
// bypass ASCII regex symbol detection.
//
// Why these specific ranges: a security audit of the upstream kit (CHANGELOG 2.1.0,
// "Unicode zero-width character bypass") found that a pattern with a ZWSP spliced into
// it tokenized as one non-ASCII blob, matched none of the PascalCase/camelCase regexes,
// and sailed through. The set is the soft hyphen plus the three formatting blocks that
// render as nothing: ZWSP/ZWNJ/ZWJ/LRM/RLM, the word-joiner and invisible-operator
// range, and the BOM.
//
// Stripping rather than rejecting is deliberate: a stripped command is still judged on
// its real symbols, whereas rejecting outright would deny commands that picked up a BOM
// by accident. This is a guardrail against evasion, not a security boundary.
const ZERO_WIDTH = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  // Fail-open #1: malformed stdin. A hook that exits non-zero on garbage input would
  // break every Bash call rather than the ones it means to gate.
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);
  // Set only by `lib/scripts/migrate-project.sh:228`, which runs Claude headless to
  // bulk-move a legacy .docs/ tree. That work is inherently filesystem-shaped (git mv,
  // find, sed over paths that are about to stop existing) and Serena has nothing to
  // offer it, so the whole run opts out via one env flag rather than by teaching every
  // rule below a migration-specific exception. `serena-first-read-guard.js:64` honours
  // the same flag. Note it is an ordinary env var: it is a convenience for a trusted
  // local script, not a control an untrusted caller is prevented from setting.
  if (process.env.CLAUDE_MIGRATION === '1') process.exit(0);

  // Fail-open #2: skip enforcement when Serena is unhealthy for this project.
  // A missing, legacy, or 24h-expired state file all mean "assume healthy, enforce" —
  // only an explicit `health.should_enforce === false`, written by the usage tracker
  // after a transport-level failure with no live Serena process, disables the guard.
  // See README § "Health tracking & fail-open enforcement".
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  // String coercion: non-string command would throw on .trim() and fail-open.
  // Zero-width strip: prevents `grep\u200BUserFunc` evasion.
  const fullCmd = String(data.tool_input?.command ?? '').trim().replace(ZERO_WIDTH, '');

  // Container bypass: `docker exec`, `docker compose exec`, `docker-compose exec`.
  // Serena cannot reach into a container's filesystem, so the FS-exploration and
  // in-place-editing rules have nothing to redirect such a command *to*.
  //
  // ORDERING (load-bearing): this runs on `fullCmd`, BEFORE the segment split below.
  // Reversing it breaks the real case that motivated the current shape (upstream
  // CHANGELOG 3.1.5): `ssh host 'docker exec ctr sh -c "ls /path; ls /path2"'` splits on
  // the inner `;` into two bare `ls /path` segments, and the `docker exec` context that
  // justified them is gone from both. Split first and the bypass can never fire.
  //
  // Intentionally NOT anchored at `^` — the docker invocation is frequently nested
  // inside another command (`ssh host '...'`, `sudo`), which an anchored match misses.
  // The `(?:\s+-{1,2}[\w-]+(?:[ =]\S+)?)*` run skips flags between the manager and
  // `exec` so `docker --context prod compose -f x.yml exec` still matches.
  //
  // Accepted cost: this is a whole-command substring test, so a command that merely
  // quotes the phrase (`echo "run docker exec first"`) disables the guard for that call.
  // Serena-first is agent guidance rather than a security boundary, so an occasional
  // over-permissive read is the cheaper error direction here than blocking real
  // container work.
  if (/(?:^|[\s'"])(?:sudo\s+)?(?:docker-compose|docker(?:\s+compose)?)(?:\s+-{1,2}[\w-]+(?:[ =]\S+)?)*\s+exec\b/i.test(fullCmd)) {
    process.exit(0);
  }

  // SSH bypass: any ssh-to-remote-host invocation skips all Serena-first checks.
  // Same rationale as the container bypass — Serena's LSP is bound to this project's
  // local root, so it cannot answer a question about a remote filesystem, and blocking
  // `ssh host 'grep foo /etc/x'` would leave the agent with no way to do the work.
  //
  // ORDERING: also on `fullCmd`, also before the split, for the same reason — the
  // remote command usually arrives as a quoted payload full of `;` and `&&`.
  //
  // Two deliberate narrowings in the regex:
  //   - the leading `(?:^|[\s'"|;&])` class means `\bssh\b` cannot match inside a longer
  //     word, so `sshpass -p … ssh host` still matches on its second token while a
  //     hypothetical `myssh` does not;
  //   - the trailing `\s+\S` requires ssh to have at least one argument, so the bare
  //     word "ssh" in prose or a variable name does not switch the whole guard off.
  //
  // NOTE: the narrowings reduce accidental matches; they do not make this tamper-proof.
  // `echo 'ssh host'` still disables the guard for that command. Accepted for the same
  // reason as above: guidance, not a boundary.
  if (/(?:^|[\s'"|;&])ssh\s+\S/i.test(fullCmd)) {
    process.exit(0);
  }

  // Split the command on `;`, `&&`, `||` and evaluate each segment independently.
  // This catches cases like `ls src/ && cat src/index.ts` where only one segment is bad;
  // judging the whole string at once would let a bad half hide behind a good half.
  //
  // `|` is deliberately NOT a separator here. Phase 1 needs to see a pipeline whole in
  // order to decide whether a grep is filtering another tool's output (allowed) or
  // searching the codebase (blocked) — splitting on `|` would destroy exactly the
  // context that decision rests on. Phase 1 does its own `|` split internally.
  //
  // The split is quoting-unaware, like `lib/command-parse.js#splitSegments`: a `;` or
  // `&&` inside a quoted string splits anyway. That errs toward evaluating more, smaller
  // fragments, i.e. toward blocking — the safe direction for a guard whose failure mode
  // is over-permissiveness. Teaching it real quoting means reimplementing the shell.
  const segments = fullCmd.split(/;|&&|\|\|/).map(s => s.trim()).filter(Boolean);

  for (const cmd of segments) {
    const blockResult = checkSegment(cmd, fullCmd);
    if (blockResult) {
      process.stderr.write(blockResult.stderr);
      console.log(JSON.stringify(blockResult.json));
      process.exit(2);
    }
  }

  process.exit(0);
});

/**
 * Inspect a single command segment for violations.
 * Returns { stderr, json } if the segment should be blocked, or null to allow.
 *
 * Three phases run in a fixed order. The order is not stylistic — see the ORDERING
 * notes on each PHASE banner for what breaks if they are swapped. In short:
 *
 *   PHASE 1 (grep family) must be first, because it is the only phase that inspects the
 *     *pattern* rather than the target, and it owns the pipeline-shape decision. Phases
 *     2 and 3 would otherwise claim commands (`cat x.ts | grep Foo`) on the strength of
 *     the target alone and emit the wrong suggestion.
 *   PHASE 2 (reads) must precede PHASE 3 (writes), because the read rules carry negative
 *     lookaheads for `-i` that hand the editing variants down to phase 3. Reverse them
 *     and the redirect rules in phase 3 would claim `sed -n '1,5p' a.ts > /dev/null`.
 *
 * Every phase returns on first match, so within a phase the earlier rule wins.
 */
function checkSegment(cmd, fullCmd) {
  // Strip the transparent `rtk` proxy prefix so the bypasses below match the real
  // command. `rtk` wraps another command without changing its semantics, so
  // `rtk git diff HEAD -- file.md` must be judged as `git diff HEAD -- file.md`;
  // without the strip, the VCS bypass's `^(?:sudo\s+)?(?:git|gh|…)` anchor misses and
  // an ordinary `git diff` on a markdown file gets blocked.
  //
  // Anchored at `^` and applied per-segment: only a leading `rtk` is a proxy prefix,
  // whereas `rtk` appearing later is an argument and must stay visible to the rules.
  // NOTE: `sudo` is stripped inline by the individual regexes rather than here, so
  // `sudo rtk git …` (prefixes in that order) is not handled. Not known to occur.
  cmd = cmd.replace(/^rtk\s+/, '');

  // Out-of-project scoping: Serena is per-project and can't reach outside the
  // root, so a segment whose every path target escapes the project passes
  // through. Read-exploration commands additionally allow variable-led paths
  // (e.g. `ls "$SDIR"`) that can't be proven in-project; in-place edits do not.
  //
  // ORDERING: this precedes all three phases because it is a scope question, not a
  // policy question — if Serena cannot reach the target, no phase below has a valid
  // suggestion to offer, and blocking would leave the agent with no route at all.
  // "EVERY target escapes" rather than "any" is what keeps `cat /etc/hosts src/a.ts`
  // blocked; see segmentEscapesProject().
  if (segmentEscapesProject(cmd)) return null;

  // VCS bypass: `git`, `gh`, `hg`, `jj`, `svn` may legitimately reference any
  // path (e.g. `git diff HEAD -- foo.md`, `gh pr view`). They don't read file
  // contents in the way `cat`/`sed`/`grep` do — the diff/show output is VCS
  // metadata (revisions, hunks, blame) that Serena cannot produce at all, so there is
  // no Serena call to redirect the user to. Skip all Phase 2/3 checks for them.
  //
  // Anchored at `^` on purpose: this asks "what program is this segment running?", not
  // "does this segment mention git?". `cat src/a.ts && echo git` must not get a pass.
  //
  // `git grep` specifically is NOT exempted, and that is a reversal worth knowing about:
  // upstream 3.1.1 added a `git grep`/`git show` substring bypass, and 3.1.2 removed it
  // because `git grep` is a codebase search that bypasses Serena's LSP index — exactly
  // the thing this hook exists to redirect. `git … | grep` stays allowed via Phase 1's
  // pipe bypass, which is the legitimate case (filtering VCS output, not searching code).
  if (/^(?:sudo\s+)?(?:git|gh|hg|jj|svn)\b/.test(cmd)) {
    // Still run Phase 1 in case of `git log | grep MySymbol` patterns within a single segment.
    // (Phase 1 has its own allowlist for git-piped grep, so this is safe.)
    //
    // KNOWN FALSE POSITIVE: this test is a whole-segment substring scan, so a VCS command
    // whose *pathspec* contains the word grep is dragged into Phase 1 — e.g.
    // `git log -- lib/hooks/serena-bash-grep-block.js` (the `-` delimiters make `-grep-`
    // satisfy `\bgrep\b`), which then blocks on Phase 1's `lib/` fallback. Escape hatch:
    // a pathspec glob that omits the word, e.g. `git log -- 'lib/hooks/serena-bash-*.js'`.
    // Narrowing this to "grep is an actual command token" would need quote-aware parsing.
    if (!/\b(grep|rg|ag|ack)\b/i.test(cmd)) return null;
  }

  // ── PHASE 1: grep-family detection ────────────────────────────────────────
  //
  // ORDERING: first, and it must stay first. This is the only phase that judges the
  // *pattern* rather than the target, and the only one that reasons about pipeline
  // shape. Run Phase 2 first and `cat src/a.ts | grep UserService` would be claimed by
  // the cat rule on the strength of its target, producing a `get_symbols_overview`
  // suggestion for what is really a symbol search — the wrong tool, and the pipe bypass
  // that decides whether the grep was legitimate never gets consulted at all.
  //
  // The `/i` flag is not cosmetic: upstream CHANGELOG 2.1.0 records `GREP` and `RG` in
  // caps evading a case-sensitive test.
  if (/\b(grep|rg|ag|ack)\b/i.test(cmd)) {
    // Markdown exploration: grep/rg on .md files must go through Serena
    // (search_for_pattern / read_file). Markdown writing stays on native Edit/Write,
    // but reading & searching are Serena's job — the symbol-pattern heuristic below
    // misses lowercase prose queries like "addendum|amend|update", which would
    // otherwise slip past on a markdown target.
    //
    // ORDERING within Phase 1: this deliberately precedes the pipe bypass. A markdown
    // target is decided by *what file is named*, and that is true regardless of how many
    // pipes the command has; letting the pipe bypass run first would let
    // `find . | grep -f pat wiki/index.md` through on pipeline shape alone.
    //
    // Accepted cost of that choice: a `.md` path anywhere in a piped command blocks it,
    // including when the file is incidental (`npm test | grep -c "README.md"`). The
    // escape hatch is the suggested Serena call itself, which does the same job.
    const mdTargetMatch = cmd.match(/(?:^|\s)((?:[~./\w-]+\/)?[\w.-]+\.md)\b/i);
    if (mdTargetMatch) {
      return buildMarkdownBlockResult(cmd, fullCmd, 'grep', mdTargetMatch[1]);
    }

    // Pipe-bypass (INVERSE denylist): allow grep after any pipe unless the first pipe segment
    // itself runs grep/rg/ag/ack, or reads a code file directly (cat/head/tail <code-ext>,
    // find <code-dir>).
    //
    // Why inverted. The upstream original was a positive allowlist of trusted first-stage
    // tools, which started at `git|gh|hg` (3.1.1) and immediately had to grow to add
    // `docker|docker-compose|podman|kubectl|oc|nerdctl` (3.1.3). Every build tool, test
    // runner, and linter in existence is a legitimate thing to pipe into grep — composer,
    // cargo, mvn, make, npm test, ruff — so the allowlist could only ever be incomplete,
    // and each gap presented as a spurious block. 3.1.4 inverted it: the *unsafe* first
    // stages are the short, closed, and stable list, because "grep the codebase" only has
    // a few spellings. Do not convert this back to an allowlist.
    //
    // The principle: `X | grep Foo` filters X's output; only when X is itself a codebase
    // search or a code-file read is the pipeline a disguised codebase search.
    const _pipeSegs = cmd.split('|').map(s => s.trim());
    if (_pipeSegs.length >= 2) {
      const _firstSeg = _pipeSegs[0];
      // Guards against the naive split above: `|` is a regex alternation as often as it is
      // a pipe. `git grep -nrE "smart_launch|llm_audit_sink"` splits into two fragments,
      // making a plain `git grep` look like a two-stage pipeline and bypassing the check —
      // a real hole fixed in 3.1.2. Testing the first fragment for a grep token closes it,
      // since the verb stays in fragment one however the quoted pattern is chopped up.
      const _firstSegIsGrep    = /\b(grep|rg|ag|ack)\b/i.test(_firstSeg);
      // The other disguised-search shape: pipe a code file's contents into grep and the
      // search is over code, not over tool output. Two spellings are covered —
      //   1. a reader with a code-extension operand (`cat src/app.ts | grep Foo`);
      //   2. `find` rooted at a conventional source directory (`find src -name '*.ts' |
      //      grep Handler`) — matched by directory name because find's output is paths,
      //      which carry no extension to test until after the pipe.
      // The `\S*` before the directory alternation lets `./src`, `../lib`, and `app/lib`
      // match. Both lists are conventional-name heuristics, so a project using
      // non-standard directory names (e.g. `source/`) is simply not covered — accepted,
      // since the failure direction is a missed block rather than a spurious one.
      const _firstSegReadsCode =
        /\b(?:cat|head|tail|less|more|bat)\s+\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)\b/i.test(_firstSeg) ||
        /\bfind\s+\S*(?:src|app|components|lib|hooks|utils|services|actions)\b/i.test(_firstSeg);
      if (!_firstSegIsGrep && !_firstSegReadsCode) return null;
    }
    // Path-based exemptions — directories Serena's index does not usefully cover, so a
    // grep is the only tool available: generated SQL migrations, agent scratch/config
    // trees (`.task`, `.claude`), vendored dependencies, and the knowledge-vault notes
    // directory. Each side of the name is anchored to a separator or a string boundary;
    // upstream 2.1.0 recorded a bare substring match letting `myknowledge-vaultxxx`
    // through, and the same shape would let any of these be spoofed by a longer name.
    if (/(?:^|[\/\\])(?:supabase[\/\\]migrations|\.task|\.claude|node_modules|knowledge-vault)(?:[\/\\]|$)/i.test(cmd)) return null;
    // An explicit `--include`/`--include=` restricted to a non-code extension is the user
    // stating the search scope outright: nothing Serena indexes can match, so there is no
    // symbol search to redirect to. Note `env` in this list — see the deliberate division
    // of labour with `env-content-read-guard.js` at the `hasNonCodeTarget` rules below.
    if (/--include=?\S*\.(sql|json|txt|env|sh|css|scss|log)\b/i.test(cmd)) return null;

    // Un-escape `\"` first: the command often arrives already quoted once (from a JSON
    // payload or a nested shell), and without this the double-quoted alternative below
    // fails to find its closing quote and silently falls through to the weaker forms.
    const cleaned = cmd.replace(/\\"/g, '"');
    // Three alternatives, tried in descending confidence. Order matters only in that the
    // quoted forms must precede the bare form: an unquoted match inside an already-quoted
    // pattern would capture a fragment rather than the whole expression.
    //   1/2. double- then single-quoted pattern — the operand is unambiguous.
    //   3.   bare pattern with no quotes. Deliberately restricted to `[A-Z][a-zA-Z]\w+`:
    //        an unquoted operand cannot be told apart from a path or a flag argument in
    //        general, so this only fires on the one shape that is almost always a symbol
    //        (initial capital, at least three chars). The `(?:-\w+\s+(?:[a-z]+\s+)?)*?`
    //        run skips leading flags and their lowercase arguments (`-t ts`, `-m 5`)
    //        without swallowing the pattern itself.
    const patternMatch =
      cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*"([^"]+)"/i) ||
      cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*'([^']+)'/i) ||
      cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:(?:-\w+\s+(?:[a-z]+\s+)?)*?)([A-Z][a-zA-Z]\w+)/);

    if (!patternMatch) {
      // No readable pattern (e.g. `-e` forms, `-f patfile`, heavy shell quoting). The
      // pattern is what normally decides this phase, so fall back to the target: a grep
      // aimed at a conventional source directory or a TS/JS file is a codebase search
      // whatever its pattern turns out to be. The suggestion says `<code file>` because
      // there is no symbol to name.
      const fallbackTargetsCode =
        /\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]|actions[\\/]/i.test(cmd) ||
        /\.tsx?\b|\.jsx?\b/i.test(cmd);
      if (fallbackTargetsCode) {
        return buildFsBlockResult(cmd, fullCmd, 'grep', '<code file>');
      }
    }

    if (patternMatch) {
      const fullPattern = patternMatch[1];
      // NOTE: split on BOTH `|` and `.` — splitting on dots avoids merging
      // dotted expressions like `mcp.Tool` into `mcpTool` (camelCase false positive).
      // That exact false positive is recorded in upstream CHANGELOG 2.2.0: stripping the
      // dot as a regex metacharacter fused the two halves into something that looked like
      // a camelCase identifier, so an ordinary `grep "mcp.Tool"` was blocked. Splitting on
      // the dot before metachar-stripping means each half is classified on its own.
      // `\\?\|` accepts both the bare `|` alternation and the escaped `\|` that basic
      // (non-extended) grep requires.
      //
      // Order inside `clean` is load-bearing: zero-width chars are stripped BEFORE regex
      // metacharacters, because a metachar-strip on a token containing an invisible
      // separator would leave the separator in place and hide the symbol.
      //
      // `allowlist: 'bash'` selects one of the three call-site dialects in lib/serena.js —
      // the one tuned for shell patterns, which is more permissive about common lowercase
      // words than the Grep-tool dialect. Classification itself lives in
      // `isCodeSymbol` there; this file only decides what to feed it.
      const symbols = extractSymbolsFromPattern(fullPattern, {
        splitRe: /\\?\||\./,
        clean: p => p.replace(ZERO_WIDTH, '').replace(/[*+?^${}()[\]\\]/g, ''),
        allowlist: 'bash',
      });

      // SECURITY: only allow the safe-prefix pipe bypass AFTER confirming no code symbols.
      // This branch ordering *is* the fix for a reported bypass (upstream 2.1.0,
      // "Pipe-ordering bypass"): the safe-prefix exemption originally ran before symbol
      // detection, so `echo x | grep SomeCamelFunc` was allowed on pipeline shape alone.
      // Hoisting the exemption back out of this `symbols.length === 0` guard — a tempting
      // simplification, since it would flatten a level of nesting — reopens it exactly.
      if (symbols.length === 0) {
        const targetsCodeEarly =
          /\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]|actions[\\/]/i.test(cmd) ||
          /\.tsx?\b|\.jsx?\b/i.test(cmd);
        // A non-code extension in the command means the search is scoped to something
        // Serena does not index, so there is no Serena call to redirect to. The
        // `&& !targetsCodeEarly` conjunct keeps a mixed command (`grep X src/a.ts b.json`)
        // blocked — a code target anywhere outranks a non-code one.
        //
        // ⚠️ `env` is in this list on purpose (navigation does not care about .env files),
        // and that is precisely why `grep KEY .env` once leaked secrets to the transcript.
        // Secrets are NOT this hook's job — `env-content-read-guard.js` owns display of
        // .env contents, and both hooks are wired on Bash so both see the call. Do not
        // "fix" the leak by removing `env` here; that would block legitimate navigation
        // and still miss the Serena-side path. See README § `env-content-read-guard.js`.
        const hasNonCodeTargetEarly = /\.(sql|json|txt|env|sh|css|scss|log|xml)\b/i.test(cmd) && !targetsCodeEarly;
        if (hasNonCodeTargetEarly) return null;

        // Narrow safe-prefix exemption, distinct from the inverse-denylist pipe bypass
        // above. That one has already declined to exempt this command (the first stage
        // was a grep or a code read); this one re-admits a short list of first stages
        // whose output is plainly not source code. It is reachable only with zero code
        // symbols in the pattern, which is what makes the extra permissiveness safe.
        //
        // `xargs`/`exec` disqualify the command because both turn the first stage's output
        // back into arguments for a second command — `find src | xargs grep Foo` is a
        // codebase search wearing a pipe, not a filter over output.
        // The `pipePos < grepPos` test enforces that the grep is genuinely downstream:
        // `grep Foo src/ | head` has a pipe but the grep is the source, not the sink.
        const isSimplePipe = /\|/.test(cmd) && !/xargs|exec/.test(cmd);
        const grepPos = cmd.search(/\b(grep|rg|ag|ack)\b/i);
        const pipePos = cmd.indexOf('|');
        if (isSimplePipe && pipePos !== -1 && pipePos < grepPos) {
          const beforePipe = cmd.substring(0, pipePos).trim();
          // Two anchored groups: package managers / runtimes / `echo` / a `cat` of an
          // explicitly non-code file, plus plain text utilities. `cat` is admitted only
          // with a non-code extension spelled out — a bare `cat` would readmit the
          // `cat src/a.ts | grep Foo` case the inverse denylist exists to catch.
          if (/^(git|npm|npx|pnpm|node|echo|cat\s+\S+\.(?:json|md|txt|log|ya?ml))/i.test(beforePipe) ||
              /^(ls|wc|head|tail|sort|uniq)\b/i.test(beforePipe)) {
            return null;
          }
        }
        if (targetsCodeEarly) {
          return buildFsBlockResult(cmd, fullCmd, 'grep', '<code file>');
        }
        return null;
      }

      // ── On the duplication with targetsCodeEarly / hasNonCodeTargetEarly above ──
      //
      // These are NOT copies: this pair is a strict superset. The `Early` pair tests two
      // clauses (source-directory path, TS/JS extension); this one adds five — ripgrep's
      // `-t ts` and `--type=ts` type filters, `find` rooted at a source directory, and the
      // two argument-passing shapes `xargs grep` and `find -exec grep`.
      //
      // Extracting one shared helper therefore cannot be a pure refactor: it needs a
      // parameter that switches those five clauses off, which trades a visible difference
      // for a hidden one in a security guard. That is the argument against doing it.
      //
      // NOTE: whether the *narrower* test on the zero-symbol path is deliberate is not
      // recoverable from the code, the README, or the upstream changelog. The effect is
      // that `rg -t ts "some phrase"` (type-scoped, no code symbols) is allowed here while
      // the same flags with a symbol present are blocked — defensible as "no symbol, no
      // symbol search", but equally consistent with the extra clauses simply having been
      // added to one site and not the other. Verify intent before unifying them.
      const targetsCode =
        /\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]|actions[\\/]/i.test(cmd) ||
        /\.tsx?\b|\.jsx?\b/i.test(cmd) ||
        /-t\s+(ts|tsx|js|jsx|typescript|javascript)\b/i.test(cmd) ||
        /--type[= ](ts|tsx|js|jsx|typescript)\b/i.test(cmd) ||
        /\bfind\b.*\b(src|app|components|lib)\b/.test(cmd) ||
        /\bxargs\b.*\b(grep|rg|ag|ack)\b/i.test(cmd) ||
        /-exec\s+(grep|rg|ag|ack)\b/i.test(cmd);

      const hasNonCodeTarget =
        /\.(sql|json|txt|env|sh|css|scss|log|xml)\b/i.test(cmd) &&
        !targetsCode;

      // The `&& !targetsCode` conjunct is already baked into hasNonCodeTarget, so the
      // second test here is redundant. Harmless, but do not read it as a second condition.
      if (hasNonCodeTarget && !targetsCode) return null;

      // Intent per symbol, from its first character: an initial capital reads as a type or
      // component name, so the useful next call is a symbol lookup; a lowercase identifier
      // is usually a function or variable already known to exist, so the useful call is a
      // reference search. A cheap heuristic, but it only picks *which* Serena tool to
      // suggest — getting it wrong costs a suboptimal suggestion, never a wrong verdict.
      const suggestions = symbols.map(sym => {
        const intent = /^[A-Z]/.test(sym) ? 'symbol_search' : 'references';
        return `  ${sym}:\n${buildSuggestion(sym, intent, '    ')}`;
      }).join('\n');

      // 200 chars keeps a long pipeline from burying the suggestion it is paired with;
      // the agent already has the full command it just tried, so echoing all of it adds
      // nothing. `fullCmd` not `cmd`, so the echo matches what the user actually typed
      // rather than the post-split, post-rtk-strip fragment being judged.
      const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
      // DEFECT (comments-only pass — deliberately not fixed): `serenaCall` is computed
      // here and never read. The reason/stderr strings below both use `suggestions`
      // instead. Dead as written; deleting it changes no behaviour, but the alternative
      // reading — that one of the two messages was meant to use the FS-style suggestion —
      // needs a decision rather than a silent tidy-up.
      const serenaCall = buildBashFsSuggestion(cmd, '  ') ||
        symbols.map(sym => {
          const intent = /^[A-Z]/.test(sym) ? 'symbol_search' : 'references';
          return `  ${buildSuggestion(sym, intent, '')}`;
        }).join('\n');
      const allowNote = 'Allowlist: any-CLI-piped grep (unless first segment is grep or reads a code file), non-code extensions, non-code paths.';
      const reason = `SERENA-FIRST: Pattern contains code symbols [${symbols.join(', ')}].\n` +
        `Command (truncated): ${displayCmd}\n` +
        `Use instead:\n${suggestions}\n${allowNote}`;

      const intent = /^[A-Z]/.test(symbols[0]) ? 'symbol_search' : 'references';
      return {
        stderr: `\n⛔ SERENA-FIRST: Blocked grep/rg — found ${symbols.length} code symbol(s): ${symbols.join(', ')}\n` +
          `Serena is always connected. Use:\n${suggestions}\n\n`,
        json: buildStructuredBlockResponse({ hook: 'serena-bash-grep-block', symbols, intent, reason }),
      };
    }
  }

  // ── PHASE 2: filesystem exploration detection ──────────────────────────────
  //
  // Reads: listing directories and dumping file contents. Reached only when Phase 1
  // found no grep-family verb, or found one it declined to block.
  //
  // ORDERING vs PHASE 3: reads must be judged before writes. The sed/awk read rules below
  // carry `(?!…-i…)` negative lookaheads that deliberately hand the editing variants down
  // to Phase 3; run Phase 3 first and its redirect rules would claim read commands that
  // merely happen to redirect (`sed -n '1,5p' a.ts > /dev/null`), reporting an in-place
  // edit that never happened and naming the wrong Serena replacement tool.

  // `ls` on a directory is `list_dir`'s job. `ls -d` is excluded because it prints the
  // directory entry itself rather than its contents — a stat, not an exploration, and
  // Serena has no equivalent.
  const lsMatch = /\bls\b(?!\s+-d\b)(?:\s+[^\s|;&<>]+)/.exec(cmd);
  if (lsMatch) {
    // Extract directory argument (skip flags)
    // NOTE: `cmd.indexOf('ls')` finds the first literal "ls" anywhere in the string, not
    // the position the regex matched. On a segment where "ls" first appears inside another
    // word (e.g. a path containing "tools"), the slice starts mid-token and the extracted
    // target is garbage — which yields a confusing target in the block message, though the
    // block/allow verdict still comes from isExemptDir on whatever was extracted.
    const afterLs = cmd.slice(cmd.indexOf('ls') + 2).trim();
    const lsTarget = afterLs.replace(/^(?:-\S+\s+)*/, '').split(/\s/)[0] || '';
    // Block only when the target is not in the always-exempt list.
    // A bare `ls` with no operand extracts to '' and falls through — listing the cwd is
    // the single most common orientation command and blocking it is pure friction.
    if (lsTarget && !isExemptDir(lsTarget)) {
      return buildFsBlockResult(cmd, fullCmd, 'ls', lsTarget || '.');
    }
  }

  // tree targeting non-exempt directory
  // The `tree` CLI is always a standalone word: it is followed by whitespace, a flag, or
  // end-of-segment. Package names like "tree-sitter" and "tree_sitter" contain additional
  // word characters after "tree", so we require a non-word character (or end) after the
  // match with (?!\w) in addition to the opening \b. This prevents false positives on
  // identifiers like tree_sitter_javascript or tree-sitter.
  const treeMatch = /\btree(?!\w)(?:\s+[^\s|;&<>]+)?/.exec(cmd);
  if (treeMatch) {
    const treeIdx = cmd.search(/\btree(?!\w)/);
    const afterTree = cmd.slice(treeIdx + 4).trim();
    const treeTarget = afterTree.replace(/^(?:-\S+\s+)*/, '').split(/\s/)[0] || '.';
    if (!isExemptDir(treeTarget)) {
      return buildFsBlockResult(cmd, fullCmd, 'tree', treeTarget);
    }
  }

  // `find` is only claimed when it carries a predicate — `-name`/`-path`/`-iname`/`-type`.
  // That is what makes it a *search* (Serena's `find_file`) rather than a bare recursive
  // listing, and it keeps `find` used as a plumbing primitive (piped into another tool,
  // or with `-delete`/`-exec` doing non-navigational work) out of scope.
  // `[^|;&<>]*` stops the scan at a shell operator so a predicate belonging to a later
  // command in the pipeline is not attributed to this `find`.
  const findMatch = /\bfind\s+(\S+)\s+[^|;&<>]*-(?:name|path|iname|type)\b/.exec(cmd);
  if (findMatch) {
    const findTarget = findMatch[1];
    if (!isExemptDir(findTarget)) {
      return buildFsBlockResult(cmd, fullCmd, 'find', findTarget);
    }
  }

  // cat/head/tail/less/more/bat on markdown — Serena owns markdown reading too.
  // Checked before the code-extension rule below purely so the message is right: both
  // would fire, but this one names `read_file` rather than `get_symbols_overview`, and a
  // markdown file has no symbol overview to give.
  // The lazy `[^|;&<>]*?\s` (rather than the code rule's `\s+`) lets the operand sit
  // after flags — `head -n 20 wiki/index.md` — while still stopping at a shell operator.
  const catMdMatch = /\b(?:cat|head|tail|less|more|bat)\b[^|;&<>]*?\s(\S+\.md)\b/i.exec(cmd);
  if (catMdMatch) {
    return buildMarkdownBlockResult(cmd, fullCmd, 'cat', catMdMatch[1]);
  }

  // cat/head/tail/less/more/bat on code-extension files.
  // The extension list is the same one used by the pipe bypass and the redirect rules in
  // Phase 3; they are kept literal at each site rather than hoisted to a shared constant,
  // which means adding a language requires touching every copy. Flagged, not changed.
  const catMatch = /\b(?:cat|head|tail|less|more|bat)\s+\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)\b/.exec(cmd);
  if (catMatch) {
    // Re-extracting via extractFileArg rather than reusing catMatch: the regex above
    // proves *a* code file is being read, but its `\S+` may have captured a token that is
    // not the operand. isAllowedPath then gets the final say, since it applies the
    // language-aware and test/config allowlists that this regex knows nothing about.
    const fileArg = extractFileArg(cmd, /\b(?:cat|head|tail|less|more|bat)\b/);
    if (fileArg && !isAllowedPath(fileArg)) {
      return buildFsBlockResult(cmd, fullCmd, 'cat', fileArg);
    }
    // Even if extraction failed, pattern already confirmed code extension.
    // Fail toward blocking here — unlike the top-level fail-open paths, this is a case
    // where the read is known to be of code and only the operand is uncertain, so the
    // allowlist cannot be consulted and the conservative verdict is the correct one.
    if (!fileArg) {
      return buildFsBlockResult(cmd, fullCmd, 'cat', catMatch[0]);
    }
  }

  // Fallback: head/tail/cat with flags put the file last (e.g. `head -85 file.ts`, `tail -f file.ts`).
  // The catMatch regex above requires the file to be the first argument, so it misses these.
  // Guarded by `!catMatch` so the two rules cannot both fire and double-report.
  //
  // Last-token-only is deliberately crude: it cannot tell an operand from a trailing
  // argument, so it will miss `head -n 20 a.ts | wc -l` (last token is `-l`). Accepted —
  // this is a backstop for the common spelling, and widening it to scan every token would
  // start claiming code paths that appear as flag values elsewhere in the command.
  if (!catMatch && /\b(?:cat|head|tail|less|more|bat)\b/.test(cmd)) {
    const lastToken = cmd.trim().split(/\s+/).pop() || '';
    if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)$/i.test(lastToken) &&
        !isAllowedPath(lastToken)) {
      const verb = cmd.trim().split(/\s/)[0];
      return buildFsBlockResult(cmd, fullCmd, verb, lastToken);
    }
  }

  // sed/awk used as readers (no in-place flag) on code-extension files.
  // Phase 3 catches the editing variants (sed -i, awk -i inplace); this rule
  // covers `sed -n '8,14p' foo.py`, `awk '/x/' foo.py`, etc.
  //
  // The `(?![^\n]*?\s-i(?:\s|$|nplace))` lookahead is the read/write divider, and it is
  // why Phase 2 must run before Phase 3 rather than the two being merged. It makes this
  // rule decline any segment carrying an in-place flag so that segment falls through to
  // Phase 3, which reports it as an *edit* and suggests `replace_content` instead of a
  // read tool. Delete the lookahead and every `sed -i` gets claimed here first, with a
  // message telling the user to read a file they were trying to write.
  //
  // The three alternatives after `-i` are what keep it from firing on unrelated flags:
  // `\s` for `sed -i -E …`, `$` for a trailing `-i`, and `nplace` for awk's `-i inplace`.
  // A short flag that merely starts with i (`-in`) is therefore not mistaken for it.
  // Known gap: the fused GNU spelling `sed -i.bak` matches none of the three, so it is
  // treated as a read here rather than falling through to Phase 3. It still blocks (the
  // target is a code file) but under the wrong verb and with the wrong suggestion.
  const sedAwkReadMatch = /\b(sed|awk)\b(?![^\n]*?\s-i(?:\s|$|nplace))[^\n]*?\s(\S+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp))\b/.exec(cmd);
  if (sedAwkReadMatch) {
    const verb = sedAwkReadMatch[1];
    const fileArg = sedAwkReadMatch[2];
    if (!isAllowedPath(fileArg)) {
      return buildFsBlockResult(cmd, fullCmd, verb, fileArg);
    }
  }

  // sed/awk as readers on markdown — Serena owns markdown reading.
  const sedAwkMdMatch = /\b(sed|awk)\b(?![^\n]*?\s-i(?:\s|$|nplace))[^\n]*?\s(\S+\.md)\b/i.exec(cmd);
  if (sedAwkMdMatch) {
    return buildMarkdownBlockResult(cmd, fullCmd, sedAwkMdMatch[1], sedAwkMdMatch[2]);
  }

  // ── PHASE 3: in-place editing detection ───────────────────────────────────
  //
  // Writes. Serena's structural editors (`replace_symbol_body`, `replace_content`) know
  // the symbol boundaries a stream editor cannot see, so an in-place `sed` over code is
  // both the riskiest and the least reviewable way to change a file.
  //
  // ORDERING: last. Every rule here matches on a write *operator* rather than a verb, and
  // operators appear in read commands too (`sed -n 1p a.ts > out`). Running this phase
  // earlier would claim those reads. Phases 2 and 3 are mutually exclusive by
  // construction, via the `-i` lookaheads in Phase 2 — that is a contract between the two
  // phases, not a local detail of either.

  // sed -i, both flag orders. Two alternatives rather than one flexible pattern because
  // `-E` is the only other flag commonly fused into this idiom and the pair covers both
  // spellings exactly; a general "any flags" pattern would start matching `-i` appearing
  // as another flag's value.
  if (/\bsed\s+(?:-E\s+)?-i\b|\bsed\s+-i(?:\s+-E)?\b/.test(cmd)) {
    const fileArg = extractLastPathArg(cmd);
    if (!fileArg || !isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, 'sed -i', fileArg || '<path>');
    }
  }

  // awk -i inplace
  if (/\bawk\s+-i\s+inplace\b/.test(cmd)) {
    const fileArg = extractLastPathArg(cmd);
    if (!fileArg || !isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, 'awk -i inplace', fileArg || '<path>');
    }
  }

  // perl -i (any combination of n/p/i flags). Perl bundles its short flags, so the
  // in-place flag legitimately appears as `-i`, `-pi`, `-ni`, `-pie`, `-ine`, … — the
  // character classes on both sides accept any bundling with an `i` somewhere in it,
  // which is why this one rule replaces the enumerated alternatives used for sed.
  if (/\bperl\s+-[npi]*i[npe]*\b/.test(cmd)) {
    const fileArg = extractLastPathArg(cmd);
    if (!fileArg || !isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, 'perl -i', fileArg || '<path>');
    }
  }

  // >> <code-file> (append redirect). Appending to a source file writes code without any
  // editor involved, so neither the Edit-tool guards nor the sed/awk rules above see it.
  // Checked before the `>` rule so the two-character operator is consumed first.
  const appendMatch = />>\s*(\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp))\b/.exec(cmd);
  if (appendMatch) {
    const fileArg = appendMatch[1];
    if (!isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, '>>', fileArg);
    }
  }

  // > <code-file> (overwrite redirect — not preceded by `2>`).
  //
  // The `(?<!2)` lookbehind exists to spare stderr redirection: `node build.js 2> err.js`
  // redirects a stream, and treating it as an overwrite of a source file would block an
  // ordinary command. It is a single-character lookbehind, so only the `2` descriptor is
  // covered — `1>` and `3>` are not, which is fine for `1>` (that genuinely is an
  // overwrite) and untested territory for higher descriptors.
  //
  // ⚠️ THIS IS THE HOOK'S MOST-HIT FALSE POSITIVE, and it is worth knowing before editing
  // anything nearby. A JS arrow function whose body mentions a `.js` file —
  // `x => require("a.js")` — presents as `>` followed by a code-extension token, so the
  // rule reads it as a redirect into source. Every inline `node -e` script in this repo's
  // UAT files is therefore written with classic `function () {}` expressions; UAT-033 and
  // UAT-034 both record this as a standing constraint. Escape hatch: avoid `=>`, or move
  // the script into a file.
  //
  // Fixing it properly means requiring whitespace or a non-`=` character before the `>`,
  // which is a behaviour change and so out of scope for a comments-only pass. Note that
  // the naive version of that fix — extending the lookbehind to `(?<![2=])` — would also
  // silently stop catching `x=>foo.ts` style redirects if any exist.
  const overwriteMatch = /(?<!2)>\s*(\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp))\b/.exec(cmd);
  if (overwriteMatch) {
    const fileArg = overwriteMatch[1];
    if (!isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, '>', fileArg);
    }
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip surrounding quotes from a shell token. */
function stripQuotes(t) {
  return String(t).replace(/^['"]+/, '').replace(/['"]+$/, '');
}

/**
 * True if a segment performs an in-place edit / file-write (not a pure read).
 *
 * Used only by segmentEscapesProject() to decide whether unresolvable `$VAR` paths get
 * the benefit of the doubt. It is intentionally broader than the Phase 3 rules — it fires
 * on ANY redirect target, not just code extensions — because the question here is "could
 * this write something?", not "does this write code?". A false positive costs a variable-
 * path edit an out-of-project pass it might have deserved; a false negative would let an
 * unprovable write through.
 */
function segmentIsInPlaceEdit(cmd) {
  return /\bsed\s+(?:-E\s+)?-i\b|\bsed\s+-i(?:\s+-E)?\b/.test(cmd) ||
    /\bawk\s+-i\s+inplace\b/.test(cmd) ||
    /\bperl\s+-[npi]*i[npe]*\b/.test(cmd) ||
    // `[^0-9&]` before the operator excludes both `2>` (a descriptor redirect) and `&>`;
    // `[^\s&|;]` after it requires a real destination token, so the `>` in `2>&1` — whose
    // next char is `&` — does not read as a write to a file.
    /(?:^|[^0-9&])>>?\s*[^\s&|;]/.test(cmd); // > file / >> file (not 2>&1)
}

/**
 * Extract path-looking argument tokens from a command segment.
 *
 * "Path-looking" requires a slash, a leading `~`, or a leading `$VAR`. A bare `foo.ts`
 * is deliberately NOT a path token: the sole consumer is the out-of-project check, and a
 * relative filename with no separator is in-project by definition, so admitting it could
 * only ever produce a wrong "escapes the project" verdict.
 */
function extractPathTokens(cmd) {
  const paths = [];
  for (let t of String(cmd).split(/\s+/)) {
    t = stripQuotes(t);
    if (!t || t.startsWith('-')) continue;      // empty or flag
    if (/^[|&;<>]+$/.test(t)) continue;         // shell operator
    // sed/awk scripts contain slashes as delimiters, not as path separators —
    // `s/a/b/` and `y/abc/xyz/` would otherwise be read as relative paths and, since
    // they resolve inside the project, would drag the whole segment back into scope.
    if (/^[sy][/|#,]/.test(t)) continue;        // sed/awk script (s/a/b/, y/a/b/)
    // Path-looking: contains a slash, or begins with ~ / $VAR.
    if (/\//.test(t) || /^~/.test(t) || /^\$\{?\w/.test(t)) paths.push(t);
  }
  return paths;
}

/**
 * True when a target path escapes the project root. Variable-led paths
 * (`$VAR…`, unresolvable) count as escaping ONLY for read commands (`allowVar`),
 * since Serena-first is agent guidance, not a security boundary, and we can't
 * prove such a path is in-project. Absolute / `~` / relative paths are resolved.
 */
function targetEscapesProject(t, opts = {}) {
  const s = stripQuotes(t).trim();
  if (!s) return false;
  if (/^\$\{?\w/.test(s)) return !!opts.allowVar;
  return isOutsideProject(s);
}

/**
 * True when EVERY path target in a segment escapes the project root, so Serena
 * can't operate on it and the segment should pass through. Read-exploration
 * segments also permit unresolvable variable-led paths; in-place edits do not.
 *
 * EVERY, not ANY, and that is the whole safety property: `cat /etc/hosts src/app.ts`
 * has an escaping target but is still a code read, so an `.some()` here would hand out a
 * bypass to any command with one out-of-project argument tacked on.
 */
function segmentEscapesProject(cmd) {
  const tokens = extractPathTokens(cmd);
  // No path tokens at all means "not scoped out" rather than "vacuously outside" — the
  // `every()` below is true for an empty array, so returning early is required to stop a
  // path-free command (`ls`, `tree`) from being waved through as out-of-project.
  if (tokens.length === 0) return false;
  const allowVar = !segmentIsInPlaceEdit(cmd);
  return tokens.every(t => targetEscapesProject(t, { allowVar }));
}

/**
 * Directories that are always exempt from ls/tree/find blocking.
 *
 * The allowlist splits into two justifications, and both are about Serena's index rather
 * than about safety:
 *
 *   - Not indexed, so Serena genuinely cannot answer: `node_modules` (vendored deps,
 *     excluded from the project scan), `dist` and `build` (generated output — listing
 *     build artifacts is a build question, not a navigation question), and `.git`
 *     (object storage, not source).
 *   - Agent-infrastructure trees the agent must be able to inspect *in order to* diagnose
 *     Serena itself: `.claude` (hooks, settings, skills), `.serena` (project.yml and
 *     memories), `.task` (scratch state). Blocking these creates a bootstrapping problem —
 *     you would need a working Serena to investigate a broken one.
 *
 * `dir === '.'` returns false (not exempt) so that listing the project root is still
 * redirected to Serena; the root is the case the guard most wants to catch.
 *
 * Three tests rather than one because they answer different questions: the first is an
 * anchored path-component match (`src/node_modules`, `./dist/`) written so a longer name
 * cannot spoof it — the bare-substring version of this shape is what let
 * `myknowledge-vaultxxx` through upstream. The second catches a bare prefix with no
 * trailing separator (`.claude`, `.serena-backup`) — note it is deliberately looser and
 * WILL match a sibling directory whose name merely starts with `.task`. The third is a
 * plain equality shortcut for the two names most often typed with no path at all.
 */
function isExemptDir(dir) {
  if (!dir || dir === '.') return false;
  return /(?:^|[/\\])(?:\.claude|\.serena|\.task|node_modules|dist|build|\.git)(?:[/\\]|$)/i.test(dir) ||
    /^\.claude|^\.serena|^\.task/.test(dir) ||
    dir === 'node_modules' || dir === '.git';
}

/** Extract the file argument that follows a command verb (after any flags). */
function extractFileArg(cmd, verbRe) {
  const match = verbRe.exec(cmd);
  if (!match) return null;
  const after = cmd.slice(match.index + match[0].length).trim();
  // Skip flag tokens like -n 10
  const token = after.replace(/^(?:-\S+(?:\s+\S+)?\s+)*/, '').split(/\s/)[0] || '';
  return token || null;
}

/**
 * Extract the last path-looking argument in a command (for sed/awk/perl).
 *
 * Last-token-first because these three all take their target as the final operand, after
 * a script argument that is itself full of slashes and dots. Scanning forward would
 * return the script (`s/foo/bar/`) instead of the file.
 *
 * The rejections encode that: a leading `-` is a flag, a leading quote is the script, and
 * `^[sg]/` catches an unquoted sed substitution or a `g`-suffixed one. Requiring `[./]`
 * keeps bare words (`inplace`, a command name) out. Returning null when nothing qualifies
 * is meaningful to the callers — Phase 3 treats "in-place edit, unidentifiable target" as
 * a block with `<path>` in the message, not as a pass.
 */
function extractLastPathArg(cmd) {
  // Match last whitespace-delimited token that looks like a path (not a flag or substitution)
  const tokens = cmd.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t && !t.startsWith('-') && !t.startsWith("'") && !t.startsWith('"') &&
        !/^[sg]\//.test(t) && /[./]/.test(t)) {
      return t;
    }
  }
  return null;
}

// ── Block-message builders ──────────────────────────────────────────────────
//
// Three builders rather than one parameterised one because each names a different Serena
// replacement and carries a different allowlist note — the message is the entire remedy
// the agent gets, and a generic "blocked" is how a block gets worked around instead of
// followed. All three emit the same two channels: stderr (short, human-facing) and a
// structured JSON envelope on stdout (for programmatic consumers). Exit code 2 is what
// actually blocks; the JSON alone would not.
//
// Each falls back to a hand-built suggestion string when buildBashFsSuggestion() cannot
// parse the command, so the message is never empty of a next step.

/** Build block result for filesystem exploration commands. */
function buildFsBlockResult(cmd, fullCmd, verb, targetPath) {
  const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
  const serenaCall = buildBashFsSuggestion(cmd, '  ');
  // NOTE: this note drifts from isExemptDir() — it advertises `.docs/`, which the function
  // does not exempt, and omits `.task/`, `dist/`, and `build/`, which it does. Message-only
  // (no verdict depends on this string), so it is recorded rather than corrected here.
  const allowNote = 'Allowlist: .docs/, .claude/, .serena/, node_modules/, .git/.';
  const reason = `SERENA-FIRST: Filesystem exploration via '${verb}' on '${targetPath}' blocked.\n` +
    `Command (truncated): ${displayCmd}\n` +
    `Use instead:\n${serenaCall || '  mcp__serena__list_dir("' + targetPath + '")'}\n${allowNote}`;
  return {
    stderr: `\n⛔ SERENA-FIRST: Blocked '${verb}' on '${targetPath}' — use Serena list_dir/find_file.\n` +
      `${serenaCall || '  mcp__serena__list_dir("' + targetPath + '")'}\n\n`,
    json: buildStructuredBlockResponse({
      hook: 'serena-bash-grep-block',
      symbols: [targetPath],
      intent: 'symbol_search',
      reason,
    }),
  };
}

/** Build block result for in-place editing commands. */
function buildInplaceBlockResult(cmd, fullCmd, verb, targetPath) {
  const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
  const serenaCall = buildBashFsSuggestion(cmd, '  ');
  const allowNote = 'Allowlist: non-code extensions (.md, .json, .yaml, etc.).';
  const reason = `SERENA-FIRST: In-place editing via '${verb}' on code file '${targetPath}' blocked.\n` +
    `Command (truncated): ${displayCmd}\n` +
    `Use instead:\n${serenaCall || '  mcp__serena__replace_content("' + targetPath + '", ...)'}\n${allowNote}`;
  return {
    stderr: `\n⛔ SERENA-FIRST: Blocked '${verb}' on '${targetPath}' — use Serena replace_content.\n` +
      `${serenaCall || '  mcp__serena__replace_content("' + targetPath + '", ...)'}\n\n`,
    json: buildStructuredBlockResponse({
      hook: 'serena-bash-grep-block',
      symbols: [targetPath],
      intent: 'symbol_search',
      reason,
    }),
  };
}

/**
 * Build block result for markdown exploration (grep/cat/head/tail on .md).
 *
 * The one builder that picks its suggestion from the verb rather than the target: a grep
 * maps to `search_for_pattern`, everything else to `read_file`. It also states the
 * read/write asymmetry explicitly, because it is the surprising part of the policy —
 * markdown *reading* is Serena's, markdown *writing* stays on native Edit/Write.
 */
function buildMarkdownBlockResult(cmd, fullCmd, verb, targetPath) {
  const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
  const serenaCall =
    verb === 'grep'
      ? `  mcp__serena__search_for_pattern(substring_pattern="<regex>", relative_path="${targetPath}")`
      : `  mcp__serena__read_file("${targetPath}")`;
  const allowNote = 'Markdown reading & searching belong to Serena; native Edit/Write are still allowed for markdown writes.';
  const reason = `SERENA-FIRST: Markdown exploration via '${verb}' on '${targetPath}' blocked.\n` +
    `Command (truncated): ${displayCmd}\n` +
    `Use instead:\n${serenaCall}\n${allowNote}`;
  return {
    stderr: `\n⛔ SERENA-FIRST: Blocked '${verb}' on markdown file '${targetPath}'.\n` +
      `${serenaCall}\n\n`,
    json: buildStructuredBlockResponse({
      hook: 'serena-bash-grep-block',
      symbols: [targetPath],
      intent: 'symbol_search',
      reason,
    }),
  };
}
