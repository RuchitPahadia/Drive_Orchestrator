# Photo Orchestrator

A Next.js 16 + TypeScript application that pools photo storage across multiple Google Drive accounts. It extracts EXIF metadata and generates thumbnails automatically in the background.

## Getting Started

### 1. Environment Setup
Create a `.env.local` file in the root of the project with the following variables:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/callback
DATABASE_URL=your_postgres_connection_string
REDIS_URL=your_redis_connection_string
TOKEN_ENCRYPTION_KEY=your_secure_32_byte_passphrase
```

### 2. Database Schema Setup
Apply the PostgreSQL schema defined in `db/schema.sql` to your Postgres instance (supporting `pgvector`) before running the application.

### 3. Running the Application Locally
To run the full flow (connecting accounts, uploading photos, and indexing metadata in the background), you need to run **two processes** at the same time:

#### Process 1: Next.js Development Server
Starts the web interface and API endpoints:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Process 2: Background Indexer Worker
Starts the BullMQ worker that listens for newly uploaded files, downloads them, extracts EXIF data, and generates thumbnails:
```bash
npm run worker
```

For local testing, we recommend opening two separate terminal windows inside the `photo-orchestrator` directory to run these commands side by side.