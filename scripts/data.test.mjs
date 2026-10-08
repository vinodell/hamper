import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

const root = new URL("../", import.meta.url);
const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

async function compile(file, imports = {}) {
  const source = await readFile(new URL(file, root), "utf8");
  const result = await transformWithOxc(source, file);
  return moduleUrl(
    result.code.replace(
      /(from\s+)(["'])([^"']+)\2/g,
      (match, prefix, _quote, path) =>
        imports[path] ? `${prefix}${JSON.stringify(imports[path])}` : match,
    ),
  );
}

const constants = await readFile(new URL("src/lib/constants.ts", root), "utf8");
const refreshMs = Number(
  constants.match(/PLOTS_REFRESH_MS = ([\d_]+);/)[1].replaceAll("_", ""),
);
const detailsUrl = await compile("src/data/individualPlots.ts");
const cacheUrl = await compile("src/lib/plotsCache.ts", {
  "../data/individualPlots": detailsUrl,
  "./constants": moduleUrl(`export const PLOTS_REFRESH_MS = ${refreshMs};`),
});
const numbersUrl = await compile("src/lib/plotNumbers.ts");
const sorting = await import(
  await compile("src/lib/plotSorting.ts", {
    "./plotNumbers": numbersUrl,
  })
);
const zones = await import(
  await compile("src/interactiveMap/resolveMapZones.ts", {
    "../lib/plotNumbers": numbersUrl,
    "./MapZones": await compile("src/interactiveMap/MapZones.ts"),
  })
);
const links = await import(await compile("src/lib/contactLinks.ts"));
const worker = (
  await import(
    await compile("worker/src/index.ts", {
      "./constants": await compile("worker/src/constants.ts"),
    })
  )
).default;

let moduleSequence = 0;
const freshCache = () => import(`${cacheUrl}#${++moduleSequence}`);
function plot(overrides = {}) {
  return {
    id: "1-01",
    settlement: "Ойнеловские дали",
    area: "7,56",
    price: "1500000",
    status: "Свободен",
    ...overrides,
  };
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("views share a pending GET, and cancelling one view preserves the shared load", async () => {
  const cache = await freshCache();
  const response = deferred();
  let reads = 0;
  const load = () => {
    reads += 1;
    return response.promise;
  };
  const controller = new AbortController();
  const cancelled = cache.loadCachedPlots(load, { signal: controller.signal });
  const shared = cache.loadCachedPlots(load);
  controller.abort();
  await assert.rejects(cancelled, { name: "AbortError" });
  response.resolve([plot()]);
  assert.equal((await shared)[0].id, "1-01");
  assert.equal(reads, 1);
  assert.equal(cache.getPlotsSnapshot().loading, false);
});

test("already aborted calls do not start requests or invalidate fresh data", async () => {
  const cache = await freshCache();
  cache.replaceCachedPlots([plot()]);
  const original = cache.getPlotsSnapshot();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    cache.loadCachedPlots(
      () => {
        assert.fail("An aborted caller must not start a GET");
      },
      { force: true, signal: controller.signal },
    ),
    { name: "AbortError" },
  );
  assert.equal(cache.getPlotsSnapshot(), original);
  assert.equal(cache.getPlotsRevision(), 1);
});

test("identical polls keep the snapshot and rows stable while refreshing freshness", async () => {
  const cache = await freshCache();
  const photo = { src: "photo.webp", alt: "Фото участка" };
  cache.replaceCachedPlots([plot({ photos: [photo] })]);
  const original = cache.getPlotsSnapshot();
  let notifications = 0;
  const unsubscribe = cache.subscribePlots(() => {
    notifications += 1;
  });
  await cache.loadCachedPlots(async () => [plot({ photos: [{ ...photo }] })], {
    maxAgeMs: 0,
  });
  assert.equal(cache.getPlotsSnapshot(), original);
  assert.equal(notifications, 0);
  await cache.loadCachedPlots(() => {
    assert.fail("Fresh rows must use memory");
  });
  cache.mergeSavedPlots([plot({ photos: [{ ...photo }] })]);
  assert.equal(cache.getPlotsSnapshot(), original);
  assert.equal(notifications, 0);
  unsubscribe();
});

test("a refresh failure preserves visible rows and a successful retry clears the error", async () => {
  const cache = await freshCache();
  cache.replaceCachedPlots([plot()]);
  const existing = cache.getPlotsSnapshot().plots[0];
  await assert.rejects(
    cache.loadCachedPlots(
      async () => {
        throw new Error("Нет соединения");
      },
      { maxAgeMs: 0 },
    ),
    /Нет соединения/,
  );
  assert.equal(cache.getPlotsSnapshot().plots[0], existing);
  assert.equal(cache.getPlotsSnapshot().error, "Нет соединения");
  // Focus or a route change must retry immediately after a failed refresh,
  // even when the preserved snapshot is still inside the cache lifetime.
  await cache.loadCachedPlots(async () => [plot()]);
  assert.equal(cache.getPlotsSnapshot().plots[0], existing);
  assert.equal(cache.getPlotsSnapshot().error, "");
});

test("invalidating an in-flight GET skips stale rows and returns the queued refresh", async () => {
  const cache = await freshCache();
  const oldResponse = deferred();
  const newResponse = deferred();
  let reads = 0;
  const load = () =>
    ++reads === 1 ? oldResponse.promise : newResponse.promise;
  const initial = cache.loadCachedPlots(load);
  const forced = cache.loadCachedPlots(load, { force: true });
  oldResponse.resolve([plot({ price: "1" })]);
  await Promise.resolve();
  assert.deepEqual(cache.getPlotsSnapshot().plots, []);
  assert.equal(reads, 2);
  newResponse.resolve([plot({ price: "2000000" })]);
  const [first, second] = await Promise.all([initial, forced]);
  assert.equal(first[0].price, "2000000");
  assert.equal(second, first);
});

test("a saved row remains visible when an older GET resolves, and unrelated rows refresh", async () => {
  const cache = await freshCache();
  const unchanged = plot({ id: "1-02" });
  cache.replaceCachedPlots([plot(), unchanged]);
  const existingUnchanged = cache.getPlotsSnapshot().plots[1];
  const oldResponse = deferred();
  const newResponse = deferred();
  let reads = 0;
  const pending = cache.loadCachedPlots(
    () => (++reads === 1 ? oldResponse.promise : newResponse.promise),
    { maxAgeMs: 0 },
  );
  const oldRevision = cache.getPlotsRevision();
  cache.mergeSavedPlots([plot({ price: "2500000", status: "Продан" })]);
  assert.equal(cache.getPlotsSnapshot().plots[1], existingUnchanged);
  cache.replaceCachedPlots([plot({ price: "1" })], oldRevision);
  assert.equal(cache.getPlotsSnapshot().plots[0].price, "2500000");
  oldResponse.resolve([plot(), unchanged]);
  await Promise.resolve();
  assert.equal(cache.getPlotsSnapshot().plots[0].status, "Продан");
  newResponse.resolve([
    plot({ price: "2500000", status: "Продан" }),
    plot({ id: "1-02", price: "1800000" }),
  ]);
  assert.equal((await pending)[1].price, "1800000");
  assert.equal(reads, 2);
});

test("map uses exact API IDs, ignores other settlements and disables sold or missing rows", () => {
  const resolved = zones.resolveMapZones([
    plot(),
    plot({
      id: "1-02",
      status: "Забронирован",
      area: "8,12 сот.",
      price: "1 800 000 ₽",
    }),
    plot({ id: "1-03", status: "Продан" }),
    plot({ id: "1-04", settlement: "Другие участки" }),
  ]);
  const byId = new Map(resolved.map((zone) => [zone.plotId, zone]));
  assert.equal(zones.isSelectableZone(byId.get("1-01")), true);
  assert.equal(byId.get("1-02").area, 8.12);
  assert.equal(byId.get("1-02").price, 1_800_000);
  assert.equal(zones.isSelectableZone(byId.get("1-02")), true);
  assert.equal(zones.isSelectableZone(byId.get("1-03")), false);
  assert.equal(byId.get("1-04").status, "unknown");
});

test("table sorting preserves natural IDs and compares normalized prices and areas", () => {
  const items = [
    plot({ id: "2-10" }),
    plot({ id: "2-2" }),
    plot({ id: "2-01" }),
  ];
  assert.deepEqual(
    items
      .sort((a, b) => sorting.comparePlots(a, b, "id"))
      .map((item) => item.id),
    ["2-01", "2-2", "2-10"],
  );
  assert.ok(
    sorting.comparePlots(
      plot({ price: "900 000 ₽" }),
      plot({ price: "1 000 000 ₽" }),
      "price",
    ) < 0,
  );
  assert.ok(
    sorting.comparePlots(
      plot({ area: "7,56 сот." }),
      plot({ area: "8,1" }),
      "area",
    ) < 0,
  );
});

test("messenger contacts accept raw identifiers and complete HTTPS URLs", () => {
  assert.equal(
    links.telegramHref(" @hamper_team "),
    "https://t.me/hamper_team",
  );
  assert.equal(
    links.telegramHref("https://t.me/hamper_team"),
    "https://t.me/hamper_team",
  );
  assert.equal(
    links.whatsappHref("+7 (999) 123-45-67"),
    "https://wa.me/79991234567",
  );
  assert.equal(
    links.whatsappHref("https://wa.me/79991234567"),
    "https://wa.me/79991234567",
  );
  for (const value of [
    undefined,
    "",
    "javascript:alert(1)",
    "http://example.test",
  ]) {
    assert.equal(links.telegramHref(value), undefined);
    assert.equal(links.whatsappHref(value), undefined);
  }
});

function contactRequest(payload) {
  return new Request("https://worker.test/api/contact", {
    method: "POST",
    headers: {
      Origin: "https://site.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
const contactPayload = {
  name: " Анна ",
  phone: "+7 (999) 123-45-67",
  project: "Ойнеловские дали",
  plot: "1-01",
  comment: " Хочу записаться на просмотр ",
};
const contactEnv = {
  PUBLIC_ORIGIN: "https://site.test",
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_CHAT_ID: "test-chat",
  DB: {
    prepare() {
      assert.fail("Contact sends do not need D1");
    },
  },
};
function mockFetch(context, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  context.after(() => {
    globalThis.fetch = original;
  });
}

test("contact rejects invalid or excessive inputs before sending a Telegram message", async (context) => {
  mockFetch(context, () => {
    assert.fail("Invalid contact data must not be sent");
  });
  for (const changes of [
    { name: " " },
    { name: "a".repeat(121) },
    { phone: "abc" },
    { phone: "+7 (999) 123" },
    { phone: "9".repeat(41) },
    { comment: "a".repeat(2001) },
    { project: 42 },
    { plot: "a".repeat(81) },
  ]) {
    const response = await worker.fetch(
      contactRequest({ ...contactPayload, ...changes }),
      contactEnv,
    );
    assert.equal(response.status, 400);
  }
});

test("contact sends selected project and plot once and confirms only Telegram success", async (context) => {
  let sends = 0;
  mockFetch(context, async (url, options) => {
    sends += 1;
    assert.equal(url, "https://api.telegram.org/bottest-token/sendMessage");
    const payload = JSON.parse(options.body);
    assert.equal(payload.chat_id, "test-chat");
    assert.ok(payload.text.includes("👤 Имя: Анна"));
    assert.ok(payload.text.includes("🏡 Проект: Ойнеловские дали"));
    assert.ok(payload.text.includes("📍 Участок: 1-01"));
    assert.ok(
      payload.text.includes("💬 Комментарий: Хочу записаться на просмотр"),
    );
    return Response.json({ ok: true });
  });
  const response = await worker.fetch(
    contactRequest(contactPayload),
    contactEnv,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(sends, 1);
  assert.equal(response.headers.has("Set-Cookie"), false);
});

test("Telegram transport and payload failures never appear as successful contact submissions", async (context) => {
  const original = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = original;
  });
  for (const result of [
    () => Response.json({ ok: false }),
    () => Response.json({ error: "unavailable" }, { status: 503 }),
    () => new Response("invalid JSON"),
    () => {
      throw new TypeError("Connection failed");
    },
  ]) {
    globalThis.fetch = async () => result();
    const response = await worker.fetch(
      contactRequest(contactPayload),
      contactEnv,
    );
    assert.equal(response.status, 502);
    assert.equal(typeof (await response.json()).error, "string");
  }
});
