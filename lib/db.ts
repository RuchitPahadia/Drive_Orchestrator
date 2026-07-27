import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

declare global {
  var pgPool: Pool | undefined;
}

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });
} else {
  if (!global.pgPool) {
    global.pgPool = new Pool({
      connectionString,
      ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });
  }
  pool = global.pgPool;
}

/**
 * Execute a parameterized query against the Postgres database pool.
 * @param text The SQL query text.
 * @param params The query parameters.
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
