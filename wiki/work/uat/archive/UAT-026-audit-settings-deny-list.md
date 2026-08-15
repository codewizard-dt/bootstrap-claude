---
id: UAT-026
aliases: [UAT-026]
title: "UAT: Audit and harden the canonical settings deny list"
status: passed
task: TASK-026
created: 2026-07-29
updated: 2026-07-29
---

# UAT-026 — UAT: Audit and harden the canonical settings deny list

implements::[[TASK-026]]

> **Source task**: [[TASK-026]]
> **Generated**: 2026-07-29

---

## Prerequisites

- [ ] Repo checked out at `/Users/davidtaylor/Repositories/bootstrap-claude`; `lib/scripts/templates/settings-deny.json` holds the post-TASK-026 list (**116** entries — was 118 until `Edit(~/.claude/settings.json)` and `Edit(~/.claude/settings.local.json)` were removed on 2026-07-29 so TASK-027's settings-guard hook can carve out a bootstrap-claude exception, which a deny rule cannot express).
- [ ] `node` (v18+, for `node:test`) and the `claude` CLI on `PATH`.
- [ ] Scratch root exported once per session — every test writes only here:
  ```bash
  export UAT026=$(mktemp -d /tmp/uat-026-XXXXXX)
  ```
- [ ] **The canonical rules are NOT assumed to be installed in `~/.claude/settings.json`, and this UAT must not install them.** Every runtime test builds its own throwaway project with a project-scoped `.claude/settings.json`. Do **not** run `install-global.sh`, `bootstrap install/setup/update`, or `merge-settings-deny.js` without `--target` pointing inside `$UAT026`.
  **Why:** `merge-settings-deny.js` is additive-only with no removal path — anything merged into your real global settings is permanent short of hand-editing the file. Rules under test here are not yet approved for your machine.
- [ ] `git status` is clean enough that `git show HEAD:lib/scripts/templates/settings-deny.json` still resolves to the pre-TASK-026 36-entry list, **or** the frozen baseline in `test/settings-deny.test.js` is used instead (it does not depend on git state).

---

## Test Cases

### UAT-DENY-001: `echo hi | sh` — does Claude Code decompose a pipeline and match each subcommand independently?

**This is the decisive test of the whole task.** Ten entries (`Bash(sh)`, `Bash(bash)`, `Bash(zsh)`, `Bash(sh -s*)`, `Bash(bash -s*)`, `Bash(python)`, `Bash(python3)`, `Bash(node)`, `Bash(ruby)`, `Bash(perl)`) exist only to match the **second** subcommand of a `curl … | sh` pipeline. No primary source was found showing a literal `Bash(sh)` blocking a literal `… | sh`; the approval was a deduction from Claude Code emitting per-subcommand allow rules. This test settles it by observation.

- **Scenario**: A pipeline whose sink interpreter is denied, run in a project where only `Bash(sh)` is denied. `bash` is left permitted in the same project as a positive control, so a "nothing happened" result cannot be mistaken for a block.
- **Repeatable Unit Test**: Not applicable: requires a live Claude Code permission-matcher decision; no in-process API exposes the matcher.
- **Steps**:
  1. Build the scratch project and its project-scoped deny list:
     ```bash
     mkdir -p "$UAT026/decomp/.claude" && printf '{\n  "permissions": {\n    "deny": ["Bash(sh)"]\n  }\n}\n' > "$UAT026/decomp/.claude/settings.json"
     ```
  2. Run the **treatment** (denied sink, `sh`):
     ```bash
     cd "$UAT026/decomp" && claude -p "Using the Bash tool, run this command verbatim exactly once and then report the tool result: echo \"touch $UAT026/marker-sh\" | sh" --dangerously-skip-permissions
     ```
  3. Run the **control** (permitted sink, `bash` — not in this project's deny list):
     ```bash
     cd "$UAT026/decomp" && claude -p "Using the Bash tool, run this command verbatim exactly once and then report the tool result: echo \"touch $UAT026/marker-bash\" | bash" --dangerously-skip-permissions
     ```
  4. Read the verdict off the filesystem, not off Claude's prose:
     ```bash
     ls -1 "$UAT026" | grep -E '^marker-(sh|bash)$'
     ```
- **Expected Result** — record which of the four branches occurred:
  - **PASS (expected)** — `marker-bash` exists, `marker-sh` does **not**. Claude Code split the pipeline and matched `sh` as its own subcommand against `Bash(sh)`. The 10 bare-interpreter entries are validated and stay in the list. Note that `--dangerously-skip-permissions` was in effect, which additionally re-confirms deny is enforced under `bypassPermissions`.
  - **FAIL** — **both** `marker-sh` and `marker-bash` exist. The pipe sink is not matched separately. **Required remediation:** remove all 10 bare-interpreter entries from `lib/scripts/templates/settings-deny.json` (they are dead weight that gives false confidence, and the additive-only merge means every day they ship is another install that can never remove them), and route fetch-and-execute coverage entirely to the TASK-027 Tier-2 PreToolUse hook. The 4 process-substitution entries (`Bash(bash <*)` etc.) are unaffected — they contain no separator and do not depend on decomposition.
  - **INCONCLUSIVE** — `marker-bash` is also missing. Claude declined to run the command or reworded it; the control failed, so the treatment proves nothing. Re-run, or run the two commands from an interactive session in `$UAT026/decomp`.
  - **INCONCLUSIVE** — `marker-sh` exists but `marker-bash` does not. Contradictory; re-run both.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-DENY-002: does the two-token `:*` prefix `Bash(git stash:*)` emit a startup warning?

Claude Code's docs only ever exemplify `:*` after a **single** token (`Bash(ls:*)`). Four pre-existing entries use a two-token prefix — `Bash(git stash:*)`, `Bash(git restore:*)`, `Bash(git switch:*)`, `Bash(git checkout:*)`. The Step 2 audit concluded they match, with the residual doubt deferred here. Because they cannot be restyled (additive merge, no removal path), a negative result needs an added sibling rule, not an edit.

- **Scenario**: Start a session whose project deny list contains the two-token `:*` rule alongside a rule that is **known** to warn, so an absence of warnings can be distinguished from an unobservable warning channel.
- **Repeatable Unit Test**: Not applicable: asserts Claude Code CLI startup diagnostics, not repo code.
- **Steps**:
  1. Build the scratch project. `Write(~/uat-026-never-consulted.txt)` is the positive control — `Write(...)` path rules are accepted but never consulted and are documented to warn at startup:
     ```bash
     mkdir -p "$UAT026/warn/.claude" && printf '{\n  "permissions": {\n    "deny": ["Bash(git stash:*)", "Write(~/uat-026-never-consulted.txt)"]\n  }\n}\n' > "$UAT026/warn/.claude/settings.json"
     ```
  2. Start a session and capture both streams:
     ```bash
     cd "$UAT026/warn" && claude --debug -p 'Reply with the single word OK.' > "$UAT026/warn-out.txt" 2> "$UAT026/warn-err.txt"
     ```
  3. Inspect for warnings naming either rule:
     ```bash
     grep -inE 'warn|invalid|unrecognized|never consulted|git stash|Write\(' "$UAT026/warn-out.txt" "$UAT026/warn-err.txt"
     ```
- **Expected Result** — record which branch occurred:
  - **PASS (expected)** — a warning naming the `Write(...)` control appears, and **no** warning names `Bash(git stash:*)`. The warning channel is demonstrably observable, and the two-token `:*` form is accepted. The Step 2 residual uncertainty is closed; the four `git …:*` entries match as assumed.
  - **FAIL** — a warning names `Bash(git stash:*)` (or the `git …:*` form generally). The four entries do not match as assumed and the git working-tree protections are illusory. **Required remediation:** do not edit or remove them (installed users would keep both strings forever); **append** space-star siblings — `Bash(git stash *)`, `Bash(git restore *)`, `Bash(git switch *)`, `Bash(git checkout *)` — and file a bug noting the existing four are inert.
  - **INCONCLUSIVE** — neither warning appears. The control did not fire, so the channel is not observable under `-p`; absence of a `git stash` warning proves nothing. Re-run interactively (`cd "$UAT026/warn" && claude`) and read the startup banner, or run `/doctor`.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-MERGE-001: merge appends canonical entries without disturbing existing user content

- **Scenario**: `merge-settings-deny.js` run against a scratch settings file that already holds a user rule, an unrelated `permissions.allow` list, and unrelated top-level keys.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`merge appends canonical entries and preserves user entries, order, and other keys`)
- **Steps**:
  1. Seed a scratch target that is deliberately *not* `~/.claude/settings.json`:
     ```bash
     printf '{\n  "model": "opusplan",\n  "permissions": {\n    "allow": ["Bash(ls:*)"],\n    "deny": ["Bash(my-own-rule *)", "Bash(sudo *)"]\n  },\n  "env": { "FOO": "bar" }\n}\n' > "$UAT026/settings.json"
     ```
  2. Run the merge against it:
     ```bash
     node lib/scripts/merge-settings-deny.js --target "$UAT026/settings.json" --source lib/scripts/templates/settings-deny.json
     ```
  3. Inspect the result:
     ```bash
     node -e 'const s=require(process.env.UAT026+"/settings.json");const d=s.permissions.deny;console.log({model:s.model,env:s.env,allow:s.permissions.allow,first2:d.slice(0,2),total:d.length,dupes:d.length-new Set(d).size,sudoCount:d.filter(x=>x==="Bash(sudo *)").length})'
     ```
- **Expected Result**: `model` is still `"opusplan"`, `env` is still `{"FOO":"bar"}`, `allow` is still `["Bash(ls:*)"]`. `first2` is `["Bash(my-own-rule *)","Bash(sudo *)"]` — user entries kept, in their original positions, at the front. `total` is `117` (116 canonical + the 1 user-only rule). `dupes` is `0`, and `sudoCount` is `1` — the canonical `Bash(sudo *)` was recognised as already present and not re-appended. Nothing was removed or reordered. The file parses as valid JSON.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-MERGE-002: re-running the merge is idempotent

The additive-only design is only safe if repeat installs (`bootstrap install` / `setup` / `update` all call it) never accumulate duplicates.

- **Scenario**: A second merge pass over an already-merged target.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`merge is idempotent — a second run adds nothing and creates no duplicates`)
- **Steps**:
  1. Snapshot the already-merged file from UAT-MERGE-001:
     ```bash
     cp "$UAT026/settings.json" "$UAT026/settings.before.json"
     ```
  2. Run the merge a second time:
     ```bash
     node lib/scripts/merge-settings-deny.js --target "$UAT026/settings.json" --source lib/scripts/templates/settings-deny.json
     ```
  3. Diff:
     ```bash
     diff "$UAT026/settings.before.json" "$UAT026/settings.json"
     ```
