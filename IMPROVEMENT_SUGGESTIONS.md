# Improvement Suggestions — Photo Orchestrator

Prioritized ideas for evolving the codebase, grounded in the audit findings and current best
practices for this stack (Next.js 16 App Router, NextAuth v5, PostgreSQL + pgvector, Google
Drive storage, BullMQ). Each item notes **impact**, **effort**, rationale, and a source where
relevant. Items marked _(speculative)_ are judgment calls, not verified needs.

Priorities assume the audit's security fixes on branch `cleanup/full-audit` are merged first.

---

## High impact / low–medium effort

### 1. Defense-in-depth authorization — never trust middleware alone
**Impact: High · Effort: Low**
The 2026 consensus is that the most common Next.js security incident is *relying on middleware
alone for authz*. This app already had a related gap (middleware matcher omitted `/api/admin`).
Keep the per-handler `getSessionUser()` / role checks as the source of truth (now standardized),
treat middleware purely as an optimization, and add a short test asserting each protected route
returns 401/403 unauthenticated. Source: [Next.js Security Best Practices (Authgear)](https://authgear.com/post/nextjs-security-best-practices/), [Handling Auth in Next.js 16 (Auth0)](https://auth0.com/blog/handling-auth-nextjs16-with-server-actions-middleware/).

### 2. Rate limiting on expensive + auth endpoints
**Impact: High · Effort: Low–Medium**
`/api/photos/search` and `/api/photos/upload` run CLIP inference / Drive I/O per call, and the
NextAuth credential endpoint is a brute-force surface. Add per-user/IP rate limiting (e.g.
`@upstash/ratelimit` with the existing Redis, or an in-memory limiter for single-instance).
Rationale: bounded cost + abuse resistance. Source: [Complete Next.js security guide 2026 (TurboStarter)](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices).

### 3. Promote `next-auth` off the beta pin
**Impact: High · Effort: Medium**
The entire auth layer rides on `next-auth@5.0.0-beta.32`. Track and move to the first stable v5
release; beta auth libraries carry elevated risk of unpatched issues and breaking changes. Gate
the upgrade behind the new auth tests.

### 4. Expand the test suite to the risky logic
**Impact: High · Effort: Medium**
The new vitest setup covers crypto, image validation, and pagination. Extend to the
storage-router selection/replication math and the embedding `normalize`/vector formatting
(inject a fake DB / factor the pure math out so it imports without `pg`/transformers). Add a
lightweight integration test against an ephemeral Postgres+pgvector (Testcontainers or a CI
service container) for the dedup, upload-transaction, and search queries.

---

## Medium impact

### 5. Batch/queue the long admin + sync loops (addresses audit M6)
**Impact: Medium · Effort: Medium**
`admin/actions` `trigger-indexing` and global `accounts/sync` iterate sequentially with `await`
under a 60s serverless cap, so large libraries time out mid-batch. Enqueue per-item jobs to the
existing BullMQ queue and return immediately with a job/batch id the UI can poll, instead of
doing the work in the request. This also removes the inline-indexing fallback's timeout risk.

### 6. Bake in verified database TLS
**Impact: Medium · Effort: Low**
The code now supports `DATABASE_CA_CERT` (verified TLS) with a fallback to unverified + warning.
Ship the managed provider's CA (Supabase/Neon publish one), set the env var in every environment,
and once confirmed, drop the `rejectUnauthorized: false` fallback entirely so unverified TLS is
impossible in production.

### 7. Structured logging + error tracking
**Impact: Medium · Effort: Low–Medium**
A minimal `lib/logger.ts` now exists. Point it at a structured JSON logger (pino) and wire an
error tracker (Sentry) so the generic client error messages (added in the audit) still have full
server-side context and alerting. Observability for the vector/index path is worthwhile too —
watch for sequential scans on the embedding table. Source: [Database Observability for AI Workloads (JusDB)](https://www.jusdb.com/blog/database-observability-ai-workloads-pgvector).

### 8. Tune pgvector HNSW for recall
**Impact: Medium · Effort: Low**
The index uses `m=16, ef_construction=64`. For 512-dim CLIP vectors, raising `ef_construction`
to ~128–200 improves recall at index-build cost, and `hnsw.ef_search` (default 40) can be set
per-query/session to trade recall for latency without rebuilding. Measure recall before/after on
a sample set. Sources: [pgvector RAG Architecture (markaicode)](https://markaicode.com/architecture/pgvector-rag-production/), [Tuning pgvector queries: probes, ef_search (postgresdba)](https://postgresdba.hashnode.dev/tuning-pgvector-queries-probes-efsearch-and-distance-functions), [Tuning pgvector Performance (ParadeDB)](https://www.paradedb.com/learn/postgresql/tuning-pgvector).

### 9. Compensating cleanup for orphaned Drive uploads _(speculative)_
**Impact: Medium · Effort: Medium**
Upload now writes `photos` + `photo_replicas` atomically, but if that transaction fails *after*
the Drive upload succeeded, the Drive files are orphaned. Add best-effort deletion of the
just-uploaded Drive files on transaction failure (or a periodic reconciliation job that removes
Drive files with no DB replica row).

### 10. Hybrid search (semantic + keyword) _(speculative)_
**Impact: Medium · Effort: Medium**
Combine the existing vector search with a GIN-indexed `tsvector` over filename/camera/EXIF text
so exact-term queries ("IMG_1234", a camera model) rank well alongside semantic matches. Common
production RAG/search pattern. Source: [pgvector RAG Architecture (markaicode)](https://markaicode.com/architecture/pgvector-rag-production/).

---

## Lower priority / polish

- **Thumbnails out of Postgres.** Base64 data-URI thumbnails live in the `photos` table and are
  returned in every browse/search row, bloating payloads and the DB. Serve them from object
  storage or a dedicated endpoint with caching. _(speculative — depends on scale)_
- **Prettier + format check in CI** for consistent style; the repo has none today.
- **CI `next build` gate** once confirmed buildable in CI (see PROJECT_REPORT — build was not
  verified in this pass).
- **Add a `LICENSE` file** (the README references MIT but none is committed), or remove the claim.
- **Remove/refresh stale agent docs** (`agents/context.md`, `agents/antigravity-build-prompts.md`)
  which contain outdated status, personal emails, and a schema that contradicts `db/schema.sql`.

---

_Research reflects sources available as of 2026-10-01; verify version-specific claims against
your installed dependency versions before acting._

