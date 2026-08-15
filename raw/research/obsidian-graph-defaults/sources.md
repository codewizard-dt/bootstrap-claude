---
topic: how to stylize the obsidian graph view, how other people/projects use obsidian to maximize productivity, and possible strategies to set up defaults in obsidian to make the most of the wiki structure, set up, links, relations, etc
slug: obsidian-graph-defaults
researched: 2026-08-15
---

# Primary Sources — Obsidian Graph View Styling, Productivity Patterns, and Shippable Wiki Defaults

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S2 | codebase | `lib/scripts/install-obsidian.sh` (full file) | 2026-08-15 | The existing guarded, sticky-preference, write-into-`.obsidian/` install pattern this research recommends extending; exact `_install_obsidian_plugin`/`_enable_obsidian_plugin` mechanics |
| S3 | codebase | `lib/scripts/templates/` (directory listing) | 2026-08-15 | Confirms the copy-once template convention exists for `wiki/*` files but has no `.obsidian/*` entry yet |
| S4 | codebase | `.gitignore` line 7 | 2026-08-15 | Confirms `.obsidian/` is gitignored — any shipped default must be a generated, not committed, file |
| S5 | codebase | `wiki/knowledge/entities/tools/obsidian.md` | 2026-08-15 | Existing repo knowledge: Obsidian is human-side-viewer-only, never a hard dependency; `.gitignore` posture |
| S6 | codebase | `wiki/knowledge/sources/obsidian-setup-automation.md` + `raw/research/obsidian-setup-automation/index.md` | 2026-08-15 | Prior research's explicit scope (plugin binaries only), its supply-chain-risk framing for community plugins, and its unactioned "author Dataview query blocks" recommendation |
| S7 | web | https://deepwiki.com/sakuramodki/obsidian/2.1-graph-visualization | 2026-08-15 | Full real-world `graph.json` example showing every key including `colorGroups`, forces, and multipliers |
| S8 | web | https://github.com/GrangbelrLurain/.obsidian/blob/master/graph.json | 2026-08-15 | Second independent real `graph.json` example confirming the same schema |
| S9 | web | https://www.reddit.com/r/ObsidianMD/comments/16q7jzb/what_do_yall_think_of_my_graph/ | 2026-08-15 | User's own Python script reading/writing `.obsidian/graph.json`'s `colorGroups` programmatically — confirms exact `{query, color:{a,rgb}}` shape and that Obsidian picks up direct file edits |
| S10 | web | https://www.reddit.com/r/ObsidianMD/comments/nva4nk/is_there_a_simple_way_to_get_color_in_my_graphs/ | 2026-08-15 | Confirms `colorGroups` query syntax: `tag:#cool`, `file:journal`, `path:private`, boolean `OR` combination |
| S11 | web | https://obsidian.md/help/plugins/graph (fetched directly) | 2026-08-15 | Official Groups panel mechanics ("Click New group... type a search term... click the colored circle") |
| S12 | web | https://deepwiki.com/thor314/obsidian-setup/3-core-configuration | 2026-08-15 | Roles of `app.json`, `appearance.json`, `workspace.json` as distinct config layers; "manual editing of workspace.json is rarely needed" |
| S13 | web | https://community.obsidian.md/plugins/graph-styler | 2026-08-15 | Graph Styler plugin description: auto-detects top folders/tags, writes native `graph.json` color groups + CSS glow snippet, backs up original config first |
| S14 | web | https://github.com/moonweave/obsidian-graph-styler | 2026-08-15 | Confirms Graph Styler repo, license (MIT), install mechanism |
| S15 | web | https://community.obsidian.md/plugins/auto-tag-graph-colors | 2026-08-15 | Auto Tag Graph Colors: zero-config automatic per-tag coloring, heat-by-connection-count mode, clean removal on disable |
| S16 | web | https://github.com/obsidian-community/obsidian-style-settings and https://community.obsidian.md/plugins/colored-tags | 2026-08-15 | Style Settings' `/* @settings */` CSS-variable-exposure mechanism; Colored Tags as the lighter-weight tag-color alternative |
| S17 | web | https://github.com/andrewmcodes/obsidian-beginner-vault-template | 2026-08-15 | Vault-template precedent: documents every setting changed from Obsidian's stock defaults in a table; ships zero plugins by default |
| S18 | web | https://rob.cogit8.org/posts/2025-03-25-obsidian-git-quick-setup-for-developers/ | 2026-08-15 | Common `.gitignore` pattern selectively un-ignoring specific `.obsidian/*.json` files (app/appearance/community-plugins/core-plugins/workspace) to share config |
| S19 | web | https://blog.muya.co.ke/sync-obsidian-plugin-data-via-git/ | 2026-08-15 | Alternate `.gitignore` pattern: ignore plugin binaries + cache/workspace, keep only `plugins/*/data.json` — reinforces "some `.obsidian/*` files are templatable, others are machine-local" |
| S20 | web | https://desktopcommander.app/blog/zettelkasten-obsidian/ | 2026-08-15 | "Don't create MOCs upfront. Let them emerge naturally... Building MOCs too early creates structure for structure's sake" — validates this repo's existing lazy-MOC design |

