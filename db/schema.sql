-- ============================================================================
-- Photo Orchestrator Database Schema (PostgreSQL + pgvector)
-- ============================================================================
-- Storage architecture:
-- 1. users: Application identity, RBAC roles, and replication policies.
-- 2. accounts: Connected Google Drive OAuth accounts with encrypted tokens & quota metrics.
-- 3. photos: Logical photo records, EXIF metadata, SHA-256 file hashes, and CLIP 512-d embeddings.
-- 4. photo_replicas: Physical copies of photos tracked across distinct Google Drive accounts.
-- ============================================================================

-- Enable pgvector extension for high-performance vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- Table 1: users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' NOT NULL, -- 'user' or 'admin'
    replication_factor INTEGER DEFAULT 2 NOT NULL, -- Configurable redundancy policy: copies per upload (1x, 2x, Nx)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- Table 2: accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    google_email TEXT NOT NULL,
    access_token TEXT NOT NULL, -- AES-256-GCM encrypted access token
    refresh_token TEXT NOT NULL, -- AES-256-GCM encrypted refresh token
    token_expiry TIMESTAMPTZ,
    quota_total_bytes BIGINT, -- Google Drive maximum allocated storage in bytes
    quota_used_bytes BIGINT, -- Google Drive consumed storage in bytes
    quota_checked_at TIMESTAMPTZ, -- Timestamp of last quota sync with Google Drive API
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- Table 3: photos (logical photo metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    taken_at TIMESTAMPTZ, -- Shutter capture timestamp parsed from EXIF DateTimeOriginal
    gps_lat DOUBLE PRECISION, -- Latitude coordinate from EXIF GPS IFD
    gps_lng DOUBLE PRECISION, -- Longitude coordinate from EXIF GPS IFD
    camera_model TEXT, -- Manufacturer + Model string parsed from EXIF
    thumbnail_url TEXT, -- Base64 data URI (300x300 JPEG) for client-side rendering
    embedding VECTOR(512), -- CLIP ViT-B/32 512-dimensional normalized float vector
    file_hash TEXT, -- SHA-256 hex digest of file bytes for instant pre-upload deduplication
    indexed_at TIMESTAMPTZ, -- Timestamp when background worker completed EXIF/embedding indexing
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------------------------------------------
-- Table 4: photo_replicas (physical file copies in separate accounts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photo_replicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    drive_file_id TEXT NOT NULL, -- Google Drive file ID corresponding to this physical copy
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(account_id, drive_file_id)
);

-- ============================================================================
-- Performance & Search Indexes
-- ============================================================================

-- HNSW index on photos.embedding for sub-millisecond CLIP semantic search (cosine similarity)
-- Enables query syntax: ORDER BY p.embedding <=> query_vector ASC
CREATE INDEX IF NOT EXISTS photos_embedding_hnsw_idx 
ON photos USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Composite B-tree index for chronologically sorted user galleries (ORDER BY taken_at DESC)
CREATE INDEX IF NOT EXISTS photos_user_taken_at_idx 
ON photos (user_id, taken_at DESC);

-- Fast foreign-key index for looking up physical replicas associated with a logical photo
CREATE INDEX IF NOT EXISTS photo_replicas_photo_id_idx 
ON photo_replicas (photo_id);

-- Composite B-tree index for instant SHA-256 pre-upload deduplication checks per user
CREATE INDEX IF NOT EXISTS photos_user_file_hash_idx 
ON photos (user_id, file_hash);
