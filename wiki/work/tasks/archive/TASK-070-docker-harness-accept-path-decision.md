---
id: TASK-070
aliases: [TASK-070]
title: "Decide whether the Docker harness needs an accept-path test lane"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
blocks: [TASK-071]
parallel_safe_with: [TASK-068, TASK-069, TASK-031, TASK-039]
uat: ""
tags: [docker, testing, dev-tooling, research]
---

# TASK-070 — Decide whether the Docker harness needs an accept-path test lane

implements::[[ROADMAP-009]]

## Objective

Research for ROADMAP-009 confirmed this codebase's non-interactive prompt contract (`has_tty`/`prompt_yn`/`prompt_yn_sticky` in `lib/scripts/lib.sh`) is a **hard, structural "no"** for every optional install prompt when run non-interactively — nothing is ever recorded as accepted, only an explicit stored `false` (or nothing at all) is ever consulted. TASK-060's harness runs everything non-interactively, so by default it can only ever exercise the "decline every optional feature" branch of `setup`/`update` (MCP install, Obsidian app/plugins/graph-defaults, etc.), never the "accept" branch. This task decides, deliberately, whether v1 of the harness needs to also exercise an "accept" path — and if so, how.

## Approach

The only way to exercise an "accept" branch non-interactively is to pre-seed `bootstrap-prefs.js` state (or the equivalent settings files) inside the scratch project/`$HOME` **before** invoking `setup`/`update`, so the installer scripts see an already-recorded `true` rather than needing a live prompt. This is exactly the mechanism TASK-071's stale-harness mode also needs (pre-seeding state before `update` runs), so the two are closely related — this task's decision directly shapes what TASK-071 pre-seeds.

Decide between:
- **Scope v1 to decline-only** (matches TASK-060's current design as written — non-interactive, no pre-seeded prefs, exercises the "everything declined" path only). Simplest, ships fastest.
- **Add a minimal accept-path lane**: a `run.sh accept` mode (or a flag on `setup`/`update`) that pre-seeds one or two representative `bootstrap-prefs.js` keys to `true` before running, proving the accept branch doesn't crash or diverge unexpectedly. Slightly more scope, but catches a class of bug the decline-only path structurally cannot.

## Steps

### 1. Make and record the decision <!-- agent: general-purpose -->

- [x] Read `lib/scripts/lib.sh`'s `has_tty`/`prompt_yn`/`prompt_yn_sticky` implementations and `lib/scripts/bootstrap-prefs.js`'s `--set`/seeding interface to confirm exactly what pre-seeding would require (which env vars / file paths / CLI invocation) — this is the concrete cost estimate for the "add a lane" option.
- [x] Decide decline-only vs. minimal-accept-lane for v1, and record the decision + one-paragraph rationale in this task's `## Notes` section.
- [x] If "minimal accept lane" is chosen: write the specific pre-seeding steps here as sub-bullets (which `bootstrap-prefs.js --set` calls, against which scratch `$HOME`/project path) so TASK-071 can consume them directly without re-deriving the mechanism. If "decline-only" is chosen: note explicitly that TASK-071's stale-harness mode should also stay decline-only for its `update` call, so the two tasks don't silently diverge on this point.

<!-- Updated: 2026-08-22 00:00 -->

## Notes

**Decision: add a minimal accept-path lane.**

**Cost estimate (from reading `lib.sh` and `bootstrap-prefs.js`).** `has_tty` (`lib.sh:204`) is `[ -t 0 ] || [ "$BOOTSTRAP_ASSUME_TTY" = "1" ]` — a detection gate only, not a bypass; it does not touch the prefs store. `prompt_yn` (`lib.sh:214`) answers `n` whenever `has_tty` is false, printing a note, and never calls into `bootstrap-prefs.js` at all. `prompt_yn_sticky` (`lib.sh:275`) is the actual gate every optional-install prompt goes through: it first calls `prefs_get <key> <selector>` (`lib.sh:634`, wrapping `node bootstrap-prefs.js --get <key> [--global|--project <dir>]`); if the stored value is the literal string `true`, it returns 0 immediately and **never reaches `has_tty` or the live prompt at all** — the non-interactive branch (`lib.sh:304`) is unreachable once a key already resolves to `true`. That is exactly the seam pre-seeding needs: writing `true` into the prefs file before invoking `setup`/`update` makes the installer take the accept branch non-interactively, with zero code changes to the prompt logic itself.

`bootstrap-prefs.js --set` (usage banner + `parseArgs`, `bootstrap-prefs.js:1-32,103-176`) requires exactly: `--set <key> --value <v>` plus exactly one layer selector — `--global`, `--project <dir>`, or `--target <path>` (mutually exclusive, one mandatory; `bootstrap-prefs.js:165-176`). `--value true`/`--value false` are coerced to real JSON booleans (`bootstrap-prefs.js:715`). Validation (`bootstrap-prefs.js:673-711`): the value must be in the schema key's `values` list if the key is known, and the selector's layer must match the key's declared `scope` (`global`/`project`/`either`) via `scopePermitsLayer` — a scope mismatch exits 1 (BUG-0009 guard), so the exact layer matters, not just "some file." Storage paths: global is `os.homedir()/.claude/bootstrap-prefs.json` (`bootstrap-prefs.js:184`, and `os.homedir()` follows a redirected `$HOME`, confirmed by the file's own comment referencing TASK-029's hermetic-testing proof); project is `<project>/.claude/bootstrap-prefs.json` (`bootstrap-prefs.js:188`). `writeAtomic` (`bootstrap-prefs.js:317-330`) does `fs.mkdirSync(path.dirname(file), { recursive: true })` before writing, so `--set` works even when `<project>/.claude/` doesn't exist yet — no need to run `setup` first just to create the directory. No env var seeds a prefs value; the only file-based mechanism is `--set`.

**Rationale.** Pre-seeding turns out to be a single, well-documented CLI call per key with no code changes required anywhere in the prompt/install logic — the cost is much lower than the phrasing in Approach implied. Against that low cost, the decline-only path is structurally incapable of ever exercising the actual `true`-branch install/write logic (writing `.obsidian/graph.json`, delivering an optional guide into `wiki/guides/`, etc.) — bugs living purely in that branch (crashes, wrong paths, JSON write failures) are invisible to TASK-060 as currently scoped, and that is exactly the class of bug this harness exists to catch per TASK-060's own Objective ("catch machine-state bugs... instead of relying on ad hoc testing"). Given the mechanism is cheap, deterministic, and already the exact one TASK-071 independently needs for its own stale-harness pre-seeding, scoping v1 to decline-only would be leaving an easy, high-value check on the table for no real savings.

**Chosen representative keys and pre-seeding steps for TASK-071 to consume directly.**

Both chosen keys are deliberately **not** `mcp.*` keys: TASK-060's own Approach section scopes MCP install out of v1 (Docker-in-Docker complications with the Brave Search MCP's own container), so `install-mcps.sh` is never invoked by the harness's `setup`/`update` runs today — pre-seeding an `mcp.*` key to `true` would be inert (the code path that reads it never runs). The two keys below are both `scope: project`, filesystem-only, and require no network fetch or external package manager (no `flatpak`/`brew`, which the fresh Ubuntu image doesn't install), so they carry no risk of failing for an environment reason unrelated to the code under test:

