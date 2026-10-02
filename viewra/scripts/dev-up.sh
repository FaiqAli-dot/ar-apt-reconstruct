#!/usr/bin/env bash
# Start local Viewra infra and print commands to run the rest of the stack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Viewra dev helper"
echo "    Root: $ROOT"
echo

if [[ ! -f .env ]]; then
  echo "==> No .env found — copying .env.example"
  cp .env.example .env
  echo "    Edit .env if you need non-default secrets."
  echo
fi

echo "==> Starting MongoDB + MinIO (docker compose)"
docker compose -f infrastructure/docker-compose.yml up -d

echo
echo "==> Infra up. Next commands (run in separate terminals from $ROOT):"
echo
echo "  pnpm install          # once"
echo "  pnpm seed             # demo org, users, sample property"
echo "  pnpm dev:api          # http://localhost:3001"
echo "  pnpm dev:worker       # image processing"
echo "  pnpm dev:admin        # http://localhost:5173"
echo "  pnpm dev:viewer       # http://localhost:5174"
echo
echo "  # or everything in parallel:"
echo "  pnpm dev"
echo
echo "MinIO console: http://localhost:9001  (minioadmin / minioadmin)"
echo "API health:    curl -s http://localhost:3001/api/health"
echo
echo "iOS capture (macOS): cd apps/capture && xcodegen generate && open ViewraCapture.xcodeproj"
echo "Docs: docs/architecture.md  docs/api.md  docs/deployment.md"
