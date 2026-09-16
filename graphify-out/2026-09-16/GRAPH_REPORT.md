# Graph Report - Photo_Orchestrator  (2026-09-15)

## Corpus Check
- 40 files · ~19,715 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 237 nodes · 325 edges · 25 communities (19 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62d667e5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- query
- devDependencies
- dependencies
- compilerOptions
- callback/route.ts
- package.json
- Photo Orchestrator — Action Steps & Roadmap
- AdminDashboard.tsx
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
- include
- 📸 Photo Orchestrator
- Photo Orchestrator - Project Context
- AGENTS.md
- embeddings.ts

## God Nodes (most connected - your core abstractions)
1. `query()` - 30 edges
2. `compilerOptions` - 16 edges
3. `getDriveClient()` - 12 edges
4. `indexPhoto()` - 12 edges
5. `📸 Photo Orchestrator` - 10 edges
6. `generateImageEmbedding()` - 9 edges
7. `formatVectorForPostgres()` - 9 edges
8. `Antigravity Build Prompts — Photo Orchestrator` - 9 edges
9. `refreshAccountQuota()` - 7 edges
10. `generateTextEmbedding()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `AdminPage()` --calls--> `query()`  [EXTRACTED]
  app/admin/page.tsx → lib/db.ts
- `DashboardPage()` --calls--> `query()`  [EXTRACTED]
  app/dashboard/page.tsx → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/callback/route.ts → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/route.ts → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/photos/route.ts → lib/db.ts

## Import Cycles
- None detected.

## Communities (25 total, 6 thin omitted)

### Community 0 - "query"
Cohesion: 0.25
Nodes (13): GET(), POST(), GET(), GET(), POST(), query(), getDriveClient(), refreshAccountQuota() (+5 more)

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.09
Nodes (23): bullmq, exifr, googleapis, @huggingface/transformers, ioredis, next, onnxruntime-node, dependencies (+15 more)

### Community 3 - "compilerOptions"
Cohesion: 0.11
Nodes (19): dom, dom.iterable, esnext, compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules (+11 more)

### Community 4 - "callback/route.ts"
Cohesion: 0.35
Nodes (7): GET(), GET(), decrypt(), encrypt(), getEncryptionKey(), generateAuthUrl(), getOAuth2Client()

### Community 5 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, worker (+1 more)

### Community 6 - "Photo Orchestrator — Action Steps & Roadmap"
Cohesion: 0.10
Nodes (19): 📜 Detailed Session History, Implementation Summary, 📊 Master Phase Tracker, 📦 Phase 10 — Configurable Replication & Deduplication, 🔄 Phase 11 — Google Drive Library Sync (Import Existing Photos), ⚡ Phase 12 — Polish & Production Readiness, ✅ Phase 8 — Semantic Image Search (CLIP + pgvector) [COMPLETED], 🔐 Phase 9 — Real User Authentication (+11 more)

### Community 7 - "AdminDashboard.tsx"
Cohesion: 0.25
Nodes (7): AccountRecord, AdminDashboard(), AdminDashboardProps, PhotoRecord, SystemStats, UserRecord, AdminPage()

### Community 8 - "dashboard/page.tsx"
Cohesion: 0.40
Nodes (4): Account, DashboardPage(), PageProps, UploadButton()

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

### Community 19 - "include"
Cohesion: 0.20
Nodes (9): **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx, exclude (+1 more)

### Community 20 - "📸 Photo Orchestrator"
Cohesion: 0.08
Nodes (24): 1. Prerequisites, 2. Environment Configuration, 3. Initialize Database Schema, 4. Install Dependencies, 5. Running the Application, 🔐 Accounts & Authentication, ⚙️ Administration, 🔍 AI Semantic Search (Phase 8) (+16 more)

### Community 22 - "Photo Orchestrator - Project Context"
Cohesion: 0.33
Nodes (5): 📋 Current Implementation Status (Phases 1-7), ⚡ Current State (Post-Supabase Restart), Photo Orchestrator - Project Context, 🛠️ Technology Stack, 🎯 Things to Finish / Next Steps

### Community 25 - "embeddings.ts"
Cohesion: 0.38
Nodes (9): GET(), formatVectorForPostgres(), generateImageEmbedding(), generateTextEmbedding(), getTextModel(), getVisionModel(), normalize(), backfill() (+1 more)

## Knowledge Gaps
- **111 isolated node(s):** `UserRecord`, `AccountRecord`, `PhotoRecord`, `SystemStats`, `AdminDashboardProps` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `query` to `dashboard/page.tsx`, `embeddings.ts`, `callback/route.ts`, `AdminDashboard.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `UserRecord`, `AccountRecord`, `PhotoRecord` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._