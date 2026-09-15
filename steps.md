# Photo Orchestrator — Action Steps & Roadmap

This file tracks all operational steps taken and the detailed plan for upcoming phases.

---

## 📜 Session History

### 📅 Session: 2026-08-14

#### Step 1: Rebuilt Database Schema after Supabase Restart
* **Goal**: Recreate the database structure on the restarted/clean Supabase instance.
* **Actions**:
  1. Created a temporary script to test DB connection and execute [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql).
  2. Verified connection using `DATABASE_URL` in [`.env.local`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/.env.local).
  3. Recreated `users`, `accounts`, and `photos` tables along with the `pgvector` index and cosine similarity index.
  4. Cleaned up the temporary setup script from the workspace.
* **Status**: ✅ Completed

#### Step 2: Fixed Default Next.js Landing Page Routing
* **Goal**: Solve the issue where visiting `http://localhost:3000` shows the default Next.js template landing page instead of the application.
* **Actions**:
  1. Replaced the placeholder content in [`app/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/page.tsx) with a Next.js server-side redirect to `/dashboard`.
* **Status**: ✅ Completed

#### Step 3: Created Documentation for Context and Steps Tracking
* **Goal**: Create files to track context and incremental steps inside the workspace.
* **Actions**:
  1. Created [`context.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/context.md) detailing the current stack, file structures, environment state, and outstanding tasks.
  2. Created [`steps.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/steps.md) to record development actions sequentially.
* **Status**: ✅ Completed

### 📅 Session: 2026-09-14

#### Step 4: Fixed Critical OAuth Scope Bug
* **Goal**: Fix `403 Forbidden: Insufficient Permission` errors on file upload/delete.
* **Actions**:
  1. Changed OAuth scope in [`lib/google-oauth.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/google-oauth.ts) from `drive.readonly` → `drive.file`.
* **Status**: ✅ Completed

#### Step 5: Live Database Reconnect & HNSW Vector Index Migration
* **Goal**: Restore database connection and upgrade vector indexing.
* **Actions**:
  1. Verified Supabase PostgreSQL connection after project unpause.
  2. Confirmed 4 existing tables and connected accounts (`rucpah@gmail.com`, `rucpah1@gmail.com`).
  3. Re-authenticated both accounts with fresh tokens under `drive.file` scope.
  4. Executed live SQL migration replacing legacy `ivfflat` index with production `hnsw` index on `photos.embedding`.
  5. Updated [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql) with HNSW index definition.
* **Status**: ✅ Completed

#### Step 6: Interactive CLIP Model Notebook
* **Goal**: Create an exploratory `.ipynb` notebook explaining multimodal embeddings, image/text vector generation, cosine similarity, and pgvector HNSW database queries.
* **Actions**:
  1. Created [`notebooks/clip_semantic_search_walkthrough.ipynb`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/notebooks/clip_semantic_search_walkthrough.ipynb).
* **Status**: ✅ Completed

#### Step 7: Dedicated GPU Virtual Environment & CUDA 12.4 Setup
* **Goal**: Create a dedicated virtual environment with PyTorch CUDA acceleration for the RTX 3050 GPU.
* **Actions**:
  1. Created `.venv` in the project root and added `.venv/` to `.gitignore`.
  2. Installed PyTorch `2.6.0+cu124` and TorchVision `0.21.0+cu124` with NVIDIA CUDA 12.4 support.
  3. Installed `transformers`, `pillow`, `matplotlib`, `numpy`, `psycopg2-binary`, `ipykernel`, and `python-dotenv`.
  4. Registered Jupyter kernel `photo-orchestrator-venv` ("Python (.venv - RTX 3050 GPU)").
  5. Created [`requirements.txt`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/requirements.txt) for reproducible installs.
  6. Verified device detection: `CUDA Available: True`, `NVIDIA GeForce RTX 3050 Laptop GPU`.
* **Status**: ✅ Completed

---

