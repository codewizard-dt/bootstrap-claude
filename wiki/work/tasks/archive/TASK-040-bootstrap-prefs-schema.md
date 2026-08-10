---
id: TASK-040
title: "Canonical preference key registry — bootstrap-prefs-schema.json"
status: done
created: 2026-08-06
updated: 2026-08-06
part_of: ROADMAP-005
depends_on: []
blocks: [TASK-041, TASK-042]
parallel_safe_with: [TASK-031, TASK-039]
uat: "[[UAT-040]]"
tags: [prefs, schema, install, consent, roadmap-005]
---

# TASK-040 — Canonical preference key registry — bootstrap-prefs-schema.json

part_of::[[ROADMAP-005]]

## Objective

Create `lib/scripts/templates/bootstrap-prefs-schema.json` — the single canonical description of every bootstrap preference key. One entry per key carrying `scope`, `consumer`, `summary`, `detail`, `values`, `default`, and `askedBy`. Three separate consumers read it: the `bootstrap-prefs.js` helper (for `--list` and for generating `bootstrap-prefs.README.md`), the installer scripts (for their sticky prompts), and the `/bootstrap-config` skill (to explain each key before offering to change it). Because all three read the same file, adding or renaming a preference is a one-file documentation change and the three surfaces cannot drift apart. This task ships **only the data file plus its shape contract** — no reader is built here (that is TASK-041) and no test is written here (TASK-042).

## Approach

**Template owns the canonical data.** This follows the established pattern of `lib/scripts/templates/settings-deny.json` and `settings-hooks.json`: a JSON file under `templates/` is the source of truth, and the scripts that consume it hold no duplicate copy of the list. The `settings-hooks.json` precedent also supplies the enforcement mechanism — `test/settings-hooks.test.js` has a bijection test proving the template and the wiring agree; TASK-042 does the same for this schema.

**Shape: a flat top-level object, key → entry.** No nesting by scope or consumer. Nesting would mean a reader has to know a key's scope before it can look the key up, which is backwards — `scope` is a *property* of the entry, not a path to it. Flat also mirrors the values files (`~/.claude/bootstrap-prefs.json` and `<project>/.claude/bootstrap-prefs.json`), which are flat dotted-key objects, so key lookup is symmetric on both sides.

**Per-key fields**, exactly as ROADMAP-005 names them, plus one addition:

| Field | Type | Meaning |
|---|---|---|
| `scope` | `"global"` \| `"project"` \| `"either"` | Which values file(s) may hold this key. `either` is the only one that consults both (project wins); `global` and `project` keys are looked up in exactly one file and never consult the other |
| `consumer` | `"installer"` \| `"skill"` | Who asks and who reads. `installer` keys are asked in situ by the script that owns them; `skill` keys are asked by the skill or the sync pass and **change what a command does** — `/bootstrap-config` warns more heavily about these |
| `summary` | string | One line, shown in `--list`, in the generated README table, and as the `AskUserQuestion` option label |
| `detail` | string | The consequence of each value, in prose — what changes on disk or in behavior. This is what stops a user from answering a bare key name blind |
| `values` | string | Human-readable value grammar, e.g. `"true \| false"` or `"auto \| confirm \| never"`. A **display** string, not a validator — TASK-041 derives its actual validation from it by splitting on `\|` and trimming |
| `default` | JSON value or `null` | What `--get --resolve` returns when neither file holds the key. `null` means "no default; the key resolves to `unset`" |
| `askedBy` | string | The script or skill that owns the prompt, e.g. `"install-mcps.sh"` or `"/git-commit"`. Used by `/bootstrap-config` to say where an answer came from |
| `dynamic` | `true`, optional | **The one addition beyond the roadmap's seven.** Marks a wildcard key pattern — see below |

**Dynamic keys need a wildcard form, and this is the one non-obvious design call.** Two prompt families generate one key per item at run time and cannot be enumerated ahead of time:

- `guides.<guide-name>` — one per entry in `OPTIONAL_GUIDES` (`sync-wiki-scaffold.sh:80`), today `evals-framework.md` and `type-checking-templates`, but the list is meant to grow.
- `gitignore.section.<slug>` — one per titled section in `lib/scripts/templates/gitignore`, whose titles are banner comments in the template itself (eight today, e.g. `OS / Editor`, `Node / TypeScript / JavaScript`).

