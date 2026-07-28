---
name: flashcard
description: Turn markdown/research files into a self-contained interactive flashcard HTML page
category: researching
model: claude-sonnet-5
argument-hint: "<file1> [file2 ...] [-- <what's important>]"
---

# Flashcard

Turn one or more markdown or research files into a **single self-contained HTML page** of interactive flashcards. The page lives in one file — no build step, no external assets except the Inter Tight font (gracefully offline-degraded). Cards flip on click or Space, navigate with arrow keys, and can be shuffled.

---

**Arguments**: $ARGUMENTS

Split on ` -- ` (literal space-dash-dash-space):
- **Left side** — space-separated file paths. Verify each exists (use `Read` to open it).
- **Right side** (optional) — a focus instruction describing what the user considers "important" (e.g., `-- API methods and their parameters`).
- If no `--` is present, the entire arguments string is treated as file paths.
- Derive a **slug** from the first file's stem (e.g., `llm-wiki` from `llm-wiki.md`). Use it in the output filename: `<slug>-flashcards.html`. If multiple files and no clear lead, use `flashcards.html`.

---

## Phase 1 — Load House-Style Design Tokens

Read `~/code/house-style/tokens.json` to get the canonical values used by the `/frontend-taste` skill. Extract exactly these values for embedding in the HTML:

| Token | Value |
|---|---|
| `--canvas` | `#f6f7f9` |
| `--surface` | `#ffffff` |
| `--ink` | `#0b0b0d` |
| `--ink-2` | `#3a3a40` |
| `--muted` | `#6b7280` |
| `--line` | `#e4e5e8` |
| `--accent` | `#4f5a78` |
| `--accent-green` | `#4a7c59` |
| `--radius-card` | `14px` |
| `--radius-pill` | `999px` |
| Font | Inter Tight, `-0.011em` tracking, `font-feature-settings: "ss01" "cv11" "cv02"` |
| Animations | `popIn 220ms cubic-bezier(0.34,1.56,0.64,1)`, `riseIn 500ms ease` |

If `~/code/house-style/tokens.json` cannot be read, fall back to the values in the table above — they are the canonical defaults.

---

## Phase 2 — Read Source Files

Use the `Read` tool to read every file path parsed from the arguments. Do not use Serena for this — these are typically markdown documents, not code files.

For each file, note:
- Its **filename stem** (used as the deck label)
- Its **full text content**

---

## Phase 3 — Extract Flashcard Content

For each source file, extract cards using the extraction hierarchy below. Apply the focus string (if provided) as a filter: extract only content that matches the focus topic and skip unrelated sections.

### Extraction hierarchy (priority order)

| Pattern | Front | Back |
|---|---|---|
| `## Heading` or `### Heading` | "What is `<heading>`?" | First 2–4 sentences of the section body (strip sub-headings) |
| `**Bold term**` followed by ` — ` or `:` and a definition | `<bold term>` | The definition text |
| Numbered list under a heading | "How do you `<heading>`?" | The numbered steps as a clean list |
| Fenced code block with surrounding context | "When/how do you use this pattern?" (derived from the preceding heading or comment) | The code block, trimmed to ≤ 12 lines |
| Table rows where the first column is a label | `<first column value>` | Remaining columns joined as prose |
| Standalone factual sentence containing "is", "are", "means", "refers to" | A cloze prompt: replace the key noun/value with `___` | The original sentence |

**Limits:**
- Target 10–40 cards per source file.
- If a file yields more, keep the highest-level headings and first-occurrence bold terms; discard redundant sub-sections.
- Deduplicate: if two cards have near-identical fronts, keep only the richer one.

### Card data shape (used internally to build the HTML)

```json
{
  "id": 1,
  "deck": "llm-wiki",
  "front": "What is the LLM Wiki pattern?",
  "back": "A three-layer structure (raw/, wiki/, CLAUDE.md) …",
  "source": "llm-wiki.md"
}
```

Collect all cards from all files into a single array. Preserve deck labels for the filter UI.

---

## Phase 4 — Generate the HTML

Produce a **single `<!DOCTYPE html>` document** with all CSS and JS inline. The only network dependency is the Google Fonts `@import` for Inter Tight — everything else is self-contained.

### Full HTML template

Use this structure exactly, substituting real values:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flashcards — {TITLE}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&display=swap');

