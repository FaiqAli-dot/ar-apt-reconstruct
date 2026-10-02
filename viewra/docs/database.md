# Database

Viewra uses **MongoDB** via Mongoose. Default connection: `mongodb://localhost:27017/viewra` (`DATABASE_URL` / `DATABASE_NAME`).

Collection names below are Mongoose defaults (pluralized model names). Documents expose `_id`; the API serializes `_id` → `id` as a string.

## Relationships

```text
Organization 1──* User
Organization 1──* Property
Property 1──* Room
Property 1──* Node
Property 1──* Connection
Property 1──* Photo
Property 1──* ProcessingJob
Property 1──* AnalyticsEvent
Room 1──* Node
Node 1──* Photo          (unique per direction)
Node 1──* Connection     (as fromNodeId / toNodeId)
Photo 1──* ProcessingJob
User 1──* RefreshToken
```

---

## `organizations`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | string | required, max 200 |
| `slug` | string | required, **unique**, max 100 |
| `settings.defaultPhotoDirections` | string[] | default `["LEFT","CENTER","RIGHT"]` |
| `settings.branding.primaryColor` | string? | |
| `settings.branding.logoUrl` | string? | |
| `createdAt` / `updatedAt` | Date | timestamps |

**Indexes:** unique on `slug`.

---

## `users`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `organizationId` | ObjectId → Organization | required, indexed |
| `name` | string | required, max 200 |
| `email` | string | required, **unique**, lowercase |
| `passwordHash` | string | bcrypt; never returned by API |
| `role` | enum | `SUPER_ADMIN`, `ADMIN`, `CAPTURE_OPERATOR` |
| `status` | enum | `ACTIVE`, `INVITED`, `DISABLED` (default `ACTIVE`) |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `organizationId`; unique on `email`.

---

## `properties`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `organizationId` | ObjectId → Organization | required, indexed |
| `title` | string | required, max 300 |
| `slug` | string | required, max 200; unique per org |
| `publicId` | string | required, **unique**, immutable public tour id |
| `address` | embedded | `line1`, `line2`, `city`, `region`, `postalCode`, `country` |
| `description` | string? | max 5000 |
| `status` | enum | `DRAFT`, `PROCESSING`, `READY`, `PUBLISHED`, `ARCHIVED` (default `DRAFT`, indexed) |
| `coverPhotoId` | ObjectId → Photo \| null | |
| `publishedAt` | Date \| null | |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `organizationId`; `publicId` unique; `status`; compound **unique** `{ organizationId, slug }`.

---

## `rooms`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `propertyId` | ObjectId → Property | required, indexed |
| `name` | string | required, max 200 |
| `type` | enum | `LIVING_ROOM`, `KITCHEN`, `BEDROOM`, `BATHROOM`, `HALLWAY`, `ENTRANCE`, `BALCONY`, `OFFICE`, `DINING`, `OTHER` |
| `order` | number | default 0 |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `propertyId`.

---

## `nodes`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `propertyId` | ObjectId → Property | required, indexed |
| `roomId` | ObjectId → Room | required, indexed |
| `label` | string | required, max 200 |
| `sequence` | number | default 0 |
| `approximatePosition` | `{ x, y }` | numbers, default `{0,0}` |
| `captureMetadata.deviceModel` | string? | |
| `captureMetadata.capturedAt` | Date? | |
| `captureMetadata.operatorId` | ObjectId → User? | |
| `captureMetadata.notes` | string? | |
| `status` | enum | `DRAFT`, `CAPTURING`, `COMPLETE`, `PROCESSING`, `READY`, `FAILED` |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `propertyId`; `roomId`.

---

## `photos`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `nodeId` | ObjectId → Node | required, indexed |
| `propertyId` | ObjectId → Property | required, indexed |
| `direction` | enum | `LEFT`, `CENTER`, `RIGHT` |
| `originalKey` | string \| null | S3 key |
| `processedKey` | string \| null | WebP after worker |
| `thumbnailKey` | string \| null | |
| `width` / `height` | number \| null | |
| `mimeType` | string \| null | |
| `fileSize` | number \| null | |
| `processingStatus` | enum | `PENDING_UPLOAD`, `UPLOADED`, `QUEUED`, `PROCESSING`, `READY`, `FAILED` (indexed) |
| `processingError` | string \| null | |
| `metadata.exifOrientation` | number? | |
| `metadata.originalFilename` | string? | |
| `metadata.capturedAt` | Date? | |
| `metadata.warnings` | string[]? | |
| `retryCount` | number | default 0; incremented on reprocess |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `nodeId`; `propertyId`; `processingStatus`; compound **unique** `{ nodeId, direction }`.

---

## `connections`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `propertyId` | ObjectId → Property | required, indexed |
| `fromNodeId` | ObjectId → Node | required |
| `toNodeId` | ObjectId → Node | required |
| `direction` | enum | `FORWARD`, `BACK`, `LEFT`, `RIGHT`, `UP`, `DOWN`, `CUSTOM` (default `CUSTOM`) |
| `label` | string? | max 200 |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `propertyId`; compound **unique** `{ propertyId, fromNodeId, toNodeId }`.

---

## `processingjobs`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `photoId` | ObjectId → Photo | required, indexed |
| `propertyId` | ObjectId → Property | required, indexed |
| `status` | enum | `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED` (default `QUEUED`, indexed) |
| `attempts` | number | default 0 |
| `lastError` | string \| null | |
| `lockedAt` | Date \| null | set when worker claims job |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `photoId`; `propertyId`; `status`.

Worker claims with atomic `findOneAndUpdate` on `QUEUED`, then retries `FAILED` under `WORKER_MAX_RETRIES` with exponential backoff.

---

## `analyticsevents`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `propertyId` | ObjectId → Property | required, indexed |
| `organizationId` | ObjectId → Organization | required, indexed |
| `type` | enum | `TOUR_VIEW`, `NODE_VIEW`, `SESSION_END`, `QR_SCAN`, `MAP_OPEN`, `MAP_JUMP` |
| `nodeId` | ObjectId → Node? | |
| `sessionId` | string? | indexed |
| `visitorId` | string? | indexed |
| `durationMs` | number? | |
| `metadata` | Mixed? | |
| `createdAt` | Date | `updatedAt` disabled |

**Indexes:** `propertyId`; `organizationId`; `sessionId`; `visitorId`.

---

## `refreshtokens`

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `userId` | ObjectId → User | required, indexed |
| `tokenHash` | string | required, **unique** (hash of refresh token) |
| `expiresAt` | Date | required; TTL index |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `userId`; unique `tokenHash`; TTL on `expiresAt` (`expireAfterSeconds: 0`).

---

## Enum quick reference

Defined in `@viewra/types` and mirrored in Mongoose schemas / CaptureCore.

| Concept | Values |
|---------|--------|
| UserRole | `SUPER_ADMIN`, `ADMIN`, `CAPTURE_OPERATOR` |
| UserStatus | `ACTIVE`, `INVITED`, `DISABLED` |
| PropertyStatus | `DRAFT`, `PROCESSING`, `READY`, `PUBLISHED`, `ARCHIVED` |
| NodeStatus | `DRAFT`, `CAPTURING`, `COMPLETE`, `PROCESSING`, `READY`, `FAILED` |
| PhotoDirection | `LEFT`, `CENTER`, `RIGHT` |
| ProcessingStatus | `PENDING_UPLOAD`, `UPLOADED`, `QUEUED`, `PROCESSING`, `READY`, `FAILED` |
| ConnectionDirection | `FORWARD`, `BACK`, `LEFT`, `RIGHT`, `UP`, `DOWN`, `CUSTOM` |
