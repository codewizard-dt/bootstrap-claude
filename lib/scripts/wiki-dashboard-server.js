#!/usr/bin/env node

// Zero-dependency static file server for the live wiki dashboard.
// Serves the dashboard HTML client (bundled next to this script) and the
// target project's wiki/ tree read-only over HTTP. Node builtins only.
// It also serves the /usage-report script's JSON at /api/usage by running a
// fixed, package-owned script with fixed arguments, never with request data.
// WIKI_DASHBOARD_USAGE_SCRIPT overrides the script path; when set, it is the
// only candidate (a missing file means /api/usage answers 404).

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_PORT = 4317;
const MAX_PORT_ATTEMPTS = 10;

const USAGE_TIMEOUT_MS = 15000;
const USAGE_MAX_BYTES = 10 * 1024 * 1024;
const USAGE_CACHE_TTL_MS = 30000;

// --- CLI arg parsing (simple/positional) --------------------------------
// First non-flag arg  = project directory (default process.cwd())
// `--port <n>` OR a positional numeric arg = port (default 4317)
function parseArgs(argv) {
  let projectDir = null;
  let port = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') {
      port = parseInt(argv[++i], 10);
    } else if (/^\d+$/.test(arg)) {
      port = parseInt(arg, 10);
    } else if (!arg.startsWith('--')) {
      if (projectDir === null) projectDir = arg;
    }
  }

  return {
    projectDir: projectDir || process.cwd(),
    port: Number.isInteger(port) ? port : DEFAULT_PORT,
  };
}

const { projectDir, port: startPort } = parseArgs(process.argv.slice(2));

const DASHBOARD_HTML = path.join(__dirname, 'templates', 'wiki', 'dashboard.html');
const WIKI_ROOT = path.resolve(projectDir, 'wiki');

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.json': 'application/json',
};

function contentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'text/plain';
}

function noCacheHeaders(extra) {
  return Object.assign(
    {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      Expires: '0',
    },
    extra || {}
  );
}

function send(res, status, body, filePath) {
  const headers = noCacheHeaders(
    filePath ? { 'Content-Type': contentType(filePath) } : { 'Content-Type': 'text/plain' }
  );
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not Found');
      return;
    }
    res.writeHead(200, noCacheHeaders({ 'Content-Type': contentType(filePath) }));
    res.end(data);
  });
}

// --- /api/usage ----------------------------------------------------------
// An env override is authoritative: if set but missing, do not fall back.
function resolveUsageScript() {
  const override = process.env.WIKI_DASHBOARD_USAGE_SCRIPT;
  if (override) {
    return fs.existsSync(override) ? override : null;
  }
  const candidates = [
    path.join(__dirname, '..', 'skills', 'usage-report', 'scripts', 'usage-report.js'),
    path.join(os.homedir(), '.claude', 'skills', 'usage-report', 'scripts', 'usage-report.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let usageCache = null; // { at, body } — keyed by time only, successes only
let usagePending = null; // callbacks waiting on the in-flight run (single-flight)

function runUsageReport(callback) {
  const script = resolveUsageScript();
  if (script === null) {
    callback(new Error('usage-report-unavailable'));
    return;
  }
  if (usageCache && Date.now() - usageCache.at < USAGE_CACHE_TTL_MS) {
    callback(null, usageCache.body);
    return;
  }
  if (usagePending) {
    usagePending.push(callback);
    return;
  }
  usagePending = [callback];

  execFile(
    process.execPath,
    [script, '--project', projectDir],
    { timeout: USAGE_TIMEOUT_MS, maxBuffer: USAGE_MAX_BYTES, windowsHide: true },
    (err, stdout) => {
      let failure = err;
      if (!failure) {
        try {
          const parsed = JSON.parse(stdout);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            failure = new Error('unexpected usage-report output');
          }
        } catch (e) {
          failure = e;
        }
      }
      if (!failure) usageCache = { at: Date.now(), body: stdout };

      const callbacks = usagePending;
      usagePending = null;
      callbacks.forEach((cb) => (failure ? cb(failure) : cb(null, stdout)));
    }
  );
}

// Bodies are fixed strings: never stderr, err.message, script path, or projectDir.
function sendUsageJson(res, status, body) {
  res.writeHead(status, noCacheHeaders({ 'Content-Type': 'application/json' }));
  res.end(body);
}

function serveUsageReport(res) {
  const script = resolveUsageScript();
  if (script === null) {
    sendUsageJson(res, 404, JSON.stringify({ error: 'usage-report-unavailable' }));
    return;
  }
  runUsageReport((err, body) => {
    if (err) {
      sendUsageJson(res, 500, JSON.stringify({ error: 'usage-report-failed' }));
      return;
    }
    sendUsageJson(res, 200, body);
  });
}

function requestHandler(req, res) {
  if (req.method !== 'GET') {
    send(res, 405, 'Method Not Allowed');
    return;
  }

  // Strip query string, then decode.
  const rawPath = req.url.split('?')[0];
  let urlPath;
  try {
    urlPath = decodeURIComponent(rawPath);
  } catch (e) {
    send(res, 400, 'Bad Request');
    return;
  }

  // Dashboard client (may 404 gracefully if not yet built).
  if (urlPath === '/' || urlPath === '/dashboard.html') {
    serveFile(res, DASHBOARD_HTML);
    return;
  }

  // Wiki tree, read-only, cwd/project-relative.
  if (urlPath === '/wiki' || urlPath.startsWith('/wiki/')) {
    const subpath = urlPath.slice('/wiki'.length).replace(/^\/+/, '');
    const resolved = path.resolve(path.join(WIKI_ROOT, subpath));

    // Path-traversal defense: resolved path must stay inside WIKI_ROOT.
    if (resolved !== WIKI_ROOT && !resolved.startsWith(WIKI_ROOT + path.sep)) {
      send(res, 403, 'Forbidden');
      return;
    }

    fs.stat(resolved, (err, stats) => {
      if (err || !stats.isFile()) {
        send(res, 404, 'Not Found');
        return;
      }
      serveFile(res, resolved);
    });
    return;
  }

  // Usage report JSON (exact match; /api/usage/ and deeper paths stay 404).
  if (urlPath === '/api/usage') {
    serveUsageReport(res);
    return;
  }

  send(res, 404, 'Not Found');
}

// --- Listen with port fallback on EADDRINUSE ----------------------------
function listen(port, attempt) {
  const server = http.createServer(requestHandler);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      listen(port + 1, attempt + 1);
    } else {
      throw err;
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Wiki dashboard server running at http://localhost:${port}`);
  });
}

listen(startPort, 1);
