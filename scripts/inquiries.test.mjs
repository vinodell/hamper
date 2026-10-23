import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { importServerModule } from "./server-test-loader.mjs";

const { default: api } = await importServerModule("api.ts");
const { SqliteDatabase } = await importServerModule("database.ts");
const schema = await readFile(
  new URL("../server/schema.sql", import.meta.url),
  "utf8",
);
const salt = Buffer.from("inquiry-test-only-salt");
const password = "inquiry-test-password";
const hash = `${salt.toString("base64url")}:${pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("base64url")}`;
const origin = "https://site.test";
const payload = {
  name: " Анна ",
  phone: "+7 (999) 123-45-67",
  project: "Ойнеловские дали",
  plot: "1-02",
  comment: " Прошу уведомить при снятии брони. ",
  consent: true,
};
function fixture(context, overrides = {}, databasePath = ":memory:") {
  const DB = new SqliteDatabase(databasePath);
  DB.exec(schema);
  const cleanups = [];
  let closed = false;
  const close = () => {
    if (!closed) DB.close();
    closed = true;
  };
  context.after(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    close();
  });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () =>
    assert.fail("Accepting inquiries must not call any external service");
  context.after(() => {
    globalThis.fetch = previousFetch;
  });
  const env = {
    DB,
    ADMIN_LOGIN: "admin-test",
    ADMIN_PASSWORD_HASH: hash,
    SESSION_SECRET: "test-session-secret-with-at-least-32-chars",
    PUBLIC_ORIGIN: origin,
    ...overrides,
  };
  return { DB, env, close, cleanup: (callback) => cleanups.push(callback) };
}
const request = (
  path,
  { body, cookie, method = body === undefined ? "GET" : "POST" } = {},
) =>
  new Request(origin + path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function authenticate(env) {
  const response = await api.fetch(
    request("/api/admin/login", { body: { login: env.ADMIN_LOGIN, password } }),
    env,
  );
  assert.equal(response.status, 200);
  return response.headers.get("Set-Cookie").split(";")[0];
}
async function latestInquiry(env, cookie) {
  const response = await api.fetch(
    request("/api/admin/inquiries", { cookie }),
    env,
  );
  assert.equal(response.status, 200);
  return (await response.json()).items[0];
}
async function waitForStatus(env, cookie, expected) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const item = await latestInquiry(env, cookie);
    if (item.telegramStatus === expected) return item;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`Journal did not reach Telegram status ${expected}`);
}

