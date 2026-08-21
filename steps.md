# Photo Orchestrator - Action Steps Log

This file tracks all operational and development steps taken sequentially during this session.

---

### 📅 Session Log: 2026-08-14

#### Step 1: Rebuilt Database Schema after Supabase Restart
* **Goal**: Recreate the database structure on the restarted/clean Supabase instance.
* **Actions**:
  1. Created a temporary script to test DB connection and execute [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql).
  2. Verified connection using `DATABASE_URL` in [`.env.local`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/.env.local).
  3. Recreated `users`, `accounts`, and `photos` tables along with the `pgvector` index and cosine similarity index.
  4. Cleaned up the temporary setup script from the workspace.
* **Status**: Completed successfully.

#### Step 2: Fixed Default Next.js Landing Page Routing
* **Goal**: Solve the issue where visiting `http://localhost:3000` shows the default Next.js template landing page instead of the application.
* **Actions**:
  1. Replaced the placeholder content in [`app/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/page.tsx) with a Next.js server-side redirect to `/dashboard`.
* **Status**: Completed successfully.

#### Step 3: Created Documentation for Context and Steps Tracking
* **Goal**: Create files to track context and incremental steps inside the workspace.
* **Actions**:
  1. Created [`context.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/context.md) detailing the current stack, file structures, environment state, and outstanding tasks.
  2. Created [`steps.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/steps.md) to record development actions sequentially.
* **Status**: Completed successfully.

#### Step 4: Verified Accounts and Outlined Testing Strategy
* **Goal**: Confirm Google Accounts were successfully saved in the database after the Supabase restart, and plan the end-to-end testing.
* **Actions**:
  1. Created and ran a script to query the database's `accounts` table. Confirmed two Google Accounts (`rucpah1@gmail.com` and `rucpah@gmail.com`) are successfully connected.
  2. Identified that the backend has `/api/photos/upload` but there is no upload UI on the dashboard/browse page.
  3. Outlined the Redis setup, server start commands, and `curl` testing method.
* **Status**: Ready for user execution.

#### Step 5: Refactored Database Schema and Codebase for Multi-Account Replication
* **Goal**: Enable storing each photo in both/all connected Google accounts (for redundancy) while keeping a single logical database entry for future features (face detection, search indexer, embeddings).
* **Actions**:
  1. Updated [`db/schema.sql`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/db/schema.sql) to split logical photo metadata (`photos` table) and physical file replicas (`photo_replicas` table).
  2. Applied updates to the database by temporarily dropping `photos` and `photo_replicas` and executing the new schema (preserving connected accounts).
  3. Modified [`lib/storage-router.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/storage-router.ts) to select all eligible accounts instead of just one.
  4. Modified [`app/api/photos/upload/route.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/api/photos/upload/route.ts) to upload to all eligible accounts in parallel, record metadata once in `photos`, and record all file copy references in `photo_replicas`.
  5. Updated [`workers/indexer.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/workers/indexer.ts) to resolve file and account details from `photo_replicas` when downloading for EXIF extraction.
  6. Updated search API [`app/api/photos/route.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/api/photos/route.ts) and frontend gallery [`app/browse/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/browse/page.tsx) to join with replicas and render tags for all accounts containing a replica of the image.
* **Status**: Completed successfully.

#### Step 6: Implemented Resilient Redis/BullMQ Fallback for Local Testing
* **Goal**: Enable the application to run successfully and index photos even if Redis is not configured or running.
* **Actions**:
  1. Extracted core photo indexing logic from the background worker into a separate shared utility at [`lib/indexer.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/indexer.ts).
  2. Simplified [`workers/indexer.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/workers/indexer.ts) to delegate directly to this shared module.
  3. Modified the upload route in [`app/api/photos/upload/route.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/api/photos/upload/route.ts) to check for `REDIS_URL`. If Redis is not set or enqueuing fails, the route automatically executes `indexPhoto` inline asynchronously (in the background, non-blocking for HTTP).
* **Status**: Completed successfully.

#### Step 7: Implemented Storage Utilization Indicators on Dashboard
* **Goal**: Show a visual indicator/progress bar showing how much storage is left out of the total storage.
* **Actions**:
  1. Updated the `Account` interface and database SELECT query in [`app/dashboard/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/dashboard/page.tsx) to load `quota_total_bytes` and `quota_used_bytes`.
  2. Implemented logic to compute total capacity, total used, and free space across all connected accounts.
  3. Added an aggregated progress bar showing pooled capacity (e.g. "12.4 GB of 30 GB used") with a gradient transition style at the top of the accounts list.
  4. Added smaller utilization bars within individual account cards to show how much space each individual Google account is using.
* **Status**: Completed successfully.

#### Step 8: Implemented Dashboard File Upload UI
* **Goal**: Add a file upload button to the dashboard UI so you don't have to use `curl` to test uploading.
* **Actions**:
  1. Created [`app/dashboard/UploadButton.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/dashboard/UploadButton.tsx) as a Client Component that provides a file selector, checks size limits (max 50MB), sends a POST request with `FormData` to `/api/photos/upload`, and triggers a page refresh to update storage stats on completion.
  2. Imported and rendered `<UploadButton />` on [`app/dashboard/page.tsx`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/app/dashboard/page.tsx) above the accounts list section.
* **Status**: Completed successfully.