Two rejected options and the chosen one:

- *Rejected — enumerate them.* Hard-codes the guide list and the gitignore section titles into a second place. Adding a guide would then silently produce an unrecognized key, which is exactly the drift this file exists to stop.
- *Rejected — leave them out of the schema.* Then `--list` and `/bootstrap-config` cannot explain the keys a user is most likely to see, and the bijection test has to carve out an exception broad enough to hide real drift.
- **Chosen — a wildcard entry with `"dynamic": true`.** The key contains a single trailing `*` segment (`"guides.*"`, `"gitignore.section.*"`). Lookup is **exact match first, wildcard second**, so a future exact `guides.evals-framework.md` entry would override the pattern without any code change. The bijection test in TASK-042 accepts a stored key that matches a wildcard as "covered".

**Slug rule for `gitignore.section.*`**, stated here because the key must be derivable identically by the shell and by the JS reader: lowercase the title, replace every run of non-alphanumeric characters with a single `-`, strip leading and trailing `-`. So `Node / TypeScript / JavaScript` → `gitignore.section.node-typescript-javascript`. Titles are free text from the template, so an un-slugified title would put spaces, slashes, and em-dashes into JSON keys.

**Naming reconciliation — `gitignore.review` is dropped.** The approved plan lists `gitignore.review` for the master review gate at `merge-gitignore.sh:152`, while TASK-030 step 3 lists `gitignore.offerSectionUpdates` for the same question ("Should setup/update offer .gitignore section updates?"). They are one prompt, not two. **`gitignore.offerSectionUpdates` is canonical** — it names the behavior rather than the UI, and it is the name TASK-030's consumer wiring already targets. Do not create `gitignore.review`.

**`default` encodes today's behavior, not the desired behavior.** TASK-030's compatibility guarantee is that an unanswered key must not change what a user sees. So `research.persistToRaw` defaults `true` (today it always writes), `gitCommit.autoPush` defaults `false` (today it never pushes), and `gitCommit.versionBump` defaults `"auto"` (today it bumps without asking). Every `installer` key defaults `null` — an unasked installer question should be *asked*, not silently answered.

**`default` is schema metadata and is never written to a values file.** The four-state model requires that absence *is* `unset`; writing a default into the file would convert an unanswered question into a settled answer and permanently suppress the prompt. TASK-041 enforces this; this task must not imply otherwise in `detail` text.

**No secrets, ever.** The Brave (`install-mcps.sh:111`) and Context7 (`:146`) API-key prompts get no schema entry and no key. They stay exactly as they are.

**Leave `sync-wiki-scaffold.sh:171` alone.** The CLAUDE.md-vs-CLAUDE.local.md question is already fully sticky in both directions via its own sentinel. It gets no key here; `/bootstrap-config` will surface it read-only later.

## Steps

### 1. Write the schema file  <!-- agent: general-purpose -->

- [x] Create `lib/scripts/templates/bootstrap-prefs-schema.json` — a single flat JSON object, 2-space indented, keys in the order given below (grouped by consumer then scope, which is how `--list` and the generated README will render them)
- [x] Every entry carries all seven required fields. `dynamic: true` appears on exactly the two wildcard entries
- [x] Plain `JSON.parse`-able with zero preprocessing — no comments, no trailing commas. This is the same constraint every other JSON file in the repo is under

**`consumer: "installer"`, `scope: "project"` (7 static + 2 dynamic):**

