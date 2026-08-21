# Photo Orchestrator - Project Context

A Next.js 16 + TypeScript application that pools photo storage across multiple Google Drive accounts. It extracts EXIF metadata and generates thumbnails automatically in the background.

---

## 🛠️ Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Vanilla CSS
- **Database**: PostgreSQL (via Supabase) with the `pgvector` extension
- **Job Queue**: BullMQ & `ioredis` for background photo indexing
- **Metadata Extraction**: `exifr` (extracts date taken, camera model, GPS coordinates)
- **Image Processing**: `sharp` (generates 300x300 JPEG thumbnails in Base64)

---

## 📋 Current Implementation Status (Phases 1-7)
All primary project phases have been scaffolded and coded:
- **Phase 1: Project Scaffold** - Completed.
- **Phase 2: Database Schema & Client** - Database pool configured in [`lib/db.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/db.ts) and schema defined in [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql). Splitting logical photo metadata (`photos`) and physical copy tracking (`photo_replicas`).
- **Phase 3: OAuth Connect + Callback** - Google OAuth configuration in [`lib/google-oauth.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/google-oauth.ts), AES-256-GCM token encryption in [`lib/crypto.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/crypto.ts), and routes `/api/accounts/connect` + `/api/accounts/callback` completed. Dashboard UI page in [`app/dashboard/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/dashboard/page.tsx) lists connected accounts, showcases aggregated and individual storage progress utilization indicators, and provides an interactive file upload button with automatic data updates.
- **Phase 4: Storage Router & Upload** - Storage router in [`lib/storage-router.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/storage-router.ts) modified to pick all eligible connected accounts for replication. Resumable upload endpoint created at `/api/photos/upload` replicates uploads to all accounts and records the replica records.
- **Phase 5: Background Indexer Worker** - Worker defined in [`workers/indexer.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/workers/indexer.ts) and connected via BullMQ queue in [`lib/queue.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/queue.ts). Queries the first available replica to download.
- **Phase 6: Search & Browse API** - GET API endpoint at `/api/photos` completed, supporting filters for date range, connected account, camera model, and pagination. Joins with replicas.
- **Phase 7: Frontend Browse UI** - Interactive browse page at [`app/browse/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/browse/page.tsx) with responsive grid, filters, loading states, pagination, and a details lightbox. Shows tags for all accounts containing a replica of the image.

---

## ⚡ Current State (Post-Supabase Restart)
1. **Schema Re-applied**: The Supabase database was restarted/reset. The connection via `DATABASE_URL` is active. I successfully re-applied the schema (`db/schema.sql`), recreating the `users`, `accounts`, and `photos` tables along with the pgvector extension and indexes.
2. **Database has 2 Connected Accounts**: Both `rucpah1@gmail.com` and `rucpah@gmail.com` are successfully registered in the database's `accounts` table.
3. **Redirect Setup**: Modified [`app/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/page.tsx) to automatically redirect to `/dashboard` when visiting `http://localhost:3000/`.
4. **Environment Check**:
   - `DATABASE_URL`: Active and connected.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Configured in [`.env.local`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/.env.local).
   - `REDIS_URL`: **Not configured** in [`.env.local`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/.env.local) (currently empty). Because we implemented a fallback mechanism, photo indexing will run inline asynchronously in the background. A Redis server is optional and only needed if you want to use the decouple BullMQ background worker.

---

## 🎯 Things to Finish / Next Steps
1. **Configure Redis**: Set up a local or cloud Redis instance and set the `REDIS_URL` in [`.env.local`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/.env.local).
2. **Start Servers**: Start the Next.js dev server (`npm run dev`) and the background indexing worker (`npm run worker`).
3. **Reconnect Google Accounts**: Visit `http://localhost:3000/` (redirects to `/dashboard`) and click "Connect Google Account" to re-authenticate accounts.
4. **Test End-to-End**: Upload a photo through the UI to test the storage router, and verify that the background worker successfully downloads the photo, extracts EXIF data, and generates a thumbnail.
5. **Phase 8 / Version 2 (Future)**: Implement semantic search with CLIP embeddings inside the database.