## ✅ Completed Phases Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project Scaffold (Next.js 16 + TS + Tailwind) | ✅ Done |
| 2 | Database Schema & Client (4 tables + pgvector) | ✅ Done |
| 3 | OAuth Connect + Callback (Google Drive) | ✅ Done |
| 4 | Storage Router & Upload (multi-account replication) | ✅ Done |
| 5 | Background Indexer Worker (EXIF + thumbnails) | ✅ Done |
| 6 | Search & Browse API (filters + pagination) | ✅ Done |
| 7 | Frontend Browse UI (grid + lightbox + filters) | ✅ Done |
| — | Admin Panel (system stats + actions) | ✅ Done |

---

## 🔧 Pre-Phase: Stabilization & Bug Fixes

Before starting new features, these items need to be resolved:

### S1. Re-authenticate Google Accounts — ✅ COMPLETED
- Both accounts (`rucpah@gmail.com` and `rucpah1@gmail.com`) re-authenticated with `drive.file` scope
- Fresh tokens and expiration dates verified in database

### S2. Replace IVFFlat Index with HNSW — ✅ COMPLETED
- Dropped legacy `photos_embedding_cosine_idx` (ivfflat)
- Created `photos_embedding_hnsw_idx` (`USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`)
- Updated [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql)

### S3. Gitignore the Client Secret File — ✅ COMPLETED
- Added `client_secret_*.json` to `.gitignore`
- Verified file is untracked by Git

### S4. End-to-End Smoke Test
1. Start dev server: `npm run dev`
2. Navigate to `/dashboard`, reconnect both accounts
3. Upload a test photo (JPEG with EXIF data)
4. Verify in the DB: `photos` row created, `photo_replicas` rows for each account
5. Verify indexer ran: `taken_at`, `camera_model`, `thumbnail_url` populated
6. Navigate to `/browse` and confirm the photo appears with metadata

---

## 🚀 Phase 8 — Semantic Image Search (CLIP Embeddings)

**Goal**: Enable natural-language search across photos ("sunset on a beach", "group photo at dinner") using CLIP vision-language embeddings stored in pgvector.

### Architecture Decision: Local Inference vs Cloud API

| Approach | Library / Service | Dimension | Cost | Latency |
|----------|------------------|-----------|------|---------|
| **Local (recommended)** | `@huggingface/transformers` + `Xenova/clip-vit-base-patch32` | **512** (matches schema) | **$0** | ~150ms/photo on CPU |
| Cloud alternative | Google Vertex AI `multimodalembedding@001` | 512 (configurable) | $0.10 / 1K images | ~200ms/photo |

**Recommendation**: Use **local inference** with `@huggingface/transformers`. It's free, outputs 512-dim vectors (zero schema migration), and runs in the existing worker process. The quantized ONNX model is ~80MB.

### Step 8.1 — Install Dependencies
```bash
npm install @huggingface/transformers onnxruntime-node
```

### Step 8.2 — Create `lib/embeddings.ts`
A module that loads the CLIP model once (singleton) and exposes two functions:

```
generateImageEmbedding(imageBuffer: Buffer) → number[] (512-dim)
generateTextEmbedding(query: string) → number[] (512-dim)
```

Key design decisions:
- Use `Xenova/clip-vit-base-patch32` (quantized 8-bit ONNX, ~80MB)
- Model loads lazily on first call, stays in memory for the worker's lifetime
- Feed the **300×300 thumbnail buffer** (already generated by `sharp` in the indexer), NOT the raw multi-MB photo — CLIP resizes to 224×224 internally anyway
- L2-normalize output vectors to unit length for cosine distance

### Step 8.3 — Integrate into `lib/indexer.ts`
Modify [`indexPhoto()`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/indexer.ts) to generate embeddings after thumbnail creation:

```
Current pipeline:
  Download → EXIF → Thumbnail → Save to DB

New pipeline:
  Download → EXIF → Thumbnail → Embedding (from thumbnail buffer) → Save to DB
```