- **Expected Result**: The script prints `settings.json: deny list already up to date` and prints no `+ <entry>` lines. `diff` produces no output — the file is byte-identical, not merely equivalent. Entry count stays at 117 with zero duplicates.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-MERGE-003: merge creates a valid settings file when the target does not exist

- **Scenario**: First-ever install on a machine with no `settings.json`, including a missing parent directory.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`merge creates a valid settings file when the target does not exist`)
- **Steps**:
  1. Merge into a path that does not exist:
     ```bash
     node lib/scripts/merge-settings-deny.js --target "$UAT026/fresh/nested/settings.json" --source lib/scripts/templates/settings-deny.json
     ```
  2. Verify shape and count:
     ```bash
     node -e 'const s=require(process.env.UAT026+"/fresh/nested/settings.json");console.log({total:s.permissions.deny.length,allStrings:s.permissions.deny.every(e=>typeof e==="string")})'
     ```
- **Expected Result**: The script prints `settings.json: created with 116 deny entries`. The parent directories are created. The file is valid JSON, `total` is `116`, `allStrings` is `true`, and `permissions.deny` matches the canonical template exactly in content and order.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-MERGE-004: a malformed target is left untouched and the install is not aborted

The script runs under `set -euo pipefail` in `install-global.sh`; a settings merge must never take down an install.

