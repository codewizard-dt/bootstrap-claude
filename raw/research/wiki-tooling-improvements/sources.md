---
topic: how to improve the wiki tooling. Find examples of 'second brains' on the internet and consider what types of improvements could be made to our wiki setup to improve memory handling and general project setup. There have for sure been developments since the original wiki gist. Areas for improvement could potentially include infrastructure, skills, hooks, prompting, etc.
slug: wiki-tooling-improvements
researched: 2026-07-06
---

# Primary Sources — Improving the LLM Wiki tooling

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `raw/llm-wiki.md` | 2026-07-06 | Karpathy's original gist text as implemented in this repo; the "Optional: CLI tools" section already recommends `qmd` for hybrid search once a wiki grows large |
| S2 | codebase | `wiki/conventions.md` | 2026-07-06 | Confirms `confidence`, `tier`, `last_verified`, `supersedes`, `superseded_by`, `scope` are reserved-but-unused frontmatter keys, explicitly intended for "confidence scoring, knowledge lifecycle, hybrid search, A-Mem-style link discovery" as future zero-migration overlays |
| S3 | codebase | `lib/hooks/README.md` | 2026-07-06 | Documents the fail-open Serena health-tracking pattern (`serena-usage-tracker.js`, `lib/serena.js`): enforce by default, classify tool-level vs transport-level failures, one restart attempt, auto-recover on next success — used as the design template for a proposed wiki-locking hook |
| S4 | codebase | `README.md` | 2026-07-06 | Confirms this repo is a template/scaffold package (not a live wiki instance); confirms copy-once vs always-refresh semantics for wiki templates via `sync-wiki-scaffold.sh` |
| S5 | codebase | `lib/skills/wiki-query/SKILL.md` | 2026-07-06 | Confirms current Query skill design: reads `wiki/index.md` first, no session-handoff/hot-cache step exists in current skill set |
| S6 | web | https://code.claude.com/docs/en/best-practices | 2026-07-06 | Anthropic's official Claude Code best-practices docs: recommends customizing compaction behavior via CLAUDE.md instructions, delegating research to subagents to protect main context |
| S7 | web | https://codepointer.substack.com/p/agent-memory-systems-and-knowledge | 2026-07-06 | Comparison of Letta/Mem0/Zep/Cognee architectures; quotes Letta's Aug 2025 "Is a Filesystem All You Need?" finding that a plain-file agent scored 74.0% vs Mem0's graph variant's 68.5% on LOCOMO, arguing specialized memory adds little when agents are good at iterative file search |
| S8 | web | https://mem0.ai/blog/state-of-ai-agent-memory-2026 | 2026-07-06 | Mem0's own 2026 benchmark report; confirms Mem0's ECAI 2025 paper (arXiv:2504.19413), adoption scale (AWS Agent SDK default provider, 186M API calls Q3 2025) |
| S9 | web | https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f | 2026-07-06 | The original gist itself, plus comments; confirms publish date of 2026-04-04 (per aggregating articles) and ongoing community feedback thread |
| S10 | web | https://github.com/AgriciDaniel/claude-obsidian | 2026-07-06 | Productized reimplementation of the same gist: confirms `wiki/hot.md` hot-cache mechanism, v1.7 per-file advisory locking (`scripts/wiki-lock.sh`) added to close a "latent multi-writer corruption hole," 15 Claude Code skills, methodology modes, provenance concepts |
| S11 | web | https://claude-blog.md/blog/claude-obsidian-second-brain | 2026-07-06 | Describes claude-obsidian's hot-cache workflow in narrative form: "At the end of every session, Claude updates wiki/hot.md... The next session reads that file first. You never rebuild context." |
| S12 | web | https://github.com/AgriciDaniel/claude-obsidian/blob/main/WIKI.md | 2026-07-06 | Exact `hot.md` file format/example: `Last Updated`, `Key Recent Facts`, `Recent Changes` (Created/Updated/Flagged), `Active Threads`, capped around ~500 words |
| S13 | web | https://github.com/ar9av/obsidian-wiki | 2026-07-06 | Independent reimplementation with provenance tracking: every claim tagged `extracted` (default), `^[inferred]`, or `^[ambiguous]`; `provenance:` frontmatter block; wiki-lint flags pages drifting into mostly speculation |
| S14 | web | https://github.com/MehmetGoekce/llm-wiki | 2026-07-06 | Independent reimplementation describing "L1/L2 cache architecture" (auto-loaded rules = L1, deep wiki = L2) as "the key insight Karpathy's gist does not mention"; explicit warning that concurrent Claude sessions writing to wiki files simultaneously can cause conflicts |
| S15 | web | https://hindsight.vectorize.io/blog/2026/05/06/claude-code-subagents-shared-memory | 2026-07-06 | Documents Claude Code's native per-subagent memory field (`.claude/agent-memory/<name>/MEMORY.md`, first 200 lines/25KB auto-injected) and the cross-subagent silo problem it doesn't solve; Hindsight's shared-bank solution |
| S16 | web | https://hindsight.vectorize.io/sdks/integrations/claude-code | 2026-07-06 | Hindsight's Claude Code plugin architecture: hooks (auto recall/retain) + MCP server (explicit `agent_knowledge_*` tools) + a skill for subagent creation |
| S17 | web | https://claudefa.st/blog/guide/mechanics/context-management | 2026-07-06 | Describes Claude Code's compaction behavior precisely: CLAUDE.md, unscoped rules, and Auto Memory (first 200 lines/25KB of MEMORY.md) are re-injected from disk after compaction; conversation-arrived context is not |
| S18 | web | https://github.com/tobi/qmd | 2026-07-06 | Confirms qmd (the tool named in the original gist) is still actively maintained: hybrid BM25 + vector + LLM re-ranking, CLI + MCP server interfaces |
| S19 | web | https://arxiv.org/abs/2502.12110 | 2026-07-06 | A-MEM paper abstract: Zettelkasten-inspired dynamic memory organization for LLM agents with "memory evolution" (existing notes update when new ones are linked) — the academic root of the "A-Mem-style link discovery" already name-checked in this repo's `wiki/conventions.md` |
| S20 | web | https://skillsllm.com/skill/claude-obsidian | 2026-07-06 | claude-obsidian v1.7 "Compound Vault" changelog: hybrid retrieval (contextual prefix + BM25 + cosine rerank per Anthropic's Sept 2024 contextual retrieval research) plus the per-file advisory locking release note |
| S21 | web | https://www.reddit.com/r/hermesagent/comments/1tiec44/hermes_agent_claude_obsidian_and_hindsight_walk/ | 2026-07-06 | Community-reported ad hoc two-agent concurrent-edit pattern: YAML soft-lock (set true/edit/set false in one write), 30-minute staleness override with log entry, append-only "Proposals" section for lock-free concurrent additions |

