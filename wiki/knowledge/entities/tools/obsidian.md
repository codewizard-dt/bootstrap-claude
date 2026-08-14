---
id: obsidian
title: Obsidian
aliases: [Obsidian.md]
updated: 2026-08-13
sources:
  - ../../../../raw/research/obsidian-wiki-linking/index.md
  - ../../../../raw/research/obsidian-wiki-linking/sources.md
confidence: extracted
tags: [obsidian, wiki-conventions, markdown, note-taking]
---

Obsidian.md is the local-first markdown note-taking app this repo's `raw/llm-wiki.md` pattern spec treats as the **human-side viewer** of the wiki — "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase." It is never a hard dependency: the wiki must remain "just a git repo of markdown files" with zero plugins required. `.gitignore` already excludes `.obsidian/` (the per-vault settings folder), confirming the repo expects someone may open `wiki/` as a live Obsidian vault locally without that configuration being committed or shared.

**Core `[[wikilink]]` syntax is untyped by design.** A link only states that two notes are connected, never *how* — the only native customization is display text via `[[Page|Alias]]`, which changes appearance, not semantics (confirmed against Obsidian's official docs). Typing what a link *means* (`implements`, `supersedes`, `contradicts`, …) requires either a plugin or a repo-level convention layered on top of plain wikilinks — see `relates_to::[[typed-wiki-links]]`. Obsidian's plugin ecosystem includes `relates_to::[[dataview]]` (queries over frontmatter/inline fields), `relates_to::[[graph-link-types]]` and `relates_to::[[breadcrumbs-plugin]]` (both graph/relation visualization layers built on Dataview's index), and the differently-mechanized `relates_to::[[wikilink-types-plugin]]`.

**Disambiguation:** this page is about the Obsidian.md application itself. Do not confuse it with `[[claude-obsidian]]`, an unrelated third-party AI-wiki reimplementation project (`github.com/AgriciDaniel/claude-obsidian`) that merely shares the word "Obsidian" in its name — it is a productized reimplementation of the LLM Wiki pattern, not the Obsidian app.

**Automated install (`derived_from::[[obsidian-setup-automation]]`).** The app itself installs headlessly via native package managers, one command per OS, all silent/non-interactive-capable: `brew install --cask obsidian` (macOS), `winget install -e --id Obsidian.Obsidian` (Windows — its winget manifest declares `InstallModes: [silent]`), `flatpak install flathub md.obsidian.Obsidian` (Linux — the officially verified, auto-updating path, preferred over `.deb`/AppImage/Snap for a script since those don't self-update). This repo's proposed `lib/scripts/install-obsidian.sh` would gate this behind a global-scope sticky preference (`obsidian.installApp`), reusing `uses::[[bootstrap-guarded-install-pattern]]` rather than inventing new install machinery.
