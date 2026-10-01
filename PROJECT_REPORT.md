# Photo Orchestrator — Project Report

_Audit, cleanup, and verification performed 2026-10-01 on branch `cleanup/full-audit`
(13 commits, not pushed). This report states only what was verified; items that could not
be verified in this environment are called out explicitly._

---

## 1. Tech stack & architecture

A self-hosted photo manager that pools storage across multiple Google Drive accounts and adds
AI semantic search.

| Layer | Technology |
|---|---|
| Framework | Next.js **16.3.8** (App Router) + React **19.2.4**, TypeScript (strict) |
| Auth | NextAuth v5 (`5.0.0-beta.32`) — Google OAuth + dev-login (non-prod) |
| Database | PostgreSQL + **pgvector** (raw SQL via `pg`, no ORM); HNSW cosine index |
| Object storage | Google Drive (`googleapis`), N-way replication across accounts |
| AI | CLIP ViT-B/32 ONNX via `@huggingface/transformers` (local, 512-dim) |
| Jobs/queue | BullMQ + Redis (`ioredis`); inline `after()` fallback when Redis absent |
| Image/EXIF | `sharp`, `exifr` |
| Tests | **Vitest** (added in this audit) |
| Deploy | Docker (web + worker) + docker-compose; Vercel-aware config; CI (GitHub Actions) |

**Data flow:** upload/sync → store bytes in Google Drive (replicated) → record `photos` +
`photo_replicas` in Postgres → enqueue indexing (BullMQ) or run via `after()` → worker downloads,
extracts EXIF, builds a thumbnail, computes a CLIP embedding → writes it back → semantic/visual
search runs pgvector ANN queries.

**Tables:** `users` (RBAC role, replication_factor), `accounts` (Drive OAuth, AES-256-GCM
encrypted tokens, quota), `photos` (metadata, GPS, SHA-256 hash, base64 thumbnail, `vector(512)`),
`photo_replicas` (physical copies per account).

## 2. Module breakdown

**`lib/`** — `db.ts` (pg pool, parameterized `query()`, `withTransaction()`, TLS config);
`crypto.ts` (AES-256-GCM token encryption); `google-oauth.ts` (OAuth client + consent URL);
`drive-client.ts` (per-account Drive client with token refresh); `drive-scanner.ts` (differential
Drive ingest); `storage-router.ts` (capacity-aware account selection); `indexer.ts` (EXIF →
thumbnail → embedding pipeline); `embeddings.ts` (CLIP ONNX, vector formatting); `queue.ts`
(BullMQ queue + DLQ). **Added this audit:** `api-utils.ts` (auth/error helpers), `pagination.ts`
(pure limit parsing), `image-validation.ts` (magic-byte detection), `indexing-scheduler.ts`,
`logger.ts`.

**`app/api/`** — `auth/[...nextauth]`, `accounts` (list/delete), `accounts/connect`,
`accounts/callback`, `accounts/sync`, `photos` (browse), `photos/search`, `photos/similar`,
`photos/upload`, `admin/actions`, `users/settings`.

**Root/other** — `auth.ts`, `auth.config.ts`, `middleware.ts` (edge RBAC); `workers/`
(`indexer.ts`, `sync-worker.ts`); `app/` UI (`admin`, `browse`, `dashboard`, `login`);
`db/schema.sql`; `scripts/` (migration + manual phase smoke scripts).

---

## 3. Vulnerabilities & findings

