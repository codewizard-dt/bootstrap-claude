# scripts/

Bash orchestration layer. These are the only scripts `bin/cli.js` ever executes directly; everything else in `lib/` (hooks, prompts, skills, templates) gets copied, synced, or read by one of these.

All scripts use `set -euo pipefail`. Every script that touches a target project sources `lib.sh` for shared helpers and takes the project path as `$1`.

## CLI-facing scripts (one per `bootstrap` command)

| Script | `bootstrap` command | What it does |
|--------|---------------------|---------------|
| `setup-project.sh` | `setup` | Preflight-checks `claude` and `uv` are installed, then runs the full new-project sequence: global hooks/skills/settings install first (offline-safe, via `install-global.sh --skip-mcps` — includes the deny-list and hooks-wiring merges), then the interactive MCP install (guarded — a failure warns and continues), wiki scaffold + tiered guides sync (optional guides prompted), `.gitignore` merge, and Serena `project.yml` bootstrap. Does **not** scaffold deployment — that's explicit via `deploy`. |
| `update-project.sh` | `update` | Re-runs the same shared sequence as `setup` (global hooks/skills/settings via `install-global.sh --skip-mcps`, then the guarded interactive MCP install) and re-syncs the wiki scaffold + tiered `wiki/guides/` into an existing project. Detects legacy `.docs/`-layout families (`tasks`, `uat`, `adr`, `prd`, `bugs`, `roadmaps`) and warns without touching them — migration is a separate, explicit step (`migrate`). Never touches `.github/`. |
| `install-global.sh` | `install` | Installs/updates hooks, skills, settings, and MCPs globally with **no project path** — the shared step both `setup` and `update` delegate to. Local/offline-safe steps run first: hooks rsync to `~/.claude/hooks/` (stderr warning if `lib/hooks` is missing), skills install (pruning stale skill folders from the wiki rename — `adr-*` → `decision-*`, `prd-*` → `req-*`), the canonical permission deny-list merge into `~/.claude/settings.json` via `merge-settings-deny.js`, then the hooks-wiring merge via `merge-settings-hooks.js` — registering the copied hook scripts in the settings `hooks` key, with a restart-your-session reminder when the wiring was created or changed. Then copies `templates/file-suggestion.sh` → `~/.claude/file-suggestion.sh` and registers it as the `fileSuggestion` `@`-autocomplete picker (`merge-settings-deny.js --set-key` mode) — printing a restart note on fresh registration, or leaving a pre-existing different `fileSuggestion` untouched. Then step 6 installs the preference helper — `bootstrap-prefs.js` → `~/.claude/bootstrap-prefs.js` and `templates/bootstrap-prefs-schema.json` → `~/.claude/templates/bootstrap-prefs-schema.json`, the layout that lets a skill read a preference with no `--schema` flag (see [Preference helper notes](#preference-helper-notes)); a missing helper or schema warns and continues. Step 7 then settles the seven `consumer: skill` preferences that have never been answered — asked once, in a batch, at global scope, gated on a tty as a whole, so a non-interactive run prints one note and writes no answers and no preferences file. MCPs install **last** (step 8) — the only network-dependent step, guarded so a failure warns instead of aborting the local installs — and `--skip-mcps` skips them when the caller already handled MCP install interactively. |
| `setup-deployment.sh` | `deploy` / `deployment` | Reads `raw/guides/deployment-strategy.md` as a prompt template, copies it into the target's `wiki/guides/` (deploy-only guide tier — the wiki sync never ships it), and runs `claude` to scaffold `.github/workflows/`, `Makefile` Docker targets, and `.gitleaks.toml` into the target project. Deliberately **not** called by `setup`/`update` — CI files get hand-customized per project (Dockerfile paths, runner labels, deploy steps) and must never be created or clobbered implicitly. `security.yml` is always overwritten (generic); `build.yml`/`.gitleaks.toml` are copy-once; `Makefile` targets are merged. |
| `migrate-project.sh` | `migrate` | Claude-driven migration of a legacy `.docs/`-layout project to the LLM Wiki structure (`wiki/knowledge/` + `wiki/work/`). Preflight requires a clean git tree; runs on a fresh `wiki-migration` branch so the whole migration is one reviewable diff. Scaffolds first via `sync-wiki-scaffold.sh --interactive`, assembles `wiki/guides/mcp-tools.md` via `build-mcp-guide.sh`, then drives the semantic conversion (frontmatter synthesis, ID renames, link rewrites, family indexes) with the prompt at `lib/prompts/migrate-wiki.md`. `git mv` before edit, so history is preserved. `--dry-run` prints the file inventory only and does not touch anything. |
| `setup-strict-typechecks.sh` | `typechecks` | Loads `lib/prompts/setup-strict-typechecks.md`, appends an optional language list (space- or comma-separated), and runs `claude` to detect languages, research current strict-mode conventions, install toolchains, and wire `make typecheck`. |
| `wiki-dashboard-server.js` | `dashboard` | Zero-dependency Node static file server (Node builtins only) that serves the live wiki dashboard client (`templates/wiki/dashboard.html`) at `/` and the project's `wiki/` tree read-only under `/wiki/*`, all with `no-store` cache headers so the polling client always sees current content. Runs in the foreground until Ctrl-C. Binds `http://localhost:4317` by default; pass a port to override (`bootstrap dashboard 4400`), and falls back to the next port (up to 10 tries) if the chosen one is in use. Unlike the other CLI scripts, this is Node, not Bash, and is long-running rather than one-shot. |

## Shared helpers and internal scripts

| Script | Used by | Purpose |
|--------|---------|---------|
| `lib.sh` | Every script above | Shared bash library: `resolve_project_dir` (path resolution + validation), `mcp_installed`/`serena_installed`/`detect_installed_mcps` (MCP state checks), `run_project_sync` (the common setup/update sequence: `install-global.sh --skip-mcps` first — hooks/skills/deny-list/hooks-wiring/fileSuggestion, offline-safe — then the guarded interactive MCP install, wiki scaffold, gitignore, the wiki-alias backfill, Obsidian, MCP-tools guide, Serena bootstrap), and `prompt_yn`/`prompt_scope` (interactive prompt helpers). |
| `install-mcps.sh` | `install-global.sh`, `setup-project.sh`, `update-project.sh` | Installs Brave Search, Context7, Playwright, and (when a project dir is given) Serena. Two modes: non-interactive (`install-global.sh`'s default — installs everything missing at user scope) and `--interactive --project-dir <dir>` (prompts per-MCP and asks for scope, used by `setup`/`update`). Playwright has a dedicated conflict flow: registered as `playwright` (user scope) by default; when a project ships its own `playwright`, a git-tracked `.mcp.json` is never modified (interactive options: register ours as `playwright-shared` + disable the project entry machine-locally via `disabledMcpjsonServers` in `.claude/settings.local.json` / register alongside / skip), while a machine-local registration can be replaced or kept (ours then uses the alternate name). Non-interactive conflicts are left untouched with a hint. |
| `sync-wiki-scaffold.sh` | `setup-project.sh`, `update-project.sh`, `migrate-project.sh` | Scaffolds an **empty** wiki into the target project from `templates/wiki/`: creates `raw/` + all `wiki/` family directories, lifecycle docs, per-family `index.md`, and stub `index.md`/`log.md`. Copy-once for project-owned files; always-refreshes `conventions.md` and `lifecycle.md`. Delivers guides from `raw/guides/` tier-wise into `wiki/guides/`: `command-anti-patterns.md` required (always refreshed); `evals-framework.md` + `type-checking-templates/` optional (`--interactive` prompts on first delivery, sticky refresh once present — legacy `.docs/guides/` presence counts, opt out by deleting); migrates legacy `.docs/guides/` (template-owned files removed or relocated, deprecated `task-spec.md` deleted, empty dirs pruned). Also delivers the `## LLM Wiki` section and `.env` safety policy (copy-once, sentinel-guarded, from `templates/CLAUDE-wiki.md` / `templates/CLAUDE-env-safety.md`) into the target's `CLAUDE.md` — when a `CLAUDE.md` already exists without the schema, prompts whether to modify it or write `CLAUDE.local.md` instead (non-interactive default: `CLAUDE.local.md`). |
| `build-mcp-guide.sh` | `setup-project.sh`, `update-project.sh`, `migrate-project.sh` | Assembles `wiki/guides/mcp-tools.md` in the target project from the per-server stub files in `templates/guides/stubs/`, including only the sections for MCPs actually installed. |
| `bootstrap-serena.sh` | `setup-project.sh`, `update-project.sh` | Headlessly triggers `.serena/project.yml` creation via `claude --print` and enables the optional Serena tools needed by this template's workflow. Preflights `claude` and `python3`. |
| `backfill-wiki-aliases.js` | `lib.sh` (`run_project_sync`, unguarded — invoked via `node`, not direct exec) | Zero-dependency Node script that re-runs TASK-064's one-time sweep on every `setup`/`update`: scans every `wiki/work/<family>/` file (active + `archive/`, all 6 families) for one that carries `id:` but no `aliases:` yet, and inserts `aliases: [<id>]` immediately after the `id:` line. Idempotent and additive-only — a file that already has `aliases:` (inline or block-list form) is left completely untouched, never corrected or overwritten. Fixes drift (a hand-authored file, an older bootstrap checkout, a merge) that would otherwise leave a bare `[[TASK-NNN]]`-style wikilink dead in Obsidian — see `wiki/knowledge/sources/obsidian-alias-link-resolution.md` for why. Deliberately **out of scope: `wiki/knowledge/`** — a knowledge page's filename already equals its `id:` slug, so its wikilinks already resolve on Obsidian's plain filename match with no alias needed, and existing knowledge-page aliases are curated alternate names a script has no safe way to invent. Always exits 0 (same contract as `merge-settings-deny.js`/`merge-settings-hooks.js`) — warns and skips on anything unexpected rather than aborting the caller. |
| `merge-gitignore.sh` | `setup-project.sh`, `update-project.sh` | Fully interactive `.gitignore` merge — **nothing is ever added without asking**. The packaged template's titled sections are offered one by one (`Add/update .gitignore section '<title>' (N new line(s))? [y/N]`); sections with nothing new are skipped silently. Non-interactive runs (or no tty) change nothing at all. Never touches existing project content. Also offers (git repos only) to keep `.serena/`/`raw/`/`wiki/` out of git via **`.git/info/exclude`** — never `.gitignore`, which would blind Serena on the wiki (see `wiki/knowledge/concepts/git-ignore-tool-visibility.md`); per-machine and idempotent. `info/exclude` *is* honored by ripgrep-class walkers and the `@` file picker, so every machine-local exclusion this script manages — the wiki/agent-state dirs AND the `.claude/bootstrap-prefs.*` files, whichever of its prompts get answered and in whichever order — is written under **one shared, generic sentinel** (`# bootstrap machine-local (autocomplete-visible)`) that the `fileSuggestion` picker installed by `install-global.sh` reads back to restore `@`-autocomplete. The sentinel line itself is written proactively on every interactive run against a git repo, even if every exclude-affecting prompt is declined, so the anchor is always there regardless of which preferences got set; a project still carrying the old, separately-named pre-unification header is repaired onto the shared sentinel automatically. |
| `merge-settings-deny.js` | `install-global.sh` | Zero-dependency Node script that merges the canonical permission deny list (`templates/settings-deny.json` — `Bash(...)` command patterns plus `Edit(...)`/`Read(...)` file-tool patterns) into `~/.claude/settings.json` `permissions.deny`. Entries are opaque strings, so any rule form the permission system accepts merges unchanged. Additive union only: missing entries are appended, user entries are never removed or reordered, all other settings keys pass through untouched. Atomic write, preserves existing indentation, and always exits 0 (warns + skips on unparseable or unexpected file shapes so an install never aborts over a settings merge). `--target`/`--source` flags exist as test seams. A second mode, `--set-key <name> --set-value <json>`, merges a single top-level settings key instead of the deny list (used to register `fileSuggestion`): absent → set; already deep-equal → no-op; present but different → one-line warning and skip, never a clobber. Supplying `--set-key` skips the deny merge entirely; a malformed `--set-value` exits 1, since that is a call-site bug rather than a user's file. |
| `merge-settings-hooks.js` | `install-global.sh` | Zero-dependency Node sibling of `merge-settings-deny.js` (deliberately not a new mode of it — different, block-and-entry-aware semantics) that merges the canonical hook wiring (`templates/settings-hooks.json`) into the `hooks` key of `~/.claude/settings.json` with a "template owns its blocks" model: repo-owned entries (a `command` under `~/.claude/hooks/` whose basename appears in the template) are created or updated in place; matcher drift on a pure-owned block is adopted (a matcher rename ships without duplicating the block); user/foreign blocks and entries are never modified, reordered, or removed; a repo hook found relocated into a mixed block is warned about but not duplicated; no empty placeholder blocks are ever written. Always exits 0 (warns + skips on unparseable or unexpected file shapes so an install never aborts over a settings merge). `--target`/`--source` flags exist as test seams. |
| `bootstrap-prefs.js` | `install-global.sh`, `install-mcps.sh`, `sync-wiki-scaffold.sh`, `merge-gitignore.sh`, `update-project.sh` (all through the `prefs_*` / `prompt_*_sticky` wrappers in `lib.sh`), and the `/bootstrap-config` skill | Zero-dependency Node reader/writer for the preference store — the one binary every consumer goes through, so no prompt site keeps its own copy of a key's value list. Five operations: `--get` (a resolving read; always exits 0, so no call site needs `\|\| true`), `--set`, `--unset`, `--list`, and `--section-key <title>` (turns a `.gitignore` banner title into its `gitignore.section.<slug>` key, so the slug rule has exactly one implementation and is Unicode-aware). `--set`/`--unset` require **exactly one** layer selector (`--global` / `--project <dir>` / `--target <path>`) and will not guess — a misdirected write is unrecoverable in a way a misdirected read is not; `--get` resolves across layers by default for the mirror-image reason. Values are validated against the schema's `values` grammar (an illegal value exits 1 — a caller bug must never land in the file and read back as `unset`), and `--set` also refuses to write into a layer the key's `scope` forbids (`--target` stays exempt); writes are atomic and reuse the file's existing indentation; and every successful `--set`/`--unset` regenerates the `bootstrap-prefs.README.md` companion beside the values file. See [Preference helper notes](#preference-helper-notes). |

## Standalone infra scripts (not wired to the CLI)

These are **not** referenced by `bin/cli.js` or by any other script — they're invoked manually when standing up self-hosted CI infrastructure for a project that used `deploy`.

| Script | Purpose |
|--------|---------|
| `setup-runner.sh` | Generalized GitHub Actions self-hosted runner installer. Run as root on a target droplet: `RUNNER_TOKEN=<token> REPO_URL=<url> bash setup-runner.sh`. Registers the runner, installs it as a service, and configures GHCR login. |
| `startup.sh` | One-shot droplet bootstrap: updates apt, installs zsh/curl/make, and installs Docker + the Compose plugin from Docker's official apt repo. Typically run once before `setup-runner.sh` on a fresh VM. |
| [`test/docker/fresh-machine/`](../../test/docker/fresh-machine/README.md) | Docker-based harness that emulates running `setup`/`update` on a completely fresh machine with no prior Claude Code infrastructure. `./run.sh [shell\|setup\|update]`. |

## `templates/`

Static and semi-static assets copied or read by the scripts above — never executed themselves.

| Path | Read/copied by | Contents |
|------|-----------------|----------|
| `templates/wiki/` | `sync-wiki-scaffold.sh` | The empty wiki scaffold: `index.md`, `log.md`, `conventions.md`, and per-family `knowledge/`/`work/{tasks,uat,bugs,requirements,decisions,roadmaps}/` directories with `lifecycle.md`, `index.md`, `archive/index.md`, and `.gitkeep` placeholders. |
| `templates/guides/stubs/` | `build-mcp-guide.sh` | Per-MCP-server markdown fragments (`serena.md`, `context7.md`, `brave-search.md`, `playwright.md`) plus `00-header.md` (the shared top-of-file rules), assembled into `wiki/guides/mcp-tools.md`. |
| `templates/CLAUDE-wiki.md` | `sync-wiki-scaffold.sh` | The `## LLM Wiki` schema section delivered into a target project's `CLAUDE.md` (copy-once, sentinel-guarded). |
| `templates/CLAUDE-env-safety.md` | `sync-wiki-scaffold.sh` | The `.env` read/write safety policy prepended to a target project's `CLAUDE.md` (copy-once, never duplicated). |
| `templates/gitignore` | `merge-gitignore.sh` | Packed copy of this repo's own `.gitignore` (dotfiles aren't included in npm packages, so it's shipped under a non-dot name and renamed on copy). |
| `templates/file-suggestion.sh` | `install-global.sh` | The `fileSuggestion` `@`-autocomplete picker, copied to `~/.claude/file-suggestion.sh`. Reads the picker's stdin JSON `query` with `sed` (no `jq`), lists the project from `rg --files` (falling back to `git ls-files`, then `find`), and re-includes the paths under the `# bootstrap wiki & agent state (machine-local)` sentinel in `.git/info/exclude` — so bootstrap's hidden dirs are suggestible again while a user's other `info/exclude` entries stay hidden. Always exits 0. |
| `templates/settings-deny.json` | `merge-settings-deny.js` | The canonical `permissions.deny` list (bare JSON array of rule strings). Covers **both** `Bash(...)` command patterns (destructive disk/system commands, `sudo`, permission footguns, git working-tree/history protections, macOS persistence, credential exfiltration, fetch-and-execute) **and** file-tool path patterns — `Edit(...)` / `Read(...)` — protecting Claude Code's own settings and hooks, shell profiles, git config, and credential stores. Audited against the Claude Code permission-rule docs; merged additively into `~/.claude/settings.json` on every `install`/`setup`/`update`. See [Deny-list notes](#deny-list-notes) for the enforcement model and known costs. |
| `templates/bootstrap-prefs-schema.json` | `bootstrap-prefs.js` (resolved by default as `<its own dir>/templates/bootstrap-prefs-schema.json`, no flag needed), `install-global.sh` (step 6 copies it to `~/.claude/templates/`; step 7's sync pass reads it to decide which keys are still unanswered), the installer prompt sites (`install-mcps.sh`, `merge-gitignore.sh`, `sync-wiki-scaffold.sh`, `update-project.sh`, `lib.sh`), `/bootstrap-config` | The canonical registry of every bootstrap preference key — a flat JSON object mapping a dotted key to an entry that describes it (`scope`, `consumer`, `summary`, `detail`, `values`, `default`, `askedBy`, optional `dynamic`). One file, several readers, so adding or renaming a preference is a one-file change and the surfaces cannot drift apart — the same "template owns the canonical data" model as the two settings templates above. Pure data: JSON carries no comments, so the file stays bare (no `$comment` keys, no trailing commas, `JSON.parse`-able with zero preprocessing) and its rules live in [Preference-schema notes](#preference-schema-notes). |
| `templates/settings-hooks.json` | `merge-settings-hooks.js` | The canonical hook wiring — a bare hooks-value object (the value of the settings `hooks` key, not a full settings file) covering 4 events (`SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`) whose entries map 1:1 onto the 18 hook scripts in `lib/hooks/*.js`. The single source of truth for the wiring merged into `~/.claude/settings.json` on every `install`/`setup`/`update`; each block's matcher is load-bearing (see `lib/hooks/README.md`), which is why the wiring ships as a template instead of being hand-pasted. |

## Deny-list notes

### What deny rules do and don't cover

`permissions.deny` rules are enforced in **every** permission mode — including
`bypassPermissions` (`--dangerously-skip-permissions`, power-mode teammates,
subagents) — and for both main-session and subagent tool calls. No `allow` rule
at any scope can override a `deny` rule.

Two structural limits, neither mode-dependent:

- **Deny matches a literal command spelling, not a capability.** `Bash(rm -rf ~*)`
  does not stop `/bin/rm -rf ~`, and no deny rule can see inside `bash -c`,
  `python -c`, or `node -e`. Blocking a *capability* needs a `PreToolUse` hook
  (which parses the command) or the OS sandbox.
- **Deny rules cannot carry allowlist exceptions.** A broad deny blocks every
  matching call even when a narrower `allow` rule also matches. So
  `Bash(git stash:*)` also blocks read-only `git stash list`, and
  `Bash(crontab *)` also blocks `crontab -l`. Where an exception is genuinely
  needed, use `permissions.ask` or a hook, not deny.

File-tool rules are `Edit(...)` and `Read(...)` only. **`Write(...)` path rules
are accepted but never consulted** by current Claude Code builds — never author
one. A `Read` deny also blocks `Edit` on the same path.

### Why `~/.claude/settings.json` is guarded by a hook, not a deny rule

Protecting Claude Code's own settings is the highest-value control here: it stops
an agent granting itself permissions or installing a hook that fires on every
tool call, and Claude Code hot-reloads both files so such a write takes effect
immediately. It matters *most* under `bypassPermissions`, where Claude Code's
built-in protection for `.claude` paths is **not** applied.

That protection lives in a `PreToolUse` hook (`claude-settings-guard.js`) rather
than in this deny list. `claude-settings-guard.js` blocks `Edit`/`Write`/
`NotebookEdit`/`MultiEdit` on `~/.claude/settings.json` and `settings.local.json`
**unconditionally** — the verdict does not depend on cwd.

*History worth knowing, because the code changed under it:* the deny entries were
originally removed to make room for a bootstrap-claude carve-out, on the belief
that this repo needs to edit those files. **It does not.** The repo writes them
through `node merge-settings-deny.js` *inside* `install-global.sh` — a Bash
subprocess that no hook and no permission rule ever observes. The exception was
never load-bearing and was removed on 2026-07-30, after it was demonstrated that
any agent running in this repo could rewrite its own permission boundary with a
plain `Edit` call.

The deny entries stay out, but now by choice rather than necessity: the merge is
additive-only with **no removal path**, so restoring them is permanent for every
installed user, and the hook already covers the same paths *plus* the `Write` and
`NotebookEdit` surfaces that `Edit(...)` rules never reach. Restore them only if
the hook proves unreliable.

**`~/.claude/hooks/**` stays in the deny list with no exception**, including
inside this repo. The canonical flow there is to edit `lib/hooks/` and re-run
`install-global.sh`; editing the installed copy directly is always wrong.

**Residual risk, accepted:** an agent working inside bootstrap-claude can still
self-grant permissions by editing global settings. That is the deliberate cost of
making this repo able to do its job — containment for that case is the OS sandbox
(`/sandbox`), not this layer.

## Preference helper notes

How `bootstrap-prefs.js` behaves at run time. The schema's *shape* contract is
the next section down; this one is what a caller — a prompt site, a skill, or
`/bootstrap-config` — has to know to use the store correctly.

### Two values files, and project wins per key

| Layer | Path |
|-------|------|
| global | `~/.claude/bootstrap-prefs.json` |
| project | `<project>/.claude/bootstrap-prefs.json` |

Both are flat JSON objects mapping a dotted key to a value — the same flat shape
as the schema, so lookup is symmetric on both sides.

Resolution is `project → global → schema default → unset`, and it is
**scope-constrained**: `resolve()` only walks the layers a key's `scope` permits.
A `global`-scope key never reads the project file (honouring it would make a
machine-wide answer overridable per checkout) and a `project`-scope key never
reads the global one. Only `either` keys consult both.

`--get` resolves across layers **by default** — that is deliberate, not a flag:
forgetting a flag and silently getting `unset` would cause exactly the re-prompt
this store exists to remove. But the *project* layer can only be consulted if you
say where the project is: `--get`/`--list` read `<project>/.claude/` only when
`--project <dir>` is passed. Omit it and you get the global layer alone, which is
why `--list` ends with a line saying which layers it actually consulted.

`--target <path>` bypasses layer resolution entirely and reads or writes exactly
one file. It is the test seam, and doubles as the escape hatch for touching a
single layer by path.

### The four-state model

Every key is in exactly one of four states, and the distinction between the last
three is the whole point of the subsystem.

| State | Representation | Meaning |
|-------|----------------|---------|
| `unset` | **absent from both values files** | Never answered. The prompt should still fire. |
| a settled value | the key holds `true`, `"auto"`, `"shared"`, … | Answered. Never re-asked. |
| `false` | the key holds `false` | A remembered **decline** — a settled answer, not an absence. |
| `ask` | the key holds `"ask"` | *"Keep prompting me; do not persist the answer."* |

- **Absence is the entire representation of `unset`.** `null` is never written and
  the string `"unset"` is never stored; `--set <key> --value unset` (or `null`)
  exits 1 and points at `--unset`. Deleting a key is how you re-open a question,
  and `--unset` is the only supported way to do it.
- **`false` is not `unset`.** This is the state that fixes ROADMAP-005's original
  complaint: stickiness used to come from side effects (a thing existing on disk),
  which is one-directional — accepting stopped the prompt, declining did not, so
  every run re-asked the questions the user had already said no to.
- **`ask` is itself a stored answer.** The key is settled; what it settles on is
  "prompt every time". A stored `ask` is therefore never re-offered by the
  settling pass — re-prompting *for* a decision the user already made would be the
  same bug in a different costume.
- **Grammar exception:** `gitCommit.versionBump` expresses its ask state as
  **`confirm`**, inside its own `auto | confirm | never` grammar. It has
  deliberately no separate `ask` value, and offering one is a hard failure —
  `--set gitCommit.versionBump --value ask` exits 1.
- **The commit-subject prefix follows the bump**, for that same key. `/git-commit`
  writes `[patch]`/`[minor]`/`[major]` **if and only if** it actually bumped a
  version: written under `auto` and an approved `confirm`, omitted under `never`
  and a declined `confirm`. An earlier contract wrote it unconditionally so that
  release tooling "kept working"; that was backwards. The prefix is a claim about
  what the commit did and tooling acts on it, so a `[minor]` on a commit that
  bumped nothing publishes a release with no version change behind it. Pinned by
  `test/bootstrap-prefs.test.js`, across the skill, the schema `detail`, and the
  installer prompt — a user who picks `never` from the prompt's own description
  and then finds a prefix on their commit was mis-sold.

### The installed layout is what makes skill keys readable

`install-global.sh` step 6 installs two files:

```
~/.claude/bootstrap-prefs.js
~/.claude/templates/bootstrap-prefs-schema.json
```

The schema goes to `~/.claude/templates/`, not beside the helper, because
`bootstrap-prefs.js` resolves its schema as **`<its own directory>/templates/bootstrap-prefs-schema.json`**
(`bootstrap-prefs.js:111`). Preserving that relative layout is the entire point:
the installed copy works with **no `--schema` flag**, so a skill running in an
arbitrary project — one that is almost never a bootstrap checkout — still gets
validation, defaults, and descriptions. That is what makes the `consumer: skill`
keys readable at all:

```
node ~/.claude/bootstrap-prefs.js --get gitCommit.autoPush --project .
```

A flattened copy would silently drop validation *and* defaults, and a dropped
default turns an unanswered key from "the documented default" into `unset` at
every call site. `--schema <path>` exists only for a non-default schema — chiefly
a test seam. A missing or malformed schema is a warning, never a crash: `--get`
still resolves from the files and `--set` still writes.

The installer scripts do **not** use the installed copy — `lib.sh` resolves
`bootstrap-prefs.js` from its own directory at source time, so a `setup`/`update`
run always uses the checkout's helper and the checkout's schema.

### The generated companion is output, never input

Every successful `--set`/`--unset` — including a no-op set, since the schema may
have changed since the last one — rewrites `bootstrap-prefs.README.md` beside the
values file: the same directory, the same layer. It is **generated output; hand
edits are overwritten without warning.** Edit the values file, or run
`/bootstrap-config`.

It groups its tables `installer` then `skill`, the same order and the same
grouping `--list` uses and the same order as the registry table below, so all
three surfaces read alike. Its `## Unrecognized keys` section is the
forward-compatibility surface: a key present in a values file but absent from the
schema is never dropped, it round-trips a read-modify-write untouched, and it is
listed there with the reason it was not explained.

### No preference key ever holds a secret

No API key, token, or password belongs in a values file or in the schema — the
same warning the generated companion carries in its header. The Brave Search API
key, for instance, is baked into the MCP container's env; `mcp.braveSearch`
records only whether to install the server. Treat this as a rule when adding a
key: if the answer to a question is a credential, the question does not belong in
this store.

### `--set` enforces a key's grammar AND its scope

`--set` validates the *value* against the schema's `values` string, and also
checks that the chosen layer is one the key's `scope` permits — writing a
`global`-scope key into a project values file (or vice versa) exits `1` with
nothing written, naming the actual scope and the layer that would be
consulted instead. `--target <path>` remains the deliberate, exempt escape
hatch: it always bypasses the scope check, since it is an explicit
single-file operation rather than a resolved layer. Fixed as
[`BUG-0009`](../../wiki/work/bugs/archive/BUG-0009-set-writes-scope-inert-key-silently.md)
(previously: the write silently succeeded and printed an affirmative line
while landing in a layer `resolve()` never walks). A scope-inert key can
still exist — via `--target`, a hand edit, or a values file written by a
newer bootstrap — and the generated companion's `## Unrecognized keys`
section still explains it the same way: `scope is ... — this layer never
consults it, so it has no effect here`.

## Preference-schema notes

The shape contract for `templates/bootstrap-prefs-schema.json`. JSON cannot carry
comments, so the file itself must stay bare — no `$comment` header, no explanatory
keys — and everything a reader or a new consumer needs to know about its shape
lives here instead. What each individual key *does* is a separate question, and
it is answered by [The key registry — all 21 entries](#the-key-registry--all-21-entries)
at the end of this section.

### Flat key → entry, and eight fields

A single flat top-level object: dotted key → entry object. Deliberately **not**
nested by scope or consumer — `scope` is a *property* of an entry, not a path to
it, and nesting would force a reader to already know a key's scope before it could
look the key up. Flat also mirrors the values files
(`~/.claude/bootstrap-prefs.json` and `<project>/.claude/bootstrap-prefs.json`),
which are flat dotted-key objects, so lookup is symmetric on both sides.

| Field | Type | Meaning |
|-------|------|---------|
| `scope` | `"global"` \| `"project"` \| `"either"` | Which values file(s) may hold the key. Only `either` consults both (project wins); `global` and `project` keys are looked up in exactly one file. |
| `consumer` | `"installer"` \| `"skill"` | Who asks and who reads. `installer` keys are asked in situ by the script that owns the prompt; `skill` keys change what a slash command does. |
| `summary` | string | One line — used for `--list`, the generated README table, and the prompt option label. |
| `detail` | string | Prose consequence of each value: what changes on disk or in behavior. |
| `values` | string | Human-readable value grammar, e.g. `"true \| false"` or `"auto \| confirm \| never"`. A **display** string; a validator is derived from it by splitting on `\|` and trimming. |
| `default` | JSON value or `null` | What a resolving read returns when neither values file holds the key. `null` means "no default; the key resolves to `unset`". |
| `askedBy` | string | The script or slash command that owns the **settling** prompt — the one place that writes the answer, e.g. `"install-mcps.sh"`. Exactly one owner: either a bare filename that must exist in `lib/scripts/`, or a `/slash-command` that must have a `lib/skills/<name>/SKILL.md` (both enforced by `test/bootstrap-prefs.test.js`), so a compound value like `"install-global.sh, /git-commit"` is not legal. Run-time prompts that a key's own `ask`/`confirm` state triggers inside a consumer are **not** listed here — they live in `detail`. See [Why every `consumer: skill` key says `install-global.sh`](#why-every-consumer-skill-key-says-install-globalsh). |
| `dynamic` | `true`, optional | The only optional field. Marks a wildcard key pattern — see below. |

### Lookup is exact-match first, wildcard second

Two prompt families generate one key per item at run time and cannot be
enumerated ahead of time, so they get wildcard entries carrying `"dynamic": true`:
`guides.*` (one per `OPTIONAL_GUIDES` entry in `sync-wiki-scaffold.sh`, keyed by
the exact entry text including any extension) and `gitignore.section.*` (one per
titled section of `templates/gitignore`). A wildcard key is a single trailing `*`
segment — nothing fancier. Lookup tries an exact key first and only then falls
back to a pattern, so adding an exact `guides.evals-framework.md` entry later
overrides the pattern with no code change.

**Slug rule for `gitignore.section.*`** — stated here because the key has to be
derivable identically by the shell and by the JS reader: lowercase the section's
banner title, replace every run of non-alphanumeric characters with a single `-`,
then strip leading and trailing `-`. So `Node / TypeScript / JavaScript` becomes
`gitignore.section.node-typescript-javascript`. Treat "non-alphanumeric"
**Unicode-aware**, not as `[^a-z0-9]` over bytes: one section title today contains
an em dash, and a bytewise match turns that one character into three dashes before
the collapse step.

### `gitignore.section.*` has a one-value grammar, on purpose

That entry's `values` is the literal string `"false"` — one legal value, no
`true`. It is the design, not a typo, and must not be widened. `merge-gitignore.sh`
guarantees that *nothing is ever added to a project's `.gitignore` without asking*
(`merge-gitignore.sh:11`); a remembered **yes** would silently append lines on a
later run and break that. So only declines are recorded. An accepted section is
never stored, which is also why a section that gains new lines in a later template
version is still offered by title next run instead of being appended silently.

The rule is specific to add/skip gates. Keys that pick among behaviors —
`prefs.gitTracking`, `gitCommit.versionBump`, `gitignore.offerSectionUpdates` — are
recorded in every direction and are genuinely asked once.

### `default` is metadata and is never written to a values file

`default` describes what an *unanswered* key resolves to. It is never serialized
into `~/.claude/bootstrap-prefs.json` or a project's values file. The four-state
model depends on absence *being* `unset`: writing a default into the file would
convert an unanswered question into a settled answer and permanently suppress the
prompt that was supposed to ask it.

### An unrecognized key round-trips unchanged

A key present in a values file but absent from this schema is **never silently
dropped**. It survives a read-modify-write untouched and is listed under
"unrecognized" in the generated `bootstrap-prefs.README.md` beside the values file.
This is the forward-compatibility guarantee: a values file written by a newer
bootstrap — one that knows keys this schema has not heard of yet — stays intact
after an older version touches it, and the user can see what was kept.

### Why every `consumer: skill` key says `install-global.sh`

All seven `consumer: skill` keys name `install-global.sh` as their `askedBy`,
including `gitCommit.versionBump` and `gitCommit.autoPush` — which named
`/git-commit` until this was settled. The field records the **settling** prompt:
the one site that writes the answer. For all seven keys that site is
`install-global.sh`'s step 7 sync pass, which asks each unanswered key once, in a
batch, at global scope.

`/git-commit` does still prompt — but only once the key is already settled *to a
value that means "keep asking"* (`confirm` for `versionBump`, `ask` for
`autoPush`). That is a consumer honouring a stored answer, not the question being
asked. The same is true of the other three: `/research`, `/uat-generate`, and
`merge-gitignore.sh` each prompt in their key's `ask` state, and none of them is
named in `askedBy` either.

The practical test is `--unset`: re-open one of these keys and the question comes
back on the next `install-global.sh` run. It does **not** come back inside
`/git-commit`, which would simply fall through to the schema default and act.
Pointing a user at `/git-commit` to re-answer a question `/git-commit` will not
ask is the defect the old value encoded. Naming both was considered and is not
available: `test/bootstrap-prefs.test.js` requires `askedBy` to resolve to one
real `lib/scripts/` file or one real `lib/skills/<name>/SKILL.md`, so
`"install-global.sh, /git-commit"` fails the suite by construction. Where a
run-time prompt exists, it is documented in the key's `detail`.

### The key registry — all 24 entries

Every key in `templates/bootstrap-prefs-schema.json`, grouped by `consumer` —
`installer` first, then `skill` — which is the same grouping and the same order
`--list` and the generated `bootstrap-prefs.README.md` use. `Default` is the
schema's `default` field; `unset` in that column means `default: null`, i.e. the
key resolves to `unset` until it is answered. This table is transcribed from the
JSON; if the two ever disagree, the JSON is right and this table is a bug.

#### `consumer: installer` — 17 entries, read by the setup/update scripts

| Key | Scope | Consumer | Values | Default | Asked by | What it does |
|-----|-------|----------|--------|---------|----------|--------------|
| `mcp.serenaMigrate` | project | installer | `true \| false` | `unset` | `install-mcps.sh` | Move a project-scope Serena registration out of this repo's `.mcp.json` |
| `mcp.serena` | project | installer | `true \| false` | `unset` | `install-mcps.sh` | Register Serena at local scope for this project |
| `mcp.playwrightConflict` | project | installer | `shared \| alongside \| skip` | `unset` | `install-mcps.sh` | How to resolve a committed `.mcp.json` that already registers its own playwright server |
| `mcp.playwrightReplace` | project | installer | `true \| false` | `unset` | `install-mcps.sh` | Replace an existing machine-local Playwright registration with the bootstrap shared server |
| `update.legacyDocsAck` | project | installer | `true \| false` | `unset` | `update-project.sh` | Continue `update` even though a legacy `.docs/` directory was detected |
| `gitignore.infoExclude` | project | installer | `true \| false` | `unset` | `merge-gitignore.sh` | Add `.serena/`, `raw/`, and `wiki/` to git's local ignore list via `.git/info/exclude` |
| `prefs.gitTracking` | project | installer | `gitignore \| exclude \| neither` | `unset` | `merge-gitignore.sh` | How git should treat `.claude/bootstrap-prefs.json` and `bootstrap-prefs.README.md` |
| `guides.*` **(pattern)** | project | installer | `true \| false` | `unset` | `sync-wiki-scaffold.sh` | Install a specific optional guide into `wiki/guides/` |
| `gitignore.section.*` **(pattern)** | project | installer | `false` | `unset` | `merge-gitignore.sh` | Permanently decline one titled `.gitignore` template section |
| `mcp.braveSearch` | global | installer | `true \| false` | `unset` | `install-mcps.sh` | Install the Brave Search MCP globally for web research |
| `mcp.context7` | global | installer | `true \| false` | `unset` | `install-mcps.sh` | Install the Context7 MCP for library documentation lookups |
| `mcp.context7Scope` | global | installer | `user \| project` | `unset` | `lib.sh` | Registration scope for the Context7 MCP |
| `mcp.playwright` | global | installer | `true \| false` | `unset` | `install-mcps.sh` | Install the Playwright MCP for browser automation and UI testing |
| `obsidian.installApp` | global | installer | `true \| false` | `unset` | `install-obsidian.sh` | Install the Obsidian desktop app via the native package manager |
| `obsidian.plugins` | project | installer | `true \| false` | `unset` | `install-obsidian.sh` | Install the bundled Obsidian plugin set (Dataview, Graph Link Types, Breadcrumbs, Front Matter Title, Alias Linker) |
| `obsidian.graphDefaults` | project | installer | `true \| false` | `unset` | `install-obsidian.sh` | Install default graph-view styling (`.obsidian/graph.json`) |
| `skills.pruneOrphans` | global | installer | `true \| false` | `unset` | `install-global.sh` | Delete stale skill folders in `~/.claude/skills/` left by the wiki rename |

The two **(pattern)** rows carry `"dynamic": true` and are key *families*, not
keys: they match one concrete key per optional guide and per titled `.gitignore`
section respectively. Their matching rule, the `guides.*` naming, and the
Unicode-aware slug rule for `gitignore.section.*` are in
[Lookup is exact-match first, wildcard second](#lookup-is-exact-match-first-wildcard-second)
above; `gitignore.section.*`'s deliberate one-value grammar is in
[the section after it](#gitignoresection-has-a-one-value-grammar-on-purpose).

#### `consumer: skill` — 7 entries, read by slash commands at run time

| Key | Scope | Consumer | Values | Default | Asked by | What it does |
|-----|-------|----------|--------|---------|----------|--------------|
| `gitCommit.versionBump` | either | skill | `auto \| confirm \| never` | `auto` | `install-global.sh` | How `/git-commit` handles the version bump before committing |
| `gitCommit.autoPush` | either | skill | `true \| false \| ask` | `false` | `install-global.sh` | Whether `/git-commit` pushes after a successful commit |
| `gitCommit.lint` | either | skill | `true \| false` | `false` | `install-global.sh` | Whether `/git-commit` runs the /lint fix-cycle before committing |
| `research.persistToRaw` | either | skill | `true \| false \| ask` | `true` | `install-global.sh` | Whether `/research` writes its report and sources to `raw/research/` |
| `research.autoIngest` | either | skill | `true \| false \| ask` | `false` | `install-global.sh` | Whether `/research` automatically wiki-ingests its saved report |
| `uatGenerate.promoteTests` | either | skill | `sibling \| never \| dedicated` | `dedicated` | `install-global.sh` | Where `/uat-generate` writes the unit tests it promotes out of UAT cases |
| `gitignore.offerSectionUpdates` | either | skill | `true \| false \| ask` | `true` | `install-global.sh` | Master gate for the `.gitignore` template section review pass |

These six are the entire `scope: either` population and the entire
`consumer: skill` population — the two sets coincide, because a key that changes
what a slash command does is exactly the kind of key a user may want to answer
once machine-wide and then override in one checkout.

**Every `installer` key has `default: null`; every `skill` key carries a real
default.** That asymmetry has a consequence worth stating: `prefs_get` alone
cannot detect "unanswered" for a skill key, because an unanswered one resolves to
its default and reads as settled. That is why `install-global.sh`'s step 7 sync
pass uses `prefs_stored_global` — a stored-vs-default check — instead. A
`prefs_get`-based check there would ask nothing, forever, while looking like it
worked.