test("a submitted inquiry is durably accepted and readable only in the authenticated admin inbox", async (context) => {
  const { env } = fixture(context);
  const response = await api.fetch(
    request("/api/contact", { body: payload }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const cookie = await authenticate(env);
  const inbox = await api.fetch(
    request("/api/admin/inquiries", { cookie }),
    env,
  );
  assert.equal(inbox.status, 200);
  const { items, nextCursor } = await inbox.json();
  assert.equal(nextCursor, null);
  assert.equal(items.length, 1);
  assert.deepEqual(
    { ...items[0], id: 0, createdAt: "time" },
    {
      id: 0,
      createdAt: "time",
      name: "Анна",
      phone: payload.phone,
      project: payload.project,
      plot: payload.plot,
      comment: "Прошу уведомить при снятии брони.",
      consent: true,
      telegramStatus: "not_configured",
      telegramAttempts: 0,
    },
  );
  assert.ok(items[0].id > 0);
  assert.match(items[0].createdAt, /^\d{4}-\d\d-\d\dT.*Z$/);
});

test("Telegram delivery is queued without delaying or risking the accepted inquiry", async (context) => {
  const { env } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  const response = await api.fetch(
    request("/api/contact", { body: payload }),
    env,
  );
  assert.equal(response.status, 200);
  const cookie = await authenticate(env);
  const inbox = await api.fetch(
    request("/api/admin/inquiries", { cookie }),
    env,
  );
  const { items } = await inbox.json();
  assert.equal(items.length, 1);
  assert.equal(items[0].telegramStatus, "pending");
  assert.equal(items[0].telegramAttempts, 0);
});

test("the background runtime delivers a queued inquiry as plain text and updates Journal", async (context) => {
  const { env, cleanup } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  await api.fetch(
    request("/api/contact", { body: { ...payload, name: "<b>Анна</b>" } }),
    env,
  );
  const cookie = await authenticate(env);
  const sent = [];
  const { startTelegramDelivery } = await importServerModule("telegram.ts");
  const delivery = startTelegramDelivery(env, {
    fetch: async (url, options) => {
      sent.push({ url, ...JSON.parse(options.body) });
      return Response.json({ ok: true, result: { message_id: 1 } });
    },
  });
  cleanup(() => delivery.stop());
  const item = await waitForStatus(env, cookie, "sent");
  assert.equal(item.telegramAttempts, 1);
  assert.equal(sent.length, 1);
  assert.equal(
    sent[0].url,
    "https://api.telegram.org/bot123456:test-token/sendMessage",
  );
  assert.equal(sent[0].chat_id, "-100123456");
  assert.match(sent[0].text, /Имя: <b>Анна<\/b>/);
  assert.match(sent[0].text, /\+7 \(999\) 123-45-67/);
  assert.match(sent[0].text, /Ойнеловские дали/);
  assert.match(sent[0].text, /1-02/);
  assert.equal(sent[0].parse_mode, undefined);
});

test("Telegram throttling pauses all queued inquiries until retry_after expires", async (context) => {
  const { env, cleanup } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  await api.fetch(request("/api/contact", { body: payload }), env);
  const cookie = await authenticate(env);
  const { startTelegramDelivery } = await importServerModule("telegram.ts");
  let time = 10_000;
  let calls = 0;
  const delivery = startTelegramDelivery(env, {
    now: () => time,
    intervalMs: 5,
    fetch: async () => {
      calls++;
      return calls === 1
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 120 } },
            { status: 429 },
          )
        : Response.json({ ok: true });
    },
  });
  cleanup(() => delivery.stop());
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(calls, 1);
  assert.equal((await latestInquiry(env, cookie)).telegramStatus, "pending");
  await api.fetch(
    request("/api/contact", { body: { ...payload, name: "Во время паузы" } }),
    env,
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(
    calls,
    1,
    "New inquiries must respect the same chat's retry pause",
  );
  assert.equal((await latestInquiry(env, cookie)).telegramAttempts, 0);
  time = 129_999;
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(
    calls,
    1,
    "Telegram's mandatory retry pause must not be shortened",
  );
  time = 130_000;
  const delivered = await waitForStatus(env, cookie, "sent");
  assert.equal(delivered.name, "Во время паузы");
  assert.equal(delivered.telegramAttempts, 1);
  assert.equal(calls, 3);
  const journal = await api.fetch(
    request("/api/admin/inquiries", { cookie }),
    env,
  );
  const olderInquiry = (await journal.json()).items[1];
  assert.equal(olderInquiry.telegramStatus, "sent");
  assert.equal(olderInquiry.telegramAttempts, 2);
});

test("a stalled Telegram request is bounded and does not block delivery of later inquiries", async (context) => {
  const { env, cleanup } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  await api.fetch(request("/api/contact", { body: payload }), env);
  await api.fetch(
    request("/api/contact", { body: { ...payload, name: "Вторая заявка" } }),
    env,
  );
  const cookie = await authenticate(env);
  const { startTelegramDelivery } = await importServerModule("telegram.ts");
  let calls = 0;
  let aborted = false;
  const delivery = startTelegramDelivery(env, {
    timeoutMs: 10,
    intervalMs: 5,
    fetch: async (_url, options) => {
      if (++calls > 1) return Response.json({ ok: true });
      return new Promise((resolve, reject) => {
        const fallback = setTimeout(
          () => resolve(Response.json({ ok: false })),
          250,
        );
        options.signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            clearTimeout(fallback);
            reject(new Error("Sensitive transport error including token"));
          },
          { once: true },
        );
      });
    },
  });
  cleanup(() => delivery.stop());
  await new Promise((resolve) => setTimeout(resolve, 70));
  const item = await latestInquiry(env, cookie);
  assert.equal(item.telegramStatus, "sent");
  assert.equal(item.name, "Вторая заявка");
  assert.equal(calls, 2);
  assert.equal(aborted, true);
});

