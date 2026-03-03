---
description: Update documentation
---

# 🚨 MANDATORY REQUIREMENTS 🚨

## YOU MUST USE MCP TOOLS. THIS IS NON-NEGOTIABLE.

| Operation | REQUIRED Tool | FORBIDDEN Alternative |
|-----------|---------------|----------------------|
| Read code | `mcp__serena__find_symbol`, `mcp__serena__get_symbols_overview` | ~~Read~~ |
| Edit code | `mcp__serena__replace_symbol_body`, `mcp__serena__replace_content` | ~~Edit~~ |
| Search code | `mcp__serena__search_for_pattern` | ~~Grep~~ |
| Find files | `mcp__serena__find_file`, `mcp__serena__list_dir` | ~~Glob~~ |
| Library docs | `mcp__context7__*` | ~~WebSearch~~ for docs |
| Web research | `mcp__brave-search__*` | ~~WebSearch~~ |

**⛔ PROHIBITED**: Using Read, Edit, Write, Glob, or Grep for code files.

**Exception**: Standard Read/Edit/Write are permitted ONLY for markdown documentation files.

---

# Update Documentation Command

## Purpose
This command instructs a coding agent to update all relevant documentation after completing implementation work or when project state changes significantly.

---

## Instructions for Coding Agent

You are tasked with updating all relevant documentation to reflect the current state of the Healthcare Website Template project. Follow this comprehensive checklist:

### 1. **PROJECT_STATUS.md** (CRITICAL - Always Update)

Update the following sections in `PROJECT_STATUS.md`:

- **Implementation Progress**: Update completed items and next steps
- **Phase Progress**: Update completion checkboxes for each phase
- **Phase Status**: Mark phases as ✅ (complete), 🔄 (in progress), or ⏳ (future)
- **Critical Files Summary**: Add new important files if created

**When to Update**:
- After completing any phase or sub-phase
- After implementing major features
- After adding new components or pages
- When starting new work that changes priorities

---

### 2. **Agent Instructions** (`.docs/agent/`)

Update agent guides when workflows or patterns change:

- **`common-patterns.md`**: New patterns for adding components, pages, or Astro islands
- **`workflow-guide.md`**: Changes to development workflow or task management
- **`quality-gates.md`**: New quality checks or testing requirements
- **`code-style-guide.md`**: New coding standards or conventions
- **`mcp-tools-guide.md`**: Updates to MCP tool usage

**When to Update**:
- After establishing new development patterns
- When adding new quality gates or checks
- After refactoring common code patterns
- When coding standards evolve

---

### 3. **Specialized Agent Files** (`.claude/agents/`)

Update specialized agent instructions when their responsibilities change:

- **`component-architect.md`**: New component patterns, shadcn/ui conventions, React island patterns
- **`style-theme-guardian.md`**: New theming patterns, CSS custom properties, accessibility styling
- **`mdx-content-handler.md`**: MDX templates, content collection schemas, article patterns

**When to Update**:
- After implementing new patterns in that agent's domain
- When agent responsibilities expand or change
- After discovering better practices for that domain

---

### 4. **README Files**

Update README files at various levels:

- **Root `README.md`**: Tech stack, quick start, project overview
- **Component READMEs**: Usage examples for complex components (if created)

**When to Update**:
- After changing tech stack or dependencies
- After adding new setup steps
- When quick start instructions change
- After creating reusable components that need documentation

---

### 5. **CLAUDE.md** (AI Agent Entry Point)

Update `CLAUDE.md` when:

- New specialized agents are added
- Agent delegation chain changes
- Critical requirements or workflows change
- New MCP tools are introduced
- Quality gates or development commands change
- Project architecture changes significantly

**When to Update**:
- After creating new specialized agents
- When changing mandatory workflows
- After updating quality gate requirements

---

## Update Workflow

Follow this sequence when updating documentation:

### Step 1: Assess Scope
- What was implemented or changed?
- Which documentation sections are affected?
- Are there new patterns or conventions to document?

### Step 2: Update in Order
1. **PROJECT_STATUS.md** (always first - source of truth)
2. **Agent instructions** (if patterns changed)
3. **Specialized agents** (if their domain changed)
4. **README files** (if setup or overview changed)
5. **CLAUDE.md** (if agent workflows changed)

### Step 3: Verify Consistency
- Do all docs agree on current phase/status?
- Are completion statuses consistent?
- Are new features documented everywhere relevant?
- Do examples match current implementation?

### Step 4: Check Cross-References
- Do links between docs still work?
- Are file paths correct?
- Are references to other sections accurate?

### Step 5: Update Memories

**🚨 MANDATORY REQUIREMENTS 🚨**

#### YOU MUST USE MCP TOOLS. THIS IS NON-NEGOTIABLE.

| Operation | REQUIRED Tool | FORBIDDEN Alternative |
|-----------|---------------|----------------------|
| List memories | `mcp__serena__list_memories` | N/A |
| Read memories | `mcp__serena__read_memory` | N/A |
| Write memories | `mcp__serena__write_memory` | N/A |
| Explore code | `mcp__serena__find_symbol`, `mcp__serena__get_symbols_overview` | ~~Read~~ |
| Find files | `mcp__serena__find_file`, `mcp__serena__list_dir` | ~~Glob~~ |
| Search code | `mcp__serena__search_for_pattern` | ~~Grep~~ |

