---
name: marp-slideshow
description: Summarize a file and emit a Marp/Marpit slideshow markdown deck following best practices
model: claude-sonnet-4-6
argument-hint: <path to source file> [optional output path]
disable-model-invocation: false
user-invocable: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**
**Run `/primer` first if you have not already this session.**

# Marp Slideshow

Read a source file at the path supplied in `$ARGUMENTS`, distill it into a structured outline, and emit a **Marpit-compatible Markdown slide deck** that follows the best practices below.

---

**Source / args**: `$ARGUMENTS`

The first whitespace-separated token is the **input path** (required). An optional second token is the **output path**.

**Output path resolution rules** (apply in order):

1. **No output path provided** → write to `.docs/MARP/<input-stem>.slides.md` (create `.docs/MARP/` if it doesn't exist). Do **not** place the deck next to the input file.
2. **Output path provided** → always normalize the filename so it ends in `.slides.md`, even if the user didn't say so:
   - `deck` → `deck.slides.md`
   - `deck.md` → `deck.slides.md` (strip the trailing `.md`, then append `.slides.md`)
   - `deck.slides.md` → keep as-is
   - `path/to/deck.md` → `path/to/deck.slides.md` (preserve the directory the user gave)
3. If the resolved output path collides with an existing file, ask the user before overwriting.

If `$ARGUMENTS` is empty, ask the user for the input path before proceeding.

---

## Phase 1 — Read & Summarize

1. Read the input file with `Read` (markdown/config) or `mcp__serena__get_symbols_overview` + `mcp__serena__find_symbol` (code). Never `cat`/`head`.
2. Extract:
   - Title (filename stem if not obvious)
   - Author / date metadata if present in front-matter or headers
   - Top-level sections / headings → these usually become slide groups
   - Key claims, data points, code snippets, diagrams, or commands worth a dedicated slide
3. Produce a short outline (in your head, not a file) of 8–20 slides. Aim for **one idea per slide**, not one paragraph per slide.

## Phase 2 — Plan the Deck

A standard structure:

1. **Title slide** — title + subtitle/byline (`_class: lead`)
2. **Agenda / Overview** — 3–6 bullets mapping the deck
3. **Section slides** — each major section gets:
   - A section divider slide (large heading, optional `_class: lead invert`)
   - 1–N content slides for that section
4. **Code / data slides** — fenced code blocks for code, tables for data
5. **Summary / takeaways**
6. **Q&A or thank-you slide**

Adjust based on the source: a short doc may collapse to 6 slides; a long one may need section dividers but should still cap around 20.

## Phase 3 — Write the Deck

Use the `Write` tool to create the output file. The deck **must** start with a YAML front-matter block exactly like this template (tune values to the content):

```markdown
---
marp: true
theme: default
paginate: true
size: 16:9
header: '<short header or remove this line>'
footer: '<author or org · date>'
style: |
  section { font-size: 28px; }
  section.lead h1 { font-size: 64px; }
  section.lead { text-align: center; }
  h1, h2 { color: #0b3d91; }
  code { font-size: 0.9em; }
---
```

Key rules:

- The **first** line after `---` opens the front-matter; the front-matter is the only place where `---` is **not** a slide break. After the closing `---`, every subsequent `---` on its own line is a slide separator.
- Always set `marp: true` so Marp CLI / VS Code Marp extension picks it up.
- Always set `paginate: true` (turn off per-slide with `<!-- _paginate: false -->` on the title slide).
- Use **local directives** (`<!-- backgroundColor: #fff -->`) for ranges and **spot directives with underscore prefix** (`<!-- _class: lead -->`, `<!-- _backgroundColor: black -->`, `<!-- _color: white -->`) for **single-slide** overrides.
- Keep slide content terse — if a slide has more than ~6 bullets or wraps past the visible area, split it.

### Title slide pattern

```markdown
<!-- _class: lead -->
<!-- _paginate: false -->

# Deck Title

#### Subtitle or one-line pitch

Author · YYYY-MM-DD

---
```

### Section divider pattern

```markdown
<!-- _class: lead -->
<!-- _backgroundColor: #0b3d91 -->
<!-- _color: white -->

# Section 2 — Architecture

---
```

### Content slide pattern

```markdown
## Slide title (sentence-case is fine)

- Key point one — short, ideally < 10 words
- Key point two
- Key point three

> Optional pull-quote or callout

<!-- Speaker note: expand on point two; cite the metric from §3. -->

---
```

### Image / background patterns

- Inline image with sizing: `![w:480](path.png)` or `![w:60% h:auto](path.png)`
- Full-bleed background: `![bg](path.jpg)`
- Split background (image left 40%, content right): `![bg left:40%](path.jpg)`
- Background with filter: `![bg blur:4px brightness:.8](path.jpg)`
- Solid color background for a slide: `![bg](#0b3d91)` or use `<!-- _backgroundColor: ... -->`

### Code slide pattern

````markdown
## Quick example

```php
final readonly class PatientId
{
    public function __construct(public int $value) {}
}
```

- Why it matters: …
- Tradeoff: …

---
````

### Speaker notes

Marpit treats HTML comments as speaker notes when an exporter supports them. Add comments **inside** the slide they belong to, *before* the trailing `---`:

```markdown
## Slide title

- Bullet

<!--
Speaker note: full prose here. Multi-line is fine.
-->

---
```

Don't put directives and notes in the same comment — keep them in separate `<!-- ... -->` blocks so directive parsing stays clean.

## Phase 4 — Best-practice Checklist (apply before writing)

Before calling `Write`, mentally verify:

- [ ] `marp: true` is in front-matter
- [ ] `theme`, `paginate`, `size` are set
- [ ] Title slide uses `_class: lead` and `_paginate: false`
- [ ] No slide exceeds ~6 bullets or ~40 words of body copy
- [ ] Each `---` between slides has a blank line above and below
- [ ] No `---` appears inside a slide body (use `***` for hr if you need a rule)
- [ ] Headings descend (no skipping H1 → H4); one H1 per slide max
- [ ] Code blocks are fenced with a language tag
- [ ] Images use Marpit sizing (`w:` / `h:` / `bg` / `bg left`) — no raw `<img>` unless necessary
- [ ] Speaker notes (HTML comments) are present where the source had context that didn't fit on-slide
- [ ] Footer / header are short (one line, no Markdown that breaks YAML — wrap in quotes if it contains `:` or `#`)
- [ ] Output filename ends in `.slides.md` (always — append/normalize even if the user-supplied path didn't include it)
- [ ] If the user did **not** supply an output path, the deck is written to `.docs/MARP/<input-stem>.slides.md` (not next to the source)

## Phase 5 — Write & Confirm

1. `Write` the deck to the output path.
2. Print a short summary to the user:
   - Output path
   - Slide count
   - Preview suggestion: `npx @marp-team/marp-cli@latest <output>.md` to render to HTML, or `npx @marp-team/marp-cli@latest <output>.md --pdf` for PDF, or open in VS Code with the **Marp for VS Code** extension.

---

## CRITICAL Rules

1. **Never** modify the source file — only read it.
2. Use `Read` for markdown/text source, Serena MCP for code source.
3. Use `Write` (not `Edit`) to create the deck — it's a new file.
4. Do not invent facts not in the source. If a section is unclear, mark the slide with a `<!-- TODO: verify ... -->` speaker-note comment instead of guessing.
5. Do not embed images that aren't referenced in the source unless the user asks for them.
6. Maximum of 3 sub-processes if you delegate research/summarization. Always terminate.
