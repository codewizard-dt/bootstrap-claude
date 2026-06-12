## bootstrap-claude

Setting up Claude Code for a new project means 45 minutes of the same repetitive work: adding four MCP servers, creating task directories, defining documentation conventions. This package does all of it in one `npx bootstrap-claude setup` run.

### Why it's interesting

The key idea is that markdown files are better instructions than chat. Every handoff in the workflow — task files, UAT specs, ADRs — has a defined schema that gives Claude unambiguous instructions, which means you can hand off work and trust the output. State lives in `.docs/` files rather than conversation history, so any agent in any context window can pick up a task and continue without needing to be re-briefed.

### Who it's for

Developers who use Claude Code daily and rebuild the same scaffolding from scratch on every new project.

### The best features

- **47 slash commands** installed globally in a single rsync call, spanning the full dev lifecycle: requirements (`/prd-create`), architecture decisions (`/adr-create`), task tracking (`/task-add`), implementation delegation (`/tackle`), automated testing (`/uat-auto`), and documentation updates (`/update-docs`).
- **`/tackle`** reads a structured task file and delegates each step to subagents sequentially — implementation, verification, and doc updates — so you can hand off a task and come back to a PR-ready result.
- **`/uat-auto`** generates acceptance test specs from task files and runs them headlessly with auto-judged verdicts, closing the loop between spec and verification without any manual test writing.

### The best part

The whole system is stateless from the package's perspective: all project state lives in `.docs/` markdown files, which means it works equally well whether you're running one agent or an entire fleet.
