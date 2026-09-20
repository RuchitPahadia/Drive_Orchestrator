/**
 * @file lib/db.ts
 * @description PostgreSQL connection pool with hot-reload safety and parameterized query execution.
 * Maintains a global singleton pool during development to prevent connection exhaustion caused by
 * Next.js Hot Module Replacement (HMR).
 * @phase Phase 2: Database Schema & Client
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

// Extend NodeJS global to store the pg Pool singleton in development environments
declare global {
  var pgPool: Pool | undefined;
}

let pool: Pool;

// Production: Instantiate a clean single pool for the container/process lifecycle
if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    // Disable SSL for local database instances; enable with rejectUnauthorized: false for Supabase/Neon cloud instances
    ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });
} else {
  // Development: Use a global singleton so pool is preserved across Next.js fast-refresh cycles
  if (!global.pgPool) {
    global.pgPool = new Pool({
      connectionString,
      // Supabase uses self-signed/managed certificates requiring rejectUnauthorized: false
      ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });
  }
  pool = global.pgPool;
}

/**
 * Execute a parameterized query against the PostgreSQL database pool.
 * 
 * @template T - The expected row schema returned by the query.
 * @param text - The SQL query text with parameter placeholders ($1, $2, etc.).
 * @param params - Optional array of parameter values to inject safely.
 * @returns Promise resolving to the QueryResult containing returned rows.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export { pool };
