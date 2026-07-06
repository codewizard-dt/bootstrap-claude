# UAT-CORE — shared procedures for the UAT family

Steps 1–5 and the closure procedure are identical (or near-identical) across `/uat-walk`, `/uat-auto`, and `/uat-auto-plus`. They live here once. Each SKILL.md defines only what differs for its mode; where a step varies, a **Mode differences** note names the deltas.

**Pipeline:** `/task-add → /tackle → /uat-generate → {uat-walk | uat-auto | uat-auto-plus} → archive/`. Tasks stay at their stable path in `wiki/work/tasks/` until UAT passes; on all-pass this procedure flips the task to `done` and archives both files. Files never move except into `archive/`.

**Status vocabulary** (only the status line ever changes — never reformat anything else in a test block):

| Marker | Meaning |
|--------|---------|
| `- [ ] Pass` | untested (pending) |
| `- [x] Pass <!-- YYYY-MM-DD -->` | passed |
| `- [FAIL: <reason>] <!-- YYYY-MM-DD -->` | failed (blocking) |
| `- [FIXING: <note>] <!-- YYYY-MM-DD -->` | fix in progress (blocking, always temporary) |
| `- [SKIP: <reason>] <!-- YYYY-MM-DD -->` | skipped — **human verdict only** |

A UAT file is **complete** when no test has a blocking status (`[FAIL]` / `[FIXING]`). `[x] Pass` and `[SKIP]` are non-blocking; `- [ ] Pass` is non-blocking only when the active mode excludes it.

---

## Step 1 — Resolve & parse the UAT file

Resolve `$ARGUMENTS` to one file in `wiki/work/uat/` (files never move — no `completed/` subdir; use Serena `list_dir`/`find_file`):

| Input | Action |
|-------|--------|
| File path (`wiki/work/uat/UAT-003-user-auth.md`) | use directly |
| Number-slug (`UAT-003`, `003-user-auth`) | match in `wiki/work/uat/`; if none, STOP + report |
| Number / description (`3`, `user auth`) | search `wiki/work/uat/`; if ambiguous, resolve per mode |
| Empty / unresolved | auto-pick per mode |

**Mode differences (resolution):**
- **uat-walk** — ambiguous input: list matches, ask the user to clarify. No auto-pick; empty/unresolved → STOP and report.
- **uat-auto / uat-auto-plus** — never prompt. Ambiguous input → STOP and report in the completion summary. Empty/unresolved → enumerate `status: pending` files in `wiki/work/uat/`, pick the lowest `<NNN>` prefix, announce in one line (`No matching UAT file — running \`<filename>\``), proceed without confirmation. If none pending, STOP: "No pending UAT files found".

If the resolved file is missing, empty, or outside `wiki/work/uat/`, STOP (walk: warn + confirm; auto/plus: exit with a diagnostic summary).

**Parse** the file for: `### UAT-*` test headings (e.g. `UAT-API-001:`, `UAT-UI-002:`); `## Prerequisites` items; each test's status marker (see vocabulary). Count totals per status. If every test is already resolved (no `- [ ] Pass`, `[FAIL]`, or `[FIXING]`), skip straight to **Closure**.

---

## Step 2 — Prerequisites

For each unchecked prerequisite: if it is a **runnable check** (server on a port, DB migrated, file exists), verify with one deterministic command — one Bash call per prerequisite (`curl`, `pg_isready`, port probe, file test). If it is **descriptive only** ("test data loaded"), it is **unverifiable** — never assume it holds.

**Mode differences (prerequisites):**
- **uat-walk** — after auto-checking, present all prerequisites at once grouped as **auto-verified ✅** and **needs-confirmation ❓** (unverifiable or failed). If all auto-verify, note it in one line and proceed without asking. Otherwise ask the user to confirm the ❓ ones; a failed prerequisite is a warning, the user decides whether to continue.
- **uat-auto** — hard gate: any prerequisite that fails or is unverifiable aborts the run. Mark every untested test `[FAIL: auto-judge: prerequisite not satisfied — <which>]` and go to Closure.
- **uat-auto-plus** — attempt **one** autonomous repair per failing runnable prerequisite (start the dev server in a background Bash call + `Monitor` for ready; run the migrate command; run the seed command; obtain a missing env var only if `.env.test` or equivalent documents how). Re-verify. If it still fails after one repair, apply the uat-auto hard gate. Track background processes started here — Closure terminates them.

---

## Step 3 — Classify tests

