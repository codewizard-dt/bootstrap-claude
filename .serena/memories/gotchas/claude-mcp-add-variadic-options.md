# Gotcha: `claude mcp add` variadic options swallow positional args

`claude mcp add` defines `-H, --header <header...>` and `-e, --env <env...>` as **variadic** commander options: they consume every following argument until the next flag. Placing them before the positional `<name> <commandOrUrl>` makes commander parse the name/URL as extra header/env values and fail with `error: missing required argument 'name'`.

**Rule:** in any scripted `claude mcp add`, positionals come first, variadic flags last:

```
claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY: <key>"
```

**History:** bootstrap 2.11.0 shipped `_add_context7` (lib/scripts/install-mcps.sh) with `--header` before the positionals; fresh-machine `bootstrap setup` aborted mid-run (set -e) whenever a Context7 key was entered. Fixed in 2.11.1 (install-mcps.sh `_add_context7` + the setup-project.sh epilogue echo). The no-key branch never failed, which is why machines with context7 already registered didn't surface it.
