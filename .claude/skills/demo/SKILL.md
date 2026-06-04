---
name: demo
description: Audit all project functionality at a high level and produce a 2-3 minute demo run book plus a Marp slideshow
model: claude-sonnet-4-6
argument-hint: "[path to project directory (defaults to cwd)] [custom instructions]"
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Demo

Audit the project's features, produce a **2-3 minute demo run book** at `.docs/demo/runbook.md`, then generate a **Marp slideshow** from it at `.docs/MARP/demo.slides.md`.

---

**Arguments**: `$ARGUMENTS`

- First whitespace-delimited token — if it resolves to an existing directory, treat it as the project root. Otherwise use the current working directory and treat the whole string as custom instructions.
- Remaining tokens — free-form custom instructions (audience, focus area, time override, tone, etc.).
- If `$ARGUMENTS` is empty: root = cwd, no custom instructions.

---

## Phase 1 — Discovery

Use Serena MCP to explore the project. Never use `bash` commands like `ls`, `cat`, `find`, or `grep` for code exploration.

1. Read Serena memories (`mcp__serena__list_memories` → `mcp__serena__read_memory`) for project context.
2. `mcp__serena__list_dir` on the root and key directories (`src/`, `app/`, `lib/`, `cli/`, `api/`, `pages/`, `routes/`, `commands/`).
3. Check `CLAUDE.md`, `README.md`, and `package.json` (or equivalent manifests) for the project's stated purpose, tech stack, and entry points.
4. Scan `.docs/tasks/`, `.docs/prd/`, and `.docs/roadmaps/` for feature lists and acceptance criteria.
5. Use `mcp__serena__get_symbols_overview` on key source files to identify exported functions, classes, routes, or CLI commands.
6. Use `mcp__serena__search_for_pattern` to locate UI routes, API endpoints, or CLI entry points.

Compile a **feature inventory** — a flat list of distinct, user-visible capabilities:

```
Feature: <name>
Entry point: <file:symbol or route or command>
What it does: <one sentence>
Demoed via: <UI click path | CLI command | API call | code example>
```

Aim for 6–14 features. Collapse trivial variations (e.g., "edit" and "delete" of the same entity can be one feature).

---

## Phase 2 — Demo Narrative

Design a **narrative arc** that fits 2-3 minutes of live demo time (roughly 300-450 spoken words, 8-12 steps). A good demo arc:

1. **Hook** — one sentence on the problem this project solves.
2. **Setup state** — any prerequisite the audience needs to know (data already loaded, server already running, etc.). Keep this to one quick statement, not a live setup.
3. **Core flow** — demonstrate the primary happy path end to end. Each step should show a visible, meaningful result.
4. **Power feature** — one non-obvious capability that makes the project stand out (e.g., an AI-assisted step, a real-time feature, a CLI shortcut).
5. **Edge / error handling** *(optional, use if time allows)* — one brief example of graceful failure or an advanced option.
6. **Wrap** — one sentence on what to do next or where to learn more.

Apply any custom instructions from `$ARGUMENTS` to the narrative (e.g., "focus on the CLI", "audience is non-technical", "skip the auth flow").

---

## Phase 3 — Write the Run Book

Create `.docs/demo/` if it doesn't exist. Write `.docs/demo/runbook.md` using this template:

```markdown
# Demo Run Book — {Project Name}

**Audience**: {who this demo is for}
**Duration**: 2–3 minutes
**Last updated**: {YYYY-MM-DD}

---

## Setup (pre-demo, do not narrate)

- [ ] {prerequisite step 1 — e.g., "Start server: `npm run dev`"}
- [ ] {prerequisite step 2 — e.g., "Seed demo data: `npm run seed:demo`"}
- [ ] {prerequisite step 3 — e.g., "Open browser to http://localhost:3000"}

---

## Script

### Hook *(~15 s)*

> {Spoken line. Keep it to 1-2 sentences.}

### Step 1 — {Feature Name} *(~20 s)*

**Action**: {Exact click path, command, or code to run}

> {Spoken line or talking point. One short paragraph max.}

**Expected result**: {What the audience sees}

---

*(Repeat Step N pattern for each step — aim for 6–10 steps total)*

---

### Wrap *(~15 s)*

> {Spoken closing line. Point to docs, repo, or next steps.}

---

## Timing Guide

| Section | Target |
|---------|--------|
| Hook | 15 s |
| Core flow (N steps) | ~{N × 15-20} s |
| Power feature | 30 s |
| Wrap | 15 s |
| **Total** | **~{total} s** |

---

## Contingency Notes

- **If {thing} breaks**: {fallback — e.g., "switch to the recorded GIF at docs/demo/fallback.gif"}
- **If asked about {topic}**: {one-line answer to deflect or defer}
```

Fill every placeholder with real project content. The script must be specific enough that anyone on the team can deliver the demo cold.

---

## Phase 4 — Generate the Marp Slideshow

Invoke the `marp-slideshow` skill on the run book you just wrote:

> **Delegate to `/marp-slideshow .docs/demo/runbook.md .docs/MARP/demo`**

The resulting deck should have one slide per demo step, the hook as the title slide, and the timing guide as a slide near the end. Speaker notes on each slide should contain the verbatim spoken line from the run book.

If the `marp-slideshow` skill is not available, write the deck directly following the Marp best practices from the skill (front-matter with `marp: true`, `paginate: true`, `size: 16:9`; `_class: lead` on the title; section dividers for Setup / Core Flow / Power Feature / Wrap; one idea per slide; speaker notes in HTML comments).

---

## Phase 5 — Confirm

Print a summary to the user:

1. **Feature inventory** — bulleted list of what was found.
2. **Run book path** — `.docs/demo/runbook.md`, estimated word count, step count.
3. **Slideshow path** — `.docs/MARP/demo.slides.md`, slide count.
4. **Render command** — `npx @marp-team/marp-cli@latest .docs/MARP/demo.slides.md` (HTML) or `--pdf` for PDF.
5. **Any gaps** — features that exist but couldn't be cleanly demo'd (missing entry point, no happy-path data, etc.).

---

## CRITICAL Rules

1. Use **Serena** for all code exploration — never `bash` `ls`/`cat`/`find`/`grep` on source files.
2. Use **Read** for markdown and config files (not Serena for those).
3. Never modify source code — read only.
4. Do not invent features not evidenced in the codebase. If a feature is unclear, mark it `[UNVERIFIED]` in the run book rather than guessing.
5. The run book must be **self-contained** — a teammate who has never seen the project should be able to deliver the demo using only this document.
6. Maximum 3 concurrent sub-processes if delegating research steps.
