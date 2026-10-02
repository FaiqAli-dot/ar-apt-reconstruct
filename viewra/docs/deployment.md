# Deployment

## Local development (infra only)

```bash
cd viewra
docker compose -f infrastructure/docker-compose.yml up -d
# Mongo :27017, MinIO :9000 / console :9001, bucket viewra
```

Run API, worker, admin, and viewer on the host with pnpm (see [README.md](../README.md)).

Helper:

```bash
./scripts/dev-up.sh
```

## Production compose

`infrastructure/docker-compose.prod.yml` builds and runs:

| Service | Image / build | Port (host) |
|---------|---------------|-------------|
| `mongo` | `mongo:7` | `27017` |
| `minio` | `minio/minio` | `9000`, `9001` |
| `minio-init` | `minio/mc` | creates bucket |
| `api` | `Dockerfile.api` | `3001` |
| `worker` | `Dockerfile.worker` | — |
| `admin` | `Dockerfile.admin` (nginx) | `8080` → 80 |
| `viewer` | `Dockerfile.viewer` (nginx) | `8081` → 80 |

```bash
cp .env.example .env   # set production secrets
docker compose -f infrastructure/docker-compose.prod.yml --env-file .env up -d --build
```

Seed once API is healthy (exec into api container or run from a machine with `DATABASE_URL` pointing at prod Mongo):

```bash
pnpm seed
# or: docker compose -f infrastructure/docker-compose.prod.yml exec api node --import tsx … 
# Prefer running seed via: docker compose exec api sh -c 'cd /app && pnpm --filter @viewra/api seed'
```

## Environment variables

Copy from [`.env.example`](../.env.example). **Do not commit real secrets.**

| Variable | Used by | Purpose |
|----------|---------|---------|
| `NODE_ENV` | api, worker | `production` in deploy |
| `DATABASE_URL` | api, worker | Mongo connection string |
| `DATABASE_NAME` | api, worker | DB name (default `viewra`) |
| `JWT_SECRET` | api | Access-token signing (≥16 chars; use long random in prod) |
| `JWT_ACCESS_EXPIRES_IN` | api | e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | api | e.g. `7d` |
| `BCRYPT_ROUNDS` | api | Password hash cost |
| `S3_ENDPOINT` | api, worker | MinIO/R2/S3 endpoint URL |
| `S3_REGION` | api, worker | e.g. `auto` (R2) or `us-east-1` |
| `S3_BUCKET` | api, worker | Bucket name |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api, worker | Credentials |
| `S3_FORCE_PATH_STYLE` | api, worker | `true` for MinIO; often `false` for AWS |
| `S3_PUBLIC_URL` | api, worker | Public base for object URLs (CDN or `https://…/bucket`) |
| `API_HOST` / `API_PORT` | api | Bind address |
| `API_URL` | docs / clients | Canonical API URL |
| `CORS_ORIGINS` | api | Comma-separated admin/viewer origins |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | api | Global rate limit |
| `LOG_LEVEL` | api, worker | e.g. `info` |
| `PUBLIC_VIEWER_URL` | api | Used for QR / publish links |
| `WORKER_POLL_INTERVAL_MS` | worker | Idle poll delay |
| `WORKER_CONCURRENCY` | worker | Parallel jobs |
| `WORKER_MAX_RETRIES` | worker | Max attempts per job |
| `VITE_API_URL` | admin, viewer (build) | Browser API base |
| `VITE_PUBLIC_VIEWER_URL` | admin (build) | Viewer base for links |
| `VITE_S3_PUBLIC_URL` | admin (build) | Optional direct asset base |
| `SEED_*` | api seed | Demo accounts (change or disable in prod) |

### Cloudflare R2 / AWS S3

Point `S3_*` at your bucket:

- **R2:** `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`, `S3_FORCE_PATH_STYLE=true` (or as required by SDK), `S3_PUBLIC_URL` = public bucket / custom domain.
- **AWS S3:** regional endpoint or omit custom endpoint if using default AWS; set `S3_FORCE_PATH_STYLE=false`; `S3_PUBLIC_URL` = CloudFront or bucket website URL.

Ensure CORS on the bucket allows `PUT` from capture devices and browser origins if browsers upload directly.

## Dockerfiles

| File | Role |
|------|------|
| `infrastructure/Dockerfile.api` | pnpm install → build packages + api → `node dist/index.js` |
| `infrastructure/Dockerfile.worker` | Same for worker (includes `sharp` native deps) |
| `infrastructure/Dockerfile.admin` | Multi-stage Vite build → nginx static |
| `infrastructure/Dockerfile.viewer` | Multi-stage Vite build → nginx static |

Frontend images bake `VITE_*` at **build** time — rebuild when API/viewer public URLs change.

## Production notes

1. **Secrets** — override `JWT_SECRET`, MinIO/R2 keys, and seed passwords via secrets manager or compose `env_file`; never bake into images.
2. **TLS** — terminate TLS at a reverse proxy (Caddy, nginx, cloud LB) in front of api / admin / viewer. Set `CORS_ORIGINS` and `PUBLIC_VIEWER_URL` / `VITE_*` to HTTPS URLs.
3. **Mongo** — use managed MongoDB or persistent volumes; enable auth (`mongodb://user:pass@host/viewra`). Back up regularly.
4. **Object storage** — prefer R2/S3 over shipping MinIO in production unless you operate it yourself. Lifecycle rules for unused originals optional.
5. **Worker scale** — run one or more worker replicas; job claim is atomic via Mongo `findOneAndUpdate`.
6. **Health** — probe `GET /api/health` for the API. Worker has no HTTP port; rely on process supervisor / compose restart.
7. **Publish** — only `PUBLISHED` properties are publicly readable; archive returns `410` on tour routes.
8. **iOS** — point `APIClient` base URL at the production API; App Transport Security must allow that host.

## Smoke checklist

1. `GET /api/health` → `ok`
2. Login with seeded (or created) admin
3. Create property → room → node → upload photo → worker marks READY
4. Publish after validation passes
5. Open `{PUBLIC_VIEWER_URL}/tour/{publicId}`
