-- Migration: retune the HNSW index for better recall on 512-d CLIP vectors.
--
-- Rebuilds photos_embedding_hnsw_idx with ef_construction=128 (was 64) and shows how to
-- raise the query-time ef_search knob. Run against an existing database that already has the
-- old index. REINDEX CONCURRENTLY avoids taking a long write lock, but cannot run inside a
-- transaction block — run these statements individually (not wrapped in BEGIN/COMMIT).
--
-- Because the WITH options differ, a plain REINDEX reuses the old options; drop & recreate:

DROP INDEX IF EXISTS photos_embedding_hnsw_idx;

CREATE INDEX photos_embedding_hnsw_idx
ON photos USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- Optional, recommended: raise query-time recall (default ef_search is 40).
-- Replace <db> with your database name (e.g. postgres on Supabase). Takes effect on new sessions.
--   ALTER DATABASE <db> SET hnsw.ef_search = 100;
-- Or per-session: SET hnsw.ef_search = 100;