test("queued Telegram delivery and its backoff survive closing and reopening the database", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hamper-telegram-"));
  const databasePath = path.join(directory, "inquiries.sqlite");
  const { env, close, cleanup } = fixture(
    context,
    {
      TELEGRAM_BOT_TOKEN: "123456:test-token",
      TELEGRAM_CHAT_ID: "-100123456",
    },
    databasePath,
  );
  cleanup(() => rm(directory, { recursive: true, force: true }));
  await api.fetch(request("/api/contact", { body: payload }), env);
  const cookie = await authenticate(env);
  const { startTelegramDelivery } = await importServerModule("telegram.ts");
  let calls = 0;
  const first = startTelegramDelivery(env, {
    now: () => 1_000,
    intervalMs: 5,
    fetch: async () => {
      calls++;
      return Response.json({ ok: false });
    },
  });
  cleanup(() => first.stop());
  await new Promise((resolve) => setTimeout(resolve, 20));
  await first.stop();
  assert.equal(calls, 1);
  close();
  const reopened = new SqliteDatabase(databasePath);
  const restartedEnv = { ...env, DB: reopened };
  cleanup(() => reopened.close());
  let time = 30_999;
  const restarted = startTelegramDelivery(restartedEnv, {
    now: () => time,
    intervalMs: 5,
    fetch: async () => {
      calls++;
      return Response.json({ ok: true });
    },
  });
  cleanup(() => restarted.stop());
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 1, "Restart must preserve the stored retry deadline");
  assert.equal((await latestInquiry(restartedEnv, cookie)).telegramAttempts, 1);
  time = 31_000;
  const delivered = await waitForStatus(restartedEnv, cookie, "sent");
  assert.equal(delivered.telegramAttempts, 2);
  assert.equal(delivered.phone, payload.phone);
  assert.equal(calls, 2);
});

test("unsuccessful Telegram delivery stops after eight attempts while preserving the inquiry", async (context) => {
  const { env, cleanup } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  await api.fetch(request("/api/contact", { body: payload }), env);
  const cookie = await authenticate(env);
  const { startTelegramDelivery } = await importServerModule("telegram.ts");
  let time = 0;
  const delays = [];
  const delivery = startTelegramDelivery(env, {
    now: () => time,
    intervalMs: 5,
    fetch: async () => {
      delays.push(time);
      return Response.json({
        ok: false,
        description: "Sensitive API error must stay private",
      });
    },
  });
  cleanup(() => delivery.stop());
  for (let attempt = 1; attempt <= 8; attempt++) {
    const deadline = Date.now() + 1000;
    while (delays.length < attempt && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(delays.length, attempt);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (attempt < 8) {
      time += Math.min(30_000 * 2 ** (attempt - 1), 3_600_000) - 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      assert.equal(delays.length, attempt);
      time += 1;
    }
  }
  const failed = await waitForStatus(env, cookie, "failed");
  assert.equal(failed.telegramAttempts, 8);
  assert.equal(failed.name, "Анна");
  time += 86_400_000;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(delays.length, 8);
});

test("concurrent delivery runtimes claim each inquiry once while its lease is active", async (context) => {
  const { env, cleanup } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  await api.fetch(request("/api/contact", { body: payload }), env);
  const cookie = await authenticate(env);
  const { startTelegramDelivery } = await importServerModule("telegram.ts");
  let calls = 0;
  const options = {
    intervalMs: 5,
    fetch: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Response.json({ ok: true });
    },
  };
  const first = startTelegramDelivery(env, options);
  const second = startTelegramDelivery(env, options);
  cleanup(() => first.stop());
  cleanup(() => second.stop());
  const item = await waitForStatus(env, cookie, "sent");
  assert.equal(item.telegramAttempts, 1);
  assert.equal(calls, 1);
});

