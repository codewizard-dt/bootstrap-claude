'use strict';

/**
 * serena-languages.js — reads project/global Serena config for enabled languages
 * and maps them to file extensions for use in enforcement hooks.
 *
 * ── This is a library, not a hook ─────────────────────────────────────────
 * It is never wired in lib/scripts/templates/settings-hooks.json, has no
 * stdin/stdout contract, and must never call process.exit or throw. It is loaded
 * at require-time by hooks that are all fail-open, so an exit or an uncaught
 * throw here would take down a tool call the hook was never meant to gate. That
 * is why readFileSafe swallows its catch and why every lookup degrades to "not
 * configured" instead of erroring.
 *
 * Who depends on it:
 *   lib/serena.js — getEnabledExtensionsSet, inside isAllowedPath, to decide
 *     whether a path's extension belongs to an enabled language. serena.js
 *     re-exports the function, so every Serena hook that calls isAllowedPath
 *     (edit-guard, write-guard, read-guard, bash-grep-block, …) depends on this
 *     file transitively; serena-first-glob-guard.js calls the re-export directly
 *     to decide whether a non-code glob is worth enforcing.
 * LANG_EXTS, getEnabledLanguages and buildCodeExtensionsRegex are exported but
 * have no in-repo consumer today — public surface, not dead code.
 *
 * Resolution order (mirrors Serena itself):
 *   1. ~/.serena/serena_config.yml  — global defaults
 *   2. {cwd}/.serena/project.yml    — project override (wins when languages: present)
 *
 * Both inline and block YAML list forms are handled:
 *   languages: []
 *   languages: [typescript, python]
 *   languages:
 *   - typescript
 *   - python
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const GLOBAL_CONFIG = path.join(os.homedir(), '.serena', 'serena_config.yml');

// Serena language name → file extensions (lowercase, no leading dot).
// Keys are the exact strings Serena accepts in `languages:`; an unknown key
// contributes nothing (getEnabledExtensionsSet's `|| []`) rather than throwing,
// so a typo degrades to narrower scoping, never to a crash.
// typescript carries js/jsx/mjs/cjs because Serena's TypeScript server also
// serves plain JavaScript — a JS-only project still writes `typescript`.
const LANG_EXTS = {
  typescript:       ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  // The *_jedi / *_ty / *_ccls / *_omnisharp / *_solargraph / *_phpactor keys are
  // not extra languages — they are Serena's alternate language-server backends,
  // and each is a distinct value a user may write in `languages:`. Both spellings
  // must map, or a project on the alternate backend loses language scoping.
  python:           ['py'],
  python_jedi:      ['py'],
  python_ty:        ['py'],
  go:               ['go'],
  rust:             ['rs'],
  java:             ['java'],
  kotlin:           ['kt', 'kts'],
  swift:            ['swift'],
  vue:              ['vue'],
  svelte:           ['svelte'],
  cpp:              ['cpp', 'cc', 'cxx', 'c', 'h', 'hpp'],
  cpp_ccls:         ['cpp', 'cc', 'cxx', 'c', 'h', 'hpp'],
  csharp:           ['cs'],
  csharp_omnisharp: ['cs'],
  ruby:             ['rb'],
  ruby_solargraph:  ['rb'],
  php:              ['php'],
  php_phpactor:     ['php'],
  scala:            ['scala'],
  bash:             ['sh', 'bash'],
  markdown:         ['md', 'mdx'],
  yaml:             ['yml', 'yaml'],
  json:             ['json', 'jsonc'],
  lua:              ['lua'],
  luau:             ['lua'],
  elixir:           ['ex', 'exs'],
  erlang:           ['erl', 'hrl'],
  haskell:          ['hs', 'lhs'],
  dart:             ['dart'],
  r:                ['r'],
  clojure:          ['clj', 'cljs', 'cljc'],
  ocaml:            ['ml', 'mli'],
  perl:             ['pl', 'pm'],
  powershell:       ['ps1', 'psm1'],
  groovy:           ['groovy'],
  nix:              ['nix'],
  julia:            ['jl'],
  zig:              ['zig'],
  terraform:        ['tf', 'tfvars'],
  toml:             ['toml'],
  solidity:         ['sol'],
  pascal:           ['pas', 'pp'],
  elm:              ['elm'],
  crystal:          ['cr'],
  fortran:          ['f', 'f90', 'f95', 'for'],
  fsharp:           ['fs', 'fsi', 'fsx'],
  lean4:            ['lean'],
  al:               ['al'],
  hlsl:             ['hlsl'],
  msl:              ['metal'],
  // FALSE POSITIVE: '.m' is also Objective-C (and Mathematica). A project with
  // matlab enabled will see Objective-C files treated as enabled-language code.
  // Escape hatch: drop matlab from `languages:` in .serena/project.yml.
  matlab:           ['m'],
  rego:             ['rego'],
  systemverilog:    ['sv', 'svh'],
  haxe:             ['hx'],
  // The three CSS-family names deliberately share one extension set, so whichever
  // one a project names in `languages:` covers .css/.scss/.sass — `languages:
  // [css]` on a .scss codebase would otherwise fall out of enforcement entirely.
  scss:             ['scss', 'sass', 'css'],
  sass:             ['scss', 'sass', 'css'],
  css:              ['css', 'scss', 'sass'],
};

/**
 * Parse the `languages:` list from a YAML string (no external YAML parser).
 *
 * Returns null  when the key is absent.
 * Returns []    when the key is present but the list is empty.
 * Returns [...] for a populated list (inline or block form).
 *
 * The null/[] split is load-bearing, not stylistic — getEnabledLanguages uses it
 * to decide whether project.yml overrides the global config. Do not normalise
 * null to [].
 *
 * Hand-rolled instead of js-yaml because the hooks must run with zero
 * dependencies: package.json declares no `dependencies` or `devDependencies` at
 * all, and install-global.sh rsyncs lib/hooks/ into ~/.claude/hooks/, where the
 * scripts execute standalone with no node_modules anywhere on the resolution
 * path. A require('js-yaml') there would throw MODULE_NOT_FOUND on every tool
 * call that triggers a Serena hook. The price is that only the two forms below
 * parse — anchors, flow maps, and multi-line quoted scalars all read as "key
 * absent", which degrades to the caller's static fallback rather than erroring.
 *
 * Accepted forms (block items may sit at any indentation, including column 0):
 *   languages: []                    → []
 *   languages: [typescript, python]  → ['typescript', 'python']
 *   languages:                       → ['typescript', 'python']
 *   - typescript
 *   - python
 */
