# Graph Report - Photo_Orchestrator  (2026-08-24)

## Corpus Check
- 35 files · ~15,344 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 154 nodes · 215 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4353866c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- query
- devDependencies
- dependencies
- compilerOptions
- drive-client.ts
- package.json
- include
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

## God Nodes (most connected - your core abstractions)
1. `query()` - 22 edges
2. `compilerOptions` - 16 edges
3. `getDriveClient()` - 12 edges
4. `indexPhoto()` - 10 edges
5. `refreshAccountQuota()` - 7 edges
6. `include` - 7 edges
7. `encrypt()` - 6 edges
8. `getOAuth2Client()` - 6 edges
9. `scripts` - 6 edges
10. `POST()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `DashboardPage()` --calls--> `query()`  [EXTRACTED]
  app/dashboard/page.tsx → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/route.ts → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/photos/route.ts → lib/db.ts
- `AdminPage()` --calls--> `query()`  [EXTRACTED]
  app/admin/page.tsx → lib/db.ts
- `GET()` --calls--> `query()`  [EXTRACTED]
  app/api/accounts/callback/route.ts → lib/db.ts

## Import Cycles
- None detected.

## Communities (18 total, 5 thin omitted)

### Community 0 - "query"
Cohesion: 0.24
Nodes (13): AdminPage(), GET(), POST(), GET(), POST(), query(), getDriveClient(), refreshAccountQuota() (+5 more)

### Community 1 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+13 more)

### Community 2 - "dependencies"
Cohesion: 0.11
Nodes (19): bullmq, exifr, googleapis, ioredis, next, dependencies, bullmq, exifr (+11 more)

### Community 3 - "compilerOptions"
Cohesion: 0.11
Nodes (19): dom, dom.iterable, esnext, compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules (+11 more)

### Community 4 - "drive-client.ts"
Cohesion: 0.36
Nodes (7): GET(), GET(), decrypt(), encrypt(), getEncryptionKey(), generateAuthUrl(), getOAuth2Client()

### Community 5 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, start, worker (+1 more)

### Community 6 - "include"
Cohesion: 0.20
Nodes (9): **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx, exclude (+1 more)

### Community 7 - "AdminDashboard.tsx"
Cohesion: 0.29
Nodes (6): AccountRecord, AdminDashboard(), AdminDashboardProps, PhotoRecord, SystemStats, UserRecord

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

## Knowledge Gaps
- **68 isolated node(s):** `graphify`, `Workflow: graphify`, `AccountRecord`, `AdminDashboardProps`, `PhotoRecord` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `query()` connect `query` to `dashboard/page.tsx`, `drive-client.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `graphify`, `Workflow: graphify`, `AccountRecord` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._