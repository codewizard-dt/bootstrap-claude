---
name: elevator-pitch
description: Generate a short, punchy elevator pitch for a project
category: executing
model: claude-sonnet-5
argument-hint: "[path to project directory (defaults to cwd)] [custom instructions to alter the output]"
disable-model-invocation: false
user-invocable: true
---
Generate a **short elevator pitch** for this project — the kind you'd give to a smart stranger at a conference who asks "what are you building?" It should make the project sound genuinely exciting, brag shamelessly about the best features with the specifics to back it up, and land in under a minute of reading.

## Arguments: $ARGUMENTS

`$ARGUMENTS` may contain two kinds of input, in either order, and either may be absent:

1. **A target path** — an existing directory (absolute or relative). If present, treat it as the project root. If absent, use the current working directory.
2. **Custom instructions** — free-form guidance. Examples:
   - "target a non-technical audience"
   - "emphasize the AI angle"
   - "write it as a tweet thread"
   - "focus on the developer experience, not the end user"

If the first whitespace-delimited token resolves to an existing directory, treat that token as the target path and the rest as custom instructions. Otherwise treat the entire string as custom instructions and default the target to cwd.

---

## Instructions

### 1. Discover what makes this project worth talking about

Use Serena MCP tools to explore the target project. You are looking for the story, not the spec. Find:

- **The core problem** — what pain does this solve? Be concrete.
- **The insight** — what's the key idea that makes this approach work? (A clever abstraction, an unusual combination of tools, a workflow nobody had automated before, etc.)
- **The audience** — who benefits and how does their life improve?
- **The best features** — identify the 2-3 features that are most impressive, most useful, or most surprising. Look for things with real numbers (command counts, time saved, steps eliminated), elegant abstractions, or capabilities that competitors don't have. These are the things you'd demo first to a skeptic.
- **The best part** — something that makes a developer or user think "oh that's clever."

Check: `package.json` (name, description), existing `README.md`, the top-level directory structure, and any `.docs/` or `CLAUDE.md` files for stated goals.

### 2. Write the pitch

Produce a markdown snippet with this structure — tight, concrete, no filler:

```markdown
## {Project Name}

{One punchy sentence that names the problem and the solution. No jargon. No "leveraging". No "seamlessly".}

### Why it's interesting

{2-3 sentences on the insight or approach. What makes this different from the obvious solution? What would a smart developer find elegant or surprising about it?}

### Who it's for

{One sentence naming the target user and the specific pain they stop feeling.}

### The best features

{2-3 bullets, each one bragging specifically about a standout feature. Lead with the most impressive one. Be concrete: name the feature, say what it does, include a number or comparison if one exists. This is where you sell it — but sell with facts, not adjectives.}

### The best part

{One sentence on the single most surprising or clever thing about it.}
```

### 3. Quality bar

- **Brag with specifics.** The "best features" section should be the loudest part of the pitch, but every claim must be backed by something real in the codebase — a number, a named command, a concrete capability. "47 slash commands covering the full dev lifecycle" is bragging. "A lot of useful commands" is not.
- **Concrete over abstract.** "Cuts deploy setup from 4 hours to one command" beats "streamlines deployment workflows."
- **Honest.** Only claim what the codebase actually does. Do not invent capabilities.
- **Voice.** Write like an engineer who built it and is genuinely proud — not like a press release or a landing page hero section.
- **Length.** The full output should fit comfortably in a Slack message. Under 275 words total.

### 4. Anti-slop pass

After writing the draft pitch, rewrite it applying every constraint below. This block must be applied last — after all other instructions — which is why it appears here rather than at the top.

```
No emojis. Avoid using em dashes; use commas or periods instead. Do not use any
of the following words or any derivatives: unlock, leverage, harness, insights,
democratize, explore, discover, dive in, elevate, enhance, witness, revolutionize,
transform, embrace, unleash, dive, indulge, actionable, reveal, unmatched, delve,
era, collaboration, cutting-edge, matters, impact, fusion, advancing, navigate,
drive, problem solver, changemaker, game changer, ensure, transformational,
powerful, derailed, delighted, cheat code.

If there are titles or headers, write them as direct one-liners under 10 words
based on the actual insight, not the topic category. Titles can be informal but
they need to say something specific.

Avoid contrastive negation, antithesis, and rhetorical contrast. No "X, not Y"
constructions. Write in a natural, conversational tone.

Avoid sentence fragments, anaphora, and asyndeton. Do not use short standalone
phrases or stacked clauses without conjunctions. Write in complete, naturally
flowing sentences.

Avoid repeated sentence openings across multiple sentences and vary sentence
structure so the same word or phrase does not begin consecutive sentences.

Do not structure paragraphs around rhythmic rhetorical patterns that sound like
speeches or persuasion frameworks. Prioritize clarity over dramatic phrasing.

Avoid colon-based dual clause titles or headings that try to simulate depth.
Write titles that describe the idea directly.

Remove buzzwords, hype language, and filler adjectives. Replace vague
marketing-style phrasing with clear descriptions of what actually happens.

Avoid vague claims and include concrete examples, numbers, tools, constraints,
or specific situations whenever possible so the writing contains real information.

Prefer straightforward explanation over rhetorical emphasis. Write sentences
that sound like a thoughtful person explaining an idea, not a motivational post
or keynote speech.

When editing text, simplify sentences that sound formulaic or generic and replace
abstract language with precise wording that reflects a real observation or
experience.
```

### 5. Output

Write the final rewritten pitch to `ELEVATOR-PITCH.md` in the target project's root directory, overwriting any existing file. Then print the content to the conversation so the user can review it.
