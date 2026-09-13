---
topic: creating a way to easily edit the user/project settings that doesn't rely on Claude Code — an interactive TUI, or piggyback off the 'dashboard' command
slug: bootstrap-prefs-editor-tui
researched: 2026-09-13
---

# Primary Sources — bootstrap-prefs.json editor TUI

| ID | Type | Locator | Accessed | What it contributed |
|----|------|---------|----------|---------------------|
| S0a | codebase | `lib/scripts/bootstrap-prefs.js` (full file) | 2026-09-13 | The existing get/set/unset/list engine: schema-driven validation, `scopePermitsLayer` write guard, atomic writes (`writeAtomic`), companion-doc regeneration — the reuse target for any new editor |
| S0b | codebase | `lib/scripts/templates/bootstrap-prefs-schema.json` (full file) | 2026-09-13 | The full ~20-key + 2 dynamic-family schema shape (`scope`, `consumer`, `summary`, `detail`, `values`, `default`, `askedBy`) that any UI must render |
| S0c | codebase | `lib/skills/bootstrap-config/SKILL.md` (full file) | 2026-09-13 | The existing Claude-mediated editor's complete Step A–G algorithm — the spec to port into a standalone script |
| S0d | codebase | `lib/scripts/wiki-dashboard-server.js` (full file) | 2026-09-13 | Confirms the dashboard is a zero-dependency, read-only static file server with no auth, and that `listen(port, callback)` omits a host argument (defaults to all interfaces, not `127.0.0.1`) |
| S0e | codebase | `bin/cli.js::SCRIPTS` | 2026-09-13 | The subcommand-dispatch convention (`execFileSync` over a flat script map) a new `config` subcommand would follow |
| S0f | codebase | `package.json` (full file) | 2026-09-13 | Confirms no `dependencies`/`devDependencies` exist today — the zero-dependency policy is a fact about the repo, not an inference |
| S1 | web | https://thelinuxcode.com/nodejs-readline-module-a-practical-production-oriented-guide-for-interactive-clis/ | 2026-09-13 | "For a minimal interactive CLI, I still use Node's built-in readline module," plus guidance on closing the interface, gating interactivity behind a TTY check, and handling Ctrl-C |
| S2 | web | https://github.com/lirantal/nodejs-cli-apps-best-practices | 2026-09-13 | "Don't force user interactivity if a command-line argument can be auto-detected... Aim to provide a 'works out of the box' experience"; dependency footprint affects install/startup speed for `npx`-invoked CLIs |
| S3 | web | https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026 | 2026-09-13 | Bundle-size comparison: `@clack/prompts` (~2KB, "the new standard for CLI prompts"), `enquirer` (~100KB, for autocomplete/date-picker/richer types), `ink` (~150KB + React, for complex live-updating state) |
| S4 | web | https://npmtrends.com/enquirer-vs-inquirer-vs-prompt-vs-prompts | 2026-09-13 | Adoption data: inquirer 43.2M weekly downloads/21.5k stars, prompts 43.8M downloads/9.3k stars, enquirer 27.2M downloads/7.9k stars |
| S5 | web | https://npm-compare.com/commander,enquirer,inquirer,prompts,vorpal,yargs | 2026-09-13 | "Choose prompts if bundle size is a critical concern and you want a lightweight, unopinionated library" |
| S6 | web | https://www.reddit.com/r/webdev/comments/1nnq50y/how_can_i_secure_localhost_connection_for_my/ | 2026-09-13 | "some people... will wrongly suggest exposing on 0.0.0.0 which is not loopback, and WILL expose your server to the local network. So don't do that... 127.0.0.1 or the localhost keyword is what you want" |
| S7 | web | https://yomotherboard.com/question/whats-the-best-way-to-secure-a-localhost-connection-for-a-desktop-web-app/ | 2026-09-13 | Reinforces binding to `127.0.0.1` specifically and that binding alone doesn't equal full security (HTTPS/token layers are the deeper fix, out of scope for a local settings tool but worth knowing) |
| S8 | web | https://medium.com/@instatunnel/your-dev-server-is-not-safe-the-hidden-danger-of-csrf-on-localhost-36fed5cf0e38 | 2026-09-13 | "From your browser's perspective, localhost (or 127.0.0.1) is just another domain name... the attacker doesn't need to access your server directly. They access it through your browser" — the CSRF-from-open-tab risk for any write-capable local server |
| S9 | web | https://stackoverflow.com/questions/60759837/why-is-a-csrf-post-request-to-localhost8000-successful-but-127-0-0-18000 | 2026-09-13 | "localhost and 127.0.0.1 are not considered same-domain as far as browsers are concerned" — a concrete gotcha for anyone implementing an Origin/same-site check as a CSRF defense |

