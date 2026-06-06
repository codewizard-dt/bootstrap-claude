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

Audit the project's features, produce a **2-3 minute demo run book** at `.docs/demo/runbook.md`, then generate a **Marp slideshow** from it at `.docs/demo/runbook.slides.md`.

---

**Arguments**: `$ARGUMENTS`

- If the first token is an existing directory path, treat it as the project root; otherwise use the current working directory.
- Everything else is custom instruction — audience, focus area, tone, anything you want to adjust.
- If `$ARGUMENTS` is empty: root = cwd, no custom instructions.

---

## Phase 1 — Discovery

Use Serena MCP to explore the project. Never use `bash` commands for file exploration.

Start by reading Serena memories and the project's README, manifest, and any planning docs in `.docs/`. Then browse the source tree and use `mcp__serena__get_symbols_overview` on key files to discover what the project actually does — routes, commands, exported functions, UI entry points.

Compile a **feature inventory** — a flat list of distinct, user-visible capabilities. For each feature note what it does and how to trigger it (a click path, a command, or a code example). Aim for around a dozen features; collapse trivial variations into a single entry.

---

## Phase 2 — Demo Narrative

Design a narrative arc that fits roughly two to three minutes of live demo time. A good arc moves from problem to solution to the "wow" moment:

- **Hook** — one sentence on the problem this project solves
- **Core flow** — the primary happy path, end to end, each step showing something visible
- **Power feature** — one non-obvious capability that makes the project stand out

End with a single closing sentence pointing to next steps or where to learn more. Apply any custom instructions from `$ARGUMENTS` to shape the narrative.

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

- [ ] {prerequisite — e.g., "Start server: `npm run dev`"}
- [ ] {prerequisite — e.g., "Open browser to http://localhost:3000"}

---

## Script

### Hook *(~15 s)*

> {Spoken line. Keep it to one or two sentences.}

### Step 1 — {Feature Name} *(~20 s)*

**Action**: {Exact click path, command, or code to run}

> {Spoken talking point. One short paragraph max.}

**Expected result**: {What the audience sees}

---

*(Repeat the step pattern for each step)*

---

### Wrap *(~15 s)*

> {Spoken closing line. Point to docs, repo, or next steps.}

---

## Timing Guide

| Section | Target |
|---------|--------|
| Hook | 15 s |
| Core flow | ~{N × 15–20} s |
| Power feature | 30 s |
| Wrap | 15 s |
| **Total** | **~{total} s** |

---

## Contingency Notes

- **If {thing} breaks**: {fallback}
- **If asked about {topic}**: {one-line deflection}
```

Fill every placeholder with real project content. The run book must be self-contained — anyone on the team should be able to deliver the demo cold.

---

## Phase 4 — Generate the Marp Slideshow

Invoke the `marp-slideshow` skill on the run book you just wrote:

> **Delegate to `/marp-slideshow .docs/demo/runbook.md .docs/demo/`**

The deck must use a **GitHub dark style** — set the front-matter to a dark background (`#0d1117`) with light text (`#c9d1d9`) and accent color (`#58a6ff`). Write every slide as if you are speaking directly to a stakeholder: tell the story, don't transcribe the run book. One clear idea per slide; no bullet dumps. Speaker notes contain the verbatim spoken line from the run book.

If the `marp-slideshow` skill is not available, write the deck directly: use `marp: true`, `paginate: true`, `size: 16:9`; apply the GitHub dark style via a `style:` block; use `_class: lead` on the title slide; one slide per demo step.

**Architecture diagrams**: If the project has a meaningful architecture worth showing (layered systems, data flows, service dependencies), follow this two-track approach — one format per destination:

- **Run book (Markdown)** — embed a fenced `mermaid` block directly in `.docs/demo/runbook.md` at the appropriate section. Keep each diagram small — no more than six or seven nodes. One layer per diagram.
- **Slides (SVG image)** — never embed a raw Mermaid code block in the slides. Instead:
  1. Write the raw Mermaid source (no markdown wrapper) to `.docs/demo/<name>.mmd` (e.g. `architecture.mmd`, `data-flow.mmd`).
  2. Render it to SVG via Bash: `npx @mermaid-js/mermaid-cli mmdc -i .docs/demo/<name>.mmd -o .docs/demo/<name>.svg`
  3. Reference the rendered SVG in the slide: `![Architecture](.docs/demo/<name>.svg)`

One diagram per slide. Name `.mmd` files after their content (e.g. `system-overview.mmd`, `data-flow.mmd`).

---

## Phase 5 — Confirm

Print a short summary to the user:

- **Run book** — path, word count, and step count
- **Slideshow** — path, slide count, and render command (`npx @marp-team/marp-cli@latest .docs/demo/runbook.slides.md`)
- **Gaps** — features that exist but couldn't be cleanly demo'd

---

## Rules

- Use **Serena** for all code exploration — never `bash` on source files.
- Never modify source code — read only.
- Do not invent features not evidenced in the codebase; mark unclear features `[UNVERIFIED]`.
