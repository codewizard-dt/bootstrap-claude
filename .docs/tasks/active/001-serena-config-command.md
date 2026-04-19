# 001 — /serena-config slash command

## Objective

Add a `/serena-config` slash command that interactively configures Serena's language servers in the target project's `.serena/project.yml`, supporting both additions and removals.

## Approach

The command reads `.serena/project.yml` and auto-detects likely languages **before** prompting, then uses grouped `AskUserQuestion` multi-selects to add/remove entries. Final list is written back via `Edit`. No changes to `setup-project.sh` or `update-project.sh` — this replaces the earlier shell-script plan.

## Prerequisites

- [ ] `.serena/project.yml` exists in the target project (created by first Serena MCP start)
- [ ] `AskUserQuestion` tool is available in the Claude Code session

---

## Steps

### 1. Create the slash command file  <!-- agent: general-purpose -->

- [x] Create `.claude/commands/serena-config.md` with frontmatter `description: Interactively configure Serena language servers` and `argument-hint: (no arguments)` <!-- Completed: 2026-04-18 -->
- [x] Include the standard header lines used by other commands: <!-- Completed: 2026-04-18 -->
  - `**Always obey `.docs/guides/mcp-tools.md`. Read it now if not already in context.**`
- [x] Body must encode the workflow defined in steps 2–7 below as numbered instructions for the executing agent. The command file IS the runtime spec — be explicit, do not defer logic to code. <!-- Completed: 2026-04-18 -->

### 2. Step A of command body — Read current state FIRST (before any prompting)  <!-- agent: general-purpose -->

- [x] Instruct the agent to `Read` `.serena/project.yml` at the repository root
  - If the file does not exist: abort with message "Run the Serena MCP at least once to generate `.serena/project.yml`, then re-run `/serena-config`."
- [ ] Parse the current `language:` (singular string) and/or `languages:` (list) fields. Record the existing selection as `CURRENT_LANGUAGES`.
  - Serena project.yml historically uses `language: <single>`; newer versions accept `languages: [list]`. The command must handle both and normalise to the list form on write.

### 3. Step B of command body — Auto-detect candidate languages (before prompting)  <!-- agent: general-purpose -->

- [x] Instruct the agent to run detection using the `Glob` tool (or `mcp__serena__find_file` if available) for these signals, collecting a set `DETECTED_LANGUAGES`:
  - `**/*.py` or `pyproject.toml` / `requirements.txt` / `setup.py` → `python`
  - `**/*.ts` / `**/*.tsx` / `**/*.js` / `**/*.jsx` / `package.json` → `typescript`
  - `**/*.go` / `go.mod` → `go`
  - `**/*.rs` / `Cargo.toml` → `rust`
  - `**/*.rb` / `Gemfile` → `ruby`
  - `**/*.java` / `pom.xml` / `build.gradle*` → `java`
  - `**/*.kt` / `**/*.kts` → `kotlin`
  - `**/*.scala` / `build.sbt` → `scala`
  - `**/*.cs` / `*.csproj` / `*.sln` → `csharp`
  - `**/*.c` / `**/*.cpp` / `**/*.h` / `**/*.hpp` / `CMakeLists.txt` → `cpp`
  - `**/*.php` / `composer.json` → `php`
  - `**/*.swift` / `Package.swift` → `swift`
  - `**/*.dart` / `pubspec.yaml` → `dart`
  - `**/*.ex` / `**/*.exs` / `mix.exs` → `elixir`
  - `**/*.erl` / `rebar.config` → `erlang`
  - `**/*.hs` / `*.cabal` / `stack.yaml` → `haskell`
  - `**/*.clj` / `**/*.cljs` / `deps.edn` / `project.clj` → `clojure`
  - `**/*.lua` → `lua`
  - `**/*.pl` / `**/*.pm` → `perl`
  - `**/*.r` / `**/*.R` → `r`
  - `**/*.zig` → `zig`
  - `**/*.nix` → `nix`
  - `**/*.sh` / `**/*.bash` / `**/*.zsh` → `bash`
  - `**/*.md` → `markdown`
  - `**/*.yml` / `**/*.yaml` → `yaml`
  - `**/*.toml` → `toml`
  - `**/*.vue` → `vue`
  - `**/*.sol` → `solidity`
  - `**/*.ml` / `**/*.mli` → `ocaml`
  - `**/*.f90` / `**/*.f95` / `**/*.f03` → `fortran`
  - `**/*.jl` → `julia`
  - `**/*.groovy` → `groovy`
  - `**/*.dart` → `dart`
  - `**/*.tf` → `terraform`
- [x] Compute `UNION = CURRENT_LANGUAGES ∪ DETECTED_LANGUAGES`. Display a human-readable summary to the user before any prompt, e.g.:
  - `Currently configured: python, typescript`
  - `Detected in repo: python, typescript, bash, markdown, yaml`

### 4. Step C of command body — Confirm the "keep" set  <!-- agent: general-purpose -->

