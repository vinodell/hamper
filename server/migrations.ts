import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { SqliteDatabase } from "./database.js";

export function applyMigrations(database: SqliteDatabase, directory: string) {
  const files = readdirSync(directory)
    .filter((name) => /^\d+_[\w-]+\.sql$/.test(name))
    .sort();
  if (!files.length) throw new Error("No database migrations found");
  const migrations = files.map((filename) => {
    const sql = readFileSync(path.join(directory, filename), "utf8");
    return {
      filename,
      sql,
      hash: createHash("sha256").update(sql).digest("hex"),
    };
  });
  database.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  const known = new Map(
    migrations.map((migration) => [migration.filename, migration.hash]),
  );
  for (const previous of database.connection
    .prepare("SELECT filename, sha256 FROM _migrations")
    .all()) {
    if (known.get(String(previous.filename)) !== previous.sha256)
      throw new Error(
        `Applied migration is missing or was modified: ${String(previous.filename)}`,
      );
  }
  const applied: string[] = [];
  for (const { filename, sql, hash } of migrations) {
    database.exec("BEGIN IMMEDIATE");
    try {
      const previous = database.connection
        .prepare("SELECT sha256 FROM _migrations WHERE filename = ?")
        .get(filename);
      if (previous) {
        if (previous.sha256 !== hash)
          throw new Error(`Applied migration was modified: ${filename}`);
      } else {
        database.exec(sql);
        database.connection
          .prepare("INSERT INTO _migrations (filename, sha256) VALUES (?, ?)")
          .run(filename, hash);
        applied.push(filename);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
  return { applied };
}
