---
id: UAT-043
title: "UAT: Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY"
status: passed
task: TASK-043
created: 2026-08-06
updated: 2026-08-06
---

# UAT-043 — UAT: Sticky prompt helpers in lib.sh — prompt_yn_sticky, prompt_choice_sticky, BOOTSTRAP_ASSUME_TTY

implements::[[TASK-043]]

> **Source task**: [[TASK-043]]
> **Generated**: 2026-08-06

---

## Scope note

TASK-043 adds no call sites — it adds the choke point every other Phase 2 task
calls. So this UAT verifies the **helper contract** in `lib/scripts/lib.sh`, not
any installer flow (TASK-044/045/046 own those). There is no UI and no HTTP
surface here; every case is a shell-runtime or integration check.

**Hermeticity rule, non-negotiable.** No test may read or write the real
`~/.claude/bootstrap-prefs.json`. Every command below creates its own
`mktemp -d`, redirects `HOME` into it, and prints the helper's own resolved
layer paths as the first line of output so a failed redirect is visible *before*
any write. If that first `Layers:` line does not point inside `/var/folders/…`
or `/tmp/…`, stop and fail the run.

**Two known testing artifacts — NOT product defects.** (1) `read -r -p` writes
its prompt to the terminal, not to a pipe, so asserting on prompt *text* over
piped stdin is vacuous — these tests assert on answers and on store state
instead. (2) Under `BOOTSTRAP_ASSUME_TTY=1` with stdin at EOF, `read` returns
empty and the sticky helper records the declared default; that is a real
interactive ask that hit EOF, unreachable at a genuine tty.

---

## Prerequisites

- [ ] Repo at `/Users/davidtaylor/Repositories/bootstrap-claude`, `node` and `bash` on `PATH`
- [ ] `lib/scripts/bootstrap-prefs.js` and `lib/scripts/templates/bootstrap-prefs-schema.json` present (sibling resolution of `BOOTSTRAP_PREFS_JS` depends on it)
- [ ] `npm test` green at the 245-test baseline before starting

---

## Test Cases

