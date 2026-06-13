# bootstrap-claude

Bootstrap Claude Code projects with an **LLM Wiki**, reusable skills, hooks, and 4 MCP servers — in a single command.

```
npx @codewizard-dt/bootstrap setup
```

---

## Quick start

| Command | What it does |
|---------|-------------|
| `npx @codewizard-dt/bootstrap setup` | Full project setup: install MCPs + skills globally, scaffold wiki, scaffold CI/CD, bootstrap Serena |
| `npx @codewizard-dt/bootstrap update` | Sync wiki scaffold + guides, reinstall skills globally |
| `npx @codewizard-dt/bootstrap install` | Install/update MCPs, hooks, and skills globally only (no project path needed) |
| `npx @codewizard-dt/bootstrap deploy` | Scaffold `.github/` CI/CD workflows + `.gitleaks.toml` into the project |
| `npx @codewizard-dt/bootstrap migrate [--dry-run]` | Migrate a legacy `.docs/` project to the wiki structure (Claude-driven) |
| `npx @codewizard-dt/bootstrap typechecks [ts py ...]` | Strict type-checking setup via Claude |

**Prerequisites:** `node ≥ 18`, [`claude` CLI](https://docs.anthropic.com/en/docs/claude-code), [`uv`](https://github.com/astral-sh/uv) (for Serena), Claude API key.

---

## The LLM Wiki architecture

Every project bootstrapped with this template gets a three-layer LLM Wiki:

```
raw/          ← Immutable ground-truth sources (the LLM reads but never modifies)
wiki/         ← LLM-maintained knowledge base (the LLM owns entirely)
CLAUDE.md     ← Schema: tells the LLM how the wiki is structured
```

### Two domains, opposite organizing laws

**`wiki/knowledge/`** — timeless synthesis, organized by links not status. Pages are revised in place as understanding evolves; no `status` field. Sub-trees: `sources/`, `concepts/`, `entities/{people,organisations,tools,components}/`.

**`wiki/work/`** — stateful lifecycle artifacts, organized by status. Files are **never moved** after creation; state lives in the `status:` frontmatter field. Each family keeps an `index.md` listing **only active items** — completed/terminal items are removed from the index, not the file system.

Work families: `requirements/` (REQ-NNN) · `decisions/` (DEC-NNNN) · `roadmaps/` (ROADMAP-NNN) · `tasks/` (TASK-NNN) · `uat/` (UAT-NNN, own family) · `bugs/` (BUG-NNNN).

See `raw/llm-wiki.md` for the underlying pattern spec.

---

## Package layout

```
bin/          cli.js — entry point for npx commands
lib/
  skills/     55 custom skill definitions — installed to ~/.claude/skills/
  hooks/      PreToolUse hook scripts — installed to ~/.claude/hooks/
  prompts/    Claude prompt templates read by the setup scripts
  scripts/
    templates/wiki/   canonical wiki scaffold (instantiated by sync-wiki-scaffold.sh)
    sync-wiki-scaffold.sh
    setup-project.sh / update-project.sh / install-global.sh
    setup-deployment.sh / setup-strict-typechecks.sh
    merge-gitignore.sh / bootstrap-serena.sh / setup-runner.sh / startup.sh
raw/
  llm-wiki.md           LLM Wiki pattern spec
  design-principles.md  Engineering principles
  house-style/          Design system snapshot
  guides/               Source guides synced to .docs/guides/ in target projects
```

---

## What setup and update do

| Step | setup | update |
|------|-------|--------|
| Install MCPs globally (brave-search, context7, playwright) | ✅ | ✅ |
| Install hooks globally (`~/.claude/hooks/`) | ✅ | ✅ |
| Install skills globally (`~/.claude/skills/`) | ✅ | ✅ |
| Scaffold wiki (copy-once) + sync guides (always refresh) | ✅ | ✅ |
| Merge `.gitignore` | ✅ | ✅ |
| Register Serena MCP (per-project) | ✅ | ✅ (idempotent) |
| Bootstrap Serena `project.yml` | ✅ | ✅ (idempotent) |
| Scaffold CI/CD (`.github/` + `.gitleaks.toml`) | ✅ | ❌ (never clobbered) |

### Copy-once vs always-refresh

The wiki scaffold uses two policies:

- **Copy-once** — `wiki/index.md`, `wiki/log.md`, per-family `index.md`, `.gitkeep` files. Created once; your project owns them after that.
- **Always-refresh** — `wiki/conventions.md`, all `lifecycle.md` files, all `raw/guides/` files. Template-owned spec docs; overwritten on every `update` to stay current.

---

## Skills

50+ custom skills are installed globally to `~/.claude/skills/` and available in any project. See the full command table in `CLAUDE.md`. Key families:

- **Wiki**: `/wiki-ingest`, `/wiki-query`, `/wiki-lint`
- **Requirements**: `/req-create`, `/req-finalize`, `/req-update`, `/req-retire`, `/req-compile`, `/req-extract-decisions`
- **Decisions**: `/decision-create`, `/decision-finalize`, `/decision-walkthrough`, `/decision-next`
- **Tasks + UAT**: `/task-add`, `/tackle`, `/uat-generate`, `/uat-walk`, `/uat-auto`, `/uat-auto-plus`, `/uat-skip`, `/task-audit`, `/task-trash`, `/task-update`
- **Bugs**: `/bug-file`, `/bug-triage`, `/bug-close`
- **Roadmaps**: `/roadmap-create`, `/roadmap-add`, `/roadmap-next`
- **Research**: `/research`, `/wiki-query`, `/deep-research`
- **Utilities**: `/primer`, `/lint`, `/git-commit`, `/update-docs`, `/demo`, `/gap-assess`

Hooks (installed to `~/.claude/hooks/`) enforce Serena-first navigation and protect git operations. See `lib/hooks/README.md` for the required settings.json wiring.

---

## Design decisions

- **Templates are canonical, repo dogfoods its own scaffold** — `lib/scripts/templates/wiki/` is the single source of truth. The repo's own `wiki/` was instantiated by running `sync-wiki-scaffold.sh .`, so scaffold-rule edits propagate by re-running it.
- **Global skills, per-project Serena** — skills are installed globally once; Serena is registered per-project with an absolute path (prevents language-config bleed between projects).
- **Never-move work artifacts** — status lives in frontmatter; files are stable forever; links never break.
- **Per-family active indexes** — each `wiki/work/<family>/index.md` lists only active items. Completed items drop off the index; the files stay. This makes "what's in flight" a single `Read` call.
- **Deploy is a separate seam** — CI/CD scaffolding is copy-once on first setup and never touched on update; projects hand-customize their workflows.

---

## Publishing

```bash
npm version minor          # or major / patch
npm publish --access public
```

The `files` field in `package.json` ships `bin/`, `lib/`, `raw/`, `.github/`, `.gitleaks.toml`.

---

## Migrating an existing `.docs/` project

If your project has the old `.docs/`-based layout (tasks in `.docs/tasks/`, ADRs in `.docs/adr/`, etc.):

```bash
npx @codewizard-dt/bootstrap migrate --dry-run   # preview what would migrate
npx @codewizard-dt/bootstrap migrate             # run the migration
```

The migration is Claude-driven and requires a **clean git tree**. It creates a fresh `wiki-migration` branch, scaffolds the wiki, then `git mv`s every artifact to its new home (history preserved), synthesizes frontmatter (`id`/`status`/dates), renames files to ID-prefixed form (`NNN-slug.md` → `TASK-NNN-slug.md`, ADRs → `DEC-NNNN-slug.md`), rewrites cross-references (`**Implements**: ADR-…` → `implements::[[DEC-…]]`), builds the per-family active indexes, and removes the emptied `.docs/` family dirs. `.docs/guides/` and `.docs/company-context/` are kept.

Afterwards: review the diff, run `/wiki-lint` in Claude Code, commit, and merge the branch.

Status mapping: `completed/` → `done`/`passed`, `skipped/` → `skipped`, `trashed/` → `trashed`, `archived/` → `retired`, `in-progress/`/`closed/` → same-named statuses. Nothing is deleted — terminal items just don't appear in the active indexes.

---

## Troubleshooting

**`command not found: bootstrap`** — run `npx @codewizard-dt/bootstrap install` or add `node_modules/.bin` to your PATH.

**Serena not connecting** — run from the project root: `claude mcp add --scope project serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project "$(pwd)"`.

**Stale old-named skills** (adr-*, prd-*) in `~/.claude/skills/` — run `npx @codewizard-dt/bootstrap install`; the install script will detect and prompt to remove them.

**Hook prompts not suppressed** — the install script copies hook scripts to `~/.claude/hooks/` but does NOT wire them into `~/.claude/settings.json`. See `lib/hooks/README.md` for the one-time manual wiring step.