test("failure to persist the Telegram queue rolls back the inquiry before any delivery", async (context) => {
  const { env, DB } = fixture(context, {
    TELEGRAM_BOT_TOKEN: "123456:test-token",
    TELEGRAM_CHAT_ID: "-100123456",
  });
  DB.exec(
    "CREATE TRIGGER reject_test_outbox BEFORE INSERT ON inquiry_telegram_outbox BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END;",
  );
  const response = await api.fetch(
    request("/api/contact", { body: payload }),
    env,
  );
  assert.equal(response.status, 500);
  const cookie = await authenticate(env);
  const journal = await api.fetch(
    request("/api/admin/inquiries", { cookie }),
    env,
  );
  assert.deepEqual((await journal.json()).items, []);
});

test("inquiry details never appear in anonymous, foreign-origin or public requests", async (context) => {
  const { env } = fixture(context);
  await api.fetch(request("/api/contact", { body: payload }), env);
  const cookie = await authenticate(env);
  for (const [input, status] of [
    [request("/api/admin/inquiries"), 401],
    [
      new Request(origin + "/api/admin/inquiries", {
        headers: { Origin: "https://foreign.test", Cookie: cookie },
      }),
      403,
    ],
    [request("/api/inquiries"), 404],
  ]) {
    const response = await api.fetch(input, env);
    assert.equal(response.status, status);
    assert.equal((await response.text()).includes(payload.phone), false);
  }
  const publicPlots = await api.fetch(request("/api/plots"), env);
  assert.equal((await publicPlots.text()).includes(payload.phone), false);
  const inbox = await api.fetch(
    request("/api/admin/inquiries", { cookie }),
    env,
  );
  assert.match(inbox.headers.get("Cache-Control"), /no-store/);
});

test("inbox pagination remains stable when new inquiries arrive between pages", async (context) => {
  const { env } = fixture(context);
  for (let index = 1; index <= 5; index++)
    await api.fetch(
      request("/api/contact", {
        body: { ...payload, name: `Посетитель ${index}` },
      }),
      env,
    );
  const cookie = await authenticate(env);
  const page = async (path) => {
    const response = await api.fetch(request(path, { cookie }), env);
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await page("/api/admin/inquiries?limit=2");
  assert.deepEqual(
    first.items.map((item) => item.name),
    ["Посетитель 5", "Посетитель 4"],
  );
  assert.equal(first.nextCursor, 4);
  await api.fetch(
    request("/api/contact", { body: { ...payload, name: "Новый посетитель" } }),
    env,
  );
  const second = await page("/api/admin/inquiries?limit=2&before=4");
  assert.deepEqual(
    second.items.map((item) => item.name),
    ["Посетитель 3", "Посетитель 2"],
  );
  const last = await page("/api/admin/inquiries?limit=2&before=2");
  assert.deepEqual(
    last.items.map((item) => item.name),
    ["Посетитель 1"],
  );
  assert.equal(last.nextCursor, null);
  const refreshed = await page("/api/admin/inquiries?limit=2");
  assert.equal(refreshed.items[0].name, "Новый посетитель");
  for (const query of [
    "limit=0",
    "limit=101",
    "limit=x",
    "before=-1",
    "before=1.5",
    "before=9007199254740992",
  ]) {
    const response = await api.fetch(
      request(`/api/admin/inquiries?${query}`, { cookie }),
      env,
    );
    assert.equal(response.status, 400);
  }
});

test("storage failure never produces a successful inquiry or exposes its contents", async (context) => {
  const { env } = fixture(context);
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(" "));
  context.after(() => {
    console.error = originalError;
  });
  const response = await api.fetch(request("/api/contact", { body: payload }), {
    ...env,
    DB: {
      prepare() {
        throw new Error("Private database failure");
      },
    },
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Не удалось выполнить запрос",
  });
  assert.equal(logs.join(" ").includes(payload.phone), false);
  assert.equal(logs.join(" ").includes("Private database failure"), false);
});