### UAT-INT-001: bash 3.2 constraint holds — every script parses, no bash-4 constructs
- **Description**: `lib.sh` grew from 206 to 657 lines. Its hard constraint is macOS default bash 3.2: no `local -n`, no `declare -A`, no `${var,,}`. A bash-4 construct would parse fine on the dev machine and fail only on a user's Mac.
- **Steps**:
  1. Run the command below as-is.
  2. Expect every shell file to parse and the construct scan to report clean.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude
  fail=0
  for f in lib/scripts/*.sh lib/scripts/templates/*.sh; do
    bash -n "$f" || { echo "SYNTAX FAIL: $f"; fail=1; }
  done
  echo "bash -n: all lib/scripts shell files parsed"
  node -e '
  const fs=require("fs");
  const code=fs.readFileSync("lib/scripts/lib.sh","utf8").split("\n").filter(l=>!/^\s*#/.test(l)).join("\n");
  const bad=[[/local\s+-n\s/,"local -n nameref"],[/declare\s+-A\s/,"associative array"],[/\$\{[A-Za-z_][A-Za-z0-9_]*,,\}/,"${var,,} lowercasing"]];
  let hits=0;
  for(const [re,label] of bad){ if(re.test(code)){ console.log("BASH4 CONSTRUCT FOUND: "+label); hits++; } }
  console.log(hits===0?"NO BASH4 CONSTRUCTS IN lib.sh CODE":"BASH 3.2 VIOLATION");
  process.exit(hits===0?0:1);
  ' || fail=1
  echo "syntax-gate-exit=$fail"
  ```
- **Expected Result**: `bash -n: all lib/scripts shell files parsed`, then `NO BASH4 CONSTRUCTS IN lib.sh CODE`, then `syntax-gate-exit=0`. No `SYNTAX FAIL` line. (The comment strip is required — the constraint banner itself names all three forbidden constructs.)
- **Repeatable Unit Test**: Not applicable: a syntax/portability gate over shell files, not deterministic business logic; belongs in a lint step rather than the node runner.
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-002: `BOOTSTRAP_ASSUME_TTY` is a tty override, not a prompt bypass
- **Description**: The seam must gate only tty *detection*. `read` must still run, so a test that supplies no stdin still takes the real EOF path. If the seam short-circuited the prompt instead, every stickiness test in the suite would pass by not testing anything.
- **Steps**:
  1. Run the command below as-is.
  2. Confirm the `Layers:` line points inside the scratch dir before reading the rest.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude
  S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
  export HOME="$S/home"; mkdir -p "$HOME" "$S/proj"
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="tty seam is per call|empty, EOF, an out-of-range digit and garbage" test/prompt-stickiness.test.js
  ```

  > **Why the runner rather than an inline shell probe.** The natural probe —
  > `bash -c '... out="$(prompt_choice_sticky ...)" ...'` — is refused by this
  > repo's own `interpreter-indirection-guard.js`, because an inline `-c` program
  > containing a command substitution cannot be extracted and re-checked before it
  > runs. That refusal is correct and is not a product defect. The harness in
  > `test/prompt-stickiness.test.js` does the same thing the sanctioned way: it
  > writes a wrapper file and spawns `bash` on it, with `BOOTSTRAP_ASSUME_TTY`
  > applied per call so each test states which side of the seam it is on.
- **Expected Result**: 2 tests, 2 pass, 0 fail. `has_tty` is false in the curated env and true only under `BOOTSTRAP_ASSUME_TTY=1`, and the seam does not leak back into the shared env object. With the seam **on** and stdin at EOF, `read` still runs and the empty reply resolves to the declared default — proving the seam gates tty *detection* only. (Live shell probe run during this session confirmed the same: `DEFAULT=NOTTY`, `SEAM=TTY`, `EOF_REPLY=[skip]`, with the `Layers:` line resolving inside the scratch dir.)
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`harness: the tty seam is per call — has_tty is false by default and true only with tty:true`; `prompt_choice_sticky: empty, EOF, an out-of-range digit and garbage all resolve to the declared default`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-001: the load-bearing rule — a non-interactive run records NOTHING
- **Scenario**: An unattended CI run must never bake a permanent `no` into a user's store. An unattended decline that persists is strictly worse than the re-prompting this mechanism removes, because there is no prompt left to change your mind with. The `prefs_set` must be unreachable from the non-interactive branch **by return**, not skipped by a flag.
- **Steps**:
  1. Run the command below as-is. Note stdin is **poisoned** with `y` — if the branch ever reached `read`, the answer would flip to yes and a `true` would be recorded.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude
  S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
  export HOME="$S/home"; mkdir -p "$HOME" "$S/proj"
  export PROJ="$S/proj"
  node lib/scripts/bootstrap-prefs.js --list --project "$PROJ" | tail -1
  env -u BOOTSTRAP_ASSUME_TTY bash -c 'set -euo pipefail; . lib/scripts/lib.sh
  st=0; prompt_yn_sticky mcp.braveSearch --global "  Install Brave? [y/N]: " || st=$?
  echo "RC=$st"' <<< "y"
  echo "--- store state after the unattended run ---"
  node -e '
  const fs=require("fs"),path=require("path");
  for(const [label,dir] of [["GLOBAL",process.env.HOME],["PROJECT",process.env.PROJ]]){
    const v=path.join(dir,".claude","bootstrap-prefs.json");
    const c=path.join(dir,".claude","bootstrap-prefs.README.md");
    const any=fs.existsSync(v)||fs.existsSync(c);
    console.log(label+"_STORE: "+(any?("RECORDED -> "+fs.readFileSync(v,"utf8").trim()):"absent (nothing recorded)"));
  }'
  ```

  > The store check goes through `node`, not `ls`: the repo's own Serena-first
  > hook blocks `ls` for filesystem inspection. It also checks the companion
  > README — a companion beside a missing values file is proof a write path ran.
- **Expected Result**: The non-interactive note prints **exactly once**, `RC=1`, and both stores report `absent (nothing recorded)`. A recorded `true` would mean the poisoned stdin was consumed; a recorded `false` would mean a CI run just permanently silenced a prompt.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`prompt_yn_sticky: no tty and no stored answer — returns 1, ignores stdin, and records NOTHING in either layer`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-002: stdout purity, and NAMES are stored — never digits
- **Scenario**: `prompt_choice_sticky`'s stdout **is** its return value, so a notice on stdout would be captured by the caller as the answer. Separately, a stored digit would silently change meaning the day a menu is reordered — it would still resolve, and it would resolve to the wrong thing. This is the lib.sh half of defect (a): the store must hold names.
- **Steps**:
  1. Run the command below as-is. stderr is deliberately left unredirected so a leaking notice is visible.
  2. Run 1 replies with the **digit** `2`; run 2 poisons stdin with `1` (a different legal answer).
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude
  S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
  export HOME="$S/home"; mkdir -p "$HOME" "$S/proj"
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a digit selects the Nth name|a remembered name suppresses the prompt" test/prompt-stickiness.test.js
  ```

  > Runner form for the same reason as UAT-INT-002: an inline `bash -c` carrying
  > `$(prompt_choice_sticky …)` is refused by `interpreter-indirection-guard.js`.
- **Expected Result**: 2 tests, 2 pass, 0 fail. A reply of `2` resolves to the second name and the store holds the **name** `alongside`, never the digit; the captured stdout is exactly the name with no notice text; and a remembered name suppresses the prompt even with a tty, leaving poisoned stdin unread. (Live shell probe run during this session confirmed the same: `CAPTURED=[alongside]`, `od -c` showing exactly the 9 bytes `a l o n g s i d e` with no trailing newline, stored value `"mcp.playwrightConflict": "alongside"`, and run 2 returning `alongside` with the remembered-answer notice appearing on stderr but **not** inside the capture.)
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`prompt_choice_sticky: a digit selects the Nth name, and the NAME is what is stored — never the digit`; `…: a remembered name suppresses the prompt even WITH a tty, and never reads stdin`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-003: `ask` and `unset` are not collapsed — a stored `ask` survives a live reply
- **Scenario**: `unset` is an unanswered question the next answer should settle; `ask` is a *settled* answer whose content is "keep asking, never persist". Collapsing them lets a user's explicit `ask` be silently overwritten by their next reply.
- **Steps**:
  1. Run the command below. It seeds `ask`, fingerprints the store, then answers with `false` — a legal name that is **not** the default, so a recorded answer would visibly overwrite the `ask`.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude
  S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
  export HOME="$S/home"; mkdir -p "$HOME" "$S/proj"
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="a stored .ask. prompts every run" test/prompt-stickiness.test.js
  ```

  > Runner form for the same reason as UAT-INT-002. The runner version is also the
  > stronger check: it fingerprints the store by **SHA-256 and mtime**, so a
  > rewrite of `ask` back to `ask` — still a write, and still evidence that
  > `prefs_set` was reached — cannot pass as clean.
- **Expected Result**: 2 tests, 2 pass, 0 fail — one for each sticky helper (`prompt_yn_sticky` keeps its own `true`/`false` ladder; `prompt_choice_sticky` goes through the shared `_sticky_lookup`). In both, the question **is** asked and the live reply is returned to the caller, but the store is unchanged by bytes and mtime. (Live shell probe run during this session confirmed the same: `CAPTURED=[false]` — the reply won — while the store stayed byte-identical at sha `0fd6ee7e…` and still held `"gitignore.offerSectionUpdates": "ask"`.)
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`prompt_choice_sticky: a stored ask prompts every run and the reply does NOT overwrite it`; `prompt_yn_sticky: a stored ask prompts every run and the reply does NOT overwrite it`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-003: `prompt_scope` keeps its own resolver and its bare form stays inert
- **Description**: `prompt_scope` is the one helper that existed before the sticky layer. Two regressions must be impossible: (1) the bare form `prompt_scope "$name"` — used by `bootstrap-serena.sh` and `install-mcps.sh:94` — must make **zero** `bootstrap-prefs.js` calls; (2) the resolver is **first-letter** (`[pP]*` → project), a rule the schema publishes to users. Routing it through `prompt_choice_sticky`'s digit/exact-name resolver would silently turn a bare `p` into `user`.
- **Steps**:
  1. Run the targeted suite below. It uses an argv-logging spy shim for the zero-call proof — an empty log is positive evidence, strictly stronger than "no file was created".
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="prompt_scope" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 4 tests, 4 pass, 0 fail. Covers first-letter resolution (`p`/`P`/`project`/`pineapple` → project; `u`/empty/`garbage`/EOF → user), the empty spy log, the key-without-selector warning, the sticky round trip with stdout carrying only the scope, and the no-tty path recording nothing.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (4 `prompt_scope:` tests — added by this UAT; falsifiability confirmed by temporarily replacing `[pP]*)` with `project)`, which failed 3 of them, then restoring `lib.sh` and verifying it byte-identical by SHA-256)
- [x] Pass <!-- 2026-08-06 -->

### UAT-EDGE-004: a broken preference layer never costs the user their install
- **Scenario**: Every consumer runs under `set -euo pipefail`, where an unguarded non-zero status kills the script. Two failure modes must degrade rather than abort: a **partial install** (helper file or `node` missing) and a **caller bug** (a value outside the key's grammar).
- **Steps**:
  1. Run the targeted suite below.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node --test --test-name-pattern="prefs_get/prefs_set|prefs_set: an illegal value" test/prompt-stickiness.test.js
  ```
- **Expected Result**: 2 tests, 2 pass, 0 fail. A missing helper reads as the literal word `unset` (never empty) and `prefs_set` no-ops, with execution reaching the end of the script. An illegal value leaves the helper's own error **visible** on stderr plus lib.sh's `Warning: could not record preference`, exits 0 anyway, and leaves the previously stored value byte-identical.
- **Repeatable Unit Test**: Created: `test/prompt-stickiness.test.js` (`prefs_get/prefs_set: a missing helper degrades to unset and a silent no-op, without aborting the caller`; `prefs_set: an illegal value surfaces the error, does not abort, and leaves the stored value intact`)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-004: the schema citation this task moved is accurate
- **Description**: Step 7 repaired `lib.sh:198` → `lib.sh:387` in `mcp.context7Scope.detail` after the new functions shifted `prompt_scope` down. A stale citation points a user at the wrong line and the pin test would drift silently.
- **Steps**:
  1. Run the command below — it reads the citation out of the schema and checks the line it names actually contains the prompt.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && node -e '
  const fs=require("fs");
  const schema=JSON.parse(fs.readFileSync("lib/scripts/templates/bootstrap-prefs-schema.json","utf8"));
  const keys=schema.keys||schema;
  const m=(keys["mcp.context7Scope"].detail||"").match(/lib\.sh:(\d+)/);
  if(!m){console.log("NO CITATION FOUND");process.exit(1);}
  const n=Number(m[1]);
  const line=fs.readFileSync("lib/scripts/lib.sh","utf8").split("\n")[n-1];
  console.log("citation: lib.sh:"+n);
  console.log("that line: "+JSON.stringify(line));
  const ok=line.includes("Scope for $name");
  console.log(ok?"CITATION ACCURATE":"CITATION STALE");
  process.exit(ok?0:1);
  '
  ```
- **Expected Result**: `citation: lib.sh:387`, the printed line is the `read -r -p "  Scope for $name — [u]ser (default) or [p]roject? "` line, and `CITATION ACCURATE`.
- **Repeatable Unit Test**: Created: `test/bootstrap-prefs.test.js` (`CITATION_PINS` row `'lib.sh:387': 'Scope for $name'`, pre-existing — updated by TASK-043 step 7)
- [x] Pass <!-- 2026-08-06 -->

### UAT-INT-005: the full suite is green with no new skips
- **Description**: Baseline before this task's UAT was 245 tests / 245 pass / 0 fail / **0 skipped**. The Phase-1 bijection skip is gone; a skip reappearing is a regression, not a neutral outcome.
- **Steps**:
  1. Run `npm test` and read the trailer counts.
- **Command**:
  ```bash
  cd /Users/davidtaylor/Repositories/bootstrap-claude && npm test
  ```
- **Expected Result**: `fail 0` and `skipped 0`. Test count is **251** — the 245 baseline plus the 6 `prompt_scope` / `prefs_*` tests this UAT added.
- **Repeatable Unit Test**: Not applicable: this case *is* the repeatable suite.
- [x] Pass <!-- 2026-08-06 -->

---

## Notes

**Unit tests created by this UAT** — 6 added to `test/prompt-stickiness.test.js`,
in the file's existing `withScratchEnv` / `runShell` harness pattern:

| Test | Covers |
|---|---|
| `prompt_scope: the bare form resolves by FIRST LETTER and makes zero prefs calls` | first-letter resolver + argv-spy zero-call proof |
| `prompt_scope: a key with NO selector warns, answers normally, and records nothing` | the both-args-required opt-in |
| `prompt_scope: the sticky form records the answer, then replays it with stdout carrying ONLY the scope` | round trip + stdout purity |
| `prompt_scope: no tty answers user, prints no note, and records NOTHING even with a key and selector` | the load-bearing rule on the third helper |
| `prefs_get/prefs_set: a missing helper degrades to unset and a silent no-op, without aborting the caller` | partial-install degradation |
| `prefs_set: an illegal value surfaces the error, does not abort, and leaves the stored value intact` | caller-bug degradation |

These filled the one real gap in TASK-047's coverage: `prompt_scope` and the two
`prefs_*` wrappers had no direct tests, despite `prompt_scope`'s bare form being
a live contract with `bootstrap-serena.sh` and `install-mcps.sh:94`.
