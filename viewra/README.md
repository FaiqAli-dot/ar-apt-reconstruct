# Viewra

Photographic spatial walkthrough platform. Operators capture LEFT / CENTER / RIGHT photos at discrete nodes inside a property; visitors navigate published tours by following a graph of photographic viewpoints — not a 3D mesh.

## Monorepo structure

```
viewra/
├── apps/
│   ├── admin/          # React (Vite) org admin — properties, graph, publish, QR
│   ├── viewer/         # React (Vite) public tour viewer (/tour/:publicId)
│   └── capture/        # iOS SwiftUI capture app (XcodeGen + CaptureCore)
├── services/
│   ├── api/            # Fastify REST API (auth, CRUD, uploads, tours)
│   └── worker/         # Image processing worker (Sharp → WebP + thumbnails)
├── packages/
│   ├── types/          # Shared Zod schemas & TypeScript types
│   ├── shared/         # Graph validation, slugs, storage keys
│   ├── config/         # Shared tsconfig bases
│   ├── CaptureCore/    # Swift package — graph, validation, offline upload queue
│   └── ui/             # Stub; admin/viewer keep local components for now
├── infrastructure/     # docker-compose (dev + prod) and Dockerfiles
├── scripts/            # Dev helpers
└── docs/               # Architecture, database, API, capture, deployment
```

## Quick start

### Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io/) 9.15+
- Docker (for MongoDB + MinIO)

### 1. Start local infrastructure

```bash
cd viewra
pnpm docker:up
# or: docker compose -f infrastructure/docker-compose.yml up -d
```

This starts:

| Service | Port | Notes |
|---------|------|--------|
| MongoDB 7 | `27017` | Database `viewra` |
| MinIO | `9000` (API), `9001` (console) | Credentials `minioadmin` / `minioadmin` |
| minio-init | — | Creates bucket `viewra` |

### 2. Install dependencies

```bash
pnpm install
```

### 3. Environment

```bash
cp .env.example .env
```

Defaults match local Docker Mongo + MinIO. See [docs/deployment.md](./docs/deployment.md) for production variables.

For Vite apps you can also copy:

```bash
cp apps/admin/.env.example apps/admin/.env
cp apps/viewer/.env.example apps/viewer/.env
```

### 4. Seed demo data

```bash
pnpm seed
```

Creates a demo organization, admin, capture operator, and a sample property graph with placeholder photos.

| Role | Email | Password (from `.env.example`) |
|------|-------|--------------------------------|
| Super admin | `admin@viewra.local` | `ViewraAdmin123!` |
| Capture operator | `operator@viewra.local` | `ViewraOperator123!` |

### 5. Run services

In separate terminals (or use `pnpm dev` for api + worker + admin + viewer in parallel):

```bash
pnpm dev:api       # http://localhost:3001
pnpm dev:worker    # polls ProcessingJob queue
pnpm dev:admin     # http://localhost:5173
pnpm dev:viewer    # http://localhost:5174
```

Or use the helper script for tips + commands:

```bash
./scripts/dev-up.sh
```

### 6. iOS capture (optional)

Requires macOS + Xcode 15+:

```bash
cd apps/capture
xcodegen generate
open ViewraCapture.xcodeproj
```

See [apps/capture/README.md](./apps/capture/README.md) and [docs/capture-workflow.md](./docs/capture-workflow.md).

## Tests

```bash
pnpm test              # all packages / services / apps with tests
pnpm test:api          # API integration tests
pnpm test:worker       # Worker integration tests
pnpm --filter @viewra/viewer test
cd packages/CaptureCore && swift test
```

Typecheck:

```bash
pnpm typecheck
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/architecture.md](./docs/architecture.md) | System design, graph model, upload pipeline |
| [docs/database.md](./docs/database.md) | MongoDB collections, fields, indexes |
| [docs/api.md](./docs/api.md) | REST endpoints |
| [docs/capture-workflow.md](./docs/capture-workflow.md) | iOS capture + CaptureCore |
| [docs/deployment.md](./docs/deployment.md) | Production deploy, env vars, Docker |

## License

Private — all rights reserved.
