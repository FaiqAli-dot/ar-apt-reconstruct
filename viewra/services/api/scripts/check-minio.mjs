#!/usr/bin/env node
/**
 * Optional helper: ensure MinIO is reachable for local development.
 * Tests download and start MinIO automatically under tests/.cache.
 */
console.log(
  "Start local MinIO via: docker compose -f infrastructure/docker-compose.yml up -d",
);
console.log("Or rely on integration tests which bootstrap MinIO automatically.");
