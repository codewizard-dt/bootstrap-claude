---
topic: "How to incorporate Dataview, Graph Link Types, Breadcrumbs, and Obsidian itself into the setup/update scripts (opt-in but recommended); which skills would improve with those plugins installed; automated install paths for the app and the plugins during setup/update"
slug: obsidian-setup-automation
researched: 2026-08-13
---

# Primary Sources — Automating Obsidian + Plugin Setup

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S1 | codebase | `lib/scripts/install-mcps.sh::register_optional_mcp`, `::_add_playwright`, `::_add_brave` | 2026-08-13 | The guarded-install pattern: mcp_installed short-circuit, sticky yes/no prompt, native-tool adder, non-fatal failure handling — direct precedent for an Obsidian app/plugin installer |
| S2 | codebase | `lib/scripts/lib.sh::run_project_sync`, `::prompt_yn_sticky` | 2026-08-13 | The shared setup/update call sequence and the sticky-preference-prompt primitive (`prefs_get`/`prefs_set` semantics: true/false/ask/unset) |
| S3 | codebase | `lib/scripts/sync-wiki-scaffold.sh` lines 78-133 (`OPTIONAL_GUIDES` loop) | 2026-08-13 | The bundled-optional-item precedent: dynamic `guides.*` keys, "presence on disk wins over stored answer," stored-true delivers even non-interactively |
| S4 | codebase | `lib/scripts/templates/bootstrap-prefs-schema.json` | 2026-08-13 | The exact documentation shape (`scope`, `consumer`, `summary`, `detail`, `values`, `default`, `askedBy`, optional `dynamic`) every new preference key must follow |
| S5 | codebase | `lib/skills/task-audit/SKILL.md` Step 2e (dependency block parsing) | 2026-08-13 | Confirms `/task-audit` uses a bespoke `> **Depends on**: [...]` blockquote, NOT the `rel::[[target]]` typed-link convention — the key constraint on which skills "automatically" benefit from Breadcrumbs/Dataview |
| S6 | codebase | `raw/llm-wiki.md` (graph view / Dataview tips section) | 2026-08-13 | Confirms the wiki pattern spec already recommends graph-view orphan/hub spotting and Dataview querying, but describes both as manual today |
| S7 | codebase | `.gitignore` line 7 (`.obsidian/`) | 2026-08-13 | Confirms any Obsidian config this automation writes is already treated as machine-local/untracked, consistent with the existing MCP-registration model |
| S8 | codebase | `raw/research/obsidian-wiki-linking/index.md` + `sources.md` (this repo's prior research) | 2026-08-13 | Background this report builds on: the `rel::[[target]]` = Dataview inline-field finding, plugin identities, and the "zero query blocks exist today" fact |
| S9 | web | https://obsidianmate.com/article/how-to-install-local-plugins-obsidian | 2026-08-13 | Manual plugin-install mechanism: `manifest.json` + `main.js` (+ optional `styles.css`) placed in `.obsidian/plugins/<folder-matching-manifest-id>/` |
| S9-repo | web | https://github.com/obsidianmd/obsidian-sample-plugin | 2026-08-13 | Confirms the exact copy target path: `VaultFolder/.obsidian/plugins/your-plugin-id/` |
| S11-reddit | web | https://www.reddit.com/r/ObsidianMD/comments/tpodka/how_can_i_manually_install_plugins/ | 2026-08-13 | Confirms the same manual mechanism from a second independent source, including where to find the release assets (plugin's GitHub Releases page) |
| S12 | web | https://github.com/obsidianmd/obsidian-releases (repo README) | 2026-08-13 | Official, authoritative statement of the mechanism: "Obsidian will read the list of plugins in community-plugins.json... Obsidian will download manifest.json, main.js, and styles.css (if available), and store them in the proper location inside the vault" |
| S13 | web | https://forum.obsidian.md/t/community-plugins-json/112180 and https://forum.obsidian.md/t/plugins-arent-being-recognized-loaded/23988 | 2026-08-13 | Real-world confirmation that `.obsidian/community-plugins.json` exists cross-platform and is what Obsidian reads to know which downloaded plugins are enabled |
| S14 | web | https://community.obsidian.md/plugins/obsidian42-brat and https://github.com/TfTHacker/obsidian42-brat | 2026-08-13 | BRAT (Beta Reviewer's Auto-update Tool): a GUI-side plugin for pulling beta plugins from GitHub repo URLs — confirmed to require manual bootstrapping inside a running Obsidian instance first, so it is not a scripting primitive for headless install |
| S9-brew | web | https://formulae.brew.sh/cask/obsidian | 2026-08-13 | Confirms `brew install --cask obsidian` as the Homebrew Cask install path on macOS |
| S10 | web | https://winstall.app/apps/Obsidian.Obsidian and https://github.com/microsoft/winget-pkgs/blob/master/manifests/o/Obsidian/Obsidian/1.3.4/Obsidian.Obsidian.installer.yaml | 2026-08-13 | Confirms `winget install -e --id Obsidian.Obsidian`, and that the winget manifest itself declares `InstallModes: [silent]` — i.e. genuinely unattended-install capable |
| S11 | web | https://flathub.org/en/apps/md.obsidian.Obsidian and https://linuxcapable.com/how-to-install-obsidian-on-ubuntu-linux/ | 2026-08-13 | Confirms Flatpak (`flatpak install flathub md.obsidian.Obsidian`) as the officially-verified, auto-updating Linux install path, preferred over `.deb`/AppImage/Snap for a script (those don't self-update) |

## Excerpts

### S9 — Obsidian Mate, manual plugin install guide
https://obsidianmate.com/article/how-to-install-local-plugins-obsidian
> manifest.json: Contains the plugin's name, version, description, and minimum Obsidian version. This is what tells Obsidian "hey, this is a plugin." main.js: The actual compiled JavaScript code that runs the plugin... This name should match the id field in the plugin's manifest.json file.

### S9-repo — obsidianmd/obsidian-sample-plugin
https://github.com/obsidianmd/obsidian-sample-plugin
> Copy over main.js, styles.css, manifest.json to your vault VaultFolder/.obsidian/plugins/your-plugin-id/.

### S12 — obsidianmd/obsidian-releases (official)
https://github.com/obsidianmd/obsidian-releases
> Obsidian will read the list of plugins in community-plugins.json... When the user chooses to install your plugin, Obsidian will look for your GitHub releases tagged identically to the version inside manifest.json. Obsidian will download manifest.json, main.js, and styles.css (if available), and store them in the proper location inside the vault.

### S13 — Obsidian Forum, community-plugins.json thread
https://forum.obsidian.md/t/community-plugins-json/112180
> Is there a guarantee that community-plugins.json will continue to exist on all platforms? ... [demonstrated] that it still exists.

https://forum.obsidian.md/t/plugins-arent-being-recognized-loaded/23988
> obsidian is no longer recognizing/loading most of my plugins despite being downloaded and existing in community-plugins.json file.

### S14 — BRAT plugin
https://community.obsidian.md/plugins/obsidian42-brat
> The Beta Reviewers Auto-update Tool or BRAT for short is a plugin that makes it easier for you to assist other developers with reviewing and testing their plugins and themes. Simply add the GitHub repository path for the beta Obsidian plugin to the list for testing.

### S9-brew — Homebrew Cask
https://formulae.brew.sh/cask/obsidian
> Knowledge base that works on top of a local folder of plain text Markdown files. https://obsidian.md/

### S10 — winget manifest
https://github.com/microsoft/winget-pkgs/blob/master/manifests/o/Obsidian/Obsidian/1.3.4/Obsidian.Obsidian.installer.yaml
> PackageIdentifier: Obsidian.Obsidian ... InstallModes: - silent

### S11 — Flathub
https://flathub.org/en/apps/md.obsidian.Obsidian
> Obsidian is a powerful knowledge base that works on top of a local folder of plain text Markdown files.

https://linuxcapable.com/how-to-install-obsidian-on-ubuntu-linux/
> Flatpak is the most consistent choice across Ubuntu 26.04, 24.04, and 22.04. Flathub marks the application as verified by the Obsidian team... For the Flathub build, leave Obsidian's in-app automatic updates disabled because Flatpak owns the stable package update path.