| Type | Signal |
|------|--------|
| **API/CLI** | contains `curl`/`http`/`wget` or a shell code block in Steps/Expected, **or** has an `Endpoint:` field |
| **UI** | `UAT-UI-*` prefix, or `Page:` / `Components:` metadata |
| **Manual** | anything else (edge cases, concurrency, integration logic) |

---

## Step 3.5 — Stub detection (headless modes only)

**uat-auto / uat-auto-plus only.** `/uat-walk` skips this — a human evaluates each test regardless. Run this gate for every eligible test **before** executing any (classify all in Step 3, then sweep, then execute non-stubs).

A stub test **stays `- [ ] Pass`** — do not execute it, do not record `[FAIL]`, do not enter the fix loop (implementing a feature from scratch is out of scope). Surface it in the summary.

1. **Target** — API/CLI: `Endpoint:` or URL in `**Command**:`; UI: `Page:`/`Components:`; Manual: feature name from `Description`.
2. **Locate** the implementation via `mcp__serena__search_for_pattern` across `src/`/`app/`/`lib/`. If nothing is found, treat as **unlocatable** → run the test normally (cannot confirm stub).
3. **Stub indicators** (via `find_symbol` / `search_for_pattern`): `TODO`/`FIXME`/`HACK` inside a body; `throw new Error('not implemented')`, `raise NotImplementedError`, `notImplemented()`, `unimplemented!()`; a bare `pass` / `pass # TODO|stub`; empty body (`{}`, `return`, `return null|undefined|None`); placeholder comments (`// stub`, `# TODO: implement`, etc.).
4. **Found** → leave status untouched, record `stub-detected` (with file + indicator) in run tracking, skip execution. **Not found / unlocatable** → proceed to Step 4.

---

## Step 4 — Execute & judge

Work through eligible tests in document order; update the file immediately after each verdict (Step 5).

**Eligibility (headless modes):** default is **pending + previously-failed** — every `- [ ] Pass` or `[FAIL: ...]` test. Reset `[FAIL: ...]` (and, in auto-plus, `[FIXING: ...]`) to `- [ ] Pass` before running so a fresh verdict is recorded. Leave `[x] Pass` and `[SKIP: ...]` untouched. `/uat-walk` selects tests by its own mode prompt instead (see its SKILL.md).

### Auto-judge criteria (uat-auto / uat-auto-plus)

**API/CLI** — extract the command from `**Command**:`. No extractable command → `[FAIL: auto-judge: no machine-executable command in test body]`. Pass requires **ALL**:
1. Command exited cleanly (response returned; no connection error).
2. HTTP status matches the Expected section's explicit status; if none specified, any 2xx is pass-eligible on status alone.
3. Response body satisfies **every** machine-checkable assertion in Expected (literal substring, JSON key presence, JSON value equality, array length, type-of) — via `jq` or substring match.
4. If the test references `$UAT_AUTH_TOKEN`, the token must be present in the environment.

Any criterion fails → `[FAIL: auto-judge: <criterion, actual vs expected>]`. Expected section with no machine-checkable assertion → `[FAIL: auto-judge: expected section not machine-verifiable]`.

**UI** → always `[FAIL: auto-judge: UI test requires human verification — use /uat-walk]`. No navigation, screenshot, or browser interaction.

**Manual** → always `[FAIL: auto-judge: manual test requires human verification]`. No heuristic evaluation. Intentional fail-closed: `/uat-generate` produced a manual test because it expected a human.

`/uat-walk` does not auto-judge — the user issues every verdict. `/uat-auto-plus` enters its fix loop after an API/CLI `[FAIL]` (never for UI/Manual — no machine-checkable signal that a fix worked).

### Bash hygiene — API/CLI tests (all modes)

**One program invocation per Bash call: one `curl` (as-is), optionally one `\| jq` stage. Nothing else.** If a generated `**Command**:` block violates this, rewrite it to the clean form before running (canonical style: `lib/skills/uat-generate/SKILL.md` "Curl command standards"). Never emit literal password/token values — only `"$UAT_AUTH_TOKEN"` / `"$UAT_TEST_PASSWORD"` references.

