#!/usr/bin/env node
'use strict';

// serena-bash-grep-block.js — PreToolUse hook (matcher: Bash)
// Blocks grep-family AND filesystem-exploration AND in-place-editing shell commands when targeting code.
// Suggests the equivalent Serena tool call.
// Pipe-grep bypass (inverse denylist): allow grep after any pipe UNLESS the first segment itself
// contains grep/rg/ag/ack, or reads a code file directly (cat/head/tail on *.ts etc., find <code-dir>).
// Container bypass: docker exec (or ssh + docker exec) bypasses all FS checks — Serena can't see inside containers.

const path = require('path');
const {
  buildSuggestion, buildStructuredBlockResponse, buildBashFsSuggestion, isAllowedPath,
  extractSymbolsFromPattern,
  getStateFilePath, readStateFile, shouldEnforceSerena, isOutsideProject,
} = require('./lib/serena');

// Zero-width / formatting chars that would split tokens invisibly and
// bypass ASCII regex symbol detection.
const ZERO_WIDTH = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);
  if (process.env.CLAUDE_MIGRATION === '1') process.exit(0);

  // Fail-open: skip enforcement when Serena is unhealthy for this project.
  if (!shouldEnforceSerena(readStateFile(getStateFilePath()))) process.exit(0);

  // String coercion: non-string command would throw on .trim() and fail-open.
  // Zero-width strip: prevents `grep\u200BUserFunc` evasion.
  const fullCmd = String(data.tool_input?.command ?? '').trim().replace(ZERO_WIDTH, '');

  // Container bypass: `docker exec`, `docker compose exec`, `docker-compose exec`.
  // Serena cannot reach into a container's filesystem, so the FS-exploration and
  // in-place-editing rules don't apply. Runs BEFORE segment splitting so inner
  // `&&`/`;` inside `bash -c '...'` or `ssh host '...'` don't slice the context away.
  // Intentionally NOT anchored at start — covers `ssh host 'docker exec ...'` patterns.
  if (/(?:^|[\s'"])(?:sudo\s+)?(?:docker-compose|docker(?:\s+compose)?)(?:\s+-{1,2}[\w-]+(?:[ =]\S+)?)*\s+exec\b/i.test(fullCmd)) {
    process.exit(0);
  }

  // SSH bypass: any ssh-to-remote-host invocation skips all Serena-first checks.
  // Serena's LSP cannot reach a remote server, so grep/cat/sed/find against
  // remote paths must be allowed. Matches `ssh host …`, `ssh user@host …`, and
  // pipelines that contain ssh anywhere (e.g. `cat key | ssh host 'cmd'`).
  // `\bssh\b` won't match `sshpass`; the trailing `\s+\S` ensures ssh has an arg
  // so a bare word "ssh" inside a string/comment won't trigger the bypass.
  if (/(?:^|[\s'"|;&])ssh\s+\S/i.test(fullCmd)) {
    process.exit(0);
  }

  // Split the command on `;`, `&&`, `||` and evaluate each segment independently.
  // This catches cases like `ls src/ && cat src/index.ts` where only one segment is bad.
  const segments = fullCmd.split(/;|&&|\|\|/).map(s => s.trim()).filter(Boolean);

  for (const cmd of segments) {
    const blockResult = checkSegment(cmd, fullCmd);
    if (blockResult) {
      process.stderr.write(blockResult.stderr);
      console.log(JSON.stringify(blockResult.json));
      process.exit(2);
    }
  }

  process.exit(0);
});

/**
 * Inspect a single command segment for violations.
 * Returns { stderr, json } if the segment should be blocked, or null to allow.
 */
function checkSegment(cmd, fullCmd) {
  // Strip transparent rtk proxy prefix so VCS/SSH/phase bypasses fire on the real command.
  // e.g. `rtk git diff HEAD -- file.md` → `git diff HEAD -- file.md`
  cmd = cmd.replace(/^rtk\s+/, '');

  // Out-of-project scoping: Serena is per-project and can't reach outside the
  // root, so a segment whose every path target escapes the project passes
  // through. Read-exploration commands additionally allow variable-led paths
  // (e.g. `ls "$SDIR"`) that can't be proven in-project; in-place edits do not.
  if (segmentEscapesProject(cmd)) return null;

  // VCS bypass: `git`, `gh`, `hg`, `jj`, `svn` may legitimately reference any
  // path (e.g. `git diff HEAD -- foo.md`, `gh pr view`). They don't read file
  // contents in the way `cat`/`sed`/`grep` do — the diff/show output is VCS
  // metadata, not Serena-navigable code. Skip all Phase 2/3 checks for them.
  // Phase 1 (grep) already has its own pipe-bypass for `git ... | grep`.
  if (/^(?:sudo\s+)?(?:git|gh|hg|jj|svn)\b/.test(cmd)) {
    // Still run Phase 1 in case of `git log | grep MySymbol` patterns within a single segment.
    // (Phase 1 has its own allowlist for git-piped grep, so this is safe.)
    if (!/\b(grep|rg|ag|ack)\b/i.test(cmd)) return null;
  }

  // ── PHASE 1: grep-family detection ────────────────────────────────────────

  if (/\b(grep|rg|ag|ack)\b/i.test(cmd)) {
    // Markdown exploration: grep/rg on .md files must go through Serena
    // (search_for_pattern / read_file). Markdown writing stays on native Edit/Write,
    // but reading & searching are Serena's job — the symbol-pattern heuristic below
    // misses lowercase prose queries like "addendum|amend|update", which would
    // otherwise slip past on a markdown target.
    const mdTargetMatch = cmd.match(/(?:^|\s)((?:[~./\w-]+\/)?[\w.-]+\.md)\b/i);
    if (mdTargetMatch) {
      return buildMarkdownBlockResult(cmd, fullCmd, 'grep', mdTargetMatch[1]);
    }

    // Pipe-bypass (inverse denylist): allow grep after any pipe unless the first pipe segment
    // itself runs grep/rg/ag/ack, or reads a code file directly (cat/head/tail <code-ext>,
    // find <code-dir>). This covers composer, cargo, mvn, make, npm test, ruff, etc. without
    // an ever-growing allowlist.
    const _pipeSegs = cmd.split('|').map(s => s.trim());
    if (_pipeSegs.length >= 2) {
      const _firstSeg = _pipeSegs[0];
      const _firstSegIsGrep    = /\b(grep|rg|ag|ack)\b/i.test(_firstSeg);
      const _firstSegReadsCode =
        /\b(?:cat|head|tail|less|more|bat)\s+\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)\b/i.test(_firstSeg) ||
        /\bfind\s+\S*(?:src|app|components|lib|hooks|utils|services|actions)\b/i.test(_firstSeg);
      if (!_firstSegIsGrep && !_firstSegReadsCode) return null;
    }
    if (/(?:^|[\/\\])(?:supabase[\/\\]migrations|\.task|\.claude|node_modules|knowledge-vault)(?:[\/\\]|$)/i.test(cmd)) return null;
    if (/--include=?\S*\.(sql|json|txt|env|sh|css|scss|log)\b/i.test(cmd)) return null;

    const cleaned = cmd.replace(/\\"/g, '"');
    const patternMatch =
      cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*"([^"]+)"/i) ||
      cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:-\S+\s+)*'([^']+)'/i) ||
      cleaned.match(/\b(?:grep|rg|ag|ack)\s+(?:(?:-\w+\s+(?:[a-z]+\s+)?)*?)([A-Z][a-zA-Z]\w+)/);

    if (!patternMatch) {
      const fallbackTargetsCode =
        /\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]|actions[\\/]/i.test(cmd) ||
        /\.tsx?\b|\.jsx?\b/i.test(cmd);
      if (fallbackTargetsCode) {
        return buildFsBlockResult(cmd, fullCmd, 'grep', '<code file>');
      }
    }

    if (patternMatch) {
      const fullPattern = patternMatch[1];
      // NOTE: split on BOTH `|` and `.` — splitting on dots avoids merging
      // dotted expressions like `mcp.Tool` into `mcpTool` (camelCase false positive).
      // Each token is stripped of zero-width chars and regex metachars before
      // classification (see extractSymbolsFromPattern / isCodeSymbol in lib/serena.js).
      const symbols = extractSymbolsFromPattern(fullPattern, {
        splitRe: /\\?\||\./,
        clean: p => p.replace(ZERO_WIDTH, '').replace(/[*+?^${}()[\]\\]/g, ''),
        allowlist: 'bash',
      });

      // SECURITY: only allow the safe-prefix pipe bypass AFTER confirming no code symbols.
      if (symbols.length === 0) {
        const targetsCodeEarly =
          /\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]|actions[\\/]/i.test(cmd) ||
          /\.tsx?\b|\.jsx?\b/i.test(cmd);
        const hasNonCodeTargetEarly = /\.(sql|json|txt|env|sh|css|scss|log|xml)\b/i.test(cmd) && !targetsCodeEarly;
        if (hasNonCodeTargetEarly) return null;

        const isSimplePipe = /\|/.test(cmd) && !/xargs|exec/.test(cmd);
        const grepPos = cmd.search(/\b(grep|rg|ag|ack)\b/i);
        const pipePos = cmd.indexOf('|');
        if (isSimplePipe && pipePos !== -1 && pipePos < grepPos) {
          const beforePipe = cmd.substring(0, pipePos).trim();
          if (/^(git|npm|npx|pnpm|node|echo|cat\s+\S+\.(?:json|md|txt|log|ya?ml))/i.test(beforePipe) ||
              /^(ls|wc|head|tail|sort|uniq)\b/i.test(beforePipe)) {
            return null;
          }
        }
        if (targetsCodeEarly) {
          return buildFsBlockResult(cmd, fullCmd, 'grep', '<code file>');
        }
        return null;
      }

      const targetsCode =
        /\bsrc[\\/]|\bapp[\\/]|components[\\/]|lib[\\/]|hooks[\\/]|utils[\\/]|services[\\/]|actions[\\/]/i.test(cmd) ||
        /\.tsx?\b|\.jsx?\b/i.test(cmd) ||
        /-t\s+(ts|tsx|js|jsx|typescript|javascript)\b/i.test(cmd) ||
        /--type[= ](ts|tsx|js|jsx|typescript)\b/i.test(cmd) ||
        /\bfind\b.*\b(src|app|components|lib)\b/.test(cmd) ||
        /\bxargs\b.*\b(grep|rg|ag|ack)\b/i.test(cmd) ||
        /-exec\s+(grep|rg|ag|ack)\b/i.test(cmd);

      const hasNonCodeTarget =
        /\.(sql|json|txt|env|sh|css|scss|log|xml)\b/i.test(cmd) &&
        !targetsCode;

      if (hasNonCodeTarget && !targetsCode) return null;

      const suggestions = symbols.map(sym => {
        const intent = /^[A-Z]/.test(sym) ? 'symbol_search' : 'references';
        return `  ${sym}:\n${buildSuggestion(sym, intent, '    ')}`;
      }).join('\n');

      const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
      const serenaCall = buildBashFsSuggestion(cmd, '  ') ||
        symbols.map(sym => {
          const intent = /^[A-Z]/.test(sym) ? 'symbol_search' : 'references';
          return `  ${buildSuggestion(sym, intent, '')}`;
        }).join('\n');
      const allowNote = 'Allowlist: any-CLI-piped grep (unless first segment is grep or reads a code file), non-code extensions, non-code paths.';
      const reason = `SERENA-FIRST: Pattern contains code symbols [${symbols.join(', ')}].\n` +
        `Command (truncated): ${displayCmd}\n` +
        `Use instead:\n${suggestions}\n${allowNote}`;

      const intent = /^[A-Z]/.test(symbols[0]) ? 'symbol_search' : 'references';
      return {
        stderr: `\n⛔ SERENA-FIRST: Blocked grep/rg — found ${symbols.length} code symbol(s): ${symbols.join(', ')}\n` +
          `Serena is always connected. Use:\n${suggestions}\n\n`,
        json: buildStructuredBlockResponse({ hook: 'serena-bash-grep-block', symbols, intent, reason }),
      };
    }
  }

  // ── PHASE 2: filesystem exploration detection ──────────────────────────────

  // ls (but not `ls -d`) targeting non-exempt directory
  const lsMatch = /\bls\b(?!\s+-d\b)(?:\s+[^\s|;&<>]+)/.exec(cmd);
  if (lsMatch) {
    // Extract directory argument (skip flags)
    const afterLs = cmd.slice(cmd.indexOf('ls') + 2).trim();
    const lsTarget = afterLs.replace(/^(?:-\S+\s+)*/, '').split(/\s/)[0] || '';
    // Block only when the target is not in the always-exempt list
    if (lsTarget && !isExemptDir(lsTarget)) {
      return buildFsBlockResult(cmd, fullCmd, 'ls', lsTarget || '.');
    }
  }

  // tree targeting non-exempt directory
  // The `tree` CLI is always a standalone word: it is followed by whitespace, a flag, or
  // end-of-segment. Package names like "tree-sitter" and "tree_sitter" contain additional
  // word characters after "tree", so we require a non-word character (or end) after the
  // match with (?!\w) in addition to the opening \b. This prevents false positives on
  // identifiers like tree_sitter_javascript or tree-sitter.
  const treeMatch = /\btree(?!\w)(?:\s+[^\s|;&<>]+)?/.exec(cmd);
  if (treeMatch) {
    const treeIdx = cmd.search(/\btree(?!\w)/);
    const afterTree = cmd.slice(treeIdx + 4).trim();
    const treeTarget = afterTree.replace(/^(?:-\S+\s+)*/, '').split(/\s/)[0] || '.';
    if (!isExemptDir(treeTarget)) {
      return buildFsBlockResult(cmd, fullCmd, 'tree', treeTarget);
    }
  }

  // find -name/-path/-iname/-type targeting code
  const findMatch = /\bfind\s+(\S+)\s+[^|;&<>]*-(?:name|path|iname|type)\b/.exec(cmd);
  if (findMatch) {
    const findTarget = findMatch[1];
    if (!isExemptDir(findTarget)) {
      return buildFsBlockResult(cmd, fullCmd, 'find', findTarget);
    }
  }

  // cat/head/tail/less/more/bat on markdown — Serena owns markdown reading too.
  const catMdMatch = /\b(?:cat|head|tail|less|more|bat)\b[^|;&<>]*?\s(\S+\.md)\b/i.exec(cmd);
  if (catMdMatch) {
    return buildMarkdownBlockResult(cmd, fullCmd, 'cat', catMdMatch[1]);
  }

  // cat/head/tail/less/more/bat on code-extension files
  const catMatch = /\b(?:cat|head|tail|less|more|bat)\s+\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)\b/.exec(cmd);
  if (catMatch) {
    const fileArg = extractFileArg(cmd, /\b(?:cat|head|tail|less|more|bat)\b/);
    if (fileArg && !isAllowedPath(fileArg)) {
      return buildFsBlockResult(cmd, fullCmd, 'cat', fileArg);
    }
    // Even if extraction failed, pattern already confirmed code extension
    if (!fileArg) {
      return buildFsBlockResult(cmd, fullCmd, 'cat', catMatch[0]);
    }
  }

  // Fallback: head/tail/cat with flags put the file last (e.g. `head -85 file.ts`, `tail -f file.ts`).
  // The catMatch regex above requires the file to be the first argument, so it misses these.
  if (!catMatch && /\b(?:cat|head|tail|less|more|bat)\b/.test(cmd)) {
    const lastToken = cmd.trim().split(/\s+/).pop() || '';
    if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp)$/i.test(lastToken) &&
        !isAllowedPath(lastToken)) {
      const verb = cmd.trim().split(/\s/)[0];
      return buildFsBlockResult(cmd, fullCmd, verb, lastToken);
    }
  }

  // sed/awk used as readers (no in-place flag) on code-extension files.
  // Phase 3 catches the editing variants (sed -i, awk -i inplace); this rule
  // covers `sed -n '8,14p' foo.py`, `awk '/x/' foo.py`, etc. The negative
  // lookahead skips segments containing -i so we don't double-fire.
  const sedAwkReadMatch = /\b(sed|awk)\b(?![^\n]*?\s-i(?:\s|$|nplace))[^\n]*?\s(\S+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp))\b/.exec(cmd);
  if (sedAwkReadMatch) {
    const verb = sedAwkReadMatch[1];
    const fileArg = sedAwkReadMatch[2];
    if (!isAllowedPath(fileArg)) {
      return buildFsBlockResult(cmd, fullCmd, verb, fileArg);
    }
  }

  // sed/awk as readers on markdown — Serena owns markdown reading.
  const sedAwkMdMatch = /\b(sed|awk)\b(?![^\n]*?\s-i(?:\s|$|nplace))[^\n]*?\s(\S+\.md)\b/i.exec(cmd);
  if (sedAwkMdMatch) {
    return buildMarkdownBlockResult(cmd, fullCmd, sedAwkMdMatch[1], sedAwkMdMatch[2]);
  }

  // ── PHASE 3: in-place editing detection ───────────────────────────────────

  // sed -i (any flag-order variant)
  if (/\bsed\s+(?:-E\s+)?-i\b|\bsed\s+-i(?:\s+-E)?\b/.test(cmd)) {
    const fileArg = extractLastPathArg(cmd);
    if (!fileArg || !isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, 'sed -i', fileArg || '<path>');
    }
  }

  // awk -i inplace
  if (/\bawk\s+-i\s+inplace\b/.test(cmd)) {
    const fileArg = extractLastPathArg(cmd);
    if (!fileArg || !isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, 'awk -i inplace', fileArg || '<path>');
    }
  }

  // perl -i (any combination of n/p/i flags)
  if (/\bperl\s+-[npi]*i[npe]*\b/.test(cmd)) {
    const fileArg = extractLastPathArg(cmd);
    if (!fileArg || !isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, 'perl -i', fileArg || '<path>');
    }
  }

  // >> <code-file> (append redirect)
  const appendMatch = />>\s*(\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp))\b/.exec(cmd);
  if (appendMatch) {
    const fileArg = appendMatch[1];
    if (!isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, '>>', fileArg);
    }
  }

  // > <code-file> (overwrite redirect — not preceded by `2>`)
  const overwriteMatch = /(?<!2)>\s*(\S+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|vue|svelte|cpp|c|h|hpp))\b/.exec(cmd);
  if (overwriteMatch) {
    const fileArg = overwriteMatch[1];
    if (!isAllowedPath(fileArg)) {
      return buildInplaceBlockResult(cmd, fullCmd, '>', fileArg);
    }
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip surrounding quotes from a shell token. */
function stripQuotes(t) {
  return String(t).replace(/^['"]+/, '').replace(/['"]+$/, '');
}

/** True if a segment performs an in-place edit / file-write (not a pure read). */
function segmentIsInPlaceEdit(cmd) {
  return /\bsed\s+(?:-E\s+)?-i\b|\bsed\s+-i(?:\s+-E)?\b/.test(cmd) ||
    /\bawk\s+-i\s+inplace\b/.test(cmd) ||
    /\bperl\s+-[npi]*i[npe]*\b/.test(cmd) ||
    /(?:^|[^0-9&])>>?\s*[^\s&|;]/.test(cmd); // > file / >> file (not 2>&1)
}

/** Extract path-looking argument tokens from a command segment. */
function extractPathTokens(cmd) {
  const paths = [];
  for (let t of String(cmd).split(/\s+/)) {
    t = stripQuotes(t);
    if (!t || t.startsWith('-')) continue;      // empty or flag
    if (/^[|&;<>]+$/.test(t)) continue;         // shell operator
    if (/^[sy][/|#,]/.test(t)) continue;        // sed/awk script (s/a/b/, y/a/b/)
    // Path-looking: contains a slash, or begins with ~ / $VAR.
    if (/\//.test(t) || /^~/.test(t) || /^\$\{?\w/.test(t)) paths.push(t);
  }
  return paths;
}

/**
 * True when a target path escapes the project root. Variable-led paths
 * (`$VAR…`, unresolvable) count as escaping ONLY for read commands (`allowVar`),
 * since Serena-first is agent guidance, not a security boundary, and we can't
 * prove such a path is in-project. Absolute / `~` / relative paths are resolved.
 */
function targetEscapesProject(t, opts = {}) {
  const s = stripQuotes(t).trim();
  if (!s) return false;
  if (/^\$\{?\w/.test(s)) return !!opts.allowVar;
  return isOutsideProject(s);
}

/**
 * True when EVERY path target in a segment escapes the project root, so Serena
 * can't operate on it and the segment should pass through. Read-exploration
 * segments also permit unresolvable variable-led paths; in-place edits do not.
 */
function segmentEscapesProject(cmd) {
  const tokens = extractPathTokens(cmd);
  if (tokens.length === 0) return false;
  const allowVar = !segmentIsInPlaceEdit(cmd);
  return tokens.every(t => targetEscapesProject(t, { allowVar }));
}

/** Directories that are always exempt from ls/tree/find blocking. */
function isExemptDir(dir) {
  if (!dir || dir === '.') return false;
  return /(?:^|[/\\])(?:\.claude|\.serena|\.task|node_modules|dist|build|\.git)(?:[/\\]|$)/i.test(dir) ||
    /^\.claude|^\.serena|^\.task/.test(dir) ||
    dir === 'node_modules' || dir === '.git';
}

/** Extract the file argument that follows a command verb (after any flags). */
function extractFileArg(cmd, verbRe) {
  const match = verbRe.exec(cmd);
  if (!match) return null;
  const after = cmd.slice(match.index + match[0].length).trim();
  // Skip flag tokens like -n 10
  const token = after.replace(/^(?:-\S+(?:\s+\S+)?\s+)*/, '').split(/\s/)[0] || '';
  return token || null;
}

/** Extract the last path-looking argument in a command (for sed/awk/perl). */
function extractLastPathArg(cmd) {
  // Match last whitespace-delimited token that looks like a path (not a flag or substitution)
  const tokens = cmd.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t && !t.startsWith('-') && !t.startsWith("'") && !t.startsWith('"') &&
        !/^[sg]\//.test(t) && /[./]/.test(t)) {
      return t;
    }
  }
  return null;
}

/** Build block result for filesystem exploration commands. */
function buildFsBlockResult(cmd, fullCmd, verb, targetPath) {
  const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
  const serenaCall = buildBashFsSuggestion(cmd, '  ');
  const allowNote = 'Allowlist: .docs/, .claude/, .serena/, node_modules/, .git/.';
  const reason = `SERENA-FIRST: Filesystem exploration via '${verb}' on '${targetPath}' blocked.\n` +
    `Command (truncated): ${displayCmd}\n` +
    `Use instead:\n${serenaCall || '  mcp__serena__list_dir("' + targetPath + '")'}\n${allowNote}`;
  return {
    stderr: `\n⛔ SERENA-FIRST: Blocked '${verb}' on '${targetPath}' — use Serena list_dir/find_file.\n` +
      `${serenaCall || '  mcp__serena__list_dir("' + targetPath + '")'}\n\n`,
    json: buildStructuredBlockResponse({
      hook: 'serena-bash-grep-block',
      symbols: [targetPath],
      intent: 'symbol_search',
      reason,
    }),
  };
}

/** Build block result for in-place editing commands. */
function buildInplaceBlockResult(cmd, fullCmd, verb, targetPath) {
  const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
  const serenaCall = buildBashFsSuggestion(cmd, '  ');
  const allowNote = 'Allowlist: non-code extensions (.md, .json, .yaml, etc.).';
  const reason = `SERENA-FIRST: In-place editing via '${verb}' on code file '${targetPath}' blocked.\n` +
    `Command (truncated): ${displayCmd}\n` +
    `Use instead:\n${serenaCall || '  mcp__serena__replace_content("' + targetPath + '", ...)'}\n${allowNote}`;
  return {
    stderr: `\n⛔ SERENA-FIRST: Blocked '${verb}' on '${targetPath}' — use Serena replace_content.\n` +
      `${serenaCall || '  mcp__serena__replace_content("' + targetPath + '", ...)'}\n\n`,
    json: buildStructuredBlockResponse({
      hook: 'serena-bash-grep-block',
      symbols: [targetPath],
      intent: 'symbol_search',
      reason,
    }),
  };
}

/** Build block result for markdown exploration (grep/cat/head/tail on .md). */
function buildMarkdownBlockResult(cmd, fullCmd, verb, targetPath) {
  const displayCmd = fullCmd.length > 200 ? fullCmd.slice(0, 200) + '…' : fullCmd;
  const serenaCall =
    verb === 'grep'
      ? `  mcp__serena__search_for_pattern(substring_pattern="<regex>", relative_path="${targetPath}")`
      : `  mcp__serena__read_file("${targetPath}")`;
  const allowNote = 'Markdown reading & searching belong to Serena; native Edit/Write are still allowed for markdown writes.';
  const reason = `SERENA-FIRST: Markdown exploration via '${verb}' on '${targetPath}' blocked.\n` +
    `Command (truncated): ${displayCmd}\n` +
    `Use instead:\n${serenaCall}\n${allowNote}`;
  return {
    stderr: `\n⛔ SERENA-FIRST: Blocked '${verb}' on markdown file '${targetPath}'.\n` +
      `${serenaCall}\n\n`,
    json: buildStructuredBlockResponse({
      hook: 'serena-bash-grep-block',
      symbols: [targetPath],
      intent: 'symbol_search',
      reason,
    }),
  };
}
