'use strict';

/**
 * serena-languages.js — reads project/global Serena config for enabled languages
 * and maps them to file extensions for use in enforcement hooks.
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

// Serena language name → file extensions (lowercase, no leading dot)
const LANG_EXTS = {
  typescript:       ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
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
  matlab:           ['m'],
  rego:             ['rego'],
  systemverilog:    ['sv', 'svh'],
  haxe:             ['hx'],
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

  const afterKey = content.slice(content.indexOf(keyMatch[0]) + keyMatch[0].length);
  const items = [];
  for (const line of afterKey.split('\n')) {
    if (/^\s*#/.test(line)) continue;       // skip comment lines
    if (/^[a-zA-Z]/.test(line)) break;      // next top-level key — stop
    const m = line.match(/^\s*-\s*(['"]?)(\S+)\1/);
    if (m) items.push(m[2]);
  }
  return items;
}

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

/**
 * Returns the list of enabled language names for the current working directory.
 * Project config ({cwd}/.serena/project.yml) overrides the global config when
 * it provides a non-null languages list (even an empty one).
 */
function getEnabledLanguages() {
  const globalLangs  = parseLanguagesFromYaml(readFileSafe(GLOBAL_CONFIG));
  const projectYml   = path.join(process.cwd(), '.serena', 'project.yml');
  const projectLangs = parseLanguagesFromYaml(readFileSafe(projectYml));
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
 */
function buildCodeExtensionsRegex() {
  const exts = getEnabledExtensionsSet();
  if (exts.size === 0) return null;
  return new RegExp('\\.(' + [...exts].join('|') + ')$', 'i');
}

module.exports = { LANG_EXTS, getEnabledLanguages, getEnabledExtensionsSet, buildCodeExtensionsRegex };
