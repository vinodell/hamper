import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

const root = new URL("../", import.meta.url);
const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function compile(file, imports = {}) {
  const { code } = await transformWithOxc(
    await readFile(new URL(file, root), "utf8"),
    file,
  );
  return moduleUrl(
    code.replace(/(from\s+)(["'])([^"']+)\2/g, (match, prefix, _quote, name) =>
      imports[name] ? `${prefix}${JSON.stringify(imports[name])}` : match,
    ),
  );
}

const constantsUrl = moduleUrl("export const PLOTS_REFRESH_MS = 30000;");
const sharedRequestUrl = await compile("src/lib/waitForSharedRequest.ts");
const settingsUrl = await compile("src/lib/siteSettings.ts", {
  "./constants": constantsUrl,
  "./waitForSharedRequest": sharedRequestUrl,
});
const cacheUrl = await compile("src/lib/plotsCache.ts", {
  "./constants": constantsUrl,
  "../data/individualPlots": await compile("src/data/individualPlots.ts"),
  "./waitForSharedRequest": sharedRequestUrl,
});
let sequence = 0;
const freshSettings = () => import(`${settingsUrl}#${++sequence}`);
const freshPlots = () => import(`${cacheUrl}#${++sequence}`);
const settings = (enabled, discountPercent) => ({
  promotion: { enabled, discountPercent },
});
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("a failed initial settings load never invents a promotion and refresh failures retain confirmed values", async () => {
  const store = await freshSettings();
  const fail = async () => {
    throw new Error("Нет соединения");
  };
  await assert.rejects(store.loadCachedSiteSettings(fail), /Нет соединения/);
  assert.deepEqual(store.getSiteSettingsSnapshot(), {
    settings: null,
    loading: false,
    error: "Нет соединения",
  });
  const confirmed = settings(true, 15);
  await store.loadCachedSiteSettings(async () => confirmed);
  await assert.rejects(
    store.loadCachedSiteSettings(fail, { maxAgeMs: 0 }),
    /Нет соединения/,
  );
  assert.equal(store.getSiteSettingsSnapshot().settings, confirmed);
  await store.loadCachedSiteSettings(async () => settings(false, 20));
  assert.deepEqual(store.getSiteSettingsSnapshot(), {
    settings: settings(false, 20),
    loading: false,
    error: "",
  });
});

test("settings consumers share a request while aborting one consumer preserves the load", async () => {
  const store = await freshSettings();
  const response = deferred();
  let reads = 0;
  const load = () => {
    reads += 1;
    return response.promise;
  };
  const controller = new AbortController();
  const cancelled = store.loadCachedSiteSettings(load, {
    signal: controller.signal,
  });
  const shared = store.loadCachedSiteSettings(load);
  controller.abort();
  await assert.rejects(cancelled, { name: "AbortError" });
  response.resolve(settings(true, 5));
  assert.deepEqual(await shared, settings(true, 5));
  assert.equal(reads, 1);
  await store.loadCachedSiteSettings(() => {
    assert.fail("A fresh successful settings response must be shared");
  });
  await assert.rejects(
    store.loadCachedSiteSettings(load, {
      force: true,
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(reads, 1);
});

test("confirmed promotion saves remain visible when older public and admin reads resolve", async () => {
  const store = await freshSettings();
  const stale = deferred();
  const refreshed = deferred();
  let reads = 0;
  const revisionBeforeSave = store.getSiteSettingsRevision();
  const pending = store.loadCachedSiteSettings(() =>
    ++reads === 1 ? stale.promise : refreshed.promise,
  );
  store.publishSavedSiteSettings(settings(false, 25));
  assert.deepEqual(
    store.getSiteSettingsSnapshot().settings,
    settings(false, 25),
  );
  store.publishSavedSiteSettings(settings(true, 1), revisionBeforeSave);
  stale.resolve(settings(true, 1));
  await Promise.resolve();
  assert.deepEqual(
    store.getSiteSettingsSnapshot().settings,
    settings(false, 25),
  );
  assert.equal(reads, 2);
  refreshed.resolve(settings(false, 25));
  assert.deepEqual(await pending, settings(false, 25));
});

test("unchanged settings polls preserve the snapshot reference and notify no views", async () => {
  const store = await freshSettings();
  await store.loadCachedSiteSettings(async () => settings(true, 10));
  const original = store.getSiteSettingsSnapshot();
  let notifications = 0;
  const unsubscribe = store.subscribeSiteSettings(() => {
    notifications += 1;
  });
  await store.loadCachedSiteSettings(async () => settings(true, 10), {
    maxAgeMs: 0,
  });
  store.publishSavedSiteSettings(settings(true, 10));
  assert.equal(store.getSiteSettingsSnapshot(), original);
  assert.equal(notifications, 0);
  unsubscribe();
});

test("saved cadastral, document and mortgage changes refresh the public plot snapshot", async () => {
  const cache = await freshPlots();
  let plot = {
    id: "test-metadata",
    settlement: "Другие участки",
    area: "8",
    price: "1200000",
    status: "Свободен",
    cadastralNumber: null,
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: null,
  };
  cache.replaceCachedPlots([plot]);
  for (const update of [
    { cadastralNumber: "47:07:0123456:100" },
    { gpzuDone: true },
    { buildingPermitDone: true },
    { mortgageUrl: "https://domclick.ru/card/100" },
  ]) {
    const previous = cache.getPlotsSnapshot().plots[0];
    plot = { ...plot, ...update };
    cache.mergeSavedPlots([plot]);
    const current = cache.getPlotsSnapshot().plots[0];
    assert.notEqual(current, previous);
    for (const [key, value] of Object.entries(update)) {
      assert.equal(current[key], value);
    }
  }
});

test("promotion re-entry keeps an unsaved toggle while adopting another admin's new discount", async () => {
  const { mergePromotionDraft } = await import(
    await compile("src/lib/promotionDrafts.ts")
  );
  const fresh = settings(true, 25);
  const merged = mergePromotionDraft(fresh, {
    saved: settings(true, 10),
    enabled: false,
    discount: "10",
  });
  assert.deepEqual(merged, {
    saved: fresh,
    enabled: false,
    discount: "25",
  });
});

test("promotion re-entry preserves raw discount edits, including invalid inputs, and adopts an untouched toggle", async () => {
  const { mergePromotionDraft } = await import(
    await compile("src/lib/promotionDrafts.ts")
  );
  const fresh = settings(false, 25);
  for (const discount of ["15", "", "0", "101", "12.5", "1e"]) {
    assert.deepEqual(
      mergePromotionDraft(fresh, {
        saved: settings(true, 10),
        enabled: true,
        discount,
      }),
      { saved: fresh, enabled: false, discount },
    );
  }
});

test("first promotion load uses confirmed settings and successful saves reset the draft baseline", async () => {
  const { createPromotionDraft, mergePromotionDraft } = await import(
    await compile("src/lib/promotionDrafts.ts")
  );
  const confirmed = settings(true, 30);
  assert.deepEqual(mergePromotionDraft(confirmed, createPromotionDraft()), {
    saved: confirmed,
    enabled: true,
    discount: "30",
  });
  const saved = createPromotionDraft(confirmed);
  const fresh = settings(false, 40);
  assert.deepEqual(mergePromotionDraft(fresh, saved), {
    saved: fresh,
    enabled: false,
    discount: "40",
  });
});