function parseLanguagesFromYaml(content) {
  if (!content) return null;

  // Inline list: languages: [] or languages: [typescript, python]
  const inlineMatch = content.match(/^languages\s*:\s*\[([^\]]*)\]/m);
  if (inlineMatch) {
    const inner = inlineMatch[1].trim();
    if (!inner) return [];
    return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }

  // Key present but no inline bracket → look for block list items on following lines
  const keyMatch = content.match(/^languages\s*:/m);
  if (!keyMatch) return null;

  // KNOWN DEFECT, left unfixed (this pass is comments-only): the regex above is
  // ^-anchored, but indexOf is not — it searches from position 0 for the literal
  // matched text ("languages:"). An earlier occurrence of that substring, e.g.
  // inside a comment or as the tail of a key such as `default_languages:`, makes
  // the slice start in the wrong place and the block items are read from the
  // wrong region of the file. Inline form returns before reaching this line, so
  // only block form is affected.
  const afterKey = content.slice(content.indexOf(keyMatch[0]) + keyMatch[0].length);
  const items = [];
  for (const line of afterKey.split('\n')) {
    if (/^\s*#/.test(line)) continue;       // skip comment lines
    // A block item always starts with '-' (at any indentation), so a line
    // beginning with a letter at column 0 is the next top-level key and the list
    // has ended. Without this the loop swallows the rest of the file.
    if (/^[a-zA-Z]/.test(line)) break;      // next top-level key — stop
    // \S+ stops at the first space, so a quoted value containing whitespace
    // parses as its first word. No Serena language name contains a space, so this
    // has no real-world false positive today.
    const m = line.match(/^\s*-\s*(['"]?)(\S+)\1/);
    if (m) items.push(m[2]);
  }
  return items;
}

// Missing file, unreadable file, and permission denied all mean the same thing
// here: "not configured". This module is required by fail-open hooks, so it must
// never throw — see the library note at the top of the file.
function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

/**
 * Returns the list of enabled language names for the current working directory.
 * Project config ({cwd}/.serena/project.yml) overrides the global config when
 * it provides a non-null languages list (even an empty one).
 *
 * "Even an empty one" is the entire reason parseLanguagesFromYaml distinguishes
 * null from []: `languages: []` in project.yml is an authoritative "this project
 * scopes to nothing", and it has to outrank a populated global list. Collapse
 * the two and such a project silently inherits whatever the user happens to have
 * in ~/.serena/serena_config.yml.
 *
 * process.cwd() is the project root only because Claude Code runs hooks from it.
 * This module does no repo-root discovery, so a caller that has chdir'd
 * elsewhere resolves the wrong project.yml and gets the global list instead.
 */
function getEnabledLanguages() {
  const globalLangs  = parseLanguagesFromYaml(readFileSafe(GLOBAL_CONFIG));
  const projectYml   = path.join(process.cwd(), '.serena', 'project.yml');
  const projectLangs = parseLanguagesFromYaml(readFileSafe(projectYml));
  // The trailing `|| []` deliberately collapses null/[] for callers — downstream
  // only cares about the resulting set. Consequence worth knowing: "no languages
  // configured" reaches serena.js's isAllowedPath as an empty set, and that
  // branch falls back to the static CODE_EXTENSIONS list. An empty result
  // therefore widens enforcement to the built-in defaults; it does not disable it.
  return (projectLangs !== null ? projectLangs : globalLangs) || [];
}

/**
 * Returns a Set of file extensions (lowercase, no leading dot) for all
 * enabled languages in the current project.
 */
function getEnabledExtensionsSet() {
  const exts = new Set();
  for (const lang of getEnabledLanguages()) {
    for (const ext of (LANG_EXTS[lang] || [])) exts.add(ext);
  }
  return exts;
}

/**
 * Returns a RegExp matching file paths whose extension belongs to an enabled
 * language, or null when no languages are configured.
 *
 * Callers must read null as "no language scoping available" and fall back to
 * their own static list — null is not "matches nothing". No in-repo caller today
 * (see the consumer list at the top); this is public surface, not dead code.
 *
 * Extensions are interpolated unescaped. That is safe only because every value
 * in LANG_EXTS is [a-z0-9]+ — an extension containing a regex metacharacter
 * ('.', '+', '*') would silently corrupt the alternation rather than fail, so
 * keep LANG_EXTS values alphanumeric.
 */
function buildCodeExtensionsRegex() {
  const exts = getEnabledExtensionsSet();
  if (exts.size === 0) return null;
  return new RegExp('\\.(' + [...exts].join('|') + ')$', 'i');
}

module.exports = { LANG_EXTS, getEnabledLanguages, getEnabledExtensionsSet, buildCodeExtensionsRegex };