- **Scenario**: Target file exists but is not parseable JSON.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`merge leaves a malformed target untouched and still exits 0`, `merge skips when permissions.deny is not an array, leaving the file untouched`)
- **Steps**:
  1. Write garbage to a scratch target:
     ```bash
     printf '{ this is not json ' > "$UAT026/broken.json"
     ```
  2. Run the merge and capture the exit status:
     ```bash
     node lib/scripts/merge-settings-deny.js --target "$UAT026/broken.json" --source lib/scripts/templates/settings-deny.json; echo "exit=$?"
     ```
  3. Confirm the file was not rewritten:
     ```bash
     cat "$UAT026/broken.json"
     ```
- **Expected Result**: A `Warning: could not parse … (file untouched) — skipping deny-list merge` message on stderr, `exit=0`, and the file still contains exactly `{ this is not json ` with no trailing newline added and no `.tmp-<pid>` file left behind in `$UAT026`.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-FILE-001: the 36 pre-existing entries are byte-identical and still at indices 0–35

This is the constraint that protects already-installed users. `merge-settings-deny.js` dedups by exact string with no removal path, so restyling any legacy entry (e.g. `Bash(git stash:*)` → `Bash(git stash *)`) would leave every existing install holding **both** strings permanently.

- **Scenario**: Diff the current template's first 36 entries against the pre-TASK-026 list.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`the 36 legacy entries are byte-identical and still at indices 0-35`) — uses a frozen in-test baseline, so it keeps working after the change is committed.
- **Steps**:
  1. Compare against git HEAD (valid only while the change is uncommitted):
     ```bash
     diff <(git show HEAD:lib/scripts/templates/settings-deny.json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>JSON.parse(d).forEach(e=>console.log(e)))') <(node -e 'require("./lib/scripts/templates/settings-deny.json").slice(0,36).forEach(e=>console.log(e))')
     ```
  2. Confirm the additions come *after*, not interleaved:
     ```bash
     node -e 'const a=require("./lib/scripts/templates/settings-deny.json");console.log({total:a.length,added:a.length-36,firstAdded:a[36],lastLegacy:a[35]})'
     ```
