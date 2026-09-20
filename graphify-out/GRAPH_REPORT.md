# Graph Report - Photo_Orchestrator  (2026-09-20)

## Corpus Check
- 62 files · ~28,986 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 308 nodes · 452 edges · 31 communities (24 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba993836`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- query
- devDependencies
- dependencies
- compilerOptions
- callback/route.ts
- queue.ts
- Photo Orchestrator — Action Steps & Roadmap
- auth.ts
- dashboard/page.tsx
- browse/page.tsx
- layout.tsx
- schema.sql
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- rules/graphify.md
- workflows/graphify.md
- Antigravity Build Prompts — Photo Orchestrator
- next-auth.d.ts
- 📸 Photo Orchestrator
- Photo Orchestrator - Project Context
- AGENTS.md
- embeddings.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `query()` - 47 edges
2. `compilerOptions` - 16 edges
3. `getDriveClient()` - 14 edges
4. `indexPhoto()` - 14 edges
5. `syncAccountPhotos()` - 11 edges
6. `Photo Orchestrator — Action Steps & Roadmap` - 11 edges
7. `📸 Photo Orchestrator` - 10 edges
8. `refreshAccountQuota()` - 9 edges
9. `generateImageEmbedding()` - 9 edges
10. `formatVectorForPostgres()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AdminPage()` --calls--> `query()`  [EXTRACTED]
  app/admin/page.tsx → lib/db.ts
- `DashboardPage()` --calls--> `query()`  [EXTRACTED]
  app/dashboard/page.tsx → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/callback/route.ts → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/route.ts → lib/db.ts
- `DELETE()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/route.ts → lib/db.ts

## Import Cycles
- None detected.

## Communities (31 total, 7 thin omitted)

### Community 0 - "query"
Cohesion: 0.15
Nodes (25): DELETE(), GET(), POST(), POST(), GET(), GET(), POST(), GET() (+17 more)

### Community 1 - "devDependencies"
Cohesion: 0.06
Nodes (31): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+23 more)

### Community 2 - "dependencies"
Cohesion: 0.08
Nodes (25): bullmq, exifr, googleapis, @huggingface/transformers, ioredis, next, next-auth, onnxruntime-node (+17 more)

### Community 3 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 4 - "callback/route.ts"
Cohesion: 0.35
Nodes (7): GET(), GET(), decrypt(), encrypt(), getEncryptionKey(), generateAuthUrl(), getOAuth2Client()

### Community 5 - "queue.ts"
Cohesion: 0.47
Nodes (3): defaultJobOptions, dlq, queue

### Community 6 - "Photo Orchestrator — Action Steps & Roadmap"
Cohesion: 0.10
Nodes (20): 📜 Detailed Session History, Implementation Summary, 📊 Master Phase Tracker, ✅ Phase 10 — Configurable Replication & Deduplication [COMPLETED], ✅ Phase 11 — Google Drive Library Sync (Import Existing Photos) [COMPLETED], ✅ Phase 12 — Polish & Production Readiness [COMPLETED], ✅ Phase 8 — Semantic Image Search (CLIP + pgvector) [COMPLETED], ✅ Phase 9 — Real User Authentication [COMPLETED] (+12 more)

### Community 7 - "auth.ts"
Cohesion: 0.12
Nodes (12): AccountRecord, AdminDashboard(), AdminDashboardProps, PhotoRecord, SystemStats, UserRecord, AdminPage(), LoginPageProps (+4 more)

### Community 8 - "dashboard/page.tsx"
Cohesion: 0.15
Nodes (12): Account, DashboardPage(), PageProps, RemoveAccountButton(), RemoveAccountButtonProps, StorageSettingsCard(), StorageSettingsCardProps, SyncAccountButton() (+4 more)

### Community 9 - "browse/page.tsx"
Cohesion: 0.40
Nodes (3): Account, BrowsePhotosPage(), Photo

### Community 10 - "layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 11 - "schema.sql"
Cohesion: 0.80
Nodes (4): accounts, photo_replicas, photos, users

### Community 18 - "Antigravity Build Prompts — Photo Orchestrator"
Cohesion: 0.20
Nodes (9): Antigravity Build Prompts — Photo Orchestrator, Notes for you (not for the agent), Phase 1 — Project scaffold, Phase 2 — Database schema, Phase 3 — OAuth connect + callback, Phase 4 — Storage router + upload, Phase 5 — Background indexing worker, Phase 6 — Search API (+1 more)

### Community 19 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 20 - "📸 Photo Orchestrator"
Cohesion: 0.07
Nodes (28): 1. 🗄️ Multi-Account Storage Pooling & Management, 1. Prerequisites, 2. Environment Configuration, 2. ⚡ High-Throughput Batch Uploading, 3. Initialize Database Schema, 3. 🧠 Local AI Semantic Search & Recommendations (Phase 8), 4. Install Dependencies, 4. 🔐 Real Multi-Tenant Authentication & Access Control (Phase 9) (+20 more)

### Community 22 - "Photo Orchestrator - Project Context"
Cohesion: 0.33
Nodes (5): 📋 Current Implementation Status (Phases 1-7), ⚡ Current State (Post-Supabase Restart), Photo Orchestrator - Project Context, 🛠️ Technology Stack, 🎯 Things to Finish / Next Steps

### Community 25 - "embeddings.ts"
Cohesion: 0.38
Nodes (9): GET(), formatVectorForPostgres(), generateImageEmbedding(), generateTextEmbedding(), getTextModel(), getVisionModel(), normalize(), backfill() (+1 more)

## Knowledge Gaps
- **136 isolated node(s):** `UserRecord`, `AccountRecord`, `PhotoRecord`, `SystemStats`, `AdminDashboardProps` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `query` to `dashboard/page.tsx`, `embeddings.ts`, `callback/route.ts`, `auth.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `UserRecord`, `AccountRecord`, `PhotoRecord` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `query` be split into smaller, more focused modules?**
  _Cohesion score 0.14518002322880372 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._