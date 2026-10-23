import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBackup } from "./backup.js";
import { importData } from "./data-import.js";
import { SqliteDatabase } from "./database.js";
import { applyMigrations } from "./migrations.js";
import { applicationPaths } from "./paths.js";

const usage =
  "Usage: node build/server/cli.js migrate | import-d1 <export.json|export.sql> | backup <private-backup.sqlite>";
const maximumImportBytes = 64 * 1024 * 1024;

export function runCli(args: string[]) {
  const environmentFile = fileURLToPath(
    new URL("../../.env.server", import.meta.url),
  );
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
  const [command, input, ...extra] = args;
  if (command === "--help" || command === "help") return { usage };
  if (
    extra.length ||
    (command === "migrate" && input) ||
    !["migrate", "import-d1", "backup"].includes(command) ||
    (command !== "migrate" && !input)
  )
    throw new Error(usage);
  const { databasePath, migrationsDir, publicDir } = applicationPaths(
    import.meta.url,
  );
  if (command !== "migrate" && !existsSync(databasePath))
    throw new Error("Database does not exist. Run npm run db:migrate first.");
  const database = new SqliteDatabase(databasePath);
  try {
    if (command === "migrate") return applyMigrations(database, migrationsDir);
    if (command === "backup")
      return { backup: createBackup(database, input, publicDir) };
    const file = path.resolve(input);
    const details = statSync(file);
    if (!details.isFile() || details.size > maximumImportBytes)
      throw new Error(
        "Import must be a regular JSON/SQL file of at most 64 MiB",
      );
    return importData(database, readFileSync(file, "utf8"));
  } finally {
    database.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    console.info(JSON.stringify(runCli(process.argv.slice(2))));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Database operation failed",
    );
    process.exitCode = 1;
  }
}