:root {
  --canvas:      #f6f7f9;
  --surface:     #ffffff;
  --ink:         #0b0b0d;
  --ink-2:       #3a3a40;
  --muted:       #6b7280;
  --line:        #e4e5e8;
  --accent:      #4f5a78;
  --accent-green:#4a7c59;
  --radius-card: 14px;
  --radius-pill: 999px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter Tight', system-ui, sans-serif;
  font-feature-settings: "ss01" "cv11" "cv02";
  letter-spacing: -0.011em;
  background: var(--canvas);
  color: var(--ink);
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem 4rem;
  gap: 1.5rem;
}

/* Header */
header {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

h1 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
}

.controls-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

select {
  font-family: inherit;
  font-size: 0.8125rem;
  font-feature-settings: "ss01" "cv11" "cv02";
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.3rem 0.9rem 0.3rem 0.75rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
  padding-right: 1.75rem;
}

.progress {
  font-size: 0.8125rem;
  color: var(--muted);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

/* Card stage */
.stage {
  width: 100%;
  max-width: 640px;
  perspective: 1200px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.card-inner {
  position: relative;
  width: 100%;
  height: clamp(260px, 45vh, 520px);
  transform-style: preserve-3d;
  transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: var(--radius-card);
}

.card-inner.flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: var(--radius-card);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  padding: 2rem;
  gap: 0.5rem;
}

.card-face.back {
  transform: rotateY(180deg);
}

.card-label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.card-text {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
  display: flex;
  align-items: center;
  font-size: 1.0625rem;
  font-weight: 500;
  line-height: 1.5;
  color: var(--ink);
  white-space: pre-wrap;
}

.card-face.back .card-text {
  font-size: 0.9375rem;
  font-weight: 400;
  color: var(--ink-2);
  align-items: flex-start;
  padding-top: 0.25rem;
}

.card-source {
  font-size: 0.6875rem;
  color: var(--muted);
  text-align: right;
  margin-top: auto;
}

/* Hint text */
.flip-hint {
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
  opacity: 0.7;
}

/* Navigation controls */
.controls-bottom {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

button {
  font-family: inherit;
  font-size: 0.8125rem;
  font-feature-settings: "ss01" "cv11" "cv02";
  font-weight: 500;
  letter-spacing: -0.011em;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.4rem 1rem;
  background: var(--surface);
  color: var(--ink-2);
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

button:hover {
  background: var(--canvas);
  border-color: var(--accent);
  color: var(--accent);
}

button:active {
  transform: scale(0.97);
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

button.primary:hover {
  background: #3d4760;
  border-color: #3d4760;
  color: #fff;
}

/* Card enter animation */
@keyframes popIn {
  from { opacity: 0; transform: scale(0.96) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.card-inner.entering {
  animation: popIn 220ms cubic-bezier(0.34,1.56,0.64,1) both;
}

/* Progress bar */
.progress-bar-wrap {
  width: 100%;
  max-width: 640px;
  height: 3px;
  background: var(--line);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-pill);
  transition: width 0.25s ease;
}

/* Responsive */
@media (max-width: 480px) {
  body { padding: 1.25rem 0.75rem 3rem; }
  .card-face { padding: 1.5rem; }
  .card-text { font-size: 0.9375rem; }
}
</style>
</head>
<body>

<header>
  <h1>{TITLE}</h1>
  <div class="controls-top">
    <select id="deckFilter" aria-label="Filter by deck">
      <option value="all">All decks</option>
      {DECK_OPTIONS}
    </select>
    <span class="progress" id="progressText">1 / {TOTAL}</span>
  </div>
</header>

<div class="progress-bar-wrap">
  <div class="progress-bar-fill" id="progressBar" style="width:{FIRST_PCT}%"></div>
</div>

<div class="stage" id="stage" role="button" tabindex="0" aria-label="Flashcard — click to flip">
  <div class="card-inner" id="cardInner">
    <div class="card-face front">
      <span class="card-label">Question</span>
      <div class="card-text" id="frontText"></div>
    </div>
    <div class="card-face back">
      <span class="card-label">Answer</span>
      <div class="card-text" id="backText"></div>
      <div class="card-source" id="cardSource"></div>
    </div>
  </div>
</div>

<p class="flip-hint">Click card or press <kbd>Space</kbd> to flip &nbsp;·&nbsp; <kbd>←</kbd> <kbd>→</kbd> to navigate</p>

<div class="controls-bottom">
  <button id="btnPrev" onclick="navigate(-1)">← Prev</button>
  <button class="primary" id="btnFlip" onclick="flip()">Flip</button>
  <button id="btnNext" onclick="navigate(1)">Next →</button>
  <button id="btnShuffle" onclick="shuffle()">Shuffle</button>
</div>

<script>
const ALL_CARDS = {CARDS_JSON};

let deck = [...ALL_CARDS];
let idx = 0;
let flipped = false;

const cardInner = document.getElementById('cardInner');
const frontText  = document.getElementById('frontText');
const backText   = document.getElementById('backText');
const cardSource = document.getElementById('cardSource');
const progressText = document.getElementById('progressText');
const progressBar  = document.getElementById('progressBar');
const deckFilter   = document.getElementById('deckFilter');

function render(animate) {
  if (animate) {
    cardInner.classList.remove('entering');
    void cardInner.offsetWidth; // reflow
    cardInner.classList.add('entering');
  }
  flipped = false;
  cardInner.classList.remove('flipped');
  const c = deck[idx];
  frontText.textContent  = c.front;
  backText.textContent   = c.back;
  cardSource.textContent = c.source;
  const pct = deck.length > 1 ? ((idx + 1) / deck.length) * 100 : 100;
  progressText.textContent = `${idx + 1} / ${deck.length}`;
  progressBar.style.width  = pct + '%';
  document.getElementById('btnPrev').disabled = idx === 0;
  document.getElementById('btnNext').disabled = idx === deck.length - 1;
}

function flip() {
  flipped = !flipped;
  cardInner.classList.toggle('flipped', flipped);
}

function navigate(dir) {
  const next = idx + dir;
  if (next < 0 || next >= deck.length) return;
  idx = next;
  render(true);
}

function shuffle() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  idx = 0;
  render(true);
}

cardInner.addEventListener('animationend', () => {
  cardInner.classList.remove('entering');
});

document.getElementById('stage').addEventListener('click', flip);
document.getElementById('stage').addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); navigate(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
  if (e.key === ' ')          { e.preventDefault(); flip(); }
});

deckFilter.addEventListener('change', () => {
  const val = deckFilter.value;
  deck = val === 'all' ? [...ALL_CARDS] : ALL_CARDS.filter(c => c.deck === val);
  idx = 0;
  render(true);
});

render(false);
</script>
</body>
</html>
```

### Template substitutions

| Placeholder | Value |
|---|---|
| `{TITLE}` | Title derived from file name(s), e.g. `LLM Wiki Flashcards` |
| `{DECK_OPTIONS}` | One `<option value="{deck}">{deck}</option>` per unique deck label |
| `{TOTAL}` | Total card count |
| `{FIRST_PCT}` | `(1 / total * 100).toFixed(1)` |
| `{CARDS_JSON}` | The full card array as a JSON literal (use `JSON.stringify`-equivalent formatting; escape backticks and `</script>` in text fields by replacing `</script>` with `<\/script>`) |

---

## Phase 5 — Write and Report

Write the HTML string to `./<slug>-flashcards.html` using the `Write` tool.

Report to the user:
- Output path
- Total card count
- Deck breakdown: `<filename>: N cards` per source file
- Keyboard shortcuts summary (flip / navigate / shuffle)
- How to open: `open <filename>-flashcards.html`

---

## CRITICAL Rules

- The output file must be **fully self-contained** — no `src=""` external scripts, no `href=""` external stylesheets (the Google Fonts `@import` inside `<style>` is the sole allowed network reference).
- Embed `{CARDS_JSON}` as a raw JS object literal assigned to `const ALL_CARDS`. Ensure all card text is properly JSON-escaped; any `</script>` string inside card text must be split as `<\/script>` to avoid early tag closure.
- **Do not** use Serena MCP tools for reading the source markdown files — use the standard `Read` tool. Serena is for code files only.
- **Do** use `Read` (not bash) to open `~/code/house-style/tokens.json`. If the file is absent, fall back to the hardcoded token table in Phase 1.
- Write the output file with `Write` (not Bash redirect, not Serena).
- Keep the generated HTML clean — no `<!-- comments -->` in the output.