| Key | `askedBy` | `values` | `default` | Notes for `detail` |
|---|---|---|---|---|
| `mcp.serenaMigrate` | `install-mcps.sh` | `true \| false` | `null` | Migrate a project-scope Serena registration out of a tracked `.mcp.json` (site: `:286`) |
| `mcp.serena` | `install-mcps.sh` | `true \| false` | `null` | Register Serena at local scope for this project (site: `:295`) |
| `mcp.playwrightConflict` | `install-mcps.sh` | `shared \| alongside \| skip` | `null` | The 3-way conflict menu (site: `:415`). **This is the prompt that re-asks even after being answered** — options 1 and 2 leave states the gating condition cannot tell apart. Name the values, do not store `1`/`2`/`3` |
| `mcp.playwrightReplace` | `install-mcps.sh` | `true \| false` | `null` | Replace an existing machine-local Playwright registration (site: `:434`) |
| `update.legacyDocsAck` | `update-project.sh` | `true \| false` | `null` | Continue despite a legacy `.docs/` directory (site: `:46`) |
| `gitignore.infoExclude` | `merge-gitignore.sh` | `true \| false` | `null` | Keep `.serena/`, `raw/`, `wiki/` out of git on this machine via `.git/info/exclude` (site: `:312`). `detail` must state that this is **independent** of the `.gitignore` section pass — declining sections never disables sentinel repair |
| `prefs.gitTracking` | `merge-gitignore.sh` | `gitignore \| exclude \| neither` | `"exclude"` | **New prompt.** How git should treat `.claude/bootstrap-prefs.json` *and* its generated `bootstrap-prefs.README.md`. `detail` must name both files and note this is recorded in all three directions, so it is genuinely asked once |
| `guides.*` (`dynamic`) | `sync-wiki-scaffold.sh` | `true \| false` | `null` | One key per optional guide, keyed by the exact `OPTIONAL_GUIDES` entry including any extension — `guides.evals-framework.md`, `guides.type-checking-templates`. `detail` states that a guide already present on disk is refreshed regardless (existing opt-in wins) |
| `gitignore.section.*` (`dynamic`) | `merge-gitignore.sh` | `false` | `null` | One key per template section, slugified per the rule in *Approach*. `values` is **`false` only** — see step 2 |

**`consumer: "installer"`, `scope: "global"` (5):**

| Key | `askedBy` | `values` | `default` |
|---|---|---|---|
| `mcp.braveSearch` | `install-mcps.sh` | `true \| false` | `null` |
| `mcp.context7` | `install-mcps.sh` | `true \| false` | `null` |
| `mcp.context7Scope` | `lib.sh` (`prompt_scope`, `:198`) | `user \| project \| local` | `null` |
| `mcp.playwright` | `install-mcps.sh` | `true \| false` | `null` |
| `skills.pruneOrphans` | `install-global.sh` | `true \| false` | `null` |

- [x] For the three MCP install keys, `detail` names the prerequisite (Brave: an API key + Docker; Context7: none; Playwright: on macOS a launchd LaunchAgent) and states plainly that `false` means the installer stops offering it — that is the whole point of the roadmap
- [x] `mcp.context7Scope` values must match what `prompt_scope` actually accepts — read `lib/scripts/lib.sh` and use its literal answers rather than assuming
  - **Correction applied:** `prompt_scope` (`lib.sh:194-206`) returns only `"user"` or `"project"` — there is no `local` branch (`[pP]*` → project, everything else incl. empty/non-tty → user). `values` is `"user | project"`, not the plan's `user | project | local`.

**`consumer: "skill"`, `scope: "either"` (5):**

| Key | `askedBy` | `values` | `default` | `detail` must say |
|---|---|---|---|---|
| `gitCommit.versionBump` | `/git-commit` | `auto \| confirm \| never` | `"auto"` | `auto` = today's behavior (pick a bump, apply to every manifest, no confirmation); `confirm` = print the suggested bump and ask before editing any manifest; `never` = touch no version file but **still** prefix the subject with `[patch]`/`[minor]`/`[major]`. `confirm` **is** this key's `ask` state — there is no separate `"ask"` value |
| `gitCommit.autoPush` | `/git-commit` | `true \| false \| ask` | `false` | Default `false` because today's behavior is never pushing; defaulting an unanswered key to an outward-facing action would break the compatibility guarantee. The "never create a branch" rule is unaffected |
| `research.persistToRaw` | `install-global.sh` (sync pass) | `true \| false \| ask` | `true` | Governs the Phase 5 file write only — findings always appear in the response. A **per-run override exists even when this is `true`**; `ask` and the override are different mechanisms and both must work |
| `uatGenerate.promoteTests` | `install-global.sh` (sync pass) | `true \| false \| ask` | `true` | Whether `/uat-generate` writes repeatable assertions into `test/` automatically |
| `gitignore.offerSectionUpdates` | `install-global.sh` (sync pass) | `true \| false \| ask` | `true` | The master `.gitignore` review gate (`merge-gitignore.sh:152`). `false` skips the section pass without prompting; `ask` is today's behavior. **The `.git/info/exclude` block is outside this** — see `gitignore.infoExclude` |

