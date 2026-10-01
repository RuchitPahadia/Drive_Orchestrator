/**
 * @file lib/db.ts
 * @description PostgreSQL connection pool with hot-reload safety and parameterized query execution.
 * Maintains a global singleton pool during development to prevent connection exhaustion caused by
 * Next.js Hot Module Replacement (HMR).
 * @phase Phase 2: Database Schema & Client
 */

import { Pool, QueryResult, QueryResultRow, PoolConfig } from 'pg';
import { existsSync, readFileSync } from 'fs';

const connectionString = process.env.DATABASE_URL;

// Extend NodeJS global to store the pg Pool singleton in development environments
declare global {
  var pgPool: Pool | undefined;
}

let pool: Pool;

const isLocalDb =
  connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1');

/**
 * Build the pg SSL configuration.
 *
 * @security Previously this used `rejectUnauthorized: false` for every remote
 * database, which encrypts the connection but does NOT authenticate the server
 * (vulnerable to MITM). We now prefer full verification when a CA certificate
 * is provided via `DATABASE_CA_CERT` (either an inline PEM string or a path to
 * a .pem/.crt file). If no CA is configured we fall back to the previous
 * behavior but emit a warning, so remote deployments keep working while being
 * nudged toward a verified TLS setup. Supabase/Neon publish a downloadable CA.
 */
function buildSslConfig(): PoolConfig['ssl'] {
  if (isLocalDb) return false;

  const caSource = process.env.DATABASE_CA_CERT;
  if (caSource) {
    let ca: string;
    if (caSource.includes('-----BEGIN')) {
      ca = caSource; // inline PEM content
    } else if (existsSync(caSource)) {
      ca = readFileSync(caSource, 'utf8'); // path to a PEM/CRT file
    } else {
      // Fail loud rather than silently passing a bad path to pg as if it were a PEM,
      // which would otherwise surface as an opaque TLS handshake error at connect time.
      throw new Error(
        `DATABASE_CA_CERT is set to "${caSource}" but no such file exists and it is not an inline PEM certificate.`
      );
    }
    return { ca, rejectUnauthorized: true };
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[db] DATABASE_CA_CERT is not set — TLS server certificate verification is DISABLED ' +
        '(rejectUnauthorized: false). Set DATABASE_CA_CERT to your database CA to enable verification.'
    );
  }
  return { rejectUnauthorized: false };
}

// Production: Instantiate a clean single pool for the container/process lifecycle
if (process.env.NODE_ENV === 'production') {
  pool = new Pool({ connectionString, ssl: buildSslConfig() });
} else {
  // Development: Use a global singleton so pool is preserved across Next.js fast-refresh cycles
  if (!global.pgPool) {
    global.pgPool = new Pool({ connectionString, ssl: buildSslConfig() });
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

/**
 * Run a set of queries inside a single transaction on one pooled client.
 * The callback receives a bound `query` function; the transaction is committed
 * if the callback resolves and rolled back if it throws. The client is always
 * released back to the pool.
 */
export async function withTransaction<R>(
  fn: (
    tx: <T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[]
    ) => Promise<QueryResult<T>>
  ) => Promise<R>
): Promise<R> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params as never[]));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] ROLLBACK failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
