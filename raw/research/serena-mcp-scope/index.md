---
topic: Pros and cons of registering the Serena MCP server at project scope (checked into this repo's .mcp.json) versus local scope (stored in ~/.claude.json under this project's entry)
slug: serena-mcp-scope
researched: 2026-08-14
sources: [./sources.md]
---

# Research: Serena MCP — project scope vs. local scope

> Builds on [mcp-add-scope-writes](../mcp-add-scope-writes/index.md), which diagnosed why this repo once wrote Serena into `.mcp.json` and recommended local scope. This report re-verifies that reasoning against Claude Code's official scope semantics and shipped-product behavior, adds pros/cons this repo hasn't yet had to consider (team onboarding, approval-gate UX, credential hygiene), and confirms: **the code and schema already implement the recommendation** — `install-mcps.sh` registers Serena at `--scope local` and offers a consented migration (`mcp.serenaMigrate`) for any pre-existing project-scope entry. No further code change is needed; this is a decision write-up, not a new defect.

## Research Questions
- Does Claude Code's own scope model (precedence, storage location, approval behavior) support the repo's "local, never project" rule for Serena?
- What concrete failure modes does project scope introduce for a tool like Serena specifically (as opposed to MCPs in general)?
- Are there any legitimate reasons a team *would* want Serena in `.mcp.json`?
- Is the reasoning in `mcp-add-scope-writes` (2026-07-29) still current, or has anything changed?

## Current State (Codebase)
- `lib/scripts/install-mcps.sh:309-345` — Serena is registered with `claude mcp add --scope local serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$PROJECT_DIR"`, run only when `PROJECT_DIR` is set. A code comment (lines 310-317) already states the rationale: local scope avoids "serena language-config bleed" (a user-scope problem) and avoids writing a machine-specific absolute `--project` path into the repo's shareable `.mcp.json` (a project-scope problem) [S1].
- Before registering, the script checks whether `.mcp.json` already contains `"serena"` (leftover from an earlier bootstrap version) and, if interactive, offers a **consented** migration via `prompt_yn_sticky mcp.serenaMigrate` — `claude mcp remove serena -s project` — never forced, because `.mcp.json` may be committed team config [S1].
- `bootstrap-prefs-schema.json` documents two keys for this exact flow: `mcp.serenaMigrate` (offer to remove a legacy project-scope entry) and `mcp.serena` (fresh install, always local scope) [S2].
- `mcp-add-scope-writes` (2026-07-29) is the origin of this design: it found Serena had been written to `.mcp.json` with `--scope project`, breaking on any machine other than the one that ran setup, and forcing the `.mcp.json` approval gate that also broke headless `bootstrap-serena.sh` runs. It recommended `--scope local` plus a consented migration path — exactly what is now shipped [S3].

## Key Findings

**Claude Code's own scope model confirms the repo's reasoning, independent of Serena specifics.**
- Three scopes exist: `local` (stored in `~/.claude.json`, keyed by absolute project path, private to the user who added it), `project` (`.mcp.json` at repo root, meant to be committed and shared), `user` (global, all projects) [S4][S5].
- Precedence when names collide: local > project > user, with no field-level merging — a local entry fully overrides a same-named project entry [S4][S7].
- **Project-scoped `.mcp.json` triggers a per-teammate approval prompt on first use**, specifically because it "arrives with cloned code" — Claude Code cannot assume a committed config is safe to run without confirmation [S4][S6]. This is the same approval gate `mcp-add-scope-writes` found was breaking headless `bootstrap-serena.sh` invocations [S3].
- **Anything in a project-scope entry's config is expected to end up in git history** — env vars, and by extension any embedded path — because `.mcp.json` is "configuration-as-code for your team" [S5][S4].

