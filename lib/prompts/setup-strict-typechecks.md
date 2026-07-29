# Set up strict type checking for this project.

## Phase 1 — Assess languages

Scan the repo and identify every language that has a type-checking or linting tool (e.g. TypeScript, Python, Go, Rust, Java). For each
one, note:
- Which files / directories contain that language
- What config files already exist (tsconfig, pyproject.toml, mypy.ini, .eslintrc, etc.)
- What package manager / toolchain is in use

## Phase 2 — Establish strict-mode baselines (per language)

IMPORTANT: If `wiki/guides/type-checking-templates/` exists in the project, it is the authoritative baseline — start there, not from web
research. Read its `README.md` to pick the right variant, then read the chosen template files (they carry inline annotations explaining
every non-obvious decision):
- TypeScript: `tsconfig/` (node-esm / Vite three-file split / lib) + `eslint/eslint.config.ts`
- Python: `python/pyproject.toml` (mypy strict + ruff + basedpyright companion), `python/mypy.ini`, `python/pyrightconfig.json`

Use Context7 (library docs) or Brave Search (general practices, up to 50 req/sec, parallel OK) only to fill gaps the templates do not
cover: languages with no template (Go: staticcheck, go vet; Rust: #![deny(warnings)], Clippy --deny warnings; etc.), framework-specific
plugins, or flags added since the templates were written.

If `wiki/guides/type-checking-templates/` does NOT exist, fall back to researching current strict-mode recommendations from scratch with
Context7 / Brave Search:
- TypeScript: tsconfig strict, tseslint strictTypeChecked, stylisticTypeChecked, parserOptions.project
- Python: mypy --strict, pyproject.toml [tool.mypy]
- Go: staticcheck, go vet
- Rust: #![deny(warnings)], Clippy --deny warnings
- …and so on for any other language present

Either way, understand what the strict flags actually enable, the known gotchas (e.g. type-aware ESLint rules requiring
parserOptions.projectService; mypy needing per-module ignore_missing_imports for third-party stubs), and the idiomatic companion tools
(ESLint for TypeScript, mypy/pyright for Python). (The templates are an optional guide — the user can install them by re-running
`npx @codewizard-dt/bootstrap update` and answering yes for `type-checking-templates`.)

## Phase 3 — Install toolchain packages

Before touching any config file, ensure every required tool is actually installed in the project root. Do not just add entries to a
dependency file and stop — run the install command so the binaries are present and `make typecheck` can execute.

**TypeScript projects**
- Detect package manager: look for `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, otherwise npm.
- Install (example for pnpm; adjust for the detected manager):
  ```
  pnpm add -D typescript eslint @eslint/js typescript-eslint
  ```
  If the project uses a framework-specific ESLint plugin (e.g. `eslint-plugin-react`, `@next/eslint-plugin-next`,
  `eslint-plugin-vue`) install that too.
- Create `eslint.config.mjs` (flat config) at the project root if it does not exist. Use `typescript-eslint`'s
  `strictTypeChecked` + `stylisticTypeChecked` presets and set `parserOptions.projectService: true` so type-aware rules work.
- Create or update `tsconfig.json` at the project root with `"strict": true` and a `"include"` that covers all source directories.
  If a framework tsconfig already exists, extend it and layer strict on top rather than replacing it.

**Python projects**
- Detect toolchain: look for `pyproject.toml` → use `uv` (preferred) or `pip`; look for `requirements*.txt` → use pip.
- Install:
  ```
  uv add --dev ruff mypy   # or: pip install ruff mypy
  ```
- Create `ruff.toml` (or `[tool.ruff]` in `pyproject.toml`) at the project root with `line-length`, `select = ["ALL"]`, and a
  reasonable `ignore` list (at minimum: `D`, `ANN`, `S101` unless tests are excluded by path).
- Create `[tool.mypy]` in `pyproject.toml` (or `mypy.ini`) with `strict = true` and `ignore_missing_imports = true` for any
  third-party packages that lack stubs.

**Go projects**
- Install staticcheck: `go install honnef.co/go/tools/cmd/staticcheck@latest`
- No config file needed; use `go vet ./...` + `staticcheck ./...` in the Makefile target.

**Rust projects**
- No install needed; Clippy ships with rustup.
- Add a `clippy.toml` at the project root only if project-wide lint levels need tuning.

**Other languages**: follow the same pattern — install first, then write config.

After installing, verify the binaries resolve from the project root before proceeding:
- TypeScript: `npx tsc --version` and `npx eslint --version`
- Python: `ruff --version` and `mypy --version`
- Go: `staticcheck --version`

## Phase 4 — Configure

For each language, finalize the config files written in Phase 3 to enable strict mode (flags, rules, paths). Do **not** run the type
checker and do **not** attempt to fix any errors — this phase is setup only.

## Phase 5 — Makefile

Create (or update) a root-level Makefile with:
make typecheck        # runs all language checks in sequence
make typecheck-<lang> # per-language target

Each per-language target must:
- Run any required code-generation step first (e.g. tsr generate for TanStack Router before tsc -b)
- Run the type checker
- Run the linter if one exists for that language
- Exit non-zero on any error

If a language directory is empty (no source files yet), the target must skip gracefully rather than fail.

## Phase 6 — Skill

Write ~/.claude/skills/typecheck/SKILL.md with this exact content (do not alter the structure):

```
---
name: typecheck
description: Run typecheck, fix the first error, repeat until clean
model: claude-sonnet-5
disable-model-invocation: false
user-invocable: true
---

# Run typecheck and fix issues

IMPORTANT: Adhere to all rules in `wiki/guides/mcp-tools.md` if it exists.

## Step 1: find the problem

Run `make typecheck 2>&1 | head -20`

If there are no errors, this task is done.

## Step 2: assess the problem

- Analyze the output for only the **first** error reported
- Use Serena to read the relevant code symbols where the error occurs
- Understand the root cause: type annotation issue, import problem, or genuine type mismatch?
- Use Context7 or Brave Search if you need more detail on the error

## Step 3: fix the root cause

- Fix the root cause of the first error using Serena's symbolic editing tools
- Re-run `make typecheck 2>&1 | head -20` to verify the fix

## Step 4: repeat, one error at a time

- Repeat steps 1–3 until the output is empty
- Do not keep a to-do list of separate errors — just run the command again to get the next one
```

## Phase 7 — Report

Do **not** run `make typecheck`. Report to the user:

- Which languages were configured and what strict flags were enabled for each
- Which config files were created or updated
- Which packages were installed
- How to run type checking: `make typecheck` (all languages) or `make typecheck-<lang>` (per language)
- How to start fixing errors interactively: run `/typecheck`

**Type-checking is now set up and ready to use.**