The embedding is generated from the `thumbnailBuffer` (300×300 JPEG, ~15KB) rather than the raw photo buffer (5-25MB). This:
- Drops per-image memory from ~50MB to <100KB
- Is mathematically equivalent (CLIP internally resizes to 224×224)
- Adds only ~150ms to the indexing job

Update the SQL to include the embedding:
```sql
UPDATE photos
SET taken_at = $1, gps_lat = $2, gps_lng = $3,
    camera_model = $4, thumbnail_url = $5, embedding = $6,
    indexed_at = NOW()
WHERE id = $7
```

### Step 8.4 — Create Semantic Search API
New endpoint: `GET /api/photos/search`

Query params:
- `q` (string) — natural language query, e.g. "cat sleeping on couch"
- `limit` (number, default 20)
- `threshold` (number, default 0.25) — max cosine distance (lower = stricter)

Flow:
1. Convert query text → 512-dim vector via `generateTextEmbedding(q)`
2. Query pgvector:
   ```sql
   SELECT id, filename, thumbnail_url, taken_at, camera_model,
          1 - (embedding <=> $1::vector) AS similarity
   FROM photos
   WHERE user_id = $2 AND embedding IS NOT NULL
     AND (embedding <=> $1::vector) < $3
   ORDER BY embedding <=> $1::vector ASC
   LIMIT $4
   ```
3. Return `{ results: [...], query: q }`

### Step 8.5 — Create "Find Similar" API
New endpoint: `GET /api/photos/similar`

Query params:
- `photoId` (UUID) — find photos visually similar to this one
- `limit` (number, default 20)

Flow:
1. Load the embedding from the given photo row
2. Query pgvector for nearest neighbors (excluding the source photo)

