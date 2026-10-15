---
name: autopilot
description: One unattended tick of self-driving work, built for `/loop 1h /autopilot` — if idle, run /whats-next and hand the first drivable item to /power-mode; if no work is left, run /research on similar products against this codebase; if there is still none, turn the newest research into a new roadmap
category: executing
model: claude-sonnet-5
argument-hint: "[--dry-run]"
disable-model-invocation: false
user-invocable: true
---
**Prereqs:** obey `wiki/guides/mcp-tools.md`; run /primer if not done this session.

# Autopilot

One **tick** of an unattended work loop. Run it on a schedule — `/loop 1h /autopilot` — and each tick does exactly one of four things, in this order: stand down because work is already running, drive the next piece of open work, research for new ideas when nothing is open, or turn the newest research into a roadmap so the next tick has something to drive.

The schedule belongs to `/loop`. This skill never calls `ScheduleWakeup`, `CronCreate` or any timer — it runs once and stops, so a tick that finds nothing to do simply ends.

**No user is present.** Never call `AskUserQuestion`, and never wait for confirmation. Every decision below has a defined default; where a sub-skill would normally ask, this skill supplies the answer itself (Stage C spells out how). `--dry-run` runs the checks and the sweep, prints what the tick *would* do, and changes nothing.

---

## Step 1: Am I already working?

The tick must not stack on top of itself. Call `ListAgents` and check for background tasks started by this session.

- **Any agent or task still running** (a `/power-mode` team from an earlier tick, a `/research` sub-process, a `/tackle` in flight) → stop with `Autopilot: busy — <N> agent(s) still running (<names>). Skipping this tick.` Do not read the wiki, do not dispatch anything.
- **Nothing running** → continue. Agents that finished or went idle do not count as busy, but never reap or message agents this skill did not spawn.

A task that sits at `status: in-progress` with no agent running is an orphan from an interrupted run, not "work in progress" — it is ordinary Stage A input.

## Stage A: Drive the next open work

1. Run `/whats-next` (read-only) and read its ranked table and Blocked list.
2. If it printed `No open work found`, go to **Stage B**.
3. Walk the Ranked table **top-down** and pick the first row `/power-mode` can drive:

   | Row | Power-mode argument |
   |-----|---------------------|
   | task (`todo`, `in-progress`, `pending-uat`) | the task file path, `wiki/work/tasks/TASK-NNNN-slug.md` |
   | inline roadmap item, or a fully-worked roadmap | the roadmap file path, `wiki/work/roadmaps/ROADMAP-NNNN-slug.md` |

   Skip rows that need a human decision — bug triage, ADR finalize, PRD finalize, UAT cases that are manual-only (`/uat-walk`), index-drift hygiene. They are not drivable unattended, and skipping them keeps the tick from inventing an answer to a judgment call.
4. **Drivable row found** → run `/power-mode <argument>` on it and let it run to completion. Then stop (Step: Report). The next tick re-sweeps from scratch; do not pick a second item in the same tick.
5. **Rows exist but none is drivable** → this is unfinished work waiting on a human, not "nothing to do". **Do not fall through to Stage B.** Stop with `Autopilot: open work needs a human — <N> item(s): <ID — Next command>, …` listing the top three.

## Stage B: Research when the queue is empty

Reached only when `/whats-next` reported no open work at all.

1. Work out what this project is: read the root `README.md` and `CLAUDE.md` (first screen of each is enough) and the Serena memory `project/overview`.
2. List existing topics with `list_dir` on `raw/research/` and read each `index.md` title line, so the new topic does not repeat one. If the obvious topic already has a report, choose an adjacent angle (a feature area, a competitor class, a technique) that the existing reports leave open — never the same question twice.
3. Run `/research` with a topic of this shape, filled in from step 1 and narrowed by step 2:

   `Existing products, open-source projects and published approaches similar to <what this project is>: how they solve <its core problem>, what they offer that this codebase does not, and where this codebase is ahead — compared against this repository's current features and architecture`

   `/research` already covers both halves the loop needs: Phase 2 analyses this codebase, Phase 3 searches the web (Brave) and library docs (Context7). Let it apply its own `research.persistToRaw` / `research.autoIngest` gates — do not override them.
