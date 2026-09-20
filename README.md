# 📸 Photo Orchestrator

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Auth.js v5](https://img.shields.io/badge/Auth.js-v5.0_Beta-purple?style=flat-square&logo=auth0)](https://authjs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql)](https://github.com/pgvector/pgvector)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ%20%2F%20Redis-DC382D?style=flat-square&logo=redis)](https://bullmq.io/)
[![Hugging Face](https://img.shields.io/badge/AI-CLIP%20ViT--B%2F32-FFD21E?style=flat-square&logo=huggingface)](https://huggingface.co/Xenova/clip-vit-base-patch32)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/RuchitPahadia/Drive_Orchestrator/blob/main/notebooks/clip_semantic_search_walkthrough.ipynb)

**Photo Orchestrator** is an open-source, self-hosted photo management platform built with Next.js 16 and TypeScript. It pools photo storage across multiple free Google Drive accounts (15 GB each) into a single, unified, high-availability storage cluster with automatic dual-replica backup, asynchronous EXIF extraction, multi-tenant authentication, and **AI-powered semantic image search** using local CLIP embeddings and PostgreSQL `pgvector`.

---

## 🌟 Key Features

### 1. 🗄️ Multi-Account Storage Pooling & Management
- **Quota Pooling**: Connect multiple Google Drive accounts. The intelligent storage router pools the storage capacity and monitors real-time byte quotas.
- **Redundant Dual-Replica Backup**: Every photo uploaded is automatically duplicated across distinct Google Drive accounts (primary + secondary) to safeguard against accidental deletion or outages.
- **Account Disconnection**: Remove connected accounts with 1-click confirmation dialogs and automated replica tracking.
- **Enterprise-Grade Token Encryption**: Google OAuth refresh tokens are encrypted at rest using **AES-256-GCM** with unique initialization vectors (`iv`) and authentication tags (`authTag`).

### 2. ⚡ High-Throughput Batch Uploading
- **Multi-File Selection & Drag-and-Drop**: Select dozens of photos at once (`<input multiple>`) or drop folders directly into the browser upload zone.
- **Parallel Upload Workers**: Managed queue concurrency of 2 parallel uploads prevents browser and network saturation while maximizing throughput.
- **Real-Time Animated Progress**: Dynamic upload status bar displaying file sequence, file name, and percentage completion (`Uploading X of Y: filename (Z%)`).
- **Resilient Fallback**: Upload succeeds even if the Redis worker queue is temporarily down, executing metadata extraction and embedding generation inline in the background.

### 3. 🧠 Local AI Semantic Search & Recommendations (Phase 8)
- **Natural Language Search**: Query photos conceptually (e.g. *"sunset on a beach"*, *"dog running on grass"*, *"birthday celebration"*) with zero manual tags.
- **Visual Similarity Search ("Find Similar")**: Instant nearest-neighbor visual recommendations from any photo lightbox.
- **100% Local Inference**: Uses `@huggingface/transformers` running the quantized `Xenova/clip-vit-base-patch32` ONNX model (~80 MB) directly inside Node.js. No API keys, zero cloud costs, and complete privacy.
- **PostgreSQL HNSW Index**: Blazing-fast approximate nearest-neighbor vector search via PostgreSQL `pgvector` with an HNSW cosine distance index (`vector_cosine_ops`).
- **Google Colab GPU Walkthrough**: Interactive Colab notebook ([`notebooks/clip_semantic_search_walkthrough.ipynb`](notebooks/clip_semantic_search_walkthrough.ipynb)) detailing CLIP dual-encoders, contrastive loss, mixed-precision (FP16) fine-tuning, and pgvector HNSW search.

### 4. 🔐 Real Multi-Tenant Authentication & Access Control (Phase 9)
- **NextAuth.js v5 (Auth.js)**: Native App Router integration with Edge-safe route guards (`middleware.ts`).
- **Google OAuth Sign-In**: Seamless authentication for end users with automatic Supabase user syncing.
- **1-Click Developer Sign-In**: Instant local test sign-in (`dev-login`) for rapid local testing as Administrator.
- **Role-Based Access Control (RBAC)**: Enforces role permissions (`admin` vs `user`) protecting `/admin` routes and sensitive pool actions.
- **Scoped Multi-Tenancy**: Every photo, replica, and Drive account is strictly isolated and queried by `session.user.id`.

### 5. 🖼️ Gallery & Metadata Extraction
- **Automatic EXIF Parsing**: Extracts camera make, model, lens settings, exposure, ISO, capture timestamp, and GPS coordinates using `exifr`.
- **Fast Thumbnails**: Generates 300×300 JPEG thumbnails using `sharp` native bindings (<15 KB per thumbnail).
- **Interactive Lightbox**: Inspect technical camera details, view replica health, and trigger visual similarity lookups.

---

## 🏗️ Architecture & Data Flow

```
                                  +---------------------------------------+
                                  |         Next.js App Router            |
                                  |  (/dashboard, /browse, /api/photos)   |
                                  +-------------------+-------------------+
                                                      |
                               1. Batch Upload Photos | 2. Push indexing job
                               (Concurrency = 2)      v
                                             +-------------------+
                                             |    Redis Queue    |
                                             |     (BullMQ)      |
                                             +---------+---------+
                                                       |
                                                       | 3. Pick up job
                                                       v
+------------------------+                  +-------------------+
|  Google Drive Account  |                  |  Worker Process   |
|   A (Primary Copy)     |<=================| (workers/indexer) |
+------------------------+  4. Download     +---------+---------+
                             Thumbnail Buffer          |
+------------------------+                             | 5. Generate 512-d
|  Google Drive Account  |                             |    CLIP Vector Embedding
|   B (Replica Copy)     |                             v
+------------------------+                  +---------------------+
                                            | CLIP ViT-B/32 ONNX  |
                                            | (Local Transformers)|
                                            +----------+----------+
                                                       |
                                                       | 6. Save Metadata & Vector
                                                       v
                                         +-----------------------------+
                                         |    PostgreSQL + pgvector    |
                                         | (HNSW Cosine Vector Index)  |
                                         +-----------------------------+
```

### Search Pipeline
1. User enters natural language query in `/browse` (e.g., *"golden hour mountains"*).
2. `GET /api/photos/search?q=...` converts the query string into a 512-dimensional normalized vector via local CLIP text encoder.
3. Supabase PostgreSQL executes an approximate nearest-neighbor query using cosine distance:
   ```sql
   SELECT id, filename, 1 - (embedding <=> $1::vector) AS similarity 
   FROM photos 
   WHERE user_id = $2 AND embedding IS NOT NULL 
   ORDER BY embedding <=> $1::vector 
   LIMIT 20;
   ```
4. Results render with visual similarity percentage badges in the gallery.

---

## 🗄️ Database Schema

The database relies on PostgreSQL 15+ with the [`pgvector`](https://github.com/pgvector/pgvector) extension enabled:

```mermaid
erDiagram
    users ||--o{ accounts : owns
    users ||--o{ photos : owns
    photos ||--o{ photo_replicas : replicates
    accounts ||--o{ photo_replicas : stores

    users {
        uuid id PK
        text email UK
        text name
        text avatar_url
        text role
        timestamptz created_at
    }

    accounts {
        uuid id PK
        uuid user_id FK
        text google_email
        text access_token
        text refresh_token
        bigint quota_total_bytes
        bigint quota_used_bytes
        timestamptz updated_at
    }

    photos {
        uuid id PK
        uuid user_id FK
        text filename
        timestamptz taken_at
        float gps_lat
        float gps_lng
        text camera_model
        text thumbnail_url
        vector_512 embedding
        timestamptz indexed_at
    }

    photo_replicas {
        uuid id PK
        uuid photo_id FK
        uuid account_id FK
        text drive_file_id
        timestamptz created_at
    }
```

### Production Vector Index Definition
```sql
CREATE INDEX photos_embedding_hnsw_idx 
ON photos USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **PostgreSQL**: Version 15+ with `pgvector` enabled (e.g. [Supabase](https://supabase.com))
- **Redis**: Local instance or hosted cloud Redis (e.g. [Upstash](https://upstash.com)) *(Optional: indexing falls back to background inline mode if Redis is absent)*
- **Google Cloud Console Project**:
  - OAuth 2.0 Client ID and Secret configured
  - Authorized Redirect URIs:
    - `http://localhost:3000/api/auth/callback/google` (NextAuth user login)
    - `http://localhost:3000/api/accounts/callback` (Google Drive storage account connection)
  - Enabled API: **Google Drive API**
  - Scope: `https://www.googleapis.com/auth/drive.file`

---

### 2. Environment Configuration

Create `.env.local` in the project root:

```env
# NextAuth.js v5 Configuration
AUTH_SECRET=your_nextauth_secret_key_here
AUTH_URL=http://localhost:3000

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/callback

# PostgreSQL / Supabase Connection Pooler with pgvector
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres

# Redis Connection (BullMQ Queue) - Optional
REDIS_URL=redis://default:password@your-redis-host:6379

# AES-256-GCM Encryption Key (Must be 32 bytes hex string)
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

> 💡 **Tip to generate keys**:
> ```bash
> # Generate AUTH_SECRET or TOKEN_ENCRYPTION_KEY (32-byte hex)
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### 3. Initialize Database Schema

Apply the schema to your Supabase / PostgreSQL instance:

```bash
psql $DATABASE_URL -f db/schema.sql
```
*(Or paste the contents of [`db/schema.sql`](db/schema.sql) into the Supabase SQL Editor).*

---

### 4. Install Dependencies

```bash
npm install
```

---

### 5. Running the Application

For full operation, run the web application and optionally the standalone worker in separate terminals:

#### Terminal 1: Web Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Terminal 2: BullMQ Indexer Worker (Optional if Redis configured)
```bash
npm run worker
```

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` |
| `npm run worker` | Runs the BullMQ standalone background indexer worker |
| `npm run build` | Compiles the production Next.js application |
| `npm run start` | Runs the production Next.js server |
| `npm run lint` | Validates codebase with ESLint |
| `npx tsx scripts/backfill-embeddings.ts` | Backfills CLIP embeddings for any existing photos missing vectors |
| `npx tsx scripts/test-phase8.ts` | Verifies end-to-end local CLIP inference and pgvector similarity search |

---

## 📡 API Reference

### 🔐 Authentication & Accounts
- `GET /api/auth/[...nextauth]`: NextAuth dynamic auth endpoints (Google sign-in, session verification, sign-out).
- `GET /api/accounts`: List all connected Google Drive accounts and storage quotas for current user.
- `GET /api/accounts/connect`: Initiates OAuth 2.0 flow to link a Google Drive storage account.
- `GET /api/accounts/callback`: Handles Google Drive OAuth token exchange and encrypted credential storage.
- `DELETE /api/accounts`: Disconnects a storage account and removes replica metadata (`?accountId={uuid}`).

### 🖼️ Photos & Upload
- `GET /api/photos`: Paginated photo retrieval with metadata, replicas, and camera filters.
- `POST /api/photos/upload`: Multipart batch upload endpoint. Selects optimal storage accounts, writes replicas, and enqueues indexing.

### 🔍 AI Semantic Search & Similarity
- `GET /api/photos/search?q={query}&limit={20}&threshold={0.25}`: Converts text into a 512-d CLIP embedding and returns top matching photos with cosine similarity scores.
- `GET /api/photos/similar?photoId={uuid}&limit={20}`: Finds nearest-neighbor photos visually similar to the specified image.

### ⚙️ Administration
- `GET /admin`: Administrator dashboard with cluster storage metrics and user management (requires `role = 'admin'`).
- `POST /api/admin/actions`: Executes system maintenance tasks (e.g. quota refresh, pool health verification).

---

## 🗺️ Project Roadmap & Phase Status

```mermaid
flowchart TD
    subgraph Completed [Completed Phases]
        P1[Phase 1: Project Scaffold]
        P2[Phase 2: Database & Schema]
        P3[Phase 3: OAuth & Crypto]
        P4[Phase 4: Storage Router]
        P5[Phase 5: Background Indexer]
        P6[Phase 6: Search & Browse API]
        P7[Phase 7: Frontend Browse UI]
        P8[Phase 8: CLIP Semantic Search]
        P9[Phase 9: Real User Authentication]
        P10[Phase 10: Configurable Replication & Dedup]
        P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8 --> P9 --> P10
    end

    subgraph Planned [Upcoming Roadmap]
        P11[Phase 11: Google Drive Library Sync]
        P12[Phase 12: Production Polish & Docker]
        P10 --> P11 --> P12
    end
```

- [x] **Phase 1: Project Scaffold** — Next.js 16 + TypeScript + Tailwind CSS
- [x] **Phase 2: Database & pgvector** — Supabase PostgreSQL schema with 4 core tables
- [x] **Phase 3: OAuth Connect & Crypto** — Google OAuth flow with AES-256-GCM encryption
- [x] **Phase 4: Storage Router & Upload** — Multi-account physical replication
- [x] **Phase 5: Background Indexer** — EXIF parsing + Sharp thumbnail pipeline
- [x] **Phase 6: Search & Browse API** — Filterable photo search endpoint
- [x] **Phase 7: Frontend Browse UI** — Interactive gallery, lightbox, and replica indicators
- [x] **Phase 8: CLIP Semantic Search** — Local ONNX CLIP model + Supabase HNSW vector search
- [x] **Phase 9: Real User Authentication** — NextAuth.js v5 + Google Provider + RBAC
- [x] **Phase 10: Configurable Replication & Deduplication** — N-way replication controls and SHA-256 deduplication
- [ ] **Phase 11: Google Drive Library Sync** — Discover and import existing photos from connected Drive accounts
- [ ] **Phase 12: Production Polish & Docker** — Containerization, BullMQ retry policies, and skeleton UI loaders

---

## 🛡️ Security & Privacy

- **Minimal Google Scopes**: Requests only `https://www.googleapis.com/auth/drive.file`. The app can **only** read and modify files that it creates, and has zero access to private documents in Google Drive.
- **Zero-Trust Token Storage**: Refresh tokens are encrypted with AES-256-GCM before writing to the database.
- **100% Local AI Inference**: Search queries and image embeddings are computed on your local CPU/GPU using ONNX Runtime. No photos or search queries are sent to external third-party AI APIs.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).