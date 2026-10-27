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
const generatedAt = new Date();
const timeZone = "Europe/Moscow";
const dateParts = Object.fromEntries(
  new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(generatedAt)
    .map(({ type, value }) => [type, value]),
);
const creationDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
const creationTime = `${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
const generatedAtMoscow = `${creationDate} ${creationTime} MSK`;
const archiveStamp = `${creationDate}_${creationTime.replaceAll(":", "-")}_MSK`;
const staging = path.join(releaseDir, "hamper-hostland");
const archive = path.join(releaseDir, `hamper-hostland_${archiveStamp}.zip`);
const updateStaging = path.join(releaseDir, "hamper-public-update");
const updateArchive = path.join(
  releaseDir,
  `hamper-public-update_${archiveStamp}.zip`,
);
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
        db: "node --env-file-if-exists=.env.server build/server/cli.js",
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
async function writeManifest(directory) {
  const hashes = {};
  for (const filename of await filesIn(directory)) {
    const relative = path
      .relative(directory, filename)
      .split(path.sep)
      .join("/");
    if (
      /(?:^|\/)(?:private|tmp|backups|node_modules)(?:\/|$)/i.test(relative) ||
      (/(?:^|\/)\.env(?:\.|$)/i.test(relative) &&
        relative !== ".env.server.example") ||
      /\.(?:db|sqlite3?)(?:-(?:wal|shm|journal))?$/i.test(relative) ||
      /(?:^|\/)DJI[^/]*\.(?:jpe?g|heic|dng)$/i.test(relative)
    )
      throw new Error(`Private or source file in release: ${relative}`);
    hashes[relative] = createHash("sha256")
      .update(await readFile(filename))
      .digest("hex");
  }
  await writeFile(
    path.join(directory, "release-manifest.json"),
    JSON.stringify(
      {
        generatedAt: generatedAt.toISOString(),
        generatedAtMoscow,
        timeZone,
        files: hashes,
      },
      null,
      2,
    ) + "\n",
  );
  return hashes;
}

await rm(updateStaging, { recursive: true, force: true });
await mkdir(updateStaging, { recursive: true });
await cp(path.join(staging, "public"), path.join(updateStaging, "public"), {
  recursive: true,
});
await writeFile(
  path.join(updateStaging, "UPDATE.md"),
  `# Обновление клиентской части Хампер

Архив предназначен для уже работающего Node.js-приложения на Hostland.
Он содержит только public/ и не обновляет API, базу или настройки сервера.

1. Сохраните резервную копию текущей public/ вне публичного каталога сайта.
2. Загрузите новую public/ из архива и замените старую папку целиком, сохраняя
   скрытый файл .htaccess. Не объединяйте содержимое: останутся старые JS/CSS.
   Если панель позволяет, подготовьте новую папку рядом и переключите её
   переименованием; иначе замените public/ в период небольшой посещаемости.
3. Проверьте главную, Ойнеловские дали, фотографии, /admin/ и /api/health.
   Для отката верните сохранённую public/ на её прежнее место.

Не заменяйте .env.server, private/, базу, build/server/ и серверные файлы.
Миграция и импорт данных для обновления только клиентской части не нужны.
release-manifest.json содержит SHA-256 файлов архива; его и эту инструкцию
не нужно загружать в public/.
`,
);
const archives = [];
for (const [directory, filename] of [
  [staging, archive],
  [updateStaging, updateArchive],
]) {
  const hashes = await writeManifest(directory);
  await rm(filename, { force: true });
  execFileSync("zip", ["-q", "-r", filename, "."], { cwd: directory });
  const contents = await readFile(filename);
  const filenames = Object.keys(hashes);
  archives.push({
    archive: path.basename(filename),
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
    manifestFiles: filenames.length,
    publicFiles: filenames.filter((file) => file.startsWith("public/")).length,
  });
  console.log(`Hostland release: ${filename}`);
  console.log(`Reviewable files: ${directory}`);
}
await writeFile(
  path.join(releaseDir, "verification.json"),
  JSON.stringify(
    {
      generatedAt: generatedAt.toISOString(),
      generatedAtMoscow,
      timeZone,
      archives,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  path.join(releaseDir, "README.md"),
  `# Актуальный релиз Хампер

Создан: **${generatedAtMoscow}** (${timeZone}).

- [${path.basename(archive)}](${path.basename(archive)}) — полное Node.js-приложение и клиент. Инструкция внутри: INSTALL.md.
- [${path.basename(updateArchive)}](${path.basename(updateArchive)}) — только обновление public/ работающего сайта. Инструкция внутри: UPDATE.md.
- verification.json — дата создания, размеры и SHA-256 архивов.
- hamper-hostland/ и hamper-public-update/ — распакованные версии для review.
- review/ — сохранённые снимки интерфейса и отчёты проверок.
- hostland-data-*/ и hostland-initial/ — отдельные выгрузки данных; в ZIP они не входят.

Для обновления только интерфейса сохраните копию старой public/ вне публичного каталога сайта и замените public/ целиком из public-update, включая .htaccess. Не создавайте public/public/.
Настройки .env.server и рабочую базу сохраняйте при любом обновлении. Для изменений API используйте полный архив и INSTALL.md.

Упаковщик удаляет предыдущие архивы этих двух типов после создания обоих новых. Выгрузки данных и review сохраняются.
Публикация, commit и push автоматически не выполняются.
`,
);

// Remove only archives produced by this packager, after both new ZIPs exist.
const currentArchiveNames = archives.map(({ archive }) => archive);
const generatedArchivePattern =
  /^hamper-(?:hostland|public-update)(?:_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_MSK)?\.zip$/;
for (const entry of await readdir(releaseDir, { withFileTypes: true })) {
  if (
    entry.isFile() &&
    generatedArchivePattern.test(entry.name) &&
    !currentArchiveNames.includes(entry.name)
  )
    await rm(path.join(releaseDir, entry.name));
}
console.log(
  "Includes no server secrets or database. Deployment remains manual.",
);