- **Expected Result**: `diff` produces no output — all 36 legacy entries are byte-identical, in their original order, occupying indices 0–35. `total` is `116`, `added` is `80`, `lastLegacy` is `Bash(chmod 777 *)`, and `firstAdded` is `Edit(~/.claude/hooks/**)` (the two `~/.claude/settings*.json` entries that originally led the additions were removed on 2026-07-29 — see the prerequisites). No legacy entry was edited, removed, reordered, or restyled.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-FILE-002: zero `Write(...)` rules, and the tool composition is 93 Bash / 11 Edit / 12 Read

`Write(...)` path rules are accepted by the settings parser but **never consulted** — authoring one is a silent no-op that reads like protection. The list must contain none.

- **Scenario**: Static inspection of the shipped template.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`zero Write(...) rules …`, `tool composition is 93 Bash / 11 Edit / 12 Read, 116 total`, `file-tool rules anchor at ~/ or **/ …`)
- **Steps**:
  1. ```bash
     node -e 'const a=require("./lib/scripts/templates/settings-deny.json");const c=p=>a.filter(e=>e.startsWith(p)).length;console.log({total:a.length,Bash:c("Bash("),Edit:c("Edit("),Read:c("Read("),Write:c("Write("),PowerShell:c("PowerShell("),other:a.filter(e=>!/^(Bash|Edit|Read)\(/.test(e))})'
     ```
  2. Confirm no file-tool rule uses a bare single leading slash (which would anchor under `~/.claude/`, not the filesystem root):
     ```bash
     node -e 'console.log(require("./lib/scripts/templates/settings-deny.json").filter(e=>/^(Edit|Read)\(\/[^\/]/.test(e)))'
     ```
- **Expected Result**: Step 1 prints `{total:116, Bash:93, Edit:11, Read:12, Write:0, PowerShell:0, other:[]}` — zero `Write(...)` rules, zero `PowerShell(...)` mirrors (deliberately excluded from the approved set), and no entry using any other tool prefix. Step 2 prints `[]` — every file-tool rule anchors with `~/` or `**/`.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-FILE-003: no duplicate entries across all 116, and the file is a valid JSON array of strings

- **Scenario**: Static inspection. `merge-settings-deny.js` refuses to merge anything that is not an array of strings, so a malformed template silently disables the whole feature.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`template is a JSON array of strings`, `no duplicate entries`)
- **Steps**:
  1. ```bash
     node -e 'const a=require("./lib/scripts/templates/settings-deny.json");const s=new Set();const d=[];for(const e of a){if(s.has(e))d.push(e);s.add(e)}console.log({isArray:Array.isArray(a),allStrings:a.every(e=>typeof e==="string"),duplicates:d})'
     ```
- **Expected Result**: `{isArray:true, allStrings:true, duplicates:[]}`. A duplicate would be permanently unfixable for existing installs, since the merge never removes anything.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-REG-001: the new rules do not block this repo's own workflows

The bare-interpreter entries (`Bash(sh)`, `Bash(bash)`, `Bash(python3)`, `Bash(node)`, …) carry **no wildcard**, so they should match only the exact bare command. If Claude Code prefix-matches them instead, this repo's own gates break: `/tackle` mandates `bash -n <script>` as its static gate. A deny list that breaks the bootstrap it ships with is a regression.

