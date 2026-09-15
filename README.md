# 📸 Photo Orchestrator

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql)](https://github.com/pgvector/pgvector)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ%20%2F%20Redis-DC382D?style=flat-square&logo=redis)](https://bullmq.io/)
[![Hugging Face](https://img.shields.io/badge/AI-CLIP%20ViT--B%2F32-FFD21E?style=flat-square&logo=huggingface)](https://huggingface.co/Xenova/clip-vit-base-patch32)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/RuchitPahadia/Drive_Orchestrator/blob/main/notebooks/clip_semantic_search_walkthrough.ipynb)

**Photo Orchestrator** is an open-source, self-hosted photo management platform built with Next.js 16 and TypeScript. It pools photo storage across multiple free Google Drive accounts (15 GB each) into a unified, high-availability storage cluster with automatic dual-replica backup, asynchronous EXIF extraction, and **AI-powered semantic image search** using local CLIP embeddings and PostgreSQL `pgvector`.

---

## 🌟 Key Features

- **Multi-Account Storage Pooling**: Connect unlimited Google accounts. The storage router automatically pools free storage quotas and distributes uploads to the account with the highest available free space.
- **Redundant Dual-Replica Backup**: Every photo is uploaded with primary and secondary replicas distributed across separate Google Drive accounts to protect against data loss.
- **Enterprise-Grade Token Encryption**: Google OAuth refresh tokens are encrypted at rest using **AES-256-GCM** with unique initialization vectors (`iv`) and authentication tags (`authTag`).
- **Asynchronous Worker Pipeline**: Offload CPU-intensive operations (image decoding, EXIF metadata extraction, thumbnail rendering, and vector embedding computation) to a standalone **BullMQ** worker powered by Redis.
- **EXIF & Metadata Extraction**: Automatically parses camera manufacturer, model, lens parameters, original timestamp, and GPS coordinates using `exifr`.
- **AI Semantic Image Search (Phase 8)**:
  - **Natural Language Search**: Search photos by concepts and natural descriptions (e.g. *"sunset on a beach"*, *"dog playing in grass"*, *"family dinner"*) with zero manual tagging.
  - **Visual Similarity Matching**: Find nearest-neighbor photos visually similar to any selected photo with a single click.
  - **HNSW Vector Indexing**: Blazing-fast approximate nearest-neighbor search inside PostgreSQL with an HNSW cosine distance index (`vector_cosine_ops`).
  - **Zero API Cost**: Powered locally by `@huggingface/transformers` running the quantized `Xenova/clip-vit-base-patch32` ONNX model (~80 MB) inside Node.js.
- **Colab GPU Walkthrough**: Interactive Jupyter notebook demonstrating CLIP architecture, contrastive loss, mixed-precision (FP16) fine-tuning on Colab GPUs, and vector search with Supabase.
- **Modern Responsive Web UI**:
  - **Dashboard (`/dashboard`)**: Storage pool capacity meters, account status badges, and drag-and-drop photo uploader.
  - **Browse (`/browse`)**: Responsive photo gallery with AI semantic search bar, active search mode badges, similarity match percentages, and lightbox modal.
  - **Admin (`/admin`)**: System health checks, account quota monitoring, and storage rebalance triggers.

---

## 🏗️ Architecture & Data Flow

```
                                  +---------------------------------------+
                                  |         Next.js App Router            |
                                  |  (/dashboard, /browse, /api/photos)   |
                                  +-------------------+-------------------+
                                                      |
                         1. Upload Photo              | 2. Push indexing job
                                                      v
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
+------------------------+                            | 5. Generate 512-d
|  Google Drive Account  |                            |    Vector Embedding
|   B (Replica Copy)     |                            v
+------------------------+                 +---------------------+
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

### Search Flow:
1. User enters natural language query in `/browse` (e.g. *"orange sunset"*).
2. `GET /api/photos/search?q=...` converts the query to a 512-element normalized vector using CLIP text encoder.
3. PostgreSQL queries `photos` table using `1 - (embedding <=> $1::vector) AS similarity`.
4. The HNSW vector index rapidly fetches top matching photos ordered by cosine similarity.

---

## 🗄️ Database Schema

The database relies on PostgreSQL 15+ with the [`pgvector`](https://github.com/pgvector/pgvector) extension enabled:

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | User accounts | `id` (UUID), `email`, `created_at` |
| `accounts` | Connected Google Drive accounts | `id`, `user_id`, `google_email`, `access_token`, `refresh_token` (encrypted), `quota_total_bytes`, `quota_used_bytes` |
| `photos` | Logical photo records & metadata | `id`, `user_id`, `filename`, `taken_at`, `gps_lat`, `gps_lng`, `camera_model`, `thumbnail_url`, `embedding` (`VECTOR(512)`), `indexed_at` |
| `photo_replicas` | Physical copies in Drive accounts | `id`, `photo_id`, `account_id`, `drive_file_id`, `created_at` |

### Vector Index Configuration
```sql
CREATE INDEX photos_embedding_hnsw_idx 
ON photos USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **PostgreSQL**: Version 15+ with `pgvector` installed (e.g., [Supabase](https://supabase.com))
- **Redis**: Local instance or hosted provider (e.g., [Upstash](https://upstash.com))
- **Google Cloud Console Project**:
  - OAuth 2.0 Client ID and Secret configured
  - Authorized Redirect URI: `http://localhost:3000/api/accounts/callback`
  - Enabled API: **Google Drive API**
  - Scope: `https://www.googleapis.com/auth/drive.file`

---

### 2. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/callback

# PostgreSQL / Supabase Connection with pgvector
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres

# Redis Connection (BullMQ)
REDIS_URL=redis://default:password@your-redis-host:6379

# AES-256-GCM Encryption Key (Must be exactly 32 bytes in hex or plain text)
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

> 💡 **Tip to generate a secure encryption key**:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### 3. Initialize Database Schema

Apply the schema to your PostgreSQL instance:

```bash
psql $DATABASE_URL -f db/schema.sql
```
*(Or execute the contents of [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql) in the Supabase SQL Editor).*

---

### 4. Install Dependencies

```bash
npm install
```

---

### 5. Running the Application

For full operation, run the web server and the background indexer worker in separate terminal windows:

#### Terminal 1: Next.js Web App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Terminal 2: BullMQ Indexer Worker
```bash
npm run worker
```
The worker will listen for upload jobs, extract metadata, generate thumbnails, compute 512-dim CLIP embeddings, and store them in PostgreSQL.

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` |
| `npm run worker` | Runs the BullMQ background indexer worker |
| `npm run build` | Builds the production Next.js application |
| `npm run start` | Runs the production Next.js server |
| `npm run lint` | Runs ESLint validation |
| `npx tsx scripts/backfill-embeddings.ts` | Backfills CLIP embeddings for any existing photos missing vectors |
| `npx tsx scripts/test-phase8.ts` | Runs the end-to-end smoke test for text/image embeddings and pgvector |

---

## 🧠 Machine Learning & Colab Exploration

For an interactive deep-dive into how CLIP works under the hood, we provide a complete Jupyter Notebook:

📁 [`notebooks/clip_semantic_search_walkthrough.ipynb`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/notebooks/clip_semantic_search_walkthrough.ipynb)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/RuchitPahadia/Drive_Orchestrator/blob/main/notebooks/clip_semantic_search_walkthrough.ipynb)

### What the notebook covers:
1. **Interactive Architecture**: Visualizing CLIP vision & text dual-encoders.
2. **Symmetric Contrastive Loss**: PyTorch GPU tensor math with learnable temperature scaling (`logit_scale`).
3. **Mixed-Precision Training**: FP16 training with `torch.cuda.amp.GradScaler`.
4. **Model Export**: Saving fine-tuned weights to Google Drive.
5. **Supabase pgvector Verification**: Executing cosine distance queries directly against PostgreSQL.

---

## 📡 API Reference

### 🔐 Accounts & Authentication
- `GET /api/accounts`: List all connected Google Drive accounts and their quota statistics.
- `GET /api/accounts/connect`: Initiates Google OAuth 2.0 flow with `drive.file` scope.
- `GET /api/accounts/callback`: Handles Google OAuth redirect, exchanges tokens, and stores encrypted credentials.

### 🖼️ Photos
- `GET /api/photos`: Retrieve paginated photos for the authenticated user with metadata and thumbnails.
- `POST /api/photos/upload`: Multipart upload endpoint. Determines optimal storage accounts, uploads primary/backup replicas, and enqueues indexing job.

### 🔍 AI Semantic Search (Phase 8)
- `GET /api/photos/search?q={query}&limit={20}&threshold={0.25}`:
  - Generates text embedding for `{query}` and returns ranked photos with cosine similarity scores.
- `GET /api/photos/similar?photoId={uuid}&limit={20}`:
  - Finds visually and semantically similar photos using nearest-neighbor search.

### ⚙️ Administration
- `POST /api/admin/actions`: Triggers administrative tasks (e.g. quota refresh, storage rebalancing).

---

## 🛡️ Security & Privacy

- **Minimal Google Scopes**: Only requests `https://www.googleapis.com/auth/drive.file` scope. The application can **only** read and modify files that it created, and cannot access the user's private Drive documents.
- **Zero-Trust Token Storage**: Refresh tokens are never stored in plaintext. They are encrypted using `aes-256-gcm` before writing to the database.
- **Local AI Inference**: Photos and search queries are never sent to external ML APIs (e.g. OpenAI or cloud vision APIs). Vector embeddings are generated 100% locally on your machine.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).