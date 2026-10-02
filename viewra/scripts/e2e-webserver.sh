#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  node services/api/scripts/start-demo-infra.mjs &
  for _ in $(seq 1 45); do
    if [ -f .env ]; then break; fi
    sleep 1
  done
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

pnpm --filter @viewra/types build >/dev/null
pnpm --filter @viewra/shared build >/dev/null
pnpm seed

pnpm --filter @viewra/api dev &
API_PID=$!
pnpm --filter @viewra/viewer dev -- --host 127.0.0.1 --port 5174 &
VIEWER_PID=$!

cleanup() {
  kill "$API_PID" "$VIEWER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3001/api/health >/dev/null && curl -sf http://127.0.0.1:5174/ >/dev/null; then
    break
  fi
  sleep 1
done

wait "$API_PID" "$VIEWER_PID"
