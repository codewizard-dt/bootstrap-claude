# Type-Checking & Linting Templates

Templates live in `wiki/guides/type-checking-templates/` (source: `raw/guides/type-checking-templates/`; optional opt-in guide since 2.12, wiki location since 2.13). Created by analyzing real-world configs (15 tsconfigs, 6 pyproject.tomls, 3 eslint configs, 2 pyrightconfigs, 1 mypy.ini).

## Template Files

| Path | Use for |
|------|---------|
| `tsconfig/tsconfig.node-esm.jsonc` | Node.js service / CLI / MCP server (native ESM) |
| `tsconfig/tsconfig.vite-root.json` | Vite solution root (no compilation; references only) |
| `tsconfig/tsconfig.app.jsonc` | Vite + React browser app |
| `tsconfig/tsconfig.node.jsonc` | Vite config compilation (`vite.config.ts` only) |
| `tsconfig/tsconfig.lib.jsonc` | React/TS library emitting `.d.ts` |
| `python/pyproject.toml` | mypy + basedpyright + ruff + pytest + coverage |
| `python/mypy.ini` | Standalone mypy config |
| `python/pyrightconfig.json` | Pyright / basedpyright standalone |
| `eslint/eslint.config.ts` | ESLint flat config (React + TypeScript) |

## Key Decisions Baked In

- **tsconfig**: `nodeNext` for Node ESM, `bundler` for Vite; `noUncheckedIndexedAccess` + `verbatimModuleSyntax` beyond `strict: true`
- **mypy**: `strict = true` (never manual approximation); `ignore_missing_imports` per module (never global, never `ignore_errors`)
- **basedpyright**: companion mode with `typeCheckingMode = "off"`, opt-in only to mypy gap rules (TypedDict NotRequired — mypy#9408)
- **ruff**: `E, W, F, I, N, UP, B, C4, SIM, RUF` floor; `known-first-party` in isort section
- **ESLint**: `strictTypeChecked` + `parserOptions.projectService: true` (without projectService, all type-aware rules silently disabled)

## Top Anti-Patterns Found in the Wild

- `module: ESNext` + `moduleResolution: node` — semantically incompatible pair
- `typeCheckingMode` omitted in pyrightconfig — defaults to "off"
- `ignore_errors = true` on first-party modules — silences real bugs
- ESLint rules set to `"warn"` — silent tech debt that never gets fixed
- Missing `parserOptions.projectService` in eslint config — disables type-aware rules
