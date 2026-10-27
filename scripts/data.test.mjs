import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";
import { importServerModule } from "./server-test-loader.mjs";

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
const sharedRequestUrl = await compile("src/lib/waitForSharedRequest.ts");
const cacheUrl = await compile("src/lib/plotsCache.ts", {
  "../data/individualPlots": detailsUrl,
  "./constants": moduleUrl(`export const PLOTS_REFRESH_MS = ${refreshMs};`),
  "./waitForSharedRequest": sharedRequestUrl,
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
const { default: worker } = await importServerModule("api.ts");

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
  const photos = [photo];
  cache.replaceCachedPlots([plot({ photos })]);
  const original = cache.getPlotsSnapshot();
  let notifications = 0;
  const unsubscribe = cache.subscribePlots(() => {
    notifications += 1;
  });
  await cache.loadCachedPlots(async () => [plot({ photos })], {
    maxAgeMs: 0,
  });
  assert.equal(cache.getPlotsSnapshot(), original);
  assert.equal(notifications, 0);
  await cache.loadCachedPlots(() => {
    assert.fail("Fresh rows must use memory");
  });
  cache.mergeSavedPlots([plot({ photos })]);
  assert.equal(cache.getPlotsSnapshot(), original);
  assert.equal(notifications, 0);
  unsubscribe();
});

test("confirmed full payment price changes and clearing refresh every public view", async () => {
  const cache = await freshCache();
  cache.replaceCachedPlots([plot()]);
  const original = cache.getPlotsSnapshot().plots[0];
  cache.mergeSavedPlots([plot({ fullPaymentPrice: "1300000" })]);
  const offered = cache.getPlotsSnapshot().plots[0];
  assert.notEqual(offered, original);
  assert.equal(offered.fullPaymentPrice, "1300000");
  cache.mergeSavedPlots([plot({ fullPaymentPrice: null })]);
  const cleared = cache.getPlotsSnapshot().plots[0];
  assert.notEqual(cleared, offered);
  assert.equal(cleared.fullPaymentPrice, null);
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
      area: "8,12",
      price: "1800000",
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

test("map receives a numeric full payment price only for plots with a configured offer", () => {
  const resolved = zones.resolveMapZones([
    plot({ fullPaymentPrice: "1300000,50" }),
    plot({ id: "1-02", fullPaymentPrice: null }),
    plot({ id: "1-03", fullPaymentPrice: "" }),
    plot({ id: "1-04" }),
  ]);
  const byId = new Map(resolved.map((zone) => [zone.plotId, zone]));
  assert.equal(byId.get("1-01").fullPaymentPrice, 1300000.5);
  assert.equal(byId.get("1-01").price, 1500000);
  for (const id of ["1-02", "1-03", "1-04"]) {
    assert.equal(Object.hasOwn(byId.get(id), "fullPaymentPrice"), false);
  }
});

test("table sorting preserves natural IDs and compares numeric prices and areas", () => {
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
      plot({ price: "900000" }),
      plot({ price: "1000000" }),
      "price",
    ) < 0,
  );
  assert.ok(
    sorting.comparePlots(
      plot({ area: "7,56" }),
      plot({ area: "8,1" }),
      "area",
    ) < 0,
  );
});

test("price sorting follows the full payment amount shown to buyers with base-price fallback", () => {
  const items = [
    plot({
      id: "expensive-base",
      price: "2000000",
      fullPaymentPrice: "900000,50",
    }),
    plot({ id: "legacy", price: "1000000" }),
    plot({ id: "cleared", price: "950000", fullPaymentPrice: null }),
  ];
  assert.deepEqual(
    items
      .sort((left, right) => sorting.comparePlots(left, right, "price"))
      .map(({ id }) => id),
    ["expensive-base", "cleared", "legacy"],
  );
  assert.ok(
    sorting.comparePlots(
      plot({ id: "2-2", fullPaymentPrice: "1000000" }),
      plot({ id: "2-10", price: "1000000" }),
      "price",
    ) < 0,
  );
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
  consent: true,
};
const contactEnv = {
  PUBLIC_ORIGIN: "https://site.test",
  DB: {
    prepare() {
      assert.fail("Validation failures must not access the database");
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

test("contact requires explicit personal data consent before accepting an inquiry", async (context) => {
  let sends = 0;
  mockFetch(context, async () => {
    sends += 1;
    return Response.json({ ok: true });
  });
  for (const consent of [undefined, false, "true", 1, null]) {
    const response = await worker.fetch(
      contactRequest({ ...contactPayload, consent }),
      contactEnv,
    );
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.equal(sends, 0);
});

test("contact rejects invalid or excessive inputs before accepting an inquiry", async (context) => {
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

test("contact rejects and cancels oversized streamed JSON despite a small declared length", async (context) => {
  mockFetch(context, async () => Response.json({ ok: true }));
  const bytes = new TextEncoder().encode(
    JSON.stringify({ ...contactPayload, padding: "x".repeat(100_000) }),
  );
  let offset = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + 16_000));
      offset = Math.min(offset + 16_000, bytes.length);
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = await worker.fetch(
    new Request("https://worker.test/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "1" },
      body,
      duplex: "half",
    }),
    contactEnv,
  );
  assert.equal(response.status, 413);
  assert.equal(typeof (await response.json()).error, "string");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(cancelled, true);
});

test("contact request limits count UTF-8 bytes when Content-Length is absent", async (context) => {
  mockFetch(context, async () => Response.json({ ok: true }));
  const response = await worker.fetch(
    contactRequest({ ...contactPayload, padding: "я".repeat(17_000) }),
    contactEnv,
  );
  assert.equal(response.status, 413);
});