- `guides.evals-framework.md` — asked by `sync-wiki-scaffold.sh`; `true` delivers `wiki/guides/evals-framework.md`, a pure file copy.
- `obsidian.graphDefaults` — asked by `install-obsidian.sh`; `true` writes `.obsidian/graph.json` plus its `.obsidian/.graph-defaults-fingerprint.json` sidecar, a pure JSON write with no dependency on the Obsidian app itself being present.

Add a fourth `run.sh accept` mode (alongside `shell`/`setup`/`update`) that, against the same throwaway scratch project dir TASK-060's other modes use (e.g. `/workspace/scratch-project`), runs **before** invoking `setup`:

```sh
node /opt/bootstrap-claude/lib/scripts/bootstrap-prefs.js --set guides.evals-framework.md --value true --project /workspace/scratch-project
node /opt/bootstrap-claude/lib/scripts/bootstrap-prefs.js --set obsidian.graphDefaults --value true --project /workspace/scratch-project
```

...then invokes `setup` non-interactively against `/workspace/scratch-project` exactly as `run.sh setup` does, and exits with its exit code. `--project <dir>` (not `--global`) is mandatory here because both keys are `scope: project`; do **not** set `BOOTSTRAP_ASSUME_TTY=1` for this mode — the whole point is proving the recorded-`true` path works non-interactively (`prompt_yn_sticky` short-circuits on the stored value before `has_tty` is ever consulted), not forcing a live prompt to fire. The scratch dir does not need `.claude/` to exist first; `--set` creates it.

Deferred, not needed for v1: exercising `obsidian.installApp` (global scope) would additionally require `flatpak` in the image, which TASK-060's Dockerfile doesn't install — leave that, and all `mcp.*` accept branches, out of scope until MCP/Obsidian-app install is itself brought into the harness's scope.

**For TASK-071:** if the stale-harness `update` run also wants to exercise an accept branch, reuse this exact mechanism and these same two keys (`--project <scratch-dir>`, run before `update`) rather than re-deriving it — do not silently diverge onto a different key set or selector shape.

