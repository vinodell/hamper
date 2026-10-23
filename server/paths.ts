import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function canonicalPath(filename: string): string {
  if (existsSync(filename)) return realpathSync(filename);
  const parent = path.dirname(filename);
  return path.join(canonicalPath(parent), path.basename(filename));
}

export function assertPrivatePath(filename: string, publicDir: string) {
  const relative = path.relative(
    canonicalPath(path.resolve(publicDir)),
    canonicalPath(path.resolve(filename)),
  );
  if (
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  )
    throw new Error("Database and backup paths must remain outside PUBLIC_DIR");
}

export function applicationPaths(moduleUrl: string) {
  const appDirectory = fileURLToPath(new URL("../../", moduleUrl));
  const publicDir = path.resolve(
    appDirectory,
    process.env.PUBLIC_DIR ||
      (existsSync(path.join(appDirectory, "public/index.html"))
        ? "public"
        : "dist"),
  );
  const databasePath = path.resolve(
    appDirectory,
    process.env.DATABASE_PATH || "private/data.sqlite",
  );
  assertPrivatePath(databasePath, publicDir);
  return {
    appDirectory,
    publicDir,
    databasePath,
    migrationsDir: path.join(appDirectory, "server/migrations"),
  };
}
