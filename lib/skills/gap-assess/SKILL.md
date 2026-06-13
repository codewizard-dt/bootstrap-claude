---
name: gap-assess
description: Audit the current app's functionality against expected functionality and produce a gap assessment as an approvable plan (runs in plan mode, delegates to subagents)
category: researching
model: claude-opus-4
effort: high
argument-hint: <expected functionality — inline description or path to a requirements/spec file>
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Gap Assess

Audit what the current app **actually does**, compare it against the **expected functionality** supplied in `$ARGUMENTS`, and present a **gap assessment plus a remediation plan**.

**This skill runs in plan mode.** Enter plan mode at the start, do all work read-only, and deliver the gap assessment and remediation steps as the plan you submit for approval via `ExitPlanMode`. Do not modify source code.

---

**Expected functionality**: `$ARGUMENTS`

- If `$ARGUMENTS` is (or starts with) an existing file path, read that file as the expected-functionality spec (PRD, requirements doc, brief, checklist).
- Otherwise treat the text as an inline description of expected functionality.
- If `$ARGUMENTS` is empty, fall back to requirements docs in `wiki/work/requirements/` and `wiki/work/decisions/`; if none exist, ask the user to specify the expected functionality before continuing.

---

## Phase 0 — Enter plan mode

Enter plan mode immediately (`EnterPlanMode`). Everything that follows is analysis only — no edits, no writes to source.

---

## Phase 1 — Context

1. Summarize the expected functionality from `$ARGUMENTS` in your own words. Resolve whether it is inline text or a file path and load accordingly.
2. Identify which parts of the codebase are relevant to that expected functionality.

---

## Phase 2 — Recall Serena memories

Before auditing, check for relevant project knowledge:

- `mcp__serena__list_memories` → scan for memories related to the feature area.
- `mcp__serena__read_memory` → read any relevant memories (architecture decisions, known gotchas, integration patterns) to inform the audit.

---

## Phase 3 — Audit current functionality

Use **Serena MCP** for all code exploration — never `bash` commands like `ls`, `cat`, `find`, or `grep` on source files.

Delegate the audit to subagents (**absolute maximum of 3 concurrent**). Split the relevant codebase by area (e.g. routes/commands, services, data layer, UI). Each subagent uses `mcp__serena__get_symbols_overview` and `find_symbol` to discover what the code actually does.

Compile a **functionality inventory** — a flat list of distinct, user-visible capabilities the app currently has. For each: what it does and how it's triggered (click path, command, or code entry point). Mark anything you cannot verify in code as `[UNVERIFIED]`.

---

## Phase 4 — Build the expected-functionality checklist

Turn the expected functionality from `$ARGUMENTS` into a flat list of discrete, testable requirements, one line each, e.g. `EXP-01: User can reset their password via email`. If the spec is a file, extract user stories, functional requirements, and acceptance criteria. Note explicit non-goals so you don't flag them as gaps.

---

## Phase 5 — Gap analysis

Cross-reference the expected checklist against the current functionality inventory. Classify each expected item:

- **✅ Covered** — implemented and verifiable in code.
- **🟡 Partial** — partially implemented, or implemented but with caveats (incomplete edge cases, missing validation, stubbed).
- **🔴 Gap** — no implementation found.
- **➕ Undocumented** — a capability exists in code but is not in the expected spec (surface for awareness, not as a defect).

For each Partial and Gap, note the evidence (file/symbol references) and a rough effort/complexity estimate.

---

## Phase 6 — Present the gap assessment (plan)

Submit the following as the plan via `ExitPlanMode`:

1. **Coverage table** — every expected item with its status (Covered / Partial / Gap / Undocumented) and a one-line note with `file:symbol` evidence.
2. **Summary** — counts per status and the headline finding (e.g. "7/10 covered, 2 partial, 1 gap").
3. **Remediation plan** — ordered, concrete steps to close the Partial and Gap items, each scoped as a deliverable a subagent could execute, with dependencies and rough effort. This is what the user approves.

Keep claims grounded in code evidence. Do not invent functionality not found in the codebase or implied by the spec.

---

## CRITICAL rules

1. **Plan mode only** — no source edits; the deliverable is the gap assessment + remediation plan submitted via `ExitPlanMode`.
2. **Absolute maximum of 3 sub-processes at a time.**
3. **Always terminate any processes you start** (dev servers, type checkers, long-running commands).
4. **Serena for all code exploration** — never `bash` file commands on source.