### Step 8.6 — Frontend Search UI
Update [`app/browse/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/browse/page.tsx):
- Add a **search bar** at the top: "Search your photos..." with a search icon
- When the user types and submits, call `/api/photos/search?q=...`
- Display results in the existing photo grid with similarity scores as badges
- Add a **"Find Similar"** button in the photo lightbox modal
- Keep the existing structured filters (date, account, camera) alongside semantic search

### Step 8.7 — Backfill Script for Existing Photos
Create `scripts/backfill-embeddings.ts`:
- Queries all photos where `embedding IS NULL` and `thumbnail_url IS NOT NULL`
- For each: decode the Base64 thumbnail → generate embedding → update row
- Process in batches of 10 with a progress counter
- Run via: `npx tsx scripts/backfill-embeddings.ts`

### Step 8.8 — Update Schema File
Update [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql):
- Replace ivfflat index with HNSW (from S2 above)
- Add a comment noting the embedding model used

---

## 🚀 Phase 9 — Real User Authentication

**Goal**: Replace the hardcoded `testuser@example.com` with a proper authentication system.

### Step 9.1 — Choose Auth Strategy
Options:
- **NextAuth.js v5** (App Router compatible) with Google provider
- **Supabase Auth** (built-in with the existing Supabase DB)

Recommendation: **NextAuth.js v5** — keeps auth self-contained, doesn't couple to Supabase.

### Step 9.2 — Install & Configure NextAuth
```bash
npm install next-auth@beta
```
- Create `auth.ts` at project root with Google provider
- Create `app/api/auth/[...nextauth]/route.ts`
- Map NextAuth user to the existing `users` table

### Step 9.3 — Create Auth Middleware
- Create `middleware.ts` to protect `/dashboard`, `/browse`, `/admin`, and `/api/*` routes
- Redirect unauthenticated users to a login page

### Step 9.4 — Create Login Page
- Create `app/login/page.tsx` with "Sign in with Google" button
- Style consistently with existing UI

### Step 9.5 — Replace Hardcoded User ID
Audit and update every file that references `testuser@example.com`:
- `app/api/accounts/callback/route.ts`
- `app/api/photos/upload/route.ts`
- `app/api/photos/route.ts`
- `app/api/accounts/route.ts`
- `app/dashboard/page.tsx`
- `app/admin/page.tsx`

Replace with `auth()` session lookup → `session.user.id`.

### Step 9.6 — Role-Based Access for Admin
- Add a `role` column to `users` table (`TEXT DEFAULT 'user'`)
- Restrict `/admin` routes to users with `role = 'admin'`

---

## 🚀 Phase 10 — Configurable Replication & Storage Management

**Goal**: Give users control over how many copies of each photo are stored.

### Step 10.1 — Add Replication Factor Setting
- Add `replication_factor INTEGER DEFAULT 2` to `users` table
- Update [`lib/storage-router.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/storage-router.ts) to select the top N accounts by free space ratio instead of all eligible accounts

### Step 10.2 — Storage Settings UI
- Add a "Settings" tab to `/dashboard`
- Slider or dropdown for replication factor (1 to N, where N = connected accounts)
- Display estimated storage usage at each replication level

### Step 10.3 — Deduplication Check
- Before uploading, check if a file with the same SHA-256 hash already exists
- Add `file_hash TEXT` column to `photos` table
- Skip re-upload if the hash matches an existing photo

---

## 🚀 Phase 11 — Google Drive Sync (Import Existing Photos)

**Goal**: Import and index photos already stored in connected Drive accounts, not just newly uploaded ones.

### Step 11.1 — Drive Scanner Service
Create `lib/drive-scanner.ts`:
- `scanDrivePhotos(accountId)` — lists all image files in a Drive account using `drive.files.list` with `mimeType contains 'image/'`
- Paginates through results using `nextPageToken`
- Returns array of `{ driveFileId, filename, mimeType, size }`

### Step 11.2 — Sync API Endpoint
Create `POST /api/accounts/sync`:
- Accepts `accountId` parameter
- Calls scanner to discover photos
- Creates `photos` + `photo_replicas` records for new files (skip existing `drive_file_id`)
- Enqueues indexing jobs for each new photo

### Step 11.3 — Sync UI
- Add "Scan & Import" button on each account card in `/dashboard`
- Show progress indicator (X of Y photos imported)
- Display count of newly discovered photos

### Step 11.4 — Background Sync Worker
- Add a recurring BullMQ job that scans all accounts periodically (e.g., every 6 hours)
- Only imports photos that aren't already tracked in `photo_replicas`

---

## 🚀 Phase 12 — Polish & Production Readiness

### Step 12.1 — Error Handling & Retry Logic
- Add BullMQ retry config: `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`
- Add dead-letter queue for permanently failed jobs
- Surface failed indexing jobs in admin panel

### Step 12.2 — Loading & Empty States
- Skeleton loaders for all data-fetching pages
- Friendly empty states ("No photos yet — upload your first photo!")
- Error boundaries with retry buttons

### Step 12.3 — Navigation & Layout
- Add a persistent sidebar or top nav with links: Dashboard, Browse, Search, Admin
- Active route highlighting
- Mobile-responsive hamburger menu

### Step 12.4 — Performance
- Add `next/image` for optimized thumbnail rendering
- Implement virtual scrolling for large photo grids (1000+ photos)
- Add Redis caching for frequently accessed queries

### Step 12.5 — Deployment Preparation
- Dockerfile for the Next.js app
- Dockerfile for the BullMQ worker
- Docker Compose with Redis + both containers
- Environment variable documentation
- CI/CD pipeline (GitHub Actions)

---

## 📊 Phase Priority & Dependency Graph

```
Pre-Phase (Stabilization)
    ├── S1: Re-auth accounts ─────┐
    ├── S2: Fix HNSW index        │
    ├── S3: Gitignore secrets     │
    └── S4: E2E smoke test ───────┤
                                  ▼
                        Phase 8: Semantic Search ──→ Phase 11: Drive Sync
                                  │                         │
                                  ▼                         ▼
                        Phase 9: Real Auth ──────→ Phase 12: Polish
                                  │
                                  ▼
                        Phase 10: Replication Config
```

**Recommended execution order**: S1→S2→S3→S4 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12
