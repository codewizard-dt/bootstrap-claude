---
name: type-check
description: Detect available type-checking tools (typecheck, tsc, mypy, pyright, go vet, cargo check, etc.), delegate to a matching skill when one exists, otherwise fix errors one at a time in verify cycles until all checkers are clean
model: claude-sonnet-4-6
disable-model-invocation: true
---
**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**

# type-check

Detect type-checking commands available in this project. For each one, check whether a dedicated skill already exists that handles it — if so, invoke that skill. Otherwise run the built-in fix cycle.

---

## Step 1: Discover Existing Type-Checking Skills

Before inspecting project config, list `.claude/skills/` to find skills already designed for a specific type checker. Use `mcp__serena__list_dir` on `.claude/skills/` (non-recursive).

For each skill directory found, read its `SKILL.md` frontmatter (`name:` and `description:` fields) to decide relevance. A skill is a **type-check skill** if its name or description contains any of:

`mypy`, `pyright`, `basedpyright`, `pyre`, `pytype`, `tsc`, `typecheck`, `type-check`, `type-hint`,
`vue-tsc`, `svelte-check`, `astro check`, `deno check`, `go vet`, `cargo check`, `srb`, `dialyzer`, `dotnet build`

Build a **skill map**: `{ checker-keyword → skill-name }`.

Example: a skill named `fix-mypy` with description containing "mypy" → `{ "mypy" → "fix-mypy" }`.

---

## Step 2: Detect Type-Checking Tools

Build a **run plan** by inspecting project metadata. Use Serena tools (`find_file`, `list_dir`, `search_for_pattern`) and `Read` for config files. Never use shell-glob or `cat`. Skip duplicates (e.g. don't add raw `tsc` if a `typecheck` script already wraps it).

The **skill-map keyword** for each checker is the tool binary name visible in the command (e.g. `mypy`, `tsc`, `pyright`). Exception: `check-types` script → keyword `tsc`.

### TypeScript / JavaScript

`<pm>` resolution: `pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`; `bun.lock`/`bun.lockb` → `bun`; otherwise `npm`.

| Signal | Command |
|---|---|
| `package.json` script `typecheck` | `<pm> run typecheck` |
| `package.json` script `type-check` | `<pm> run type-check` |
| `package.json` script `tsc` | `<pm> run tsc` |
| `package.json` script `check-types` | `<pm> run check-types` |
| `tsconfig.json` exists, no script above wraps `tsc` | `<pm> exec tsc --noEmit` |
| `vue-tsc` in dependencies | `<pm> exec vue-tsc --noEmit` |
| `svelte.config.js` or `svelte` dep | `<pm> exec svelte-check` |
| `astro.config.*` | `<pm> exec astro check` |
| `deno.json` / `deno.jsonc` | `deno check **/*.ts` |

### Python

| Signal | Command |
|---|---|
| `mypy.ini`, `.mypy.ini`, or `[tool.mypy]` in `pyproject.toml` | `mypy .` |
| `pyrightconfig.json` or `[tool.pyright]` | `pyright` |
| `[tool.basedpyright]` in `pyproject.toml` | `basedpyright` |
| `.pyre_configuration` | `pyre check` |
| `[tool.pytype]` or `pytype.cfg` | `pytype` |
| `[tool.ty]` | `ty check` |
| `Makefile` with `typecheck`/`type-check` target | `make typecheck` |
| `tox.ini` with `mypy` env | `tox -e mypy` |

### Go, Rust, and Other

| Signal | Command |
|---|---|
| `go.mod` | `go vet ./...` then (if clean) `go build ./...` |
| `Cargo.toml` | `cargo check --all-targets` |
| `sorbet/config` | `bundle exec srb tc` |
| `*.csproj` / `*.sln` | `dotnet build --no-restore --nologo` |
| `Package.swift` | `swift build` |
| `mix.exs` with `:dialyxir` | `mix dialyzer` |

After detection, annotate the run plan with skill matches and print:

```
Detected N type-checker(s):
  1. [label] → <command>  [skill: fix-mypy]
  2. [label] → <command>  [built-in fix cycle]
  ...
```

---

## Step 3: Graceful Exit if Nothing Detected

If the run plan is **empty**, report and stop:

```
No type-checking tools detected in this project.
(Looked for: package.json scripts, tsconfig.json, mypy/pyright/pyre/pytype/ty config,
go.mod, Cargo.toml, sorbet, *.csproj, Package.swift, mix.exs.)
```

End the skill.

---

## Step 4: Command Safety Check (Before Any Bash Call)

Before executing **any** Bash command in this skill, validate it against the following pattern:

**Banned pattern — newline + `#` inside a quoted argument:**

```
# DANGEROUS — the \n# turns everything after it into a shell comment,
# hiding arguments from path validation and triggering an approval prompt
some-tool "arg1\n# hidden arg"
```

If a constructed command string contains a literal newline (or `\n` that would expand to one) followed by a `#` anywhere inside a quoted argument, **do not run it**. Rewrite as a single flat line. This most commonly appears when interpolating multiline file content or error messages into a shell argument — always strip newlines before interpolating.

Apply this check to every `Bash` call: checker invocations, verification re-runs, and auxiliary commands.

---

## Step 5: Run Each Checker — Skill Delegation or Fix Cycles

Work through the run plan **one entry at a time**.

### 5A — Dedicated skill exists → delegate

If the entry's keyword matched a skill in the skill map (Step 1):

1. Announce: `Delegating [label] to /[skill-name].`
2. Invoke that skill via the `Skill` tool, passing any relevant arguments (e.g. a file path if the user scoped this run).
3. Wait for the skill to complete.
4. If the skill reports success (clean) → move to the next entry.
5. If the skill reports remaining errors or exits unclean → **stop the entire run**. Report which skill failed.

Do **not** run the built-in fix cycle after invoking a dedicated skill. Trust the skill's output.

### 5B — No skill → built-in fix cycle

If no skill matched, run the checker directly and iterate until clean.

**Cycle start:**

1. Run the checker command via `Bash` (Step 4 safety check first).
2. If exit code `0` and no error markers: **checker is clean** → move to the next entry (or finish if this was the last).
3. If errors are present: begin the fix cycle loop.

**Fix cycle loop — Cycle N:**

1. **Parse the first error** from the output (first listed).
2. **Read the relevant code** using Serena symbolic tools (`find_symbol`, `get_symbols_overview`) or `Read` for markdown/config.
3. **Understand the cause** — what the type error means and why it occurs.
4. **Apply the minimal fix** using Serena symbolic edit for code; `Edit` for markdown/config.
5. **Re-run the checker** to verify:
   - **Fixed** (error gone): report `"Fixed: [error] in [file]"` and start the next cycle.
   - **Still present or new errors introduced**: attempt an alternative fix (max 2 retries). After 2 failed retries, skip the error, report it as unresolvable, and move to the next error.

Display progress after each cycle:

```
Cycle N complete. [label]: X error(s) remaining.
```

**Clean state:**

```
✅ [label] clean. Fixed X error(s) in Y cycle(s).
```

**Rules:**

- **One fix per cycle** — never batch multiple errors.
- **Verify after every fix** — always re-run before moving on.
- **Skip after 2 retries** — report the skip and continue.
- **Don't introduce new errors** — revert and try a different approach if a fix adds errors.
- **Minimal changes only** — fix the type error, nothing else.
- **No suppression annotations** — do not add `// @ts-ignore`, `# type: ignore`, or `cast()` as a fix. These hide errors; they don't resolve them.

---

## Step 6: Report When All Checkers Pass

When every entry in the run plan is clean (via skill delegation or built-in cycles):

```
✅ All N type-checker(s) passed.
```
