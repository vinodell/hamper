import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { transformWithOxc } from "vite";
import { importServerModule } from "./server-test-loader.mjs";

const { SqliteDatabase } = await importServerModule("database.ts");
const { createApplication } = await importServerModule("http.ts");
const { applyMigrations } = await importServerModule("migrations.ts");
const { importData } = await importServerModule("data-import.ts");
const { createBackup } = await importServerModule("backup.ts");

function testAdminCookie() {
  const payload = `v1.${Math.floor(Date.now() / 1000) + 86400}.00000000-0000-4000-8000-000000000000`;
  const signature = createHmac("sha256", "test")
    .update(`hamper-admin-v1\ntest\ntest\n${payload}`)
    .digest("base64url");
  return `hamper_admin=${payload}.${signature}`;
}

test("migration command initializes an empty API database and can safely be repeated", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-migrate-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const migrationDir = path.join(directory, "migrations");
  await cp(new URL("../server/migrations/", import.meta.url), migrationDir, {
    recursive: true,
  });
  const DB = new SqliteDatabase(path.join(directory, "private/data.sqlite"));
  context.after(() => DB.close());
  assert.equal(applyMigrations(DB, migrationDir).applied.length, 5);
  assert.deepEqual(applyMigrations(DB, migrationDir).applied, []);
  const server = createApplication({
    env: { DB, ADMIN_LOGIN: "test", ADMIN_PASSWORD_HASH: "test" },
    publicDir: directory,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/health`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("a legacy JSON export is normalized and keeps all public sales metadata", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-import-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const DB = new SqliteDatabase(":memory:");
  context.after(() => DB.close());
  applyMigrations(
    DB,
    new URL("../server/migrations/", import.meta.url).pathname,
  );
  const source = {
    plots: [
      {
        id: "1-01",
        settlement: "Ойнеловские дали",
        area: "7.00 сот.",
        price: "1 500 000 ₽",
        fullPaymentPrice: "1 200 000 ₽",
        status: "Свободен",
        street: "Лесная",
        description: "Лес; рядом",
        cadastralNumber: "47:07:1044001:123",
        gpzuDone: true,
        buildingPermitDone: false,
        mortgageUrl: "https://domclick.ru/card/migration-test",
        updatedAt: "2026-10-20 12:34:56",
      },
    ],
    settings: { promotion: { enabled: false, discountPercent: 15 } },
  };
  assert.equal(importData(DB, JSON.stringify(source)).plots, 1);
  const server = createApplication({
    env: { DB, ADMIN_LOGIN: "test", ADMIN_PASSWORD_HASH: "test" },
    publicDir: directory,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const [plot] = await (await fetch(origin + "/api/plots")).json();
  assert.equal(plot.area, "7.00");
  assert.equal(plot.price, "1500000");
  assert.equal(plot.fullPaymentPrice, "1200000");
  assert.equal(plot.cadastralNumber, "47:07:1044001:123");
  assert.equal(plot.gpzuDone, true);
  assert.equal(plot.buildingPermitDone, false);
  assert.equal(plot.mortgageUrl, "https://domclick.ru/card/migration-test");
  const [adminPlot] = await (
    await fetch(origin + "/api/admin/plots", {
      headers: { Cookie: testAdminCookie() },
    })
  ).json();
  assert.equal(adminPlot.street, "Лесная");
  assert.equal(adminPlot.updatedAt, "2026-10-20 12:34:56");
  assert.deepEqual(
    await (await fetch(origin + "/api/settings")).json(),
    source.settings,
  );
  assert.throws(
    () => importData(DB, JSON.stringify(source)),
    /not empty|already imported/i,
  );
});

test("D1 SQL exports preserve column order and quoted semicolons while control statements stay isolated", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-sql-import-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const DB = new SqliteDatabase(":memory:");
  context.after(() => DB.close());
  applyMigrations(
    DB,
    new URL("../server/migrations/", import.meta.url).pathname,
  );
  const sql = `-- Export comment; not a statement
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;
    CREATE TABLE "plots" (description TEXT, price TEXT, id TEXT PRIMARY KEY, settlement TEXT, status TEXT, area TEXT, full_payment_price TEXT, gpzu_done INTEGER, building_permit_done INTEGER, cadastral_number TEXT, mortgage_url TEXT, street TEXT, updated_at TEXT);
    INSERT INTO "plots" VALUES('Лес; О''Нил', '1 500 000 ₽', 'sql-1', 'Ойнеловские дали', 'Забронирован', '7.00 сот.', '1200000', 1, 0, '47:07:1044001:123', 'https://domclick.ru/card/sql-test', 'Лесная', '2026-10-20 12:34:56');
    CREATE TABLE site_settings (id INTEGER, promotion_enabled INTEGER, promotion_discount_percent INTEGER);
    INSERT INTO site_settings VALUES(1, 0, 18);
    CREATE TABLE _cf_KV (key TEXT);
    INSERT INTO _cf_KV VALUES('ignored');
    ATTACH DATABASE '/must-not-be-created.sqlite' AS external;
    COMMIT;`;
  assert.equal(importData(DB, sql).plots, 1);
  const server = createApplication({
    env: { DB, ADMIN_LOGIN: "test", ADMIN_PASSWORD_HASH: "test" },
    publicDir: directory,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const [plot] = await (await fetch(origin + "/api/plots")).json();
  assert.equal(plot.id, "sql-1");
  assert.equal(plot.status, "Забронирован");
  assert.equal(plot.description, "Лес; О'Нил");
  assert.equal(plot.fullPaymentPrice, "1200000");
  assert.equal(plot.gpzuDone, true);
  assert.equal(plot.mortgageUrl, "https://domclick.ru/card/sql-test");
  assert.deepEqual(await (await fetch(origin + "/api/settings")).json(), {
    promotion: { enabled: false, discountPercent: 18 },
  });
});

test("a private SQLite backup restores a stable API snapshot and refuses overwrite or public paths", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-backup-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const DB = new SqliteDatabase(path.join(directory, "source.sqlite"));
  context.after(() => DB.close());
  applyMigrations(
    DB,
    new URL("../server/migrations/", import.meta.url).pathname,
  );
  const source = {
    plots: [
      {
        id: "snapshot-1",
        settlement: "Ойнеловские дали",
        area: "8",
        price: "1500000",
        status: "Свободен",
      },
    ],
    settings: { promotion: { enabled: false, discountPercent: 20 } },
  };
  importData(DB, JSON.stringify(source));
  const destination = path.join(directory, "backups/snapshot.sqlite");
  createBackup(DB, destination, path.join(directory, "public"));
  assert.throws(
    () => createBackup(DB, destination, path.join(directory, "public")),
    /exist|overwrite/i,
  );
  assert.throws(
    () =>
      createBackup(
        DB,
        path.join(directory, "public/exposed.sqlite"),
        path.join(directory, "public"),
      ),
    /outside|public/i,
  );
  DB.exec(
    "UPDATE plots SET status = 'Продан'; UPDATE site_settings SET promotion_discount_percent = 99;",
  );
  const restored = new SqliteDatabase(destination);
  context.after(() => restored.close());
  const server = createApplication({
    env: { DB: restored, ADMIN_LOGIN: "test", ADMIN_PASSWORD_HASH: "test" },
    publicDir: directory,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const [plot] = await (await fetch(origin + "/api/plots")).json();
  assert.equal(plot.status, "Свободен");
  assert.deepEqual(
    await (await fetch(origin + "/api/settings")).json(),
    source.settings,
  );
});

test("migration checksums reject changed history and failed DDL is rolled back before retry", async (context) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "hamper-migration-ledger-"),
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL("../server/migrations/", import.meta.url), directory, {
    recursive: true,
  });
  const DB = new SqliteDatabase(":memory:");
  context.after(() => DB.close());
  applyMigrations(DB, directory);
  const initial = path.join(directory, "0000_initial.sql");
  const original = await readFile(initial, "utf8");
  await writeFile(initial, original + "\n-- changed history\n");
  assert.throws(() => applyMigrations(DB, directory), /modified/);
  await writeFile(initial, original);
  const pending = path.join(directory, "0004_atomic_probe.sql");
  await writeFile(
    pending,
    "CREATE TABLE relocation_probe (id INTEGER); INVALID SQL;",
  );
  assert.throws(() => applyMigrations(DB, directory), /syntax/);
  await writeFile(pending, "CREATE TABLE relocation_probe (id INTEGER);");
  assert.deepEqual(applyMigrations(DB, directory).applied, [
    "0004_atomic_probe.sql",
  ]);
  await rm(pending);
  assert.throws(() => applyMigrations(DB, directory), /missing/);
});

test("compiled migration/import/backup CLI commands work in the standalone Hostland release", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "build/server"), { recursive: true });
  await writeFile(path.join(directory, "package.json"), '{"type":"commonjs"}');
  await writeFile(
    path.join(directory, "build/server/package.json"),
    '{"type":"module"}',
  );
  await cp(
    new URL("../server/migrations/", import.meta.url),
    path.join(directory, "server/migrations"),
    { recursive: true },
  );
  for (const name of [
    "cli",
    "migrations",
    "data-import",
    "backup",
    "database",
    "paths",
    "api",
    "constants",
  ]) {
    const source = await readFile(
      new URL(`../server/${name}.ts`, import.meta.url),
      "utf8",
    );
    const { code } = await transformWithOxc(source, `${name}.ts`);
    await writeFile(path.join(directory, `build/server/${name}.js`), code);
  }
  const run = (...args) =>
    spawnSync(process.execPath, ["build/server/cli.js", ...args], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_CHAT_ID: "",
        DATABASE_PATH: "./private/data.sqlite",
        PUBLIC_DIR: "./public",
      },
    });
  const migration = run("migrate");
  assert.equal(migration.status, 0, migration.stderr);
  assert.equal(JSON.parse(migration.stdout).applied.length, 5);
  assert.deepEqual(JSON.parse(run("migrate").stdout).applied, []);
  const source = path.join(directory, "export.json");
  await writeFile(
    source,
    JSON.stringify({
      plots: [
        {
          id: "cli-1",
          settlement: "Ойнеловские дали",
          area: "8",
          price: "1500000",
          status: "Свободен",
        },
      ],
      settings: { promotion: { enabled: true, discountPercent: 12 } },
    }),
  );
  const imported = run("import-d1", source);
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(JSON.parse(imported.stdout).plots, 1);
  assert.equal(run("import-d1", source).status, 1);
  const backup = path.join(directory, "backups/cli.sqlite");
  const saved = run("backup", backup);
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(saved.stdout).backup, backup);
  assert.equal(run("backup", backup).status, 1);
});

test("malformed or failed imports leave both plots and promotion untouched and can be retried", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-import-atomic-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const DB = new SqliteDatabase(":memory:");
  context.after(() => DB.close());
  applyMigrations(
    DB,
    new URL("../server/migrations/", import.meta.url).pathname,
  );
  const server = createApplication({
    env: { DB, ADMIN_LOGIN: "test", ADMIN_PASSWORD_HASH: "test" },
    publicDir: directory,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const plot = {
    settlement: "Ойнеловские дали",
    area: "8",
    price: "1500000",
    status: "Свободен",
  };
  const source = {
    plots: [
      { ...plot, id: "atomic-1" },
      { ...plot, id: "atomic-2" },
    ],
    settings: { promotion: { enabled: false, discountPercent: 21 } },
  };
  const invalid = structuredClone(source);
  invalid.plots[1].price = "malformed";
  assert.throws(() => importData(DB, JSON.stringify(invalid)), /Некорректные/);
  DB.exec(
    "CREATE TRIGGER import_storage_failure BEFORE INSERT ON plots WHEN NEW.id = 'atomic-2' BEGIN SELECT RAISE(ABORT, 'test storage failure'); END;",
  );
  assert.throws(
    () => importData(DB, JSON.stringify(source)),
    /test storage failure/,
  );
  assert.deepEqual(await (await fetch(origin + "/api/plots")).json(), []);
  assert.deepEqual(await (await fetch(origin + "/api/settings")).json(), {
    promotion: { enabled: true, discountPercent: 10 },
  });
  DB.exec("DROP TRIGGER import_storage_failure;");
  assert.equal(importData(DB, JSON.stringify(source)).plots, 2);
  assert.equal((await (await fetch(origin + "/api/plots")).json()).length, 2);
  assert.deepEqual(
    await (await fetch(origin + "/api/settings")).json(),
    source.settings,
  );
});
