/**
 * Applies sql/*.sql in lexical order against DATABASE_URL.
 * Usage: DATABASE_URL=... node --import tsx scripts/migrate.ts
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "..", "sql");

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const files = (await readdir(sqlDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    for (const f of files) {
      const path = join(sqlDir, f);
      const sql = await readFile(path, "utf8");
      console.error(`Applying ${f} ...`);
      await client.query(sql);
    }
    console.error("Migrate OK:", files.join(", "));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
