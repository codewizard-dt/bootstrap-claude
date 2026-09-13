---
topic: "Renaming lib/skills/req-* skills to requirement-* and finalizing the wiki-skill-simplification fix list into an execution roadmap"
slug: req-to-requirement-rename
researched: 2026-09-13
---

# Primary Sources — Renaming `req-*` Skills to `requirement-*`

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-global.sh` lines 9-13, 43-77 | 2026-09-13 | The existing `ORPHAN_SKILLS` pruning mechanism from the prior `adr`→`decision`, `prd`→`req` rename; the pattern to extend for `req`→`requirement` |
| S2 | codebase | `CLAUDE.md` lines 107-111 (Custom Commands table) | 2026-09-13 | Confirms 5 of 6 `req-*` commands are documented there; `req-retire` is absent — a pre-existing doc-drift bug found incidentally |
| S3 | codebase | `lib/scripts/templates/wiki/work/requirements/lifecycle.md` lines 31-32; `wiki/work/requirements/lifecycle.md` lines 31-32 | 2026-09-13 | Confirms the template-source vs. local-copy split applies to this lifecycle file's prose, not just its schema table |
| S4 | codebase | `package.json` (`files` field) | 2026-09-13 | Confirms `lib/` ships wholesale — no per-skill-name entry to edit, so the rename is not an npm manifest breaking change |
| S5 | codebase (via search) | `mcp__serena__search_for_pattern` for `req-` across `lib/hooks/` and `lib/scripts/` | 2026-09-13 | Confirms no hook or settings-template file references `req-*` skill names — only `lib/scripts/README.md`'s prose (describing the orphan-pruning feature) and the lifecycle template match |
| S6 | codebase (via search) | `test/skill-frontmatter-aliases.test.js` lines 40, 68, 73; `test/wiki-work-naming-convention.test.js` lines 62-65 | 2026-09-13 | Confirms both test files hardcode the literal `req-create` name and path — will fail post-rename unless updated in the same change |

## Excerpts

### S1 — the ORPHAN_SKILLS precedent
`lib/scripts/install-global.sh` lines 9-13
> "# Stale global skill folders from the wiki rename (adr -> decision, prd -> req)\nORPHAN_SKILLS=(\n  adr-create adr-finalize adr-next adr-walkthrough\n  prd-create prd-finalize prd-extract-decisions prd-update prd-trash prd-compile\n)"

### S2 — req-retire missing from CLAUDE.md's command table
`CLAUDE.md` lines 107-111
> "| `/req-create <idea>` | ... |\n| `/req-finalize <file>` | ... |\n| `/req-extract-decisions <file>` | ... |\n| `/req-update <file> [change]` | ... |\n| `/req-compile <file>` | ... |"
(No `/req-retire` row appears anywhere in this table, though `lib/skills/README.md` lines 25-26 documents it.)

### S4 — package.json ships lib/ wholesale
`package.json` `files` field
> `"files": ["bin/", "lib/", "raw/", "!raw/research/", "!raw/companies/", "!raw/*.pdf"]`

### S6 — hardcoded test references
`test/skill-frontmatter-aliases.test.js` line 40
> `const REQ_CREATE_SKILL = path.join(REPO, 'lib', 'skills', 'req-create', 'SKILL.md');`
