import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

// Create a connection pool to avoid opening a new connection for every query
export const pool = new pg.Pool({
  connectionString,
});

/**
 * Execute a query with parameters
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Keep logs simple and production-like
  console.log(`[DB Query] executed query in ${duration}ms (rows: ${res.rowCount})`);
  return res;
}
