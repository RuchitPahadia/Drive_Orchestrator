-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table 1: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table 2: accounts
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    google_email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMPTZ,
    quota_total_bytes BIGINT,
    quota_used_bytes BIGINT,
    quota_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table 3: photos (logical photo metadata)
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    taken_at TIMESTAMPTZ,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    camera_model TEXT,
    thumbnail_url TEXT,
    embedding VECTOR(512),
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table 4: photo_replicas (physical file copies in separate accounts)
CREATE TABLE IF NOT EXISTS photo_replicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    drive_file_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(account_id, drive_file_id)
);

-- Indexes
-- ivfflat index on photos.embedding for cosine similarity search
CREATE INDEX IF NOT EXISTS photos_embedding_cosine_idx ON photos USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Regular index on (user_id, taken_at DESC)
CREATE INDEX IF NOT EXISTS photos_user_taken_at_idx ON photos (user_id, taken_at DESC);

-- Index on photo_replicas for fast lookups by photo_id
CREATE INDEX IF NOT EXISTS photo_replicas_photo_id_idx ON photo_replicas (photo_id);