## Excerpts

### S7 — Graph Visualization | sakuramodki/obsidian | DeepWiki
https://deepwiki.com/sakuramodki/obsidian/2.1-graph-visualization
> { "collapse-filter": true, "search": "path:Knowledge ", "showTags": false, "showAttachments": false, "hideUnresolved": false, "showOrphans": true, "collapse-color-groups": true, "colorGroups": [], "collapse-display": true, "showArrow": false, "textFadeMultiplier": -1.6, "nodeSizeMultiplier": 1.49088541666667, "lineSizeMultiplier": 0.954947916666667, "collapse-forces": true, "centerStrength": 0.4765625, "repelStrength": 16.40625, "linkStrength": 0.440104166666667, "linkDistance": 198, "scale": 0.3956027377542728, "close": false }

### S9 — r/ObsidianMD: what do yall think of my graph?
https://www.reddit.com/r/ObsidianMD/comments/16q7jzb/what_do_yall_think_of_my_graph/
> in the .obsidian folder there's a graphs.json file, so i used the json.loads function to convert the file into a dictionary, and then i could add groups using a hsv to rgb function to generate the color and make the condition "tag:#" + whatever number i was currently adding, run that on a for loop, convert the dictionary back into text using json.dumps and reinsert into the .obsidian folder.
>
> def AddGroups(): data = json.loads(open(".obsidian/graph.json","r").read()) data['colorGroups'] = [] ... data['colorGroups'].append({'query':f'tag:#{numToAlphabet(i)}','color':{'a':1,'rgb':col}}) open(".obsidian/graph.json","w").write(json.dumps(data))

### S10 — r/ObsidianMD: Is there a simple way to get color in my graphs?
https://www.reddit.com/r/ObsidianMD/comments/nva4nk/is_there_a_simple_way_to_get_color_in_my_graphs/
> If you want to set a color for all the files with the tag #cool, type tag:#cool · If you want to color all the files whose name begins with "journal", type file:journal · If you want to color all the files in the "private" folder, type path:private

### S11 — Graph view - Obsidian Help
https://obsidian.md/help/plugins/graph
> Click New group. In the search box, type a search term for the notes you want to add to the group. Click the colored circle to give the group a color.

### S13 — Graph Styler - Obsidian Plugin
https://community.obsidian.md/plugins/graph-styler
> Writes the global graph config (.obsidian/graph.json) and a CSS snippet (.obsidian/snippets/graph-styler-*.css); your original graph.json is backed up first... Graph Styler hardcodes nothing — it adapts to your vault: It finds your most-used folders and assigns the preset's palette to them (up to 4). No folders? It falls back to your most-used tags.

### S15 — Auto Tag Graph Colors - Obsidian Plugin
https://community.obsidian.md/plugins/auto-tag-graph-colors
> Automatically assign distinct, stable colors to every tag in the graph view. Includes smart tag blending, monochrome mode, and heat coloring by connection count... Disable the plugin and every color group it created is automatically removed. Your manually-added groups are preserved.

### S18 — Obsidian and Git: A Quick Setup Guide for Developers
https://rob.cogit8.org/posts/2025-03-25-obsidian-git-quick-setup-for-developers/
> cat > .gitignore << EOL # Ignore all Obsidian configuration by default .obsidian/* # Uncomment to sync specific configurations: # !.obsidian/app.json # !.obsidian/appearance.json # !.obsidian/community-plugins.json # !.obsidian/core-plugins.json # !.obsidian/workspace.json # System files .trash/ .DS_Store EOL

### S20 — The Zettelkasten Method in Obsidian: A Practical Setup Guide
https://desktopcommander.app/blog/zettelkasten-obsidian/
> Don't create MOCs upfront. Let them emerge naturally. When you notice you have eight notes on "decision-making" and can't find them easily, that's when you make a MOC. Not before. Building MOCs too early creates structure for structure's sake, which is the opposite of what Zettelkasten is for.