## Excerpts

### S2 — wiki/conventions.md (this repo)
`wiki/conventions.md`
> The rules that govern every page in this wiki. They exist so the knowledge base stays navigable as it grows, and so the heavier overlays (confidence scoring, knowledge lifecycle, hybrid search, A-Mem-style link discovery) can be added **later as zero-migration add-ons**.

### S7 — Agent Memory Systems and Knowledge Graphs (codepointer.substack.com)
https://codepointer.substack.com/p/agent-memory-systems-and-knowledge
> Letta's "Is a Filesystem All You Need?" post (Aug 2025) dumped LOCOMO (a multi-session dialogue recall benchmark) conversation transcripts into files attached to a plain agent and scored 74.0%, above the 68.5% for Mem0's graph variant (arXiv 2504.19413, Apr 2025). Letta argues that agents are post-trained to be good at iterative file search, so specialized memory systems add little.

### S10 — claude-obsidian GitHub repo
https://github.com/AgriciDaniel/claude-obsidian
> Can multiple people edit the same vault safely? Yes (v1.7+). Per-file advisory locking via scripts/wiki-lock.sh prevents concurrent writes from corrupting pages. Parallel ingest sub-agents acquire locks before writes.

### S11 — claude-blog.md article
https://claude-blog.md/blog/claude-obsidian-second-brain
> The hot cache is the most underrated feature. At the end of every session, Claude updates wiki/hot.md with a compact context summary. The next session reads that file first. You never rebuild context. The wiki already knows.

### S12 — claude-obsidian WIKI.md
https://github.com/AgriciDaniel/claude-obsidian/blob/main/WIKI.md
> --- type: meta title: "Hot Cache" updated: 2026-04-07T14:30:00 --- # Recent Context ## Last Updated 2026-04-07 — Ingested 3 new YouTube transcripts ## Key Recent Facts - [Most important recent takeaway] - [Second most important] ## Recent Changes - Created: [[New Page 1]], [[New Page 2]] - Updated: [[Existing Page]] (added section on X) - Flagged: Contradiction between [[Page A]] and [[Page B]] on topic Y ## Active Threads - User is currently researching [topic] - Open question: [thing still being investigated]

### S13 — ar9av/obsidian-wiki
https://github.com/ar9av/obsidian-wiki
> Provenance tracking. Every claim on a wiki page is tagged: extracted (default), ^[inferred] (LLM synthesis), or ^[ambiguous] (sources disagree). A provenance: block in the frontmatter summarizes the mix per page, and wiki-lint flags pages that drift into mostly speculation.

### S14 — MehmetGoekce/llm-wiki
https://github.com/MehmetGoekce/llm-wiki
> If you have multiple Claude sessions writing to wiki files simultaneously, concurrent edits can cause conflicts. Treat wiki files as a shared resource... L1/L2 architecture. Auto-loaded rules in memory (L1) + deep knowledge in the wiki (L2). No other tool has this.

### S15 — Hindsight blog: subagent shared memory
https://hindsight.vectorize.io/blog/2026/05/06/claude-code-subagents-shared-memory
> Each subagent's memory directory is siloed from every other subagent's. The code-reviewer doesn't see what the security-auditor learned, and vice versa. A shared memory layer (Hindsight on a single project bank) gives every subagent — plus the orchestrator — one common, accumulating understanding.

### S17 — claudefa.st context management guide
https://claudefa.st/blog/guide/mechanics/context-management
> The short version: anything loaded from disk at startup comes back, and anything that arrived through the conversation gets summarized away. Your project-root CLAUDE.md, your unscoped rules, and your auto memory (Claude's own notes, the first 200 lines or 25KB of MEMORY.md) are all re-injected from disk after compaction.

### S21 — r/hermesagent concurrent-edit thread
https://www.reddit.com/r/hermesagent/comments/1tiec44/hermes_agent_claude_obsidian_and_hindsight_walk/
> Read, set true, edit, set false in the same write. Stale lock (updated >30 min old) gets overridden with a log entry... Append-only Proposals section with three-party threads. Both agents can add proposals to the bottom without coordinating, because appends don't conflict.
