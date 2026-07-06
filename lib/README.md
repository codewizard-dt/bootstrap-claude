# lib/

This is the asset library packaged and shipped by `@codewizard-dt/bootstrap` (see the `files` field in `../package.json`). Nothing here runs standalone — `bin/cli.js` dispatches `bootstrap <command>` to a script in `lib/scripts/`, and that script copies, syncs, or generates the other three folders into a target project or into global Claude Code state (`~/.claude/`).

```
lib/
├── hooks/     Node.js PreToolUse/PostToolUse/SessionStart hook scripts — safety + Serena-first enforcement
├── scripts/   Bash orchestration — the only entry points invoked by bin/cli.js
├── prompts/   Markdown prompts fed to the `claude` CLI for context-sensitive scaffolding
└── skills/    SKILL.md slash-command definitions — the reusable agent workflow library
```

| Folder | What it is | Installed to |
|--------|-----------|---------------|
| [`hooks/`](hooks/README.md) | Enforcement scripts that block unsafe or non-Serena tool calls, even under `--dangerously-skip-permissions` | `~/.claude/hooks/` (copied by `install-global.sh`; registration in `~/.claude/settings.json` is manual — see `hooks/README.md`) |
| [`scripts/`](scripts/README.md) | Bash scripts that back every `bootstrap` CLI command, plus shared helpers and copy-once templates | Run in place from the installed npm package; write into the target project and `~/.claude/` |
| [`prompts/`](prompts/README.md) | Prompt templates for the setup steps that are too context-sensitive for static file copies (CI scaffolding, wiki migration, strict typechecks) | Read by scripts in `lib/scripts/` at runtime; never installed anywhere themselves |
| [`skills/`](skills/README.md) | One directory per skill, each holding a `SKILL.md` — the wiki-ops, requirement/decision/task/UAT/bug lifecycle, research, and utility skills | `~/.claude/skills/` (copied verbatim by `install-global.sh`) |

## How the pieces fit together

1. A user runs `npx @codewizard-dt/bootstrap <command>` (or the installed `bootstrap` bin).
2. `bin/cli.js` resolves the command to a script in `lib/scripts/` and execs it with the target project path.
3. That script sources `lib/scripts/lib.sh` for shared helpers, then does some combination of: installing MCP servers, `rsync`-ing `lib/skills/` and `lib/hooks/` to `~/.claude/`, scaffolding `wiki/`/`raw/` from `lib/scripts/templates/wiki/`, assembling `.docs/guides/mcp-tools.md` from `lib/scripts/templates/guides/stubs/`, and/or invoking `claude --print` with a prompt from `lib/prompts/` for anything that needs project-specific judgment (CI/CD scaffolding, `.docs/`→wiki migration, strict type-check setup).
4. Once installed, the target project's Claude Code sessions pick up the copied hooks (enforcement) and skills (slash commands) automatically; the wiki scaffold and `CLAUDE.md` additions give those sessions durable, file-system-backed state.

See the root [`README.md`](../README.md) for the full architecture diagram and component descriptions; this file and its children document `lib/` at the file level.
