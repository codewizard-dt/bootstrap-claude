#!/usr/bin/env node
'use strict';

/**
 * serena-first-read-guard.js — PreToolUse / Read
 *
 * Blocks: Read on in-project code files until Serena has been used, via a
 *   five-gate ladder (warmup → 2 free Reads → warning → 1 nav call → 2 nav
 *   calls → unlimited). Gate numbering matches the upstream kit's table; only
 *   the blocking rungs (1, 4, 5) appear in messages here — Gates 2 and 3 are
 *   the free-Read and warn rungs and emit no block.
 * Why a hook: a deny rule matches a path spelling; every gate here is a
 *   decision about session *history* — has warmup happened, how many distinct
 *   files have been Read, how many Serena nav calls have succeeded. That state
 *   lives in ~/.claude/state/lsp-ready-<md5(cwd)> and settings.json has no way
 *   to consult it. A hook also gets to return the exact call to make next.
 * Fails: open — an absent/expired/corrupt state file, an out-of-project path,
 *   `health.should_enforce === false`, or any thrown exception all let the Read
 *   through. Serena-first is agent guidance, not a security boundary, so the
 *   error direction is always "allow the Read".
 * False positives: a legitimately breadth-first pass (auditing many small
 *   files, sweeping configs) hits Gate 4/5 despite being the right approach —
 *   escape hatch: one mcp__serena__get_symbols_overview or find_symbol call
 *   unlocks Reads 4-5, and a second unlocks the session ("surgical mode").
 * See README.md § "Health tracking & fail-open enforcement" for the full rationale.
 */

const {
  buildWarmupInstructions, buildFileWarmupCall, isAllowedPath,
  getStateFilePath, readStateFile, updateStateFile, defaultFlag, defaultHealth,
  shouldEnforceSerena, isOutsideProject,
} = require('./lib/serena');

/**
 * Build a copy-pasteable warmup call parametrized by the exact file the
 * agent is about to Read. This is project-agnostic: it uses the file path
 * from the hook input instead of guessing a symbol name from the filename,
 * so it works in any project regardless of export conventions.
 */
function buildConcreteCall(filePath) {
  const call = buildFileWarmupCall(filePath, '  ');
  if (!call) return '';
  return `\nCONCRETE CALL FOR THIS FILE (works in any project):\n${call}\n`;
}

// ── The Read ladder ─────────────────────────────────────────────────────────
// Counted in DISTINCT code files Read this session (see nextReadNum below —
// re-reading a file already on the list never advances it), and what each
// count costs:
//
//   1-2   free                                    (FREE_READS)
//   3     allowed, warning emitted                (WARN_AT)
//   4-5   blocked unless nav_count >= 1
//   6+    blocked unless nav_count >= 2           (REQUIRE_NAV_2_AT)
//
// Two invariants the gate branches below depend on without restating:
//   WARN_AT === FREE_READS + 1 — the warn branch tests `=== WARN_AT`, so any
//     other value makes it dead code: the Read it would have warned about gets
//     blocked by Gate 4 instead, with no advance notice. That "you were told
//     once before being blocked" property is the whole point of the warn rung.
//   REQUIRE_NAV_2_AT >= WARN_AT + 2 — otherwise the "1 nav call is enough"
//     window (Reads 4-5) is empty and one nav call buys nothing over zero.
//
// NOTE: the specific counts 2 / 3 / 6 are a judgement about how much blind
// reading is tolerable before Serena navigation pays for itself. No
// measurement or written rationale for these exact numbers survives in this
// repo or in the upstream claude-code-lsp-enforcement-kit README (which
// documents the same ladder, not its derivation). Treat the invariants above
// as load-bearing and the numbers themselves as tunable.
const FREE_READS = 2;
const WARN_AT = 3;
const REQUIRE_NAV_2_AT = 6;

