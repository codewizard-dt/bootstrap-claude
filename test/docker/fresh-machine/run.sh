#!/usr/bin/env bash
set -euo pipefail

# Build/run helper for the fresh-machine Docker harness. See README.md.
# Modes: shell (default, interactive) | setup | update (setup then update) | stale (seed an older release, then update) | idempotency (update twice, diff) | live-hook (verify packageInstall.consent=true against a real, authenticated claude -p session; requires CLAUDE_CODE_OAUTH_TOKEN). --rebuild forces a fresh docker build.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR" && git rev-parse --show-toplevel)"

IMAGE_NAME="bootstrap-claude-fresh-machine"
MOUNT_PATH="/opt/bootstrap-claude"
SCRATCH_DIR="/workspace/scratch-project"
OLD_CHECKOUT_DIR="/workspace/old-bootstrap-claude"
OLD_REF="c33808d" # last commit before the 3.0.0 major bump; see TASK-071

MODE="shell"
REBUILD=false

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
    shell|setup|update|stale|idempotency|live-hook) MODE="$arg" ;;
    *)
      echo "Usage: $0 [shell|setup|update|stale|idempotency|live-hook] [--rebuild]" >&2
      exit 1
      ;;
  esac
done

if [ "$MODE" = "live-hook" ] && [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "Run 'claude setup-token' on the host and export CLAUDE_CODE_OAUTH_TOKEN before using 'run.sh live-hook'." >&2
  exit 1
fi

if [ "$REBUILD" = true ] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  echo "Building image $IMAGE_NAME..."
  docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"
fi

# Repo is bind-mounted read-only at $MOUNT_PATH (never copied, never run against directly — it's the tool under test); each mode targets a throwaway scratch dir instead.
case "$MODE" in
  shell)
    exec docker run --rm -it \
      -v "$REPO_ROOT:$MOUNT_PATH:ro" \
      "$IMAGE_NAME" bash
    ;;
  setup)
    exec docker run --rm \
      -v "$REPO_ROOT:$MOUNT_PATH:ro" \
      "$IMAGE_NAME" bash -c "mkdir -p '$SCRATCH_DIR' && '$MOUNT_PATH/lib/scripts/setup-project.sh' '$SCRATCH_DIR'"
    ;;
  update)
    exec docker run --rm \
      -v "$REPO_ROOT:$MOUNT_PATH:ro" \
      "$IMAGE_NAME" bash -c "mkdir -p '$SCRATCH_DIR' && '$MOUNT_PATH/lib/scripts/setup-project.sh' '$SCRATCH_DIR' && '$MOUNT_PATH/lib/scripts/update-project.sh' '$SCRATCH_DIR'"
    ;;
  stale)
    # Seeds $OLD_REF via git archive (no checkout needed) and runs its setup-project.sh, tolerating the expected Serena-bootstrap failure (not && chained) — then always runs current update-project.sh; its exit code is this mode's exit code.
    exec docker run --rm \
      -v "$REPO_ROOT:$MOUNT_PATH:ro" \
      "$IMAGE_NAME" bash -c "mkdir -p '$SCRATCH_DIR' '$OLD_CHECKOUT_DIR' && git --git-dir='$MOUNT_PATH/.git' archive '$OLD_REF' | tar -x -C '$OLD_CHECKOUT_DIR' && ('$OLD_CHECKOUT_DIR/lib/scripts/setup-project.sh' '$SCRATCH_DIR' || echo 'stale: old-release ($OLD_REF) setup-project.sh exited non-zero — expected (Serena bootstrap is its last step and fails non-interactively per TASK-060); continuing to update-project.sh' >&2); '$MOUNT_PATH/lib/scripts/update-project.sh' '$SCRATCH_DIR'"
    ;;
  idempotency)
    # setup then update x2, snapshotting after each update (tolerating the same expected Serena-bootstrap failure as `stale` on all three calls) — asserts snapshot2==snapshot3 (a repeat update is a true no-op). Snapshots are sorted sha256sum listings of the scratch dir + $HOME/.claude/, excluding $HOME/.claude/projects/**/*.jsonl (a fresh session-transcript file every `claude --print` call — expected volatility, not real drift). Prints a diff and exits non-zero on mismatch.
    exec docker run --rm \
      -v "$REPO_ROOT:$MOUNT_PATH:ro" \
      "$IMAGE_NAME" bash -c "set -euo pipefail; mkdir -p '$SCRATCH_DIR'; SNAP_DIR=\"\$(mktemp -d)\"; snapshot() { { find '$SCRATCH_DIR' -type f -exec sha256sum {} + ; find \"\$HOME/.claude\" -type f -not -path '*/projects/*.jsonl' -exec sha256sum {} + ; } | sort; }; ('$MOUNT_PATH/lib/scripts/setup-project.sh' '$SCRATCH_DIR' || echo 'idempotency: setup-project.sh exited non-zero — expected (Serena bootstrap is its last step and fails non-interactively per TASK-060); continuing to snapshot-1 and update-project.sh' >&2); snapshot > \"\$SNAP_DIR/snapshot-1.txt\"; ('$MOUNT_PATH/lib/scripts/update-project.sh' '$SCRATCH_DIR' || echo 'idempotency: first update-project.sh exited non-zero — expected (Serena bootstrap is its last step and fails non-interactively per TASK-060); continuing to snapshot-2 and second update-project.sh' >&2); snapshot > \"\$SNAP_DIR/snapshot-2.txt\"; ('$MOUNT_PATH/lib/scripts/update-project.sh' '$SCRATCH_DIR' || echo 'idempotency: second update-project.sh exited non-zero — expected (Serena bootstrap is its last step and fails non-interactively per TASK-060); continuing to snapshot-3 and comparison' >&2); snapshot > \"\$SNAP_DIR/snapshot-3.txt\"; if ! diff -u \"\$SNAP_DIR/snapshot-2.txt\" \"\$SNAP_DIR/snapshot-3.txt\"; then echo 'idempotency: FAIL — a second update-project.sh run produced state that differs from the first (diff above: post-update-1 vs post-update-2)' >&2; exit 1; fi; echo 'idempotency: PASS — a second update-project.sh run against the same scratch dir is a true no-op (identical scratch-project + \$HOME/.claude state)'"
    ;;
  live-hook)
    exec docker run --rm \
      -e CLAUDE_CODE_OAUTH_TOKEN \
      -v "$REPO_ROOT:$MOUNT_PATH:ro" \
      "$IMAGE_NAME" bash -c "mkdir -p '$SCRATCH_DIR' && '$MOUNT_PATH/lib/scripts/install-global.sh' --skip-mcps && node \"\$HOME/.claude/bootstrap-prefs.js\" --set packageInstall.consent --value true --project '$SCRATCH_DIR' && cd '$SCRATCH_DIR' && timeout 120 claude -p 'npm install left-pad' --output-format stream-json --verbose < /dev/null > /tmp/live-hook-output.json 2>&1; CLAUDE_EXIT=\$?; if [ \"\$CLAUDE_EXIT\" -eq 124 ]; then echo 'live-hook: FAIL — claude -p timed out after 120s (permission system may not have honored packageInstall.consent=true; likely fell back to an interactive prompt the headless session could never answer)' >&2; exit 1; elif [ \"\$CLAUDE_EXIT\" -ne 0 ]; then cat /tmp/live-hook-output.json; exit 1; fi; if [ -d '$SCRATCH_DIR/node_modules/left-pad' ]; then echo 'live-hook: PASS — npm install proceeded via a real claude -p session with packageInstall.consent=true and zero permission prompts'; exit 0; else echo 'live-hook: FAIL — claude -p exited 0 but node_modules/left-pad was never created' >&2; exit 1; fi"
    ;;
esac
