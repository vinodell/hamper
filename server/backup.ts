import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import type { SqliteDatabase } from "./database.js";
import { assertPrivatePath } from "./paths.js";

export function createBackup(
  database: SqliteDatabase,
  filename: string,
  publicDir: string,
) {
  const destination = path.resolve(filename);
  assertPrivatePath(destination, publicDir);
  if (existsSync(destination))
    throw new Error("Backup already exists; refusing to overwrite it");
  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${randomUUID()}.tmp`,
  );
  try {
    // VACUUM INTO obtains a consistent snapshot, including committed WAL data.
    // Publish using an exclusive hard link so even a racing destination is safe.
    database.connection.prepare("VACUUM INTO ?").run(temporary);
    chmodSync(temporary, 0o600);
    linkSync(temporary, destination);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  return destination;
}