## Excerpts

### S1 — Node.js Readline Module: A Practical, Production-Oriented Guide
https://thelinuxcode.com/nodejs-readline-module-a-practical-production-oriented-guide-for-interactive-clis/
> "For a minimal interactive CLI, I still use Node's built-in readline module."
> "I think of readline as a stateful session manager, not a stateless helper... closing the interface is what makes your CLI behave like a good citizen."
> "Plain readline echoes input, so it is not ideal for passwords or API keys."

### S2 — nodejs-cli-apps-best-practices (lirantal)
https://github.com/lirantal/nodejs-cli-apps-best-practices
> "Don't force user interactivity if a command-line argument can be auto-detected in a reliable way, and the action invoked doesn't explicitly require user interaction (such as confirming a deletion)."
> "A fast npm install for Node.js CLIs invoked with npx will provide a better user experience. This is made possible when the overall dependency, and transitive dependency, footprint is kept to a reasonable size."

### S3 — Ink vs @clack/prompts vs Enquirer 2026 (PkgPulse)
https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026
> "@clack/prompts is the new standard for CLI prompts — elegant design, small bundle, and an API that handles edge cases cleanly."
> "Enquirer when you need autocomplete, date picker, scales, or custom prompt types · Ink when your CLI has complex state (progress bars, live logs, nested rendering)"
> "the size of @clack/prompts (2KB), Enquirer (100KB), or Ink (150KB + React) matters less than correctness and features" (for npm-install-based distribution, as opposed to single-binary bundling)

### S4 — enquirer vs inquirer vs prompt vs prompts (npm trends)
https://npmtrends.com/enquirer-vs-inquirer-vs-prompt-vs-prompts
> "enquirer 2.4.1 which has 27,160,009 weekly downloads and 7,934 GitHub stars vs. inquirer 13.4.2 which has 43,181,849 weekly downloads and 21,508 GitHub stars vs. prompt 1.3.0 which has 751,756 weekly downloads and 1,949 GitHub stars vs. prompts 2.4.2 which has 43,795,281 weekly downloads and 9,264 GitHub stars."

### S5 — commander vs enquirer vs inquirer vs prompts vs vorpal vs yargs (npm-compare)
https://npm-compare.com/commander,enquirer,inquirer,prompts,vorpal,yargs
> "Choose prompts if bundle size is a critical concern and you want a lightweight, unopinionated library."

### S6 — r/webdev: How can I secure localhost connection for my desktop web application?
https://www.reddit.com/r/webdev/comments/1nnq50y/how_can_i_secure_localhost_connection_for_my/
> "To expand on this: some people (not fiskfisk) will wrongly suggest exposing on 0.0.0.0 which is not loopback, and WILL expose your server to the local network. So don't do that ;) 127.0.0.1 or the localhost keyword is what you want."

### S7 — What's the Best Way to Secure a Localhost Connection for a Desktop Web App?
https://yomotherboard.com/question/whats-the-best-way-to-secure-a-localhost-connection-for-a-desktop-web-app/
> "Just binding to 127.0.0.1 doesn't inherently secure it, so set up HTTPS for reliable security!"

### S8 — Your Dev Server Is Not Safe: The Hidden Danger of CSRF on Localhost
https://medium.com/@instatunnel/your-dev-server-is-not-safe-the-hidden-danger-of-csrf-on-localhost-36fed5cf0e38
> "'Okay,' you might be thinking, 'I understand CSRF for public websites, but my server is running on localhost. It's not accessible from the internet.' This is the critical misunderstanding. The attacker doesn't need to access your server directly. They access it through your browser. From your browser's perspective, localhost (or 127.0.0.1) is just another domain name."

### S9 — Why is a CSRF POST request to 'localhost:8000' successful, but '127.0.0.1:8000' is not?
https://stackoverflow.com/questions/60759837/why-is-a-csrf-post-request-to-localhost8000-successful-but-127-0-0-18000
> "localhost and 127.0.0.1 are not considered same-domain as far as browsers are concerned."