- [x] Use one `AskUserQuestion` (single-select) asking: "Use the union of currently-configured + detected languages as the starting point?" with options:
  - `Yes, use union as base (Recommended)` — start from UNION
  - `Start from currently-configured only` — start from CURRENT_LANGUAGES
  - `Start from empty` — start from ∅
- [x] Record the user's choice as `BASE_LANGUAGES`.

### 5. Step D of command body — Offer additions via grouped multi-select  <!-- agent: general-purpose -->

- [x] Compute `ADDABLE = FULL_LIST − BASE_LANGUAGES` where `FULL_LIST` is the complete Serena-supported language set (see appendix in the command file — see step 8 below).
- [x] Issue up to 4 `AskUserQuestion` calls (one per category) each as `multiSelect: true`. Only include a category question if it has ≥1 addable language. Cap each question at 4 options; if a category exceeds 4, split into "Group A" / "Group B".
  - **Scripting & shell**: `bash`, `python`, `python_jedi`, `perl`, `lua`, `ruby`, `ruby_solargraph`, `powershell`
  - **Web & app**: `typescript`, `typescript_vts`, `vue`, `php`, `php_phpactor`, `dart`, `swift`, `kotlin`
  - **Systems & compiled**: `go`, `rust`, `cpp`, `csharp`, `csharp_omnisharp`, `java`, `scala`, `zig`, `fortran`, `haskell`, `ocaml`, `fsharp`, `elixir`, `erlang`, `clojure`, `groovy`, `julia`, `crystal`, `nix`
  - **Markup, config & data**: `markdown`, `yaml`, `toml`, `terraform`, `r`, `solidity`, `al`, `matlab`, `ansible`, `pascal`
- [x] Collect `ADDITIONS` as the union of user selections across these questions.

### 6. Step E of command body — Offer removals  <!-- agent: general-purpose -->

- [x] Compute `REMOVABLE = BASE_LANGUAGES ∪ ADDITIONS`. If the set is non-empty, issue `AskUserQuestion` multi-selects (grouped the same way if >4 items) asking "Select any languages to REMOVE".
- [x] Record `REMOVALS`.
- [x] Compute `FINAL = (BASE_LANGUAGES ∪ ADDITIONS) − REMOVALS`. If `FINAL` is empty, abort with message "Refusing to write an empty language list. Re-run and select at least one language."

### 7. Step F of command body — Write `.serena/project.yml`  <!-- agent: general-purpose -->

- [x] Show the user the proposed `FINAL` list and confirm via `AskUserQuestion` (single-select Yes/No) before writing.
- [x] Use the `Edit` tool to update `.serena/project.yml`:
  - If the file contains a `language:` (singular) line: replace it with a `languages:` list block containing `FINAL`, sorted alphabetically.
  - If the file contains a `languages:` block: replace the entire block with the new sorted list.
  - Preserve all other fields and comments in the file byte-for-byte outside the languages region.
- [x] Print a final summary: `Updated .serena/project.yml — languages: [a, b, c]`
- [x] Remind user to restart the Serena MCP for changes to take effect: `claude mcp restart serena` (or the equivalent for their Claude Code version).

### 8. Command-file appendix — full Serena language list  <!-- agent: general-purpose -->

- [x] At the bottom of `.claude/commands/serena-config.md`, include a reference section titled `## Supported Languages` listing every identifier accepted by Serena's `language(s)` field. Source: https://oraios.github.io/serena/01-about/020_programming-languages.html. The list (as of 2026-04):
  - `al, ansible, bash, clojure, cpp, crystal, csharp, csharp_omnisharp, dart, elixir, elm, erlang, fortran, fsharp, go, groovy, haskell, haxe, java, julia, kotlin, lua, luau, markdown, matlab, msl, nix, ocaml, pascal, perl, php, php_phpactor, powershell, python, python_jedi, r, rego, ruby, ruby_solargraph, rust, scala, solidity, swift, terraform, toml, typescript, typescript_vts, vue, yaml, zig`

### 9. Update CLAUDE.md commands table  <!-- agent: general-purpose -->

- [x] Edit `/Users/davidtaylor/Repositories/basic-project-setup/CLAUDE.md`
- [x] Add a row to the "Custom Commands" table: `| `/serena-config` | Interactively configure Serena language servers in `.serena/project.yml` |`
- [x] Place it in a sensible position (near `/primer` / setup-related commands).

### 10. Verification  <!-- agent: general-purpose -->

- [x] Confirm `.claude/commands/serena-config.md` exists and parses as valid markdown with frontmatter
- [x] Confirm the command body reads the project file and runs detection **before** any `AskUserQuestion` call (per project feedback rule — see memory `feedback_context_before_prompting`)
- [x] Confirm CLAUDE.md lists the new command
- [ ] Manually dry-run the command in a test project <!-- human-only verification -->
<!-- Updated: 2026-04-18 --> with a pre-existing `.serena/project.yml` that uses `language: python` and verify:
  - The legacy `language:` line is converted to `languages:` list form
  - Detected languages appear in the "Detected in repo" summary
  - Additions and removals both work
  - Aborting at the final confirm leaves the file untouched
