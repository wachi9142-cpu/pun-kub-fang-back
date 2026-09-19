import { readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "./client";

const migrationsDir = path.join(import.meta.dir, "migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

for (const file of files) {
  const [existing] = await sql`
    SELECT name FROM schema_migrations WHERE name = ${file}
  `;
  if (existing) continue;

  const migration = await Bun.file(path.join(migrationsDir, file)).text();
  await sql.begin(async (tx) => {
    await tx.unsafe(migration);
    await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
  });
  console.info(`Applied ${file}`);
}

await sql.end();
console.info("Database is ready");
