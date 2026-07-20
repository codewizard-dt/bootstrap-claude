#!/usr/bin/env node

// Zero-dependency static file server for the live wiki dashboard.
// Serves the dashboard HTML client (bundled next to this script) and the
// target project's wiki/ tree read-only over HTTP. Node builtins only.

const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 4317;
const MAX_PORT_ATTEMPTS = 10;

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

  server.listen(port, () => {
    console.log(`Wiki dashboard server running at http://localhost:${port}`);
  });
}

listen(startPort, 1);
