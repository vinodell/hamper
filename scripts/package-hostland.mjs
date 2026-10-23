import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const releaseDir = path.join(root, "release");
const staging = path.join(releaseDir, "hamper-hostland");
const archive = path.join(releaseDir, "hamper-hostland.zip");
for (const filename of [
  "dist/index.html",
  "build/server/start.js",
  "build/server/cli.js",
  "docs/hostland-migration.md",
])
  await access(path.join(root, filename)).catch(() => {
    throw new Error(`Missing ${filename}. Run npm run build before packaging.`);
  });

// Stage an explicit allowlist. Never copy .env.server, private data, backups or node_modules.
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(path.join(root, "dist"), path.join(staging, "public"), {
  recursive: true,
});
await cp(path.join(root, "build/server"), path.join(staging, "build/server"), {
  recursive: true,
});
await cp(
  path.join(root, "server/migrations"),
  path.join(staging, "server/migrations"),
  { recursive: true },
);
await cp(path.join(root, "server.js"), path.join(staging, "server.js"));
await cp(
  path.join(root, "scripts/create-password-hash.mjs"),
  path.join(staging, "create-password-hash.mjs"),
);
await cp(
  path.join(root, "docs/hostland-migration.md"),
  path.join(staging, "INSTALL.md"),
);
await cp(
  path.join(root, "server/schema.sql"),
  path.join(staging, "server/schema.sql"),
);
const example = (await readFile(path.join(root, ".env.server.example"), "utf8"))
  .replace("PUBLIC_DIR=./dist", "PUBLIC_DIR=./public")
  .replace(
    "node scripts/create-password-hash.mjs",
    "node create-password-hash.mjs",
  );
await writeFile(path.join(staging, ".env.server.example"), example);
await writeFile(
  path.join(staging, "package.json"),
  JSON.stringify(
    {
      name: "hamper-hostland",
      private: true,
      type: "commonjs",
      engines: { node: ">=22.13.0" },
      scripts: {
        start: "node server.js",
        "db:migrate":
          "node --env-file-if-exists=.env.server build/server/cli.js migrate",
        "db:import":
          "node --env-file-if-exists=.env.server build/server/cli.js import-d1",
        "db:backup":
          "node --env-file-if-exists=.env.server build/server/cli.js backup",
      },
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  path.join(staging, "build/server/package.json"),
  '{"type":"module"}\n',
);
await mkdir(path.join(staging, "private"), { recursive: true });
await mkdir(path.join(staging, "tmp"), { recursive: true });

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Release must not contain symlinks");
    if (entry.isDirectory()) files.push(...(await filesIn(filename)));
    else files.push(filename);
  }
  return files.sort();
}
const files = await filesIn(staging);
const hashes = {};
for (const filename of files) {
  const relative = path.relative(staging, filename).split(path.sep).join("/");
  if (
    /^(?:private\/|tmp\/)|(?:^|\/)\.env(?:\.|$)/.test(relative) &&
    relative !== ".env.server.example"
  )
    throw new Error(`Private file in release: ${relative}`);
  hashes[relative] = createHash("sha256")
    .update(await readFile(filename))
    .digest("hex");
}
await writeFile(
  path.join(staging, "release-manifest.json"),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), files: hashes },
    null,
    2,
  ) + "\n",
);
await rm(archive, { force: true });
execFileSync("zip", ["-q", "-r", archive, "."], { cwd: staging });
console.log(`Hostland release: ${archive}`);
console.log(`Reviewable files: ${staging}`);
console.log(
  "Includes no server secrets or database. Deployment remains manual.",
);
