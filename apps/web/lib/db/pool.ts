import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  const cs = process.env.DATABASE_URL?.trim();
  if (!cs) return null;
  if (!pool) pool = new Pool({ connectionString: cs, max: 10 });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
