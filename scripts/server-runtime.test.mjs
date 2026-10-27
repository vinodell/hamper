import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { transformWithOxc } from "vite";
import { importServerModule } from "./server-test-loader.mjs";

const { SqliteDatabase } = await importServerModule("database.ts");
const { createApplication } = await importServerModule("http.ts");
const schema = await readFile(
  new URL("../server/schema.sql", import.meta.url),
  "utf8",
);

function chunkedRequest(url, chunks) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Transfer-Encoding": "chunked",
          "Content-Type": "application/json",
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () =>
          resolve({ status: response.statusCode, text }),
        );
      },
    );
    request.once("error", reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

function passengerProcess(
  directory,
  { telegram = false, cwd = directory, env = {} } = {},
) {
  const environment = { ...process.env };
  for (const key of [
    "ADMIN_LOGIN",
    "ADMIN_PASSWORD_HASH",
    "SESSION_SECRET",
    "PUBLIC_ORIGIN",
    "PUBLIC_DIR",
    "DATABASE_PATH",
    "HOST",
    "PORT",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "NODE_OPTIONS",
  ])
    delete environment[key];
  const script = [
    "process.stdin.resume();",
    telegram && "globalThis.fetch = async () => Response.json({ok:true});",
    "require(process.argv[1]);",
  ]
    .filter(Boolean)
    .join(" ");
  return spawn(
    process.execPath,
    ["-e", script, path.join(directory, "server.js")],
    {
      cwd,
      env: {
        ...environment,
        PORT: "0",
        TELEGRAM_BOT_TOKEN: telegram ? "123456:synthetic-test-token" : "",
        TELEGRAM_CHAT_ID: telegram ? "-100000000000" : "",
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

async function startPassengerFixture(
  directory,
  telegram = false,
  options = {},
) {
  const child = passengerProcess(directory, { telegram, ...options });
  const origin = await new Promise((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Passenger bootstrap timed out: " + output + errors));
    }, 10_000);
    child.stderr.on("data", (data) => {
      errors += data;
    });
    child.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/listening on (\d+);/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Passenger bootstrap exited ${code}: ${errors}`));
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  return {
    origin,
    async close() {
      if (child.exitCode !== null) return;
      const ended = once(child, "exit");
      child.stdin.end();
      child.kill("SIGTERM");
      await ended;
    },
  };
}

async function fixture(context) {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-runtime-"));
  const publicDir = path.join(directory, "public");
  await mkdir(publicDir);
  await writeFile(
    path.join(publicDir, "index.html"),
    "<!doctype html><title>Hamper</title>",
  );
  const databasePath = path.join(directory, "private.sqlite");
  const DB = new SqliteDatabase(databasePath);
  DB.exec(schema);
  const env = {
    DB,
    ADMIN_LOGIN: "runtime-test-admin",
    ADMIN_PASSWORD_HASH: "runtime-test-hash",
    PUBLIC_ORIGIN: "https://site.test",
  };
  const server = createApplication({ env, publicDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    DB.close();
    await rm(directory, { recursive: true, force: true });
  });
  const payload = `v1.${Math.floor(Date.now() / 1000) + 86400}.00000000-0000-4000-8000-000000000000`;
  const signature = createHmac("sha256", env.ADMIN_PASSWORD_HASH)
    .update(
      `hamper-admin-v1\n${env.ADMIN_LOGIN}\n${env.ADMIN_PASSWORD_HASH}\n${payload}`,
    )
    .digest("base64url");
  return {
    directory,
    publicDir,
    DB,
    server,
    origin,
    async request(url, options = {}) {
      return fetch(origin + url, {
        ...options,
        headers: {
          Origin: env.PUBLIC_ORIGIN,
          Cookie: `hamper_admin=${payload}.${signature}`,
          ...options.headers,
        },
      });
    },
  };
}

test("same-origin HTTP API saves a plot and publishes its optional sales fields", async (context) => {
  const { request } = await fixture(context);
  const saved = await request("/api/admin/plots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "hostland-1",
      area: "8",
      price: "1500000",
      fullPaymentPrice: "1200000",
      status: "Свободен",
      gpzuDone: true,
      mortgageUrl: "https://domclick.ru/card/hostland-test",
    }),
  });
  assert.equal(saved.status, 201);
  const published = await request("/api/plots");
  assert.equal(published.status, 200);
  const [plot] = await published.json();
  assert.equal(plot.id, "hostland-1");
  assert.equal(plot.fullPaymentPrice, "1200000");
  assert.equal(plot.gpzuDone, true);
  assert.equal(plot.mortgageUrl, "https://domclick.ru/card/hostland-test");
});

test("HTML navigation revalidates while hashed static assets support gzip and conditional requests", async (context) => {
  const { publicDir, request } = await fixture(context);
  await mkdir(path.join(publicDir, "assets"));
  const contents = "/* local bundle */".repeat(300);
  await writeFile(path.join(publicDir, "assets/app-abcd1234.js"), contents);
  const navigation = await request("/projects/oynelovskie-dali/", {
    headers: { Accept: "text/html" },
  });
  assert.equal(navigation.status, 200);
  assert.equal(navigation.headers.get("cache-control"), "no-cache");
  assert.match(await navigation.text(), /<title>Hamper<\/title>/);
  const asset = await request("/assets/app-abcd1234.js", {
    headers: { "Accept-Encoding": "gzip" },
  });
  assert.equal(asset.status, 200);
  assert.equal(
    asset.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
  assert.equal(asset.headers.get("content-encoding"), "gzip");
  assert.equal(await asset.text(), contents);
  const unchanged = await request("/assets/app-abcd1234.js", {
    headers: { "If-None-Match": asset.headers.get("etag") },
  });
  assert.equal(unchanged.status, 304);
  const wildcard = await request("/assets/app-abcd1234.js", {
    headers: { "If-None-Match": "*" },
  });
  assert.equal(wildcard.status, 304);
});

test("static routing keeps API errors, private files and escaped symlinks out of the SPA", async (context) => {
  const { publicDir, directory, request } = await fixture(context);
  await writeFile(path.join(publicDir, ".env.server"), "PRIVATE_ENV_SECRET");
  await writeFile(path.join(publicDir, "database.sqlite"), "PRIVATE_DB_SECRET");
  await writeFile(
    path.join(directory, "outside.txt"),
    "PRIVATE_OUTSIDE_SECRET",
  );
  await symlink(
    path.join(directory, "outside.txt"),
    path.join(publicDir, "outside.txt"),
  );
  await symlink(
    path.join(publicDir, ".env.server"),
    path.join(publicDir, "inside.txt"),
  );
  for (const url of [
    "/.env.server",
    "/database.sqlite",
    "/outside.txt",
    "/inside.txt",
    "/%2eenv.server",
    "/assets/missing.js",
    "/api/unknown",
  ]) {
    const response = await request(url, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 404, url);
    assert.match(
      response.headers.get("content-type"),
      /application\/json/,
      url,
    );
    assert.doesNotMatch(await response.text(), /PRIVATE_|<title>/, url);
  }
  const missingData = await request("/missing-data");
  assert.equal(missingData.status, 404);
  const mutation = await request("/projects/example", { method: "POST" });
  assert.equal(mutation.status, 405);
  const head = await request("/index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("HTTP enforces body limits for both declared and chunked requests while permitting bulk updates", async (context) => {
  const { origin, request } = await fixture(context);
  const oversized = await request("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "x".repeat(40 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  const chunked = await chunkedRequest(origin + "/api/contact", [
    "{",
    " ".repeat(20 * 1024),
    " ".repeat(20 * 1024),
    "}",
  ]);
  assert.equal(chunked.status, 413);
  assert.match(chunked.text, /Слишком большой/);
  const plot = {
    id: "bulk-1",
    area: "8",
    price: "1500000",
    status: "Свободен",
  };
  assert.equal(
    (
      await request("/api/admin/plots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plot),
      })
    ).status,
    201,
  );
  const bulk = await request("/api/admin/plots", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plots: [{ ...plot, status: "Забронирован" }],
      padding: "x".repeat(100 * 1024),
    }),
  });
  assert.equal(bulk.status, 200);
  const [updated] = await (await request("/api/plots")).json();
  assert.equal(updated.status, "Забронирован");
});

test("failed bulk persistence rolls back earlier plot changes instead of publishing a partial update", async (context) => {
  const { DB, request } = await fixture(context);
  const plot = { area: "8", price: "1500000", status: "Свободен" };
  for (const id of ["atomic-1", "atomic-2"]) {
    assert.equal(
      (
        await request("/api/admin/plots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...plot, id }),
        })
      ).status,
      201,
    );
  }
  // Emulate a storage constraint discovered only during the second update.
  DB.exec(
    "CREATE TRIGGER test_storage_constraint BEFORE UPDATE ON plots WHEN NEW.id = 'atomic-2' BEGIN SELECT RAISE(ABORT, 'test storage constraint'); END;",
  );
  const bulk = await request("/api/admin/plots", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plots: ["atomic-1", "atomic-2"].map((id) => ({
        ...plot,
        id,
        status: "Забронирован",
      })),
    }),
  });
  assert.equal(bulk.status, 500);
  const visible = await (await request("/api/plots")).json();
  assert.deepEqual(
    visible.map(({ id, status }) => ({ id, status })),
    [
      { id: "atomic-1", status: "Свободен" },
      { id: "atomic-2", status: "Свободен" },
    ],
  );
});

async function passengerFixture(context) {
  const directory = await mkdtemp(path.join(tmpdir(), "hamper-passenger-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "build/server"), { recursive: true });
  await mkdir(path.join(directory, "public"));
  await writeFile(
    path.join(directory, "public/index.html"),
    "<!doctype html><title>Hostland</title>",
  );
  await writeFile(path.join(directory, "package.json"), '{"type":"commonjs"}');
  await writeFile(
    path.join(directory, "build/server/package.json"),
    '{"type":"module"}',
  );
  const sourceRoot = new URL("../", import.meta.url);
  await writeFile(
    path.join(directory, "server.js"),
    await readFile(new URL("server.js", sourceRoot)),
  );
  for (const name of [
    "start",
    "http",
    "api",
    "plotValidation",
    "validation",
    "constants",
    "database",
    "paths",
    "telegram",
  ]) {
    const source = await readFile(
      new URL(`server/${name}.ts`, sourceRoot),
      "utf8",
    );
    const { code } = await transformWithOxc(source, `${name}.ts`);
    await writeFile(path.join(directory, `build/server/${name}.js`), code);
  }
  await writeFile(
    path.join(directory, ".env.server"),
    [
      "ADMIN_LOGIN=passenger-admin",
      "ADMIN_PASSWORD_HASH=passenger-test-hash",
      "SESSION_SECRET=passenger-test-session-secret-at-least-32-characters",
      "PUBLIC_ORIGIN=https://site.test",
    ].join("\n"),
  );
  const DB = new SqliteDatabase(path.join(directory, "private/data.sqlite"));
  DB.exec(schema);
  DB.close();
  return directory;
}

async function assertPassengerFailure(context, child, expectedError) {
  context.after(() => child.kill("SIGKILL"));
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += data;
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 1500);
  const [code, signal] = await once(child, "exit");
  clearTimeout(timeout);
  assert.match(errors, expectedError);
  assert.equal(
    signal,
    null,
    "startup failure must exit without waiting for Passenger's timeout",
  );
  assert.equal(code, 1);
}

test("Passenger fails fast on missing configuration even with its stdin pipe open", async (context) => {
  const directory = await passengerFixture(context);
  await rm(path.join(directory, ".env.server"));
  await assertPassengerFailure(
    context,
    passengerProcess(directory),
    /ADMIN_LOGIN is required/,
  );
});

test("Passenger exits after an HTTP listen failure with its stdin pipe open", async (context) => {
  const directory = await passengerFixture(context);
  const occupied = http.createServer();
  occupied.listen(0, "127.0.0.1");
  await once(occupied, "listening");
  context.after(() => new Promise((resolve) => occupied.close(resolve)));
  await assertPassengerFailure(
    context,
    passengerProcess(directory, {
      env: { PORT: String(occupied.address().port) },
    }),
    /EADDRINUSE/,
  );
});

test("Passenger loads application configuration from its root when launched elsewhere and preserves environment overrides", async (context) => {
  const directory = await passengerFixture(context);
  const cwd = path.join(directory, "unrelated-directory");
  await mkdir(cwd);
  await writeFile(
    path.join(cwd, ".env.server"),
    "ADMIN_LOGIN=unrelated-directory\nSESSION_SECRET=short\n",
  );
  const running = await startPassengerFixture(directory, false, {
    cwd,
    env: { PUBLIC_ORIGIN: "https://environment.test" },
  });
  context.after(() => running.close());
  const health = await fetch(running.origin + "/api/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
  const plots = await fetch(running.origin + "/api/plots");
  assert.equal(plots.status, 200);
  assert.deepEqual(await plots.json(), []);
  const admin = await fetch(running.origin + "/api/admin/plots");
  assert.equal(admin.status, 401);
  assert.equal(
    admin.headers.get("access-control-allow-origin"),
    "https://environment.test",
  );
  const html = await fetch(running.origin + "/admin", {
    headers: { Accept: "text/html" },
  });
  assert.equal(html.status, 200);
  assert.match(await html.text(), /<title>Hostland<\/title>/);
});

test("Passenger starts the delivery runtime and resumes saved data and queued inquiries after restart", async (context) => {
  const directory = await passengerFixture(context);
  let running = await startPassengerFixture(directory, true);
  context.after(() => running.close());
  const payload = `v1.${Math.floor(Date.now() / 1000) + 86400}.00000000-0000-4000-8000-000000000000`;
  const signature = createHmac(
    "sha256",
    "passenger-test-session-secret-at-least-32-characters",
  )
    .update(`hamper-admin-v1\npassenger-admin\npassenger-test-hash\n${payload}`)
    .digest("base64url");
  const saved = await fetch(running.origin + "/api/admin/plots", {
    method: "POST",
    headers: {
      Origin: "https://site.test",
      Cookie: `hamper_admin=${payload}.${signature}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: "persistent-1",
      area: "10",
      price: "1800000",
      status: "Свободен",
    }),
  });
  assert.equal(saved.status, 201);
  const contact = await fetch(running.origin + "/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Анна",
      phone: "+79991234567",
      consent: true,
    }),
  });
  assert.equal(contact.status, 200);
  await running.close();
  running = await startPassengerFixture(directory, true);
  let inquiry;
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const journal = await fetch(running.origin + "/api/admin/inquiries", {
      headers: {
        Origin: "https://site.test",
        Cookie: `hamper_admin=${payload}.${signature}`,
      },
    });
    assert.equal(journal.status, 200);
    inquiry = (await journal.json()).items[0];
    if (inquiry.telegramStatus === "sent") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(inquiry.telegramStatus, "sent");
  assert.equal(inquiry.phone, "+79991234567");
  const response = await fetch(running.origin + "/api/plots");
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0].id, "persistent-1");
  const html = await fetch(running.origin + "/", {
    headers: { Accept: "text/html" },
  });
  assert.match(await html.text(), /<title>Hostland<\/title>/);
});