**Serena's `--project` argument is exactly the kind of value that shouldn't be in a committed file.** It's an absolute filesystem path unique to whoever ran `claude mcp add`. Committing it means:
- Every other clone of the repo — a teammate on a different machine, or the same user with the repo checked out at a second path — gets a `.mcp.json` entry pointing at a directory that doesn't exist for them, and Serena silently fails to start until they notice and fix it by hand.
- The path becomes stale git history noise the moment anyone renames or relocates their clone.

**The general community pattern for personal, per-machine tool config is local scope, not project scope with per-user overrides.** Teams that use project scope productively do so for genuinely shared, path-free servers (a hosted docs server, a team database connector reached over HTTP/URL) and push anything personal — auth tokens, in the sources' examples — to local-scoped entries layered on top [S6]. Serena's absolute path is the structural equivalent of a personal credential: valid for exactly one machine, wrong for everyone else.

**No scenario surfaced where project-scope Serena is actually preferable.** The only argument for `.mcp.json` in general — "the whole team gets the same config for free on clone" — inverts for Serena, because the one field that matters (`--project <path>`) *cannot* be the same for everyone. A hypothetical relative-path or `${workspaceFolder}`-style substitution isn't part of Claude Code's scope model in the sources reviewed here [S4][S5][S7] *(no primary source found for MCP-level variable expansion of `--project`; treat as unsupported unless verified separately)*.

## Constraints
- `.mcp.json` may be committed team config the repo doesn't own outright — migration off it must stay consent-gated, never automatic, as the current code already does [S1][S3].
- bash 3.2, no `--json` on `claude mcp get` in this codebase's target environment — scope detection has to stay string-based (already true today) [S3].
- Any recommendation has to work for machines that never ran the earlier, project-scope-writing version of bootstrap and so have nothing to migrate.

## Solution Comparison

| Criteria | Project scope (`.mcp.json`, committed) | Local scope (`~/.claude.json`, current default) |
|----------|------------------------------------------|--------------------------------------------------|
| **Path correctness across clones** | Breaks — absolute `--project` path is machine-specific | Correct — each machine registers its own path |
| **Onboarding friction** | Approval prompt on every teammate's first use of the repo [S4][S6] | No `.mcp.json` gate; registered directly per machine |
| **Headless / `claude --print` runs** | Blocked by the approval gate unless bypassed [S3] | Loads without the gate |
| **Git hygiene** | Machine-specific path becomes committed history noise | Nothing project-specific enters git |
| **"Free" propagation to new clones** | Nominally yes, but the propagated value is wrong | No — each teammate runs `bootstrap setup`/`update` once (already the documented manual step) |
| **Codebase fit** | Contradicts the repo's own existing rationale and shipped code | Matches current `install-mcps.sh`, schema, `CLAUDE.md`, and prior research |
| **Maintenance** | Requires a permanent migration prompt for stragglers | None once registered |

## Recommendation

**Keep local scope as the only path Serena registers through — no code change indicated.** The existing implementation is correct and already matches both Claude Code's documented scope semantics and this repo's own prior research. Two small, optional hardening ideas surfaced during this pass, not required:

1. `CLAUDE.md`'s "Manual setup steps" section already documents the `--scope local` command correctly — no drift found.
2. If Serena or Claude Code ever ships path templating for `.mcp.json` (e.g. a `${projectRoot}`-style token), this recommendation should be revisited — until then, treat project-scope Serena as a standing anti-pattern for this repo and any repo bootstrap sets up.

**Risks and mitigations**: the only residual risk is a repo whose `.mcp.json` still carries a legacy project-scope Serena entry from a pre-fix bootstrap version — already handled by the `mcp.serenaMigrate` consent-gated prompt [S1][S2].

**Alternative if constraints change**: none identified — the case against project scope is structural (the `--project` value is inherently per-machine), not a preference that would flip with different team conventions.

## Next Steps
- No task needed — the recommendation matches shipped behavior.
- `/wiki-ingest raw/research/serena-mcp-scope/index.md` to fold this into the knowledge base (this repo currently has no wiki page for Serena's MCP scope decision; `mcp-add-scope-writes` was never ingested either — both are candidates for the same ingest pass).