- [x] Cross-reference the two `gitignore.*` keys in each other's `detail`, and cross-reference `prefs.gitTracking` from `gitignore.infoExclude` — three keys touch git-ignoring and a user reading one in isolation will guess wrong about the others

<!-- Updated: 2026-08-06 -->
**Step 1 outcome:** 19 entries written (9 installer/project incl. 2 dynamic, 5 installer/global, 5 skill/either). Line-number citations re-verified against the live scripts; three were off by one and were corrected in the schema: `merge-gitignore.sh:10`→`:11` (invariant), `:152`→`:153` (master review gate), `:312`→`:313` (info/exclude prompt). `install-mcps.sh:286/295/415/434`, `update-project.sh:46`, and `lib.sh:198` were all confirmed accurate. `skills.pruneOrphans`'s real site was located at `install-global.sh:58`.

**Discovered for TASK-041:** the gitignore template has 8 banner sections today; one title contains an em dash (`Claude Code — machine-local MCP registration…`), so the slugifier must treat "non-alphanumeric" Unicode-aware rather than as `[^a-z0-9]` over bytes, or the multi-byte `—` yields three dashes before collapse. Also: `mcp.playwrightConflict`'s `shared | alongside | skip` are names assigned to menu options `1`/`2`/`3` — the script only ever reads the digits, so the consumer needs an explicit name→branch mapping, not a passthrough.

### 2. Encode the `.gitignore` declines-only rule in the schema  <!-- agent: general-purpose -->

`merge-gitignore.sh:10` states the invariant *"NOTHING is ever added to a project's .gitignore without asking."* A remembered **yes** would silently append lines on a later run and break it. The schema must carry this so TASK-041's writer can enforce it rather than each call site remembering to.

- [x] Give `gitignore.section.*` `"values": "false"` — the literal string `false`, a one-value grammar. A `true` for this key is not a legal stored value, so an accepted section is never recorded and a genuinely new template section is still offered next time
- [x] Say so explicitly in that entry's `detail`, citing the invariant, so a reader does not "fix" the one-value grammar as a typo
- [x] Confirm the same rule does **not** apply to `prefs.gitTracking` or `gitCommit.versionBump` — both are choices, not add/skip gates, and are recorded in all three directions. State this in their `detail` text
- [x] `gitignore.offerSectionUpdates` is likewise a full three-state key: it gates whether the pass runs at all and never appends anything itself

<!-- Updated: 2026-08-06 -->
**Step 2 outcome:** Step 1's writing pass had already satisfied all four checkboxes. Audit added one clarifying sentence to `gitignore.section.*`'s `detail` (an accepted section is never recorded, so a section that gains lines in a later template version is re-offered by title rather than appended silently). Invariant citation `merge-gitignore.sh:11` re-confirmed correct. Entry count still 19, key order byte-identical, `JSON.parse` clean.

### 3. Document the shape contract  <!-- agent: general-purpose -->

The file is data, so its rules have to live somewhere a reader will find them. Two places, deliberately:

- [x] Add a `"$comment"`-free header convention note in `lib/scripts/README.md` (JSON cannot carry comments, so the file itself must stay bare) — a new row for `templates/bootstrap-prefs-schema.json` describing: flat key→entry object, the eight fields, exact-then-wildcard lookup, the gitignore-section one-value grammar, and that `default` is metadata never written to a values file
- [x] Note in the same place that **a key present in a values file but absent from the schema round-trips unchanged** and is listed under "unrecognized" by the generated README — never silently dropped. This is a forward-compatibility guarantee for values files written by a newer version
- [x] Do **not** add a `CLAUDE.md` Key Files entry yet — ROADMAP-005 Phase 4 owns the docs pass and will add the helper and the schema together, in one edit — confirmed untouched

