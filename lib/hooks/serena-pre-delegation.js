#!/usr/bin/env node
'use strict';

/**
 * serena-pre-delegation.js — PreToolUse / Agent
 *
 * Blocks: Agent spawns that are about to read code — forced explorers,
 *   worktree-isolated runs, and implement-phase delegations — when the prompt
 *   carries no pre-resolved "## LSP CONTEXT" block, so the subagent re-derives
 *   symbol locations the parent already had cheaper access to.
 * Why a hook: the target is the *content* of one field of tool_input. A
 *   settings.json rule matches a tool name and a literal command spelling; it
 *   has no vocabulary for "this prompt string is missing a section", and none at
 *   all for the filesystem state (.task/ phase, folder mtime) that decides
 *   whether the omission is worth mentioning.
 * Fails: open — unparseable stdin, a non-Agent call, an unreadable .task/ tree,
 *   or Serena marked unhealthy for this project all exit 0 silently. This is
 *   agent guidance, not a security boundary; a broken check must never stop a
 *   delegation.
 * False positives: a long implement-phase prompt that genuinely needs no symbol
 *   context (a docs rewrite, a dependency bump) — escape hatch: that path only
 *   warns, and a one-line "## LSP CONTEXT" heading clears it outright.
 * See README.md § Serena-first enforcement hooks (ported from
 * `claude-code-lsp-enforcement-kit`) for the group's rationale, and
 * § Health tracking & fail-open enforcement for the shouldEnforceSerena gate.
 */
const fs = require('fs');
const path = require('path');
const { getStateFilePath, readStateFile, shouldEnforceSerena } = require('./lib/serena');

// Explorer subagents whose entire output is code navigation. For these the LSP
// CONTEXT requirement is unconditional: no .task/ phase evidence is needed, and
// the exemption list below is not consulted at all (the two lists are disjoint
// today; if a name ever appeared in both, forcing wins). Spawning one with no
// resolved symbols guarantees it re-runs searches the parent session could have
// done once and passed down — which is the entire cost this hook exists to stop.
const FORCE_LSP_CONTEXT_AGENTS = [
  'backend-explorer', 'frontend-explorer', 'db-explorer',
];