4. Continue to **Stage C**.

## Stage C: Roadmap from the newest research

1. **Re-check for work.** Run `/whats-next` once more. If it now lists open work (something else created it while research ran), stop — the next tick drives it. Otherwise continue.
2. **Pick the source.** The newest report is the highest `researched:` date across `raw/research/*/index*.md` (`search_for_pattern` on `^researched:[^\n]*`; on a tie prefer the report `/research` just wrote). Skip any report already cited by an existing roadmap — search `wiki/work/roadmaps/ROADMAP-*.md` for its slug or path, in any status. If `/research` persisted nothing (`research.persistToRaw=false`), use this tick's in-context report and say so in the roadmap `## Notes`.
3. **Create the roadmap without the Q&A.** Follow `lib/skills/roadmap-create/SKILL.md` — number allocation, the file template, the item-rendering rules, the index row, the hot-cache refresh — with these substitutions for its interactive steps:
   - The `/research` it demands as a first step is satisfied by Stage B; do not run a second one.
   - Skip its Step 3 Q&A and Step 4 approval prompt. Answer the elicitations yourself, from the report's `## Recommendation` and `## Next Steps`:

     | Elicitation | Answer |
     |-------------|--------|
     | Goal | 1–2 sentences: the observable end state if the recommendation is carried out |
     | Phases | 2–4 short execution-flavoured names, in dependency order |
     | Owner | the name from `git config user.name` (a named person passes the quality bar; "the team" does not) |
     | Linked PRD / ADRs | `—` — never invent references |
     | Items | one checkbox-sized inline item per concrete recommendation, 3–9 in total, each grounded in a finding of the report. No sub-bullets, no file paths, no steps — that is task territory. At least one phase must hold at least one item |

   - Record the source in `## Notes` as a path (`raw/research/<slug>/index.md`). Set `derived_from:` only when a `wiki/knowledge/sources/` page for that report already exists; otherwise omit it.
   - The roadmap's own refusal rules still hold (vague Goal, missing Owner, zero items): if the report yields no concrete recommendation, write nothing and report `Autopilot: research produced no actionable recommendation — no roadmap created.`
4. **Log it.** Append `## [YYYY-MM-DD] roadmap | ROADMAP-NNNN <title>` plus one sentence — `created by /autopilot from raw/research/<slug>/` — to `wiki/log.md` (append-only; never edit an existing entry).
5. **Stop.** Do not call `/power-mode` in this tick. Research plus roadmap creation is already a long tick, and the next tick's Stage A finds the new roadmap's inline items and drives them.

## Report

One block, no preamble:

```
Autopilot tick — <YYYY-MM-DD HH:MM>
Stage:   <busy | A drove <ID> | A needs-human | B+C created <ROADMAP-NNNN> | B no-recommendation>
Details: <one line — what was run, the path acted on, or the reason it stopped>
Next:    <what the next tick will do, when known>
```

With `--dry-run`, prefix `DRY RUN —` and describe the action instead of taking it.

---

## Constraints

- **Unattended.** No `AskUserQuestion`, no confirmation waits. The roadmap in Stage C is written on this skill's own judgement — say so in the report so the human can edit or `/task-close` it.
- **One action per tick.** At most one `/power-mode` run, or one research-plus-roadmap pass. Never both in the same tick.
- **Never fall through past real work.** Stage B runs only when `/whats-next` found *no* open work; open work that merely needs a human stops the tick at Stage A.
- **Never schedule.** The interval belongs to `/loop`; this skill has no timer of its own.
- **Never edit `raw/`** except through `/research`, which owns `raw/research/`.
- **Delegated safety.** `/power-mode` and `/research` keep their own rules — agent naming, reaping, permission mode, preference gates, Serena-first navigation. This skill relaxes none of them.
- **Sub-skills only.** Do not reimplement ranking, the pipeline or the roadmap template here; read them from the skills named above.

## Usage

```
/loop 1h /autopilot            # the intended form
/autopilot --dry-run           # see what the next tick would do
```