// Defense-in-depth: if Gate 1 blocks WARMUP_BLOCK_LIMIT times in a row with
// no successful Serena call in between, warmup can never succeed (Serena is
// genuinely down, or an unforeseen error type evaded the health-tracking
// classification) — escalate to the shared should_enforce circuit breaker
// instead of blocking forever. Escalating there (not just bypassing Gate 1
// locally) matters: a local-only bypass would just relocate the deadlock to
// the next guard hook the agent hits.
//
// The value trades two costs: too low and one transient hiccup disables
// enforcement for the session; too high and a real outage costs that many
// dead-end Reads before the agent is released. 3 is the smallest count that
// cannot be reached by a single failure plus one retry. NOTE: that reading is
// reconstructed from the mechanism — no recorded derivation of the number
// exists in this repo or the upstream kit. Verify before changing.
const WARMUP_BLOCK_LIMIT = 3;

const GATE1_DEADLOCK_NOTICE =
  `⚠️ Serena warmup failed ${WARMUP_BLOCK_LIMIT} times in a row for this project ` +
  'with no successful Serena call in between. Serena-first enforcement is now ' +
  'disabled for this session; standard tools (Read/Grep/Edit) are permitted. ' +
  'It will re-enable automatically when a Serena call succeeds.';

function emitWarning(msg) { console.log(JSON.stringify({ systemMessage: msg })); }
function emitBlock(msg) { process.stderr.write(msg); process.exit(2); }