// Subagents whose work does not improve with a pre-resolved symbol map:
// reviewers and auditors (handed a diff, not a search), runners and checkers
// (they execute, they do not navigate), planners/architects/doc-updaters (prose
// in, prose out). `explore` heads the list for a sharper reason — it *is* the
// search agent, so requiring that it be handed search results first is circular.
//
// Membership is judged per agent, which is why the match below is exact rather
// than by prefix or substring: a name is exempt because someone assessed that
// specific agent, and a near-miss is a different agent.
const EXEMPT_AGENTS = [
  'explore', 'security-reviewer', 'performance-reviewer', 'conventions-reviewer',
  'conflict-detector', 'code-auditor', 'lint-types-checker', 'test-runner',
  'code-reviewer', 'go-reviewer', 'doc-updater', 'architect', 'planner',
  'deep-security-reviewer', 'typescript-reviewer', 'python-reviewer',
  'ai-integration-reviewer', 'supabase-auth-reviewer', 'scraper-reviewer',
  'nextjs-static-reviewer', 'build-error-resolver', 'e2e-runner',
  'performance-optimizer', 'tdd-guide',
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  if (data.tool_name !== 'Agent') process.exit(0);

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  const toolInput = data.tool_input || {};
  // String coercion: non-string fields would throw on subsequent string methods.
  const prompt = String(toolInput.prompt ?? '');
  const subagentType = String(toolInput.subagent_type ?? '');
  const isForcedExplorer = FORCE_LSP_CONTEXT_AGENTS.includes(subagentType);

  if (!isForcedExplorer) {
    // Exact match only — previously `.includes(e)` allowed substring matches
    // like `exploit-deep-security-reviewer` to bypass by containing a
    // legitimate exempt name. Both checks now case-insensitive exact.
    const subType = subagentType.toLowerCase();
    if (EXEMPT_AGENTS.some(e => e.toLowerCase() === subType)) process.exit(0);
  }

  // Length floor: a short prompt is a hand-off ("read X and report"), not a
  // delegation carrying enough work to be worth pre-resolving symbols for.
  // Demanding a symbol map from one would be pure noise — for scale, the block
  // this hook asks for is itself ~110 characters, so a sub-200-character prompt
  // would be mostly boilerplate.
  // NOTE: the 200 figure is not recoverable from the code, the README, or git
  // history. It is a proxy for prompt substance and therefore drifts with prompt
  // style; treat it as a tuning knob, not a boundary.
  if (prompt.length < 200) process.exit(0);

  const isolation = String(toolInput.isolation ?? '');
  const cwd = String(data.cwd ?? process.cwd());
  const taskDir = path.join(cwd, '.task');

  // An undeclared delegation is only judged in a project that actually carries a
  // .task/ tree to judge it by. No directory ⇒ no phase signal ⇒ no opinion.
  // Without this exit the hook would start warning on every long Agent prompt in
  // every project that has never used the .task/ convention — which is most of
  // them, this repo included.
  if (!isForcedExplorer && isolation !== 'worktree') {
    if (!fs.existsSync(taskDir)) process.exit(0);
  }

  // A forced explorer or a worktree-isolated run needs no phase evidence at all:
  // the first is an agent whose entire job is code navigation, the second is an
  // isolated checkout that exists only because real work is about to happen in
  // it. Both facts are declared in the call itself, so the .task/ scan below is
  // purely the fallback for a delegation that declared neither.
  let inImplementPhase = isForcedExplorer || isolation === 'worktree';

  if (!inImplementPhase) {
    try {
      // The `20` prefix filter: task folders are date-stamped (`2026-08-06-…`),
      // so the year is the cheapest way to separate them from a harness's own
      // bookkeeping entries, and testing it before the statSync keeps the common
      // case off the filesystem. It is a prefix heuristic, not a date parse — it
      // accepts anything beginning "20" and stops working in 2100.
      const entries = fs.readdirSync(taskDir).filter(e => {
        return e.startsWith('20') && fs.statSync(path.join(taskDir, e)).isDirectory();
      });
      // Freshness window: only a task folder touched recently counts as evidence
      // of what is being worked on *now*. Without it, one abandoned folder left
      // in phase=implement arms this hook for every Agent spawn in that project
      // indefinitely, and the only remedy would be deleting files the hook has no
      // business owning.
      // NOTE: the two-hour value itself is not recoverable from the code, the
      // README, or git history — it reads as a working-session length, not a
      // measured figure. Raising it risks acting on finished work; lowering it
      // silently disables the check partway through a long session. Check real
      // .task/ mtimes before changing it.
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      for (const entry of entries) {
        const folderPath = path.join(taskDir, entry);
        const stat = fs.statSync(folderPath);
        if (stat.mtimeMs < twoHoursAgo) continue;
        // Two independent phase signals. state.json is the structured form (a
        // harness writing machine state); 00-task.md below is the human one.
        // Both are consulted because different harnesses write one or the other,
        // and each sits in its own try block so a malformed state.json cannot
        // suppress the markdown check.
        //
        // Neither shape is produced by this repo — `.task/` is an external
        // orchestration convention carried over with the hook from
        // claude-code-lsp-enforcement-kit. On a bootstrap-claude checkout this
        // whole branch therefore never fires, and only the forced-explorer and
        // worktree paths are live. Do not read a green run here as evidence the
        // scan works.
        const statePath = path.join(folderPath, 'state.json');
        if (fs.existsSync(statePath)) {
          try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (state.phase === 'implement') { inImplementPhase = true; break; }
          } catch {}
        }
        // Fallback for harnesses that keep the phase in the task's markdown
        // instead of in state.json. The three `\*{0,2}` groups exist because the
        // field renders bold in some task templates and not others: `Phase:
        // implement`, `**Phase**: implement`, and `**Phase:** implement` are the
        // same field, and a guard that only matched the plain form would silently
        // stop firing the moment a template added emphasis.
        const taskMd = path.join(folderPath, '00-task.md');
        if (fs.existsSync(taskMd)) {
          try {
            const content = fs.readFileSync(taskMd, 'utf8');
            if (/\*{0,2}Phase\*{0,2}:\*{0,2}\s*implement/i.test(content)) { inImplementPhase = true; break; }
          } catch {}
        }
      }
    } catch {}
  }

  if (!inImplementPhase) process.exit(0);

  // Six ways a prompt can prove it already carries resolved symbol locations.
  // The first two match the *heading* the deny message below asks for — the
  // happy path, an agent that followed the instruction verbatim. The other four
  // match the *content* instead, so a prompt that pastes real file:line
  // references under a heading of its own wording is not punished for it. Those
  // four mirror the navigation intents worth pre-resolving: where a symbol is
  // defined, who calls it, where it is used, who imports it.
  //
  // The `\.\w{2,4}:\d+` tail is what turns each of the four into a claim rather
  // than prose — "defined at the top of the file" does not match, "defined at
  // src/a.ts:42" does. Accepting a bare filename instead would let "defined at
  // runtime" through and make the check meaningless.
  //
  // Trivially satisfiable by design: the literal string "## LSP CONTEXT" passes
  // with no symbols behind it. This is agent guidance, not a security boundary,
  // and an agent that games it only wastes its own tokens re-searching.
  const hasLspContext =
    /\bLSP CONTEXT\b/i.test(prompt) ||
    /\bSymbol Map\b/i.test(prompt) ||
    /\bdefined\s+at\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt) ||
    /\bcalled\s+from\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt) ||
    /\bused\s+in\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt) ||
    /\bimported\s+(?:in|by)\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt);

  if (hasLspContext) process.exit(0);

  const agentLabel = isForcedExplorer ? `explorer "${subagentType}"` : 'implement agent';

  // Warn vs. block, and why the split is not arbitrary. `block` is reserved for
  // the two paths where the trigger was read straight out of tool_input — a
  // subagent_type on the forced-explorer list, or isolation === 'worktree'. The
  // caller declared what it was launching, so a false positive is close to
  // impossible and being wrong costs one retry with a heading added. The generic
  // implement path is *inferred* instead, from a .task/ folder's mtime and a
  // phase field that may belong to finished or unrelated work — so it only
  // warns. Blocking a real delegation on filesystem guesswork costs more than
  // the missing symbol map does.
  //
  // SUSPECTED DEFECT — annotated, deliberately not fixed in this comments-only
  // pass. `decision: 'warn'` is not a value Claude Code documents for
  // PreToolUse; `decision: 'block'` is the honored legacy form, and the sibling
  // warn path in serena-first-read-guard.js:40 uses `{ systemMessage: ... }`
  // instead. If 'warn' is simply unrecognized, the entire non-forced implement
  // path emits nothing at all and this hook is effectively
  // forced-explorer/worktree-only. Verify that before touching anything else
  // here — the fix changes which delegations get interrupted.
  const decision = (isForcedExplorer || isolation === 'worktree') ? 'block' : 'warn';
  console.log(JSON.stringify({
    decision,
    reason: [
      `SERENA PRE-DELEGATION: ${agentLabel} without "## LSP CONTEXT".`,
      '',
      'DO THIS NOW (3 steps, then retry the Agent call):',
      '1. mcp__serena__get_symbols_overview("<any project file>")  — primes Serena',
      '2. mcp__serena__find_symbol("<keyword from task>")  — finds symbols',
      '3. Add to EVERY agent prompt:',
      '   ## LSP CONTEXT (pre-resolved — do NOT re-search)',
      '   - symbolName: defined at file.ts:42, called from a.ts:15',
      '',
      'Then re-launch the same Agent calls with ## LSP CONTEXT included.',
    ].join('\n'),
  }));
});