<!-- Updated: 2026-08-06 -->
**Step 3 outcome:** `lib/scripts/README.md` +80 lines, two insertions following the `templates/settings-deny.json` precedent exactly — a row in the `## templates/` table (inserted between the `settings-deny.json` and `settings-hooks.json` rows) whose Contents cell links to a new `## Preference-schema notes` section appended after `## Deny-list notes`. That section covers: flat key→entry shape, the eight-field table, exact-then-wildcard lookup + the Unicode-aware slug rule, the `gitignore.section.*` one-value grammar citing `merge-gitignore.sh:11`, `default` as never-written metadata, and the unrecognized-key round-trip guarantee. The per-key human-readable table is explicitly deferred to Phase 4 and was not written. `CLAUDE.md` untouched.

**Phase 4 follow-up noted:** the table row's `Read/copied by` cell currently reads `bootstrap-prefs.js` *(not built yet)* — update when TASK-041 lands the helper.

### 4. Verify  <!-- agent: general-purpose -->

No test file exists yet (TASK-042 builds it), so verification here is direct:

- [x] `node -e 'JSON.parse(require("fs").readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"))'` parses with zero preprocessing — 15611 bytes, 19 top-level keys, no duplicate raw keys
- [x] Every entry has all seven required fields present and non-empty (`default` may be `null`); exactly two entries carry `dynamic: true` — 19/19 clean; `guides.*` + `gitignore.section.*` only
- [x] Every `scope` is one of `global` / `project` / `either`; every `consumer` is `installer` / `skill` — scope global=5 / project=9 / either=5; consumer installer=14 / skill=5
- [x] Every `askedBy` names a file that exists under `lib/scripts/`, or a slash-command that exists under `lib/skills/` — 19/19 resolved (6 scripts + `/git-commit` → `lib/skills/git-commit/SKILL.md`)
- [x] Cross-check each `installer` entry's site against the real script — the plan's line numbers were captured on 2026-08-06 and the surrounding files have been edited since. If a cited line has moved, fix the reference in `detail` rather than trusting the plan — 11 citations opened and confirmed; 5 corrected in total across steps 1-4
- [x] Confirm `gitignore.review` appears **nowhere** in the file (it was superseded by `gitignore.offerSectionUpdates`) — absent
- [x] Confirm no API-key prompt produced a key — none; `mcp.braveSearch` and `mcp.context7` explicitly state the key is never stored here
- [x] `npm test` still green — this task adds no test, so the count must be unchanged — **144 pass / 0 fail**

<!-- Updated: 2026-08-06 -->
**Step 4 outcome:** 14/14 programmatic checks PASS (verification script kept in the session scratchpad, not the repo). Two further stale citations found and fixed beyond steps 1-2's three: `sync-wiki-scaffold.sh:80`→`:81` (80 is `REQUIRED_GUIDES`; `OPTIONAL_GUIDES` is 81) and `install-global.sh:58`→`:59` (58 is the `[ -t 0 ]` tty gate; the prompt is 59). Two prose claims independently source-verified: `prompt_scope` (`lib.sh:194-206`) has no local-scope branch and falls through to `user`; the "pure sentinel repair runs with no prompt" claim is backed by the `exclude_is_canonical` short-circuit at `merge-gitignore.sh:309-310`.

**`npm test` count note:** 144, not the 141 release baseline. The +3 is the pre-existing untracked `test/npm-pack-contents.test.js` (present in the session-start git snapshot, belongs to earlier npm-tarball work); it alone yields 3 tests, so 141+3=144. TASK-040 added zero tests, as specified.

## Notes

- **Downstream:** TASK-041 (`bootstrap-prefs.js`) reads this file for `--list`, for value validation, and to generate `bootstrap-prefs.README.md`. TASK-042 asserts schema↔key bijection. Both are blocked on this one.
- **Deferred to Phase 4:** pinning `bootstrap-prefs-schema.json` into `test/npm-pack-contents.test.js`, and the `lib/scripts/README.md` full key table. Step 3 above adds only the shape contract, not the human-readable key table.
- **`package.json` `files`** already ships `lib/`, so the template is included in the tarball without a manifest change — verify with `npm pack --dry-run` rather than assuming. **Verified 2026-08-06:** `npm pack --dry-run` lists `npm notice 15.6kB lib/scripts/templates/bootstrap-prefs-schema.json` — exactly one match, no manifest change needed.