Forbidden (each triggers an approval prompt and obscures output): multiple `curl`s in one call · `&&` / `;` / `\|\|` chaining · `echo` banners · `-w` format strings · `-o /tmp/...` then re-read · defensive flags (`--max-time`) · pre-assigned `TOKEN=...` vars · `\` line-continuations · piping to `head`/`tee`/redirection. Capture per test: HTTP status, response body (truncate display to ~50 lines; never write a temp file to read it back), connection errors.

---

## Step 5 — Update the file per verdict

Use the **`Edit`** tool — **one `Edit` call per status line**, even when many flip in a row. **Never** `sed`, `awk`, `perl -i`, or `echo` to flip a marker (each triggers an approval prompt; see `.docs/guides/mcp-tools.md` "Common anti-patterns"). Replace only the status line with the appropriate marker + `<!-- YYYY-MM-DD -->`. Do not modify any other part of the test block — preserve all metadata, headings, and whitespace exactly.

---

## Closure — completion & file movement

Runs once no test has a blocking status. Two outcomes.

### All pass (no `[FAIL]` / `[FIXING]` remain)

1. **UAT status** — Edit `status:` → `passed`; bump `updated:` in the UAT frontmatter.
2. **Task status** — read `task:` from the UAT frontmatter → open `wiki/work/tasks/TASK-NNN-slug.md`, Edit `status:` → `done`; bump `updated:`. (Expected prior status is `pending-uat`, set by `/tackle` when it finished implementation — but flip to `done` regardless of what's there now.)
3. **Remove index rows** — delete the UAT row from `wiki/work/uat/index.md` and the task row from `wiki/work/tasks/index.md` (one `Edit` per file).
4. **Archive both** (`git mv` via Bash; index appends via `Edit`):
   - `git mv wiki/work/uat/<UAT>.md wiki/work/uat/archive/` → append `| [[UAT-NNN]] | Title | passed | YYYY-MM-DD |` to `wiki/work/uat/archive/index.md`
   - `git mv wiki/work/tasks/<TASK>.md wiki/work/tasks/archive/` → append `| [[TASK-NNN]] | Title | done | YYYY-MM-DD |` to `wiki/work/tasks/archive/index.md`
5. **Roadmap auto-checkoff** — scan `wiki/work/roadmaps/` for `status: active` files. For each: Edit `- [ ] [[TASK-NNN` → `- [x] [[TASK-NNN`; then sweep remaining `- [ ]` free-text lines, checking the ones the completing task clearly accomplished (leave uncertain ones). If all items are now `[x]`: flip roadmap `status: done`, bump `updated:`, remove its row from `wiki/work/roadmaps/index.md`, `git mv` it to `archive/`, and append `| [[ROADMAP-NNN]] | Title | done | YYYY-MM-DD |` to `wiki/work/roadmaps/archive/index.md`. Silent no-op if no roadmap references the task. `Edit` only (except `git mv`).
6. **Decision annotation** — check the task body for `implements::[[DEC-NNNN#DM]]`. If found: open `wiki/work/decisions/NNNN-slug.md`, append `— implemented YYYY-MM-DD` to this task's `Source task(s):` line. Then check `wiki/work/tasks/` **and** `tasks/archive/` for other `todo|in-progress` tasks with the same `implements::[[DEC-NNNN#DM]]`; if none remain, append `— decision fully implemented YYYY-MM-DD` on a new line in the `## DM.` block. Sweep remaining `- [ ]` items in that block, checking the ones this task accomplished. `Read` then `Edit` only — never `sed`.
7. **Log entry** — append to `wiki/log.md`:
   ```
   ## [YYYY-MM-DD] uat | UAT-NNN passed<MODE-TAG> · TASK-NNN done
   Archived UAT-NNN → uat/archive/ and TASK-NNN → tasks/archive/. [one sentence on what was verified]
   ```
   `<MODE-TAG>`: walk → none · auto → ` (auto)` · auto-plus → ` (auto-plus)`.
8. Emit the completion summary (task + UAT IDs, new `done`/`passed` statuses, archive paths).

**Mode differences (all-pass closure):**
- **uat-auto-plus** additionally: delete this task's screenshots (`mcp__serena__list_dir` `wiki/work/uat/screenshots/` for `<task-number>-*`, then `git rm` / `rm`); **terminate every background process** it started (prerequisites + fix attempts — KillShell as needed; verify none remain). Its decision-annotation step supports multi-task WIP tracking: with other WIP tasks remaining, set only this task's sub-line to `**done** YYYY-MM-DD`; when none remain, flip `**WIP**` → `**done** YYYY-MM-DD` and append `- **Decision fully implemented** YYYY-MM-DD`.
- **uat-auto** keeps screenshots (diagnostic evidence).

### Any fail (`[FAIL]` markers remain)

Leave the UAT file in `wiki/work/uat/` (status stays `pending`/`in-progress`). Keep screenshots — diagnostic evidence for the next walkthrough. Emit the summary. **Headless modes exit 0** — an orchestrator treats the skill exiting as its task done; the pipeline decides what to do with the fail markers. **uat-auto-plus** also terminates all background processes before exit.
