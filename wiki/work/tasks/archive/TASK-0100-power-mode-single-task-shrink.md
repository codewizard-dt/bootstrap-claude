---
id: TASK-0100
aliases: [TASK-0100]
title: "Shrink power-mode's Single-Task Executor mode to a pointer at /tackle → /uat-generate → /uat-auto"
status: done
created: 2026-09-19
updated: 2026-09-19
depends_on: []
blocks: []
parallel_safe_with: []
uat: "[[UAT-0100]]"
tags: [power-mode, skill-design, redundancy]
---

# TASK-0100 — Shrink power-mode's Single-Task Executor mode to a pointer at /tackle → /uat-generate → /uat-auto

relates_to::[[wiki-skill-boilerplate-duplication]]
relates_to::[[power-mode-skill]]

## Objective

`lib/skills/power-mode/SKILL.md`'s "## Single-Task Executor" section (~50 lines: three `Agent({...})` blocks, an autonomy mandate, and a UAT-closure note) adds close to zero logic beyond sequencing `/tackle` → `/uat-generate` → `/uat-auto`, and its `/uat-auto` closure note restates what `UAT-CORE.md`'s Closure procedure already does natively. Replace it with a short pointer section (≤ ~12 lines) naming the three skills in order, while leaving the "Roadmap-to-Completion Orchestrator" mode, the Parallelization Mandate, Team Member Requirements, and Agent Lifecycle sections byte-for-byte intact. Executes ROADMAP-0014 Phase 2's last item; no functionality is lost, since every behavior the section described lives in the three referenced skills.

## Approach

**Source-of-truth note**: edit `lib/skills/power-mode/SKILL.md` in this repo, never `~/.claude/skills/power-mode/` — that is a machine-local copy overwritten by the next `install-global.sh` sync. Note the file already carries uncommitted working-tree changes; edit on top of them, do not revert.

**Research basis**: `raw/research/wiki-skill-simplification/index.md` (implementation outline item 7, "Orchestration layer") and `wiki/knowledge/concepts/wiki-skill-boilerplate-duplication.md` already conclude the Roadmap mode is genuinely distinct and only the Single-Task mode is a shrink candidate; the research classes this as a text-only edit that needs no decision gate. No `test/` file asserts on power-mode's Single-Task text (verified by search) — the only test touching power-mode is `test/component-page-reverse-pointers.test.js`, which constrains the component page (see Step 3).

**Design decisions:**

| Decision | Choice | Why |
|---|---|---|
| Keep the `/power-mode <TASK path>` dispatch entry? | **Yes**, retargeted to the pointer section | Removing it would break a documented invocation (`lib/skills/README.md`, `argument-hint`, frontmatter description). The pointer keeps the entry point working with zero orchestration logic. |
| How does the pointer execute the pipeline? | Run the three skills **in order, in the current session, via the Skill tool**, without spawning an agent team or `bypassPermissions` footer | One task has nothing to parallelize; the team/footer/reap machinery is exactly the overhead being removed. Trade-off accepted: the three phases now share the caller's context instead of three fresh agent contexts. Callers who want isolated contexts can run the three commands themselves. |
| Keep the "don't pause between phases" rule? | **Yes**, one sentence | It is the only behavior the wrapper actually added; dropping it would silently change `/power-mode <task>` from autonomous to interactive. |
| Keep the UAT-closure / UI-test / stub notes? | Compress to one sentence pointing at `/uat-auto`'s own UAT-CORE Closure; keep the acceptable-resting-state rule | Closure behavior is owned by `UAT-CORE.md`; restating it here is the duplication being removed. The Roadmap mode's identical Phase 3 note is left intact per the roadmap item. |
| Update frontmatter `description` / `lib/skills/README.md` row? | Light touch: reword the task-path clause to say it points at the pipeline | Keeps discovery text truthful without changing `argument-hint` or `name`. |
| Update the component wiki page? | **Yes** (`power-mode-skill.md`) | Its body describes Single-Task as a thin wrapper "shrink candidate"; after this task that is stale. Adds `evolved_by::[[TASK-0100]]` per the reverse-pointer convention in `wiki/conventions.md`. |

**Target text for the new section** (steps below apply it verbatim):

```markdown
## Single-Task Executor

**Trigger:** `/power-mode <path/to/TASK-NNNN.md>` with no additional instructions.

A single task has nothing to parallelize, so this mode is only a pointer — no agent team, no reap sweep. Run these three skills in order in the current session (Skill tool), without pausing, asking questions, or awaiting approval between them:

1. `/tackle <task-path>`
2. `/uat-generate <task-path>`
3. `/uat-auto <uat-path>` — same NNNN slug, under `wiki/work/uat/`

Stop after `/uat-auto` returns. On all-pass, its own UAT-CORE Closure procedure handles task/UAT status, archiving, index rows, and the roadmap checkbox. Tests left as `[FAIL: auto-judge: UI test requires human verification]` or stub-detected `- [ ] Pass` are an acceptable resting state, not a blocker — report them in the summary.
```

