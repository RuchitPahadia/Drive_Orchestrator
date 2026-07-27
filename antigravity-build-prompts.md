# Antigravity Build Prompts — Photo Orchestrator

Give these to the coding agent **one phase at a time, in order**. Wait for each phase to finish and verify it works before pasting the next. Each prompt is self-contained (restates the stack) since the agent won't necessarily remember earlier phases as context.

**Already done (don't ask the agent to redo):**
- Google Cloud project created under `toruchitpahadia@gmail.com`
- Drive API enabled
- OAuth consent screen configured, scopes added (`drive.readonly`, `userinfo.email`)
- Test users added: `rucpah@gmail.com`, `rucpah1@gmail.com`
- OAuth Client ID + Client Secret generated

---

## Phase 1 — Project scaffold

```
Set up a new Next.js 14+ project called "photo-orchestrator" using:
- TypeScript
- Tailwind CSS
- App Router (not Pages Router)
- ESLint default config

Install these dependencies:
- googleapis (official Google API client)
- pg (Postgres client)
- ioredis and bullmq (for background job queue)
- sharp (image processing / thumbnails)
- exifr (EXIF metadata extraction)

Create a .env.local file with these placeholder keys (I will fill in real values myself):
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/callback
DATABASE_URL=
REDIS_URL=
TOKEN_ENCRYPTION_KEY=

Make sure .env.local is in .gitignore. Confirm the project runs with `npm run dev` and shows the default Next.js page before finishing.
```

---

## Phase 2 — Database schema

```
This is a Next.js + TypeScript app (App Router) that pools photo storage across multiple Google Drive accounts. It uses Postgres with the pgvector extension.

Create a db/schema.sql file with these tables:

1. users — one row per app user (id UUID primary key, email, created_at)

2. accounts — one row per connected Google Drive storage account:
   - id UUID primary key
   - user_id UUID references users(id)
   - google_email TEXT
   - access_token TEXT (will store encrypted)
   - refresh_token TEXT (will store encrypted)
   - token_expiry TIMESTAMPTZ
   - quota_total_bytes BIGINT
   - quota_used_bytes BIGINT
   - quota_checked_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ default now()

3. photos — one row per indexed photo, wherever it physically lives:
   - id UUID primary key
   - user_id UUID references users(id)
   - account_id UUID references accounts(id)
   - drive_file_id TEXT
   - filename TEXT
   - mime_type TEXT
   - size_bytes BIGINT
   - taken_at TIMESTAMPTZ
   - gps_lat DOUBLE PRECISION
   - gps_lng DOUBLE PRECISION
   - camera_model TEXT
   - thumbnail_url TEXT
   - embedding VECTOR(512)
   - indexed_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ default now()
   - UNIQUE(account_id, drive_file_id)

Add an ivfflat index on photos.embedding for cosine similarity search, and a regular index on (user_id, taken_at DESC).

Also create lib/db.ts — a Postgres connection pool using the `pg` package and DATABASE_URL from env, exporting a reusable query function.

Enable the pgvector extension at the top of the schema file with CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Phase 3 — OAuth connect + callback

```
This is a Next.js 14 App Router + TypeScript project. Stack: googleapis package for Google OAuth, Postgres via lib/db.ts (already exists), pg schema with a `users` and `accounts` table (already exists — accounts has: id, user_id, google_email, access_token, refresh_token, token_expiry, created_at).

Goal: build the OAuth flow that lets me connect multiple separate Google Drive accounts to a single app user, one at a time.

1. Create lib/google-oauth.ts:
   - A function to build a Google OAuth2Client using GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI from env
   - A function generateAuthUrl() that returns a consent screen URL requesting scopes: https://www.googleapis.com/auth/drive.readonly and https://www.googleapis.com/auth/userinfo.email, with access_type: 'offline' and prompt: 'consent' so a refresh token is always returned

2. Create lib/crypto.ts:
   - encrypt(text: string) and decrypt(text: string) functions using Node's built-in crypto module (AES-256-GCM), keyed from TOKEN_ENCRYPTION_KEY in env
   - Used to encrypt access_token/refresh_token before storing in the DB

3. Create app/api/accounts/connect/route.ts:
   - GET handler that redirects the browser to the URL from generateAuthUrl()

4. Create app/api/accounts/callback/route.ts:
   - GET handler that reads the `code` query param from Google's redirect
   - Exchanges it for tokens using the OAuth2Client
   - Fetches the connected account's email via the userinfo endpoint
   - Encrypts both tokens with lib/crypto.ts
   - Inserts a new row into the accounts table (for now, hardcode a single test user_id — I'll wire up real user auth later)
   - Redirects to /dashboard with a success message, or shows a clear error if anything fails

5. Create a simple app/dashboard/page.tsx that just lists connected accounts (google_email + connected date) by querying the accounts table directly (server component, no need for a separate API route yet), and includes a "Connect Google Account" link/button pointing at /api/accounts/connect

Handle errors gracefully — if the user denies consent, or the token exchange fails, show a clear message rather than crashing.
```

---

## Phase 4 — Storage router + upload

```
This is a Next.js 14 App Router + TypeScript project pooling Google Drive storage across multiple connected accounts. Existing pieces: lib/db.ts (Postgres pool), lib/google-oauth.ts, lib/crypto.ts (encrypt/decrypt), an `accounts` table with encrypted access_token/refresh_token/token_expiry/quota_total_bytes/quota_used_bytes columns.

Goal: build the logic that picks which connected Drive account to upload a file to, and actually uploads it.

1. Create lib/drive-client.ts:
   - A function getDriveClient(accountId: string) that: loads the account row from DB, decrypts the refresh token, creates an authenticated googleapis Drive client for that account, automatically refreshing the access token if expired and updating the DB with the new encrypted access_token + expiry
   - A function refreshAccountQuota(accountId: string) that calls Drive's `about.get` with fields `storageQuota` and updates quota_total_bytes/quota_used_bytes/quota_checked_at in the DB

2. Create lib/storage-router.ts:
   - A function pickAccountForUpload(userId: string, fileSizeBytes: number) that: fetches all accounts for that user, refreshes quota for any account whose quota_checked_at is older than 10 minutes, filters to accounts with enough free space, and returns the one with the lowest (quota_used/quota_total) ratio. Throw a clear error if no account has room.

3. Create app/api/photos/upload/route.ts:
   - POST handler accepting a multipart file upload
   - Calls pickAccountForUpload to choose an account
   - Uses the Drive client for that account to upload the file (resumable upload if the file is large)
   - Inserts a row into the photos table with account_id, drive_file_id, filename, mime_type, size_bytes
   - Returns the created photo record as JSON

Include basic error handling and file size limits (reject anything over 50MB for now).
```

---

## Phase 5 — Background indexing worker

```
This is a Next.js 14 + TypeScript project. Existing pieces: lib/db.ts, lib/drive-client.ts (getDriveClient(accountId)), a `photos` table with columns for taken_at, gps_lat, gps_lng, camera_model, thumbnail_url, embedding (vector), indexed_at. Uses BullMQ + ioredis for background jobs (already installed), REDIS_URL is in env.

Goal: a background worker that processes newly uploaded/discovered photos — extracts EXIF metadata and a thumbnail. Skip embeddings for now (add a TODO comment — that's a later phase).

1. Create lib/queue.ts:
   - A BullMQ Queue instance named "photo-indexing" connected via REDIS_URL

2. Create workers/indexer.ts (standalone script, not inside app/ since this runs as a separate long-lived process, not a Next.js request):
   - A BullMQ Worker consuming the "photo-indexing" queue
   - For each job (payload: { photoId }): load the photo row, use getDriveClient to download the file (or fetch just enough for EXIF if possible), extract EXIF with the `exifr` package (date taken, GPS lat/lng, camera model), generate a thumbnail with `sharp` if needed, update the photos row with taken_at/gps_lat/gps_lng/camera_model/thumbnail_url/indexed_at
   - Log clearly on success/failure per job, and don't crash the whole worker process on a single file's error

3. Update app/api/photos/upload/route.ts to enqueue a "photo-indexing" job (with the new photo's id) right after inserting the photos row, instead of doing indexing inline

4. Add a package.json script "worker" that runs workers/indexer.ts with tsx or ts-node, so I can run it separately from `npm run dev`

Explain in a short README section how to run both processes locally (dev server + worker) at the same time.
```

---

## Phase 6 — Search API

```
This is a Next.js 14 App Router + TypeScript project. The `photos` table (Postgres + pgvector) has: user_id, account_id, filename, taken_at, gps_lat, gps_lng, camera_model, thumbnail_url, embedding (vector(512), currently unused/null for all rows — semantic search comes in a later phase, build for structured filtering only right now).

Goal: an API endpoint for browsing/filtering photos.

Create app/api/photos/route.ts:
- GET handler supporting query params: 
  - `startDate`, `endDate` (filter by taken_at range)
  - `accountId` (filter to one connected account)
  - `camera` (filter by camera_model, partial match)
  - `page`, `pageSize` (pagination, default pageSize 50)
- Queries the photos table for the hardcoded test user_id (same one used in earlier phases), applying whichever filters are present, ordered by taken_at DESC
- Returns { photos: [...], total: number, page, pageSize }

Keep the SQL parameterized (no string concatenation of user input) to avoid injection.
```

---

## Phase 7 — Frontend: browse & search UI

```
This is a Next.js 14 App Router + TypeScript + Tailwind CSS project. There's an existing API at GET /api/photos supporting startDate, endDate, accountId, camera, page, pageSize query params, returning { photos, total, page, pageSize }. Each photo object has: id, filename, taken_at, thumbnail_url, account_id, camera_model.

There's also GET-able account data (google_email) from the accounts table — assume an /api/accounts route exists returning a list of { id, google_email }; create it if it doesn't (simple SELECT from accounts for the test user).

Goal: build app/browse/page.tsx:
- A responsive photo grid (Tailwind, CSS grid, thumbnails)
- Filter controls above the grid: date range picker, a dropdown to filter by connected account (populated from /api/accounts), a text input for camera model
- Pagination controls at the bottom
- Loading and empty states
- Clicking a photo opens a simple modal/lightbox showing a larger preview and its metadata (taken date, camera, which account it's stored in)

Keep it a client component where needed (for filter state) but fetch data via the existing API route rather than direct DB access from the client.
```

---

## Notes for you (not for the agent)

- Fill in real values in `.env.local` yourself after Phase 1 — never paste real secrets into an agent prompt.
- Verify each phase actually runs (`npm run dev`, and for Phase 5 onward, `npm run worker` too) before moving to the next prompt.
- You'll need a Postgres instance with pgvector before Phase 2 does anything useful — Supabase or Neon (free tier) both support it; grab the connection string for `DATABASE_URL`.
- You'll need a Redis instance before Phase 5 — Upstash or Railway both have easy free tiers; grab the URL for `REDIS_URL`.
- Semantic (CLIP embedding) search isn't in these phases — that's a deliberate v2 addition once the structured version is working end to end.