Severity and status. **Fixed** = changed on this branch and verified at the stated level.
**Open** = not changed (needs your decision or further work).

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| C1 | Critical | `dev-login` granted admin to anyone in production; upsert escalated existing users | **Fixed** — gated to `NODE_ENV!=='production'`, no role escalation (`17fa258`) |
| C2 | Critical | Live secrets in `.env.local` (Google secret, DB password, token key, AUTH_SECRET) | **OPEN** — not committed / not in git history (verified), but live. **You must rotate them.** Not touched. |
| H1 | High | OAuth account-linking had no CSRF `state` | **Fixed (compile-verified)** — signed state cookie + constant-time check (`165888d`). Needs manual end-to-end test against live Google. |
| H2 | High | DB TLS used `rejectUnauthorized:false` (unauthenticated) | **Partially fixed** — verified TLS when `DATABASE_CA_CERT` is set; falls back to prior behavior + warning otherwise (`57fc5e4`). Set the CA to fully close it. |
| H3 | High | No automated tests; CI didn't build or test | **Fixed** — vitest + 19 tests + CI test step (`6d8fac8`, `6b42dad`). Build gate still open (see §5). |
| — | Critical | `next@16.3.5` RCE in `next/og` (GHSA-vcvr-r3jv-pc5j) | **Fixed** — `npm audit fix` → next **16.3.8**; `npm audit` now 0 vulns (`30c217e`) |
| M1 | Med | Middleware matcher omitted `/api/admin`, `/api/users` | **Fixed** (`17fa258`) |
| M2 | Med | Upload trusted client MIME; no content check | **Fixed** — magic-byte validation (`1c75ea3`) |
| M3 | Med | Raw `error.message` leaked to clients | **Fixed** — generic messages via `serverError()` across all routes (`1402efa`, `1c75ea3`) |
| M4 | Med | Upload DB writes not transactional | **Fixed** — `withTransaction()` wraps photo+replica inserts (`1c75ea3`) |
| M5 | Med | Detached `indexPhoto()` in request path (serverless-unsafe) | **Fixed** — scheduling moved to caller (`after()`/worker) (`3ed7123`) |
| M6 | Med | Sequential `await` loops under 60s cap time out on large libraries | **OPEN** — needs batching/queue redesign (see IMPROVEMENT_SUGGESTIONS #5) |
| M7 | Med | Duplicated auth guard / parseLimit / replica SQL | **Fixed** — shared helpers; unified LATERAL replica SQL (`1402efa`) |
| L1 | Low | `getDriveClient` not user-scoped (latent IDOR) | **OPEN** — safe today (all callers check ownership); hardening suggested |
| — | Low | No-op WASM thread config; minor over-exports | **OPEN** — harmless; left as-is to avoid untestable churn |
| — | Info | Stale `agents/*` docs with PII + schema contradicting code | **OPEN** — your notes; not deleted (flagged for your call) |
| — | Info | Root `AGENTS.md` prompt-injection block | **Left as-is** — verified genuine Next.js 16 tooling, re-added by `next dev` |

**Verified-safe (no action):** all SQL is parameterized (no injection); OAuth scope is
least-privilege (`drive.file`); AES-256-GCM token encryption is sound; no SSRF surface.

---

## 4. Cleanup changes (per commit)

```
1e4bd38  docs: add IMPROVEMENT_SUGGESTIONS.md
c1ce60e  docs: update README to match post-cleanup state
6b42dad  ci: run the unit test suite in CI
30c217e  fix(deps): npm audit fix — patch next RCE (GHSA-vcvr-r3jv-pc5j)
c79a0a7  chore: add .env.example template
6d8fac8  test: add vitest and unit tests (crypto, image validation, pagination)
3ed7123  fix(sync): serverless-safe background indexing for Drive sync (M5)
1c75ea3  fix(upload): validate image content and make DB writes atomic (M2, M4)
1402efa  refactor(api): standardize auth guards and generic error responses (M3, M7)
57fc5e4  feat(lib): DB TLS verification support, transaction helper, API utils, logger
165888d  fix(security): close OAuth account-linking CSRF (H1)
17fa258  fix(security): close dev-login admin bypass and widen middleware matcher
fb64bee  feat: serverless-safety hardening for Vercel deployment (pre-existing work)
```

---

## 5. Test & verification status

**Verified green:**
- `tsc --noEmit` — clean.
- `npm run lint` — 0 errors (1 pre-existing `<img>` warning in `app/dashboard/page.tsx`).
- `npm test` (Vitest) — **19 tests pass** across `tests/crypto.test.ts` (round-trip, tamper,
  format, unicode), `tests/image-validation.test.ts` (magic bytes per format + rejections),
  `tests/parse-limit.test.ts` (bounds/validation).

**NOT verified (could not run in this environment):**
- **`next build`** — started but **stopped by the harness under system memory pressure** (not a
  build failure, not re-run). The production build has **not** been confirmed on this branch.
  Run `npm run build` before deploying.
- **Live OAuth linking flow (H1)** — the `state` logic compiles and is unit-reasoned, but was not
  exercised against real Google credentials.
- **DB TLS against a real server (H2)** and **end-to-end upload/indexing** — require live
  services/secrets; not executed.
- No integration/E2E tests exist yet. The `scripts/test-phase*.ts` files are manual smoke scripts
  with no assertions — they are **not** a test suite.

---

## 6. Remaining TODOs / known issues

- **Rotate the four live secrets** in `.env.local` (C2) — highest-priority manual action.
- **Set `DATABASE_CA_CERT`** to enable verified DB TLS, then remove the unverified fallback (H2).
- **Manually test** the OAuth connect flow (H1) and run `next build` before deploying.
- **Batch the long sync/admin loops** (M6) to avoid serverless timeouts on large libraries.
- **Move `next-auth` off beta** once a stable v5 is available.
- **Clean up stale agent docs** (`agents/context.md`, `agents/antigravity-build-prompts.md`:
  outdated status, personal emails, schema that contradicts `db/schema.sql`) — left for your call.
- **Add a `LICENSE` file** (README referenced MIT; none committed).
- `graphify-out/` is regenerated by a local git hook on every commit; those working-tree changes
  were left unstaged throughout and are not part of this audit's commits.

See `IMPROVEMENT_SUGGESTIONS.md` for prioritized, sourced enhancement ideas.