## Steps

### 1. Replace the Single-Task Executor section <!-- agent: general-purpose -->

- [x] Re-read `lib/skills/power-mode/SKILL.md` immediately before editing (it has uncommitted changes and sibling Phase 2 tasks may touch skill files concurrently).
- [x] Replace everything from the `## Single-Task Executor` heading through the closing `Done. No further iteration.` line (the block ending immediately before the `---` that precedes `## Roadmap-to-Completion Orchestrator`) with the "Target text for the new section" above. Use `mcp__serena__replace_content` (regex or exact literal) or `Read` + `Edit`; keep the `---` separators on both sides.
- [x] Do **not** modify `## Roadmap-to-Completion Orchestrator` or any section above `## Single-Task Executor` except the Dispatch bullet in Step 2.

### 2. Retarget the dispatch bullet and discovery text <!-- agent: general-purpose -->

- [x] In the "## Dispatch — Roadmap vs Task" section, change the task bullet to: `- Path contains \`task\` or matches \`TASK-NNNN\` → **Single-Task Executor** (a pointer at the tackle → uat-generate → uat-auto pipeline; see below)`.
- [x] In the frontmatter `description`, reword the trailing clause `When invoked with a task file path, runs that pipeline once and stops.` to `When invoked with a task file path, runs that pipeline once in the current session and stops.` Leave `name`, `argument-hint`, and every other frontmatter key untouched.
- [x] In `lib/skills/README.md` (the `power-mode` table row near line 87), reword only if it now misstates behavior; the current text ("drives roadmap or task files through the full tackle → uat-generate → uat-auto pipeline") remains accurate, so a no-op is acceptable — do not churn it.

### 3. Refresh the component wiki page <!-- agent: general-purpose -->

- [x] In `wiki/knowledge/entities/components/power-mode-skill.md`: rewrite the `relates_to::[[wiki-skill-boilerplate-duplication]]` paragraph so it reports the outcome (Single-Task Executor is now a short pointer at `/tackle` → `/uat-generate` → `/uat-auto`, per [[TASK-0100]]) instead of calling it a pending shrink candidate; keep the `relates_to::[[wiki-skill-boilerplate-duplication]]` typed link.
- [x] Adjust the first paragraph's clause "given a task path it drives that one task" so it says a task path is handled by a pointer at the three-skill pipeline rather than by the orchestrator team.
- [x] Append `evolved_by::[[TASK-0100]]` as a new line after the existing `evolved_by::[[TASK-003]]` line (do not remove `TASK-003`); bump frontmatter `updated:` to the edit date.
- [x] Preserve the frontmatter `id: power-mode-skill` and the `implements::[[Multi-Agent Orchestration Patterns]]` link exactly — `test/component-page-reverse-pointers.test.js` asserts both. Do not cite `ROADMAP-0013` on this page (the same test forbids it).

### 4. Verify <!-- agent: general-purpose -->

- [x] `git diff lib/skills/power-mode/SKILL.md` shows changes only in the frontmatter `description`, the Dispatch task bullet, and the Single-Task Executor section; the Roadmap-to-Completion Orchestrator section (from `## Roadmap-to-Completion Orchestrator` to EOF) is unchanged relative to the pre-edit working tree. Section is net shorter by roughly 35+ lines.
- [x] Confirm no remaining `Agent({` block exists between `## Single-Task Executor` and `## Roadmap-to-Completion Orchestrator`.
- [x] Run `node --test test/component-page-reverse-pointers.test.js` — must pass (validates `evolved_by::[[TASK-0100]]` resolves and this task file mentions `lib/skills/power-mode/SKILL.md`).
- [x] Confirm the new Single-Task section keeps the three skill names in order and the "without pausing" rule (autonomy behavior preserved).

## Coordination notes

- Other ROADMAP-0014 Phase 2 tasks (shared archive doc, ID-resolution doc, boilerplate doc, `wiki-tidy` rewrite) edit other `lib/skills/*/SKILL.md` files and are expected to be collision-safe with this one. If the shared-boilerplate task's wiring step also lists `power-mode` as a consumer, tackle the two sequentially — both would edit `lib/skills/power-mode/SKILL.md`. This is an orchestration note, not a logical dependency, so `depends_on`/`blocks` stay empty.