**⛔ PROHIBITED**: Using Read, Glob, or Grep for code exploration.

---

# Codebase Context Update

Quick workflow to refresh understanding of the codebase.

## Steps

1. **Check memories**: `mcp__serena__list_memories` → Read relevant ones with `mcp__serena__read_memory`
2. **Explore as needed**: **REQUIRED** - Use MCP Serena per `.docs/guides/mcp-tools.md`
3. **Update memories**: Write findings with `mcp__serena__write_memory`

See `.docs/guides/mcp-tools.md` for MCP Serena tool reference.



---

## Documentation Quality Checklist

Before completing the update, verify:

- [ ] **Status is accurate**: Phase status matches actual completion
- [ ] **Tasks are checked**: Completed tasks marked with ✅ or [x]
- [ ] **Links work**: All internal links point to existing files
- [ ] **Examples are current**: Code examples match current implementation
- [ ] **No contradictions**: All docs agree on current state
- [ ] **New features documented**: All new work is reflected
- [ ] **Known issues tracked**: Issues documented in PROJECT_STATUS.md
- [ ] **Next steps updated**: Next steps reflect what's actually next

---

## Common Documentation Updates

### After Completing a Phase

```markdown
1. PROJECT_STATUS.md:
   - Mark phase as "✅" (complete)
   - Update all [x] checkboxes for completed tasks
   - Update "Implementation Progress > Completed" section
   - Update "Next Steps" to show new priorities

2. CLAUDE.md:
   - Update if phase changes affect agent workflows
```

### After Adding a New Component

```markdown
1. PROJECT_STATUS.md:
   - Mark component as complete in Phase 3.2 or relevant section
   - Add to "Implementation Progress > Completed" if significant

2. Agent common-patterns.md:
   - Add pattern if reusable (component, island, etc.)

3. component-architect.md (if new patterns):
   - Document component patterns and conventions
```

### After Adding a New Page Template

```markdown
1. PROJECT_STATUS.md:
   - Update Phase 4.1 template table with status

2. README.md:
   - Update project structure if needed
   - Add usage example if template is complex

3. common-patterns.md:
   - Add Astro page pattern if reusable
```

### After Theming Changes

```markdown
1. PROJECT_STATUS.md:
   - Update Phase 2 status

2. style-theme-guardian.md:
   - Document new CSS custom properties
   - Update theming patterns

3. CLAUDE.md:
   - Update theming section if architecture changed
```

### After Accessibility Improvements

```markdown
1. PROJECT_STATUS.md:
   - Update Phase 3 checklist items
   - Mark accessibility utilities as complete

2. .docs/agent/quality-gates.md:
   - Add any new accessibility testing requirements

3. component-architect.md:
   - Document accessibility patterns for components
```

---

## Special Cases

### When Implementation Differs from Plan

If implementation deviates from PROJECT_STATUS.md plan:

1. Update PROJECT_STATUS.md with actual approach
2. Explain why the deviation occurred in comments
3. Update architecture section to match reality
4. Note any technical debt introduced

### When Adding Technical Debt

If shortcuts or temporary solutions are introduced:

1. Note in PROJECT_STATUS.md (can add "Known Issues" section)
2. Add TODO comments in code
3. Create follow-up task if needed

### When Changing Workflows

If development workflows or patterns change:

1. Update `.docs/agent/workflow-guide.md`
2. Update `.docs/agent/common-patterns.md`
3. Update specialized agent instructions
4. Update CLAUDE.md if workflow is critical
5. Add examples to demonstrate new pattern

---

## Documentation Standards

### Markdown Formatting

- Use `**bold**` for emphasis
- Use `code blocks` for file paths, commands, code
- Use tables for structured information
- Use checklists for task tracking
- Use horizontal rules (`---`) to separate major sections

### Status Indicators

- ✅ or `[x]` - Completed
- ⏳ or `[ ]` - Planned/Future
- 🔄 - In Progress

### File Path References

- Use relative paths from project root
- Use markdown links: `[text](path/to/file.md)`
- Use inline code for file names: `src/components/Header.tsx`

---

## Example Update Session

**Scenario**: Just completed the Footer component (Phase 5.2)

**Updates Required**:

1. **PROJECT_STATUS.md**:
   ```markdown
   ### 5.2 Footer
   - [x] Multi-column link sections
   - [x] Contact information
   - [x] Social links with proper ARIA labels
   - [ ] Newsletter signup form (planned)
   - [x] Accessibility statement link

   ### Implementation Progress
   ### Completed ✅
   ...existing items...
   8. Footer component with accessibility features
   ```

2. **component-architect.md**: Update with Footer component patterns

3. **CLAUDE.md**: Update if Footer changes site architecture

---

## Final Checklist

Before marking documentation update complete:

- [ ] All affected files identified and updated
- [ ] Status indicators are accurate
- [ ] Links and references verified
- [ ] Examples match current code
- [ ] No contradictions between docs
- [ ] Ready for commit

---

# Git Commit 

Just run slash command /git-commit

---

**Remember**: Documentation is code. Keep it accurate, consistent, and up-to-date. Future you (and other developers/agents) will thank you!