/** Persist that `filePath` was read, recomputing against the freshly-locked state. */
function persistRead(flagPath, filePath) {
  return updateStateFile(flagPath, defaultFlag, (flag) => {
    const readFiles = Array.isArray(flag.read_files) ? flag.read_files : [];
    if (!readFiles.includes(filePath)) {
      readFiles.push(filePath);
      flag.read_files = readFiles;
      flag.read_count = readFiles.length;
    }
    flag.timestamp = Date.now();
    return flag;
  });
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Read') process.exit(0);
  if (process.env.CLAUDE_MIGRATION === '1') process.exit(0);

  // String coercion: non-string input would throw on .trim() and fail-open.
  const filePath = String(data.tool_input?.file_path ?? '').trim();
  if (!filePath) process.exit(0);

  // Enforcement is scoped to the project root — Serena can't reach outside it.
  if (isOutsideProject(filePath)) process.exit(0);

  const flagPath = getStateFilePath();
  const flag = readStateFile(flagPath);

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  //
  // ORDERING (strict): this MUST stay above the Gate-1 `!flag || !flag.warmup_done`
  // branch. Reverse the two and an unhealthy Serena deadlocks the session:
  // Gate 1 blocks the Read because warmup_done is false, warmup can only be
  // cleared by a *successful* Serena call, and Serena is precisely what is
  // down — so every Read blocks forever while the circuit breaker that would
  // release it (health.should_enforce === false, written either by
  // serena-usage-tracker.js or by this file's own WARMUP_BLOCK_LIMIT
  // escalation) sits unread below the block that never returns.
  //
  // readStateFile returns null on 24h expiry, and null ⇒ enforce. That is the
  // wanted direction: a day-old session re-imposes warmup rather than
  // inheriting a stale unlock.
  if (!shouldEnforceSerena(flag)) process.exit(0);

  if (isAllowedPath(filePath, { enforceMarkdown: true })) process.exit(0);

  if (!flag || !flag.warmup_done) {
    const updated = updateStateFile(flagPath, defaultFlag, (f) => {
      f.warmup_block_count = (f.warmup_block_count || 0) + 1;
      f.timestamp = Date.now();
      return f;
    });

    if (updated.warmup_block_count >= WARMUP_BLOCK_LIMIT) {
      updateStateFile(flagPath, defaultFlag, (f) => {
        const health = f.health || defaultHealth();
        health.should_enforce = false;
        health.healthy = false;
        health.last_error = `gate1-deadlock-guard: ${WARMUP_BLOCK_LIMIT} consecutive warmup blocks with no successful Serena call`;
        health.last_check = Date.now();
        f.health = health;
        f.timestamp = Date.now();
        return f;
      });
      emitWarning(GATE1_DEADLOCK_NOTICE);
      process.exit(0);
    }

    const warmupLines = buildWarmupInstructions('  ').join('\n');
    const concrete = buildConcreteCall(filePath);
    emitBlock(
      `⛔ SERENA-FIRST BLOCK (Gate 1 — Warmup Required)\n\n` +
      `Read on code file requires prior Serena warmup.\n\n` +
      `WARMUP PROTOCOL — call one of these first:\n` +
      `${warmupLines}\n` +
      concrete +
      `\nAfter warmup: ${FREE_READS} free Reads, then need Serena navigation.\n\n` +
      `Blocked: ${filePath}\n`
    );
  }

  const readFiles = Array.isArray(flag.read_files) ? flag.read_files : [];
  const navCount = flag.nav_count || 0;
  const alreadyRead = readFiles.includes(filePath);
  // nextReadNum = how many DISTINCT code files this session will have Read once
  // this call goes through. Two consequences worth knowing before touching it:
  //   - Re-reading a file already on the list does not advance the ladder, so
  //     the gates measure breadth of exploration, not Read volume. Re-reading
  //     the same file 50 times is deliberately free.
  //   - On the `alreadyRead` path the value is the unchanged total, NOT this
  //     file's original position on the ladder. It is only meaningful as a gate
  //     ordinal for a *new* file. That is safe only because the `alreadyRead`
  //     branch immediately below exits before any gate reads it; move or
  //     re-order that branch and the off-by-one becomes live, mis-gating repeat
  //     Reads by one rung.
  // Also note the gates read `flag` — the snapshot taken *before* persistRead's
  // lock. Two Reads racing in the same tick can compute the same nextReadNum
  // and both pass a gate. persistRead recomputes inside the lock so no write is
  // lost; only the gate verdict is best-effort, which fail-open policy accepts.
  const nextReadNum = alreadyRead ? readFiles.length : readFiles.length + 1;

  // Surgical mode: 2 successful nav calls unlock Reads for the rest of the
  // session (the tracker resets nav_count only at SessionStart / 24h expiry).
  // An already-read file is likewise always free — and per the nextReadNum note
  // above, this branch has to stay ahead of every gate for that to be correct.
  if (navCount >= 2 || alreadyRead) {
    if (!alreadyRead) persistRead(flagPath, filePath);
    process.exit(0);
  }

  if (nextReadNum <= FREE_READS) {
    persistRead(flagPath, filePath);
    process.exit(0);
  }

  if (nextReadNum === WARN_AT && navCount === 0) {
    emitWarning(
      `⚠️ SERENA-FIRST WARNING (Read ${nextReadNum}) — consider Serena navigation.\n` +
      `Use mcp__serena__find_symbol / find_referencing_symbols before more Reads.\n` +
      `Next Read will be BLOCKED unless you use at least 1 Serena nav call.\n` +
      `After 2 nav calls, all Reads are unlimited (surgical mode).`
    );
    persistRead(flagPath, filePath);
    process.exit(0);
  }

  // Gates 4 and 5 are complementary halves of `nextReadNum > WARN_AT`: the
  // `<` / `>=` split around REQUIRE_NAV_2_AT is the only thing that makes Reads
  // 4-5 the one-nav-call window. Move one bound without the other and either a
  // rung becomes unreachable or some Read count falls through both gates
  // ungated, straight to the persistRead at the bottom.
  if (nextReadNum < REQUIRE_NAV_2_AT && navCount < 1) {
    emitBlock(
      `⛔ SERENA-FIRST BLOCK (Gate 4 — Serena Navigation Required)\n\n` +
      `Read #${nextReadNum} requires at least 1 Serena navigation call.\n` +
      `After 1 nav call, Reads 4-5 unlock. After 2, unlimited.\n` +
      buildConcreteCall(filePath) +
      `\nBlocked: ${filePath}\n`
    );
  }

  if (nextReadNum >= REQUIRE_NAV_2_AT && navCount < 2) {
    emitBlock(
      `⛔ SERENA-FIRST BLOCK (Gate 5 — Surgical Mode Required)\n\n` +
      `Read #${nextReadNum} requires at least 2 Serena navigation calls.\n` +
      `Current: ${navCount} nav calls. Need 2.\n` +
      buildConcreteCall(filePath) +
      `\nBlocked: ${filePath}\n`
    );
  }

  persistRead(flagPath, filePath);
  process.exit(0);
});
