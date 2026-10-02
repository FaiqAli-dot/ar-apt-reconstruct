# REST API

Base URL (dev): `http://localhost:3001`

Auth: Bearer JWT access token in `Authorization: Bearer <token>` unless noted. Obtain tokens via `POST /api/auth/login`.

Role helpers used below:

- **Any auth** — valid ACTIVE user (any role)
- **Admin+** — `SUPER_ADMIN` or `ADMIN`
- **Super** — `SUPER_ADMIN` only
- **Public** — no auth

Tenant scoping: non–super-admin users only see resources in their `organizationId`. Cross-tenant IDs typically return `404`.

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | Public | Liveness: `{ status, service, timestamp }` |

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | Public | Body `{ email, password }` → access + refresh tokens and user |
| `POST` | `/api/auth/refresh` | Public | Body `{ refreshToken }` → new token pair |
| `POST` | `/api/auth/logout` | Public | Optional `{ refreshToken }`; revokes refresh token; `204` |
| `GET` | `/api/auth/me` | Any auth | Current user profile |

---

## Organizations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/organizations` | Super | Create org `{ name, slug }` |
| `GET` | `/api/organizations` | Any auth | List orgs (all for super; own org otherwise) |
| `GET` | `/api/organizations/:id` | Any auth | Get org by id (scoped) |

---

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/users` | Admin+ | Create user `{ organizationId, name, email, password, role?, status? }`. Admins limited to their org; cannot create `SUPER_ADMIN` |
| `GET` | `/api/users` | Any auth | List users (org-scoped; all for super) |

---

## Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/dashboard/stats` | Any auth | Counts: properties by status, nodes, photos, users, tour views |

---

## Properties

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/properties` | Any auth | Paginated list (`page`, `limit` query) |
| `POST` | `/api/properties` | Any auth | Create property `{ title, slug?, address?, description? }` → `DRAFT` |
| `GET` | `/api/properties/:id` | Any auth | Get property |
| `PATCH` | `/api/properties/:id` | Any auth | Update title/slug/address/description/status/coverPhotoId (`publicId` immutable) |
| `DELETE` | `/api/properties/:id` | Any auth | Cascade-delete rooms, nodes, photos, connections, jobs, analytics |

---

## Rooms

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/properties/:id/rooms` | Any auth | List rooms for property (by `order`) |
| `POST` | `/api/properties/:id/rooms` | Any auth | Create room `{ name, type?, order? }` |
| `PATCH` | `/api/rooms/:id` | Any auth | Update room |
| `DELETE` | `/api/rooms/:id` | Any auth | Delete if no nodes; else `409` |

---

## Nodes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/properties/:id/nodes` | Any auth | List nodes (by `sequence`) |
| `POST` | `/api/properties/:id/nodes` | Any auth | Create node. Optional `connectFromNodeId` + connection fields creates edge. Returns node + `connection` |
| `PATCH` | `/api/nodes/:id` | Any auth | Update room/label/sequence/position/status/captureMetadata |
| `DELETE` | `/api/nodes/:id` | Any auth | Delete node, its photos, related connections and processing jobs |

---

## Photos / upload

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/nodes/:id/photos/upload` | Any auth | Request presigned PUT. Body `{ direction, mimeType, fileSize, originalFilename? }`. Upserts photo for direction; returns `{ photoId, uploadUrl, key, photo }` |
| `POST` | `/api/photos/:id/complete-upload` | Any auth | Mark upload done; set status `QUEUED`; enqueue `ProcessingJob`. Optional `{ width, height }` |
| `POST` | `/api/photos/:id/reprocess` | Any auth | Re-queue processing; increments `retryCount` |
| `DELETE` | `/api/photos/:id` | Any auth | Delete photo and its jobs |

Allowed `mimeType`: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`. Max `fileSize` 50 MiB.

---

## Connections

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/properties/:id/connections` | Any auth | List connections |
| `POST` | `/api/connections` | Any auth | Create edge `{ propertyId, fromNodeId, toNodeId, direction?, label?, bidirectional? }`. Duplicate → `409` |
| `DELETE` | `/api/connections/:id` | Any auth | Delete connection |

---

## Graph / publishing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/properties/:id/graph` | Any auth | Full admin graph: property, rooms, nodes(+photos), connections |
| `GET` | `/api/properties/:id/publish-validation` | Any auth | Publish readiness report (rooms/nodes/photos/processed/graph checks) |
| `POST` | `/api/properties/:id/publish` | Admin+ | Publish if validation ready; else `400` with report |
| `POST` | `/api/properties/:id/archive` | Admin+ | Set status `ARCHIVED` |
| `GET` | `/api/properties/:id/qr` | Any auth | Tour URL + QR image URL for `PUBLIC_VIEWER_URL/tour/{publicId}` |

---

## Public tours

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tours/:publicId` | Public | Published tour payload (nodes, photos with public URLs, connections). Unpublished → `404`; archived → `410` |
| `GET` | `/api/tours/:publicId/nodes/:nodeId` | Public | Single node detail + outgoing connections + photo URLs |
| `POST` | `/api/tours/:publicId/analytics` | Public | Track event `{ type, nodeId?, sessionId?, visitorId?, durationMs?, metadata? }`; `204` |

Analytics `type`: `TOUR_VIEW`, `NODE_VIEW`, `SESSION_END`, `QR_SCAN`, `MAP_OPEN`, `MAP_JUMP`.

---

## Property analytics (admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/properties/:id/analytics` | Admin+ | Aggregated analytics for a property |

---

## Error shape

Typical JSON errors:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "…"
}
```

Zod validation failures return `400` with a formatted validation payload. Rate limiting is global (`RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`).
