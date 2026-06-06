#!/usr/bin/env bash
set -euo pipefail

# Deployment / CI scaffolding seam — separate from the docs/skills/MCP sync flow.
# Reads .docs/guides/deployment-strategy.md as a prompt template and runs Claude
# to scaffold .github/ workflows + Makefile + .gitleaks.toml into a target project.
#
# Called once by setup-project.sh (new projects). DELIBERATELY NOT called by
# update-project.sh: workflows get hand-customized per project (Dockerfile paths,
# runner labels, deploy steps) and must not be clobbered on every template update.
#
# Also invokable standalone (`npx bootstrap-claude deploy`) so an existing project
# can opt into CI on demand. Claude applies copy-once semantics:
#   - security.yml      → always overwritten (generic, no project-specific content)
#   - build.yml         → created once, skipped if present
#   - .gitleaks.toml    → created once, skipped if present
#   - Makefile          → Docker targets added/merged if a Makefile already exists

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GUIDE="$SCRIPT_DIR/../.docs/guides/deployment-strategy.md"

if [ ! -f "$GUIDE" ]; then
  echo "Error: deployment guide not found at $GUIDE" >&2
  exit 1
fi

DRY_RUN=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
set -- "${POSITIONAL[@]}"

if [ $# -ne 1 ]; then
  echo "Usage: $0 [--dry-run] <path-to-project>" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$1" 2>/dev/null && pwd)" || {
  echo "Error: Cannot resolve path: $1" >&2
  exit 1
}

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Directory does not exist: $PROJECT_DIR" >&2
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo "Docker and Compose files in $PROJECT_DIR:"
  echo ""
  echo "  Dockerfiles:"
  find "$PROJECT_DIR" \( -name node_modules -o -name .git \) -prune -o \
    -name "Dockerfile*" -print | sort | while read -r f; do
    echo "    ${f#"$PROJECT_DIR/"}"
  done
  echo ""
  echo "  Docker Compose files:"
  find "$PROJECT_DIR" \( -name node_modules -o -name .git \) -prune -o \
    \( -name "docker-compose*.yml" -o -name "docker-compose*.yaml" \
       -o -name "compose*.yml" -o -name "compose*.yaml" \) -print | sort | while read -r f; do
    echo "    ${f#"$PROJECT_DIR/"}"
  done
  exit 0
fi

PROMPT="$(cat "$GUIDE")

---

Scaffold the deployment infrastructure described in the guide above for the project at: $PROJECT_DIR

## Your task

Inspect the project's structure (directory layout, existing Dockerfiles, package.json/pyproject.toml/go.mod, existing Makefile, existing docker-compose files), then create or update the files listed below using real project values — never placeholder strings like \`<ORG>\`, \`<PROJECT>\`, or \`<LABEL>\`.

**If you cannot confidently identify the services, their entrypoints, or their runtimes from the files you find, stop and ask the user before creating anything.**

---

### Step 1 — Detect services

Identify each deployable service by scanning for directories (or the repo root for single-service repos) that contain any of:

- \`package.json\` — Node.js. Check \`scripts.dev\` / \`scripts.start\` for the dev command and inspect \`dependencies\` to identify the framework: Vite, Next.js, Express, Fastify, etc.
- \`pyproject.toml\` or \`requirements.txt\` — Python. Check dependencies for \`fastapi\`/\`uvicorn\`, \`flask\`, \`django\`, etc.
- \`go.mod\` — Go.
- \`Cargo.toml\` — Rust.

For each service record: **runtime · framework · dev command · port · whether it proxies to another service**.

---

### Step 2 — Create or update files

#### 1. \`.github/workflows/security.yml\` — always overwrite
Generic; no project-specific content. Include:
- **CodeQL** — matrix over the detected languages (use \`python\`, \`javascript-typescript\`, \`go\`, etc. as appropriate)
- **Gitleaks** secret detection with \`fetch-depth: 0\`

#### 2. \`.github/workflows/build.yml\` — create only if absent
Fill in real image names, Dockerfile paths, and runner label. Do not touch if the file already exists.

#### 3. \`.gitleaks.toml\` — create only if absent

#### 4. \`Makefile\` — merge Docker targets if a Makefile already exists; create from scratch if not
Add only the targets from the guide that are not already present. Never remove or reformat existing targets.
Set \`GITHUB_USER ?= \$(shell gh api user --jq .login 2>/dev/null)\` so auth resolves at runtime rather than being hardcoded.

#### 5. \`docker-compose.build.yml\` — create only if absent
Local dev overlay. Layered on top of \`docker-compose.yml\` via:
\`\`\`
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build --wait
\`\`\`
For each service:
- Add a \`build:\` block pointing to the service directory and its \`Dockerfile.dev\`
- Bind-mount the full source tree into the working directory (e.g. \`./backend:/app\`)
- **Shield installed dependencies with an anonymous volume** declared immediately after the source mount. This prevents the host bind mount from overwriting the container's installed packages:
  - Node.js: \`- /app/node_modules\`
  - Python venv: \`- /app/.venv\`
  - Add others (e.g. \`/app/.cargo\`) for any runtime that installs into a subdirectory
- **Override service URLs that hardcode \`localhost\`**: inside Docker, \`localhost\` resolves to the container itself. Replace with the compose service name (e.g. \`DATABASE_URL: postgresql+asyncpg://postgres:postgres@db:5432/mydb\`)
- **Vite / Node frontend proxy targets**: Vite's dev-server proxy runs server-side (Node.js), so its \`target\` also can't use \`localhost\` to reach the backend container. Pass the backend address via an env var in the compose service (e.g. \`PROXY_TARGET: http://backend:8000\`) and update \`vite.config.ts\` to read it:
  \`\`\`ts
  target: process.env.PROXY_TARGET ?? 'http://localhost:8000',
  \`\`\`
- **Vite \`--host\` flag**: the Vite dev server binds to \`127.0.0.1\` by default and is unreachable via Docker port mapping. Override the container command: \`command: npx vite --host\` (do not bake \`--host\` into the Dockerfile so the image stays usable outside Docker)
- Wire \`depends_on\` with \`condition: service_healthy\` for any service that requires the database to be ready before starting

#### 6. \`Dockerfile.dev\` per service — create only if absent
Minimal, fast-to-build dev image. The guiding principle: **install dependencies in the image; let source arrive via the bind mount at runtime**.

- **Python (FastAPI/uvicorn)**: \`FROM python:3.11-slim\`, copy only the manifest (\`pyproject.toml\` or \`requirements.txt\`), install deps, set \`CMD\` to run uvicorn with \`--host 0.0.0.0\` and \`--reload\`. Adjust the module path (\`app.main:app\`) to match the project's actual entrypoint. Do not \`COPY\` source.
- **Node.js frontend (Vite / CRA / Next dev mode)**: \`FROM node:22-alpine\`, copy \`package.json\` + lockfile, \`RUN npm install\`, set \`CMD\` to the framework's dev command (e.g. \`npx vite\`, \`npm run dev\`). Do not \`COPY\` source. The \`--host\` flag is added via the compose \`command:\` override, not here.
- **Node.js backend (Express / Fastify / etc.)**: same pattern; \`CMD\` runs the server with hot-reload (e.g. \`node --watch src/index.js\` or \`npx ts-node-dev src/index.ts\`).
- **Go**: \`FROM golang:1.22-alpine\`, copy \`go.mod\` + \`go.sum\`, \`RUN go mod download\`, \`CMD [\"go\", \"run\", \"./cmd/server\"]\` (adjust path). Use \`air\` for hot-reload if the project already depends on it.
- **Other runtimes**: apply the same principle — install deps in the image; source arrives via bind mount; dev server runs with hot-reload.

---

### Deriving the GHCR org/repo slug

Priority order:
1. \`name\` field in \`package.json\` or \`pyproject.toml\` — strip service-specific suffixes (\`-backend\`, \`-frontend\`, \`-api\`) to recover the project base name
2. GitHub remote URL (\`git remote get-url origin\`) — owner becomes the org; combine with the base name above or the directory name
3. Project directory name as a last resort

Image naming convention: \`ghcr.io/<org>/<project>-<service>\`
Examples: \`ghcr.io/acme/myapp-backend\`, \`ghcr.io/acme/myapp-frontend\`"

cd "$PROJECT_DIR"
claude --dangerously-skip-permissions "$PROMPT"