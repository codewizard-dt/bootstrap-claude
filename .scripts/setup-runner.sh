#!/usr/bin/env bash
# Generalized GitHub Actions self-hosted runner installer.
# Must be run as root on the target droplet.
#
# Usage:
#   RUNNER_TOKEN=<token> REPO_URL=https://github.com/org/repo bash setup-runner.sh
#
# Required env vars:
#   RUNNER_TOKEN   Registration token from GitHub → repo → Settings → Actions → Runners
#   REPO_URL       Full HTTPS URL of the GitHub repo (e.g. https://github.com/acme/myapp)
#
# Optional env vars (all have defaults):
#   RUNNER_VERSION   GitHub Actions runner version     (default: 2.331.0)
#   RUNNER_DIR       Install directory                 (default: /opt/actions-runner)
#   RUNNER_USER      System user to run the service    (default: runner)
#   RUNNER_NAME      Display name registered on GitHub (default: <hostname>-droplet)
#   RUNNER_LABEL     Label attached to the runner      (default: droplet)
#   GITHUB_USER      GitHub username for GHCR login    (default: derived from REPO_URL)
#
# Get the registration token from:
#   GitHub → repo → Settings → Actions → Runners → New self-hosted runner (Linux x64)

set -euo pipefail

: "${RUNNER_TOKEN:?RUNNER_TOKEN env var is required}"
: "${REPO_URL:?REPO_URL env var is required (e.g. https://github.com/acme/myapp)}"

RUNNER_VERSION="${RUNNER_VERSION:-2.331.0}"
RUNNER_DIR="${RUNNER_DIR:-/opt/actions-runner}"
RUNNER_USER="${RUNNER_USER:-runner}"
RUNNER_NAME="${RUNNER_NAME:-$(hostname)-droplet}"
RUNNER_LABEL="${RUNNER_LABEL:-droplet}"
# Derive GitHub username from the third path segment of https://github.com/owner/repo
GITHUB_USER="${GITHUB_USER:-$(echo "$REPO_URL" | sed 's|https://github.com/||' | cut -d/ -f1)}"

echo "==> Creating runner user '${RUNNER_USER}'"
id "${RUNNER_USER}" &>/dev/null || useradd -m -G docker "${RUNNER_USER}"

echo "==> Creating runner directory at ${RUNNER_DIR}"
mkdir -p "${RUNNER_DIR}"

# Skip download if the correct version is already extracted.
INSTALLED_VERSION=""
if [ -f "${RUNNER_DIR}/bin/Runner.Listener" ]; then
  INSTALLED_VERSION=$("${RUNNER_DIR}/bin/Runner.Listener" --version 2>/dev/null | tr -d '[:space:]' || true)
fi

if [ "${INSTALLED_VERSION}" = "${RUNNER_VERSION}" ]; then
  echo "==> Runner v${RUNNER_VERSION} already installed — skipping download"
else
  echo "==> Downloading GitHub Actions runner v${RUNNER_VERSION}"
  curl -fsSL -o "${RUNNER_DIR}/runner.tar.gz" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf "${RUNNER_DIR}/runner.tar.gz" -C "${RUNNER_DIR}"
  rm "${RUNNER_DIR}/runner.tar.gz"
fi

echo "==> Setting ownership of ${RUNNER_DIR}"
chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"

echo "==> Stopping and uninstalling any existing runner service"
# Must happen while .runner still exists — svc.sh reads it to determine the service name.
if [ -f "${RUNNER_DIR}/.runner" ]; then
  cd "${RUNNER_DIR}"
  ./svc.sh stop      2>/dev/null || true
  ./svc.sh uninstall 2>/dev/null || true
fi

echo "==> Configuring runner as '${RUNNER_USER}'"
# Wipe local config so config.sh doesn't refuse to run on re-runs.
rm -f "${RUNNER_DIR}/.runner" "${RUNNER_DIR}/.credentials" "${RUNNER_DIR}/.credentials_rsaparams"
# sudo -u avoids the login-shell env reset of 'su -', so config.sh writes
# .runner/.credentials into RUNNER_DIR (where svc.sh expects to find them).
sudo -u "${RUNNER_USER}" bash -c "cd '${RUNNER_DIR}' && ./config.sh \
  --url '${REPO_URL}' \
  --token '${RUNNER_TOKEN}' \
  --name '${RUNNER_NAME}' \
  --labels '${RUNNER_LABEL}' \
  --work '${RUNNER_DIR}/_work' \
  --unattended \
  --replace"

echo "==> Installing runner as a systemd service (runs as '${RUNNER_USER}')"
# svc.sh must run as root from RUNNER_DIR so it finds the .runner file config.sh wrote.
cd "${RUNNER_DIR}"
./svc.sh install "${RUNNER_USER}"
./svc.sh start

echo "==> Runner status"
systemctl status "actions.runner.*.service" --no-pager || true

echo ""
echo "Done. Runner '${RUNNER_NAME}' registered and running as '${RUNNER_USER}'."
echo "Verify at: ${REPO_URL}/settings/actions/runners"
echo ""
echo "Next: authenticate Docker with GHCR as the runner user:"
echo "  su - ${RUNNER_USER} -c \"gh auth token | docker login ghcr.io -u ${GITHUB_USER} --password-stdin\""
echo "  # or with a PAT:"
echo "  su - ${RUNNER_USER} -c \"echo <PAT> | docker login ghcr.io -u ${GITHUB_USER} --password-stdin\""