- **Scenario**: A scratch project carrying the **full** 116-entry canonical list at project scope, in which each workflow command is attempted.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`bare-interpreter rules carry no wildcard, so they cannot prefix-match real invocations`) — the static half. The live permission-matcher half below is not unit-testable.
- **Steps**:
  1. Build a scratch project holding the full canonical list plus two harmless fixtures:
     ```bash
     mkdir -p "$UAT026/reg/.claude" && node -e 'const fs=require("fs");const d=process.env.UAT026+"/reg";fs.writeFileSync(d+"/.claude/settings.json",JSON.stringify({permissions:{deny:require(process.cwd()+"/lib/scripts/templates/settings-deny.json")}},null,2)+"\n");fs.writeFileSync(d+"/hello.js","console.log(\"node-ok\");\n");fs.writeFileSync(d+"/probe.sh","#!/usr/bin/env bash\necho bash-ok\n")'
     ```
  2. Attempt every command in one session and have each result reported:
     ```bash
     cd "$UAT026/reg" && claude -p 'Using the Bash tool, run each of these five commands verbatim as separate tool calls, and then report for each one whether it executed or was blocked by a permission rule: (1) bash -n probe.sh  (2) node hello.js  (3) python3 -m site  (4) npm install -g @playwright/mcp@latest --dry-run  (5) git status' --dangerously-skip-permissions
     ```
- **Expected Result**: All five execute; none is refused by a permission rule.
  - `bash -n probe.sh` succeeds silently (exit 0) — `Bash(bash)` did not prefix-match. This is the `/tackle` static gate (`tackle/SKILL.md:98`).
  - `node hello.js` prints `node-ok` — `Bash(node)` did not prefix-match, and `Bash(node <*)` did not match a plain argument.
  - `python3 -m site` prints site paths — `Bash(python3)` did not prefix-match.
  - `npm install -g @playwright/mcp@latest --dry-run` completes — no installer rules were shipped, so `install-mcps.sh:197` is unaffected. (`--dry-run` keeps the test side-effect-free; the prefix under test is identical.)
  - `git status` succeeds — the `git …:*` entries did not over-match ordinary read-only git.
  - **Any blocked command is a FAIL**: the offending entry must be narrowed or removed *before* the list ships, because once merged it cannot be removed from existing installs.
  - `uvx --from git+https://github.com/oraios/serena` (`bootstrap-serena.sh:35`) is verified statically by UAT-REG-002 rather than executed here — no `uvx` rule exists to match it, and running it would pull a multi-megabyte download.
- [x] Pass <!-- 2026-07-29 -->
  <!-- Run note 2026-07-29: on the first pass `git status` exited 128 (`fatal: not a git repository`) because step 1 does not `git init` the fixture — an artifact of the fixture, not a permission block. Re-run after `git init` in the same project with the full 116-entry list: exit 0, not blocked. Consider adding `git init -q` to step 1's fixture setup. -->


---

### UAT-REG-002: no fetcher or package-installer rules were shipped

Restricting general internet access was an explicit non-goal. `curl` is also the mandated verification primitive for every API UAT this repo generates, and `uvx --from git+…` is load-bearing for Serena bootstrap — deny rules cannot carry allowlist exceptions, so the only safe form is no rule at all.

- **Scenario**: Static inspection of the shipped template.
- **Repeatable Unit Test**: Created: `test/settings-deny.test.js` (`no fetcher or package-installer rules — restricting internet access is an explicit non-goal`)
- **Steps**:
  1. ```bash
     node -e 'const a=require("./lib/scripts/templates/settings-deny.json");console.log(a.filter(e=>e.startsWith("Bash(")&&/\b(curl|wget|uvx|npx|pip3?\s+install|npm\s+install|cargo\s+install|docker)\b/.test(e)))'
     ```
  2. Confirm no pipeline-literal rule was shipped — a subcommand never contains its own separator, so `Bash(curl * | sh*)` would be dead and would ship silently (there is no startup warning for unenforceable Bash command patterns):
     ```bash
     node -e 'console.log(require("./lib/scripts/templates/settings-deny.json").filter(e=>e.startsWith("Bash(")&&/[|;]|&&/.test(e)))'
     ```
- **Expected Result**: Both commands print `[]`. `Read(~/.docker/config.json)` exists and is correct — it is a credential-store read rule, not a docker command rule, so restricting the filter to `Bash(` entries is deliberate.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-DOC-001: `lib/hooks/README.md` no longer claims deny rules are unenforced under `bypassPermissions`

The old text gave "deny is not consulted under bypass" as the rationale for the entire hooks directory. That claim is false, and it made the deny list look worthless in exactly the mode this repo uses for `/uat-auto-plus` and `power-mode`.

- **Scenario**: Documentation review of the two corrected passages.
- **Repeatable Unit Test**: Not applicable: prose assertion; a substring test would be brittle and would not catch a correct-but-misleading rewrite.
- **Steps**:
  1. Read `lib/hooks/README.md` lines 11–28 and 309–326.
  2. Search for any surviving false claim:
     ```bash
     grep -nE 'not (consulted|enforced)|bypass' lib/hooks/README.md
     ```
- **Expected Result**: The "Why hooks (vs. allow/deny permission rules)" section states that the deny list **is** enforced in every mode including `bypassPermissions` and for subagent calls, and gives the true, mode-independent rationale: a deny rule matches a literal command spelling while a hook parses the command (so `/bin/rm`, `bash -c`, `python -c` slip past patterns), and a hook can return an explanatory message that a deny rule cannot. No occurrence of "not consulted" or "not enforced" remains as a claim about deny under bypass. The closing section (~line 318) carries the two accurate caveats — literal-spelling matching, and that deny cannot carry allowlist exceptions.
- [x] Pass <!-- 2026-07-29 -->

---

### UAT-DOC-002: `lib/scripts/README.md`'s deny-list notes match what actually shipped

**This test was rewritten on 2026-07-29** after `Edit(~/.claude/settings.json)` and `Edit(~/.claude/settings.local.json)` were removed from the list. The `## Deny-list notes` section was written while those entries were still in, so it documents a `/update-config` trade-off that **no longer exists**. Stale documentation of a security control is worse than none — it tells users they are protected where they are not.

- **Scenario**: Documentation review against the shipped 116-entry list.
- **Repeatable Unit Test**: Not applicable: prose assertion, human review.
- **Steps**:
  1. Read the `## Deny-list notes` section of `lib/scripts/README.md`.
  2. Confirm no stale claim about global settings being locked:
     ```bash
     grep -nE 'update-config|unoverridable|hand-edit|settings\.json' lib/scripts/README.md
     ```
  3. Confirm the template really has no settings-lock entry:
     ```bash
     node -e 'console.log(require("./lib/scripts/templates/settings-deny.json").filter(e=>e.includes(".claude/settings")))'
     ```
- **Expected Result**: Step 3 prints `[]`. The prose contains **no** claim that `/update-config` is blocked on global settings, and **no** instruction to hand-edit `~/.claude/settings.json` as an escape hatch — both describe a rule that was removed. The section should instead state that `~/.claude/settings.json` protection moved to TASK-027's `claude-settings-guard.js` hook, which blocks edits outside a bootstrap-claude checkout and allows them inside one — an exception a deny rule cannot express, since deny beats allow at every scope and a hook cannot loosen a deny. The section's still-valid content must remain: `Write(...)` rules are never consulted and must never be authored; a `Read` deny also blocks `Edit` on the same path; deny rules carry no allowlist exceptions (`git stash list`, `crontab -l` are the concrete costs); deny is enforced in every mode including `bypassPermissions`.
- **If this fails** (the prose still describes the removed lock): fix `lib/scripts/README.md` before shipping. `Edit(~/.claude/hooks/**)` and `Edit(**/.claude/hooks/**)` **do** remain in the list and their documentation stays accurate — do not delete those.
- [x] Pass <!-- 2026-07-29 -->
  <!-- Run note 2026-07-29: the `## Deny-list notes` section (lines 53-107) meets every stated criterion. Nit OUTSIDE the scoped section, left unfixed by uat-auto: the file-index table at line 51 still describes the file-tool patterns as "protecting Claude Code's own settings and hooks" — only hooks remain protected by deny; settings moved to the hook. Not one of the two disqualifying claims this test names, so not a FAIL, but worth a one-word edit ("hooks") before shipping. -->


---

## Notes on scope

- `permissions.ask` package-consent (TASK-026 step 4 follow-on) and the Tier-2 PreToolUse hooks ([[TASK-027]]) are **not** covered here — neither is implemented yet.
- The 34 `PowerShell(...)` mirrors were excluded from the approved set; UAT-FILE-002 asserts their absence rather than their behavior.
- Clean up when finished: `rm -rf "$UAT026"`.
