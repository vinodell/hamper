import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

const sourceRoot = new URL("../src/lib/", import.meta.url);
const asModule = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = async (name) =>
  (
    await transformWithOxc(
      await readFile(new URL(`${name}.ts`, sourceRoot), "utf8"),
      `${name}.ts`,
    )
  ).code;
const authUrl = asModule(await compile("adminAuth"));
const numbersUrl = asModule(await compile("plotNumbers"));
const numbers = await import(numbersUrl);
const metadataUrl = asModule(await compile("plotMetadata"));
const { mergeAdminDrafts, toPlotUpdate } = await import(
  asModule(
    (await compile("adminDrafts")).replace(
      /(["'])\.\/plotNumbers\1/g,
      JSON.stringify(numbersUrl),
    ),
  )
);
const apiCode = await compile("api");
const settingsCode = await compile("siteSettings");
let sequence = 0;

async function loadApi(env = { DEV: false }) {
  const cacheUrl = `${asModule(`
    export let cached = [];
    export let revision = 0;
    export const getPlotsRevision = () => revision;
    export const replaceCachedPlots = (plots, expected) => {
      if (expected !== undefined && expected !== revision) return;
      cached = plots; revision += 1;
    };
    export const mergeSavedPlots = (plots) => {
      const byId = new Map(cached.map((plot) => [plot.id, plot]));
      plots.forEach((plot) => byId.set(plot.id, plot));
      cached = [...byId.values()]; revision += 1;
    };
    export const loadCachedPlots = async (load) => { const plots = await load(); cached = plots; return plots; };
  `)}#${++sequence}`;
  const constantsUrl = asModule(`export const apiUrl = "https://worker.test";
    export const plotStatuses = ["Свободен", "Забронирован", "Продан"];
    export const PLOTS_REFRESH_MS = 30000;`);
  const settingsUrl = `${asModule(
    settingsCode.replace(
      /(["'])\.\/constants\1/g,
      JSON.stringify(constantsUrl),
    ),
  )}#${sequence}`;
  const replacements = {
    adminAuth: authUrl,
    plotNumbers: numbersUrl,
    constants: constantsUrl,
    plotsCache: cacheUrl,
    plotMetadata: metadataUrl,
    siteSettings: settingsUrl,
  };
  const code = apiCode
    .replace(
      /(["'])\.\/(adminAuth|plotNumbers|constants|plotsCache|plotMetadata|siteSettings)\1/g,
      (_, _quote, name) => JSON.stringify(replacements[name]),
    )
    .replaceAll("import.meta.env", JSON.stringify(env));
  return {
    ...(await import(`${asModule(code)}#${sequence}`)),
    cache: await import(cacheUrl),
    settingsStore: await import(settingsUrl),
  };
}

const fixture = {
  id: "test-1",
  settlement: "Другие участки",
  area: "8.12",
  price: "1200000",
  status: "Свободен",
  street: null,
  description: null,
  updatedAt: "2026-01-01 00:00:00",
};
const response = (body, status = 200, contentType = "application/json") =>
  new Response(contentType.includes("json") ? JSON.stringify(body) : body, {
    status,
    headers: { "Content-Type": contentType },
  });

function mockBrowser(context, fetchImpl) {
  const descriptors = Object.fromEntries(
    ["fetch", "window"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const removed = [];
  const blocked = () => {
    throw new Error("Credential storage must not be accessed");
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { hostname: "localhost" },
      sessionStorage: {
        getItem: blocked,
        setItem: blocked,
        removeItem: (key) => removed.push(key),
      },
      localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: fetchImpl,
  });
  context.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return removed;
}

function assertCookieRequest(options) {
  assert.equal(options.credentials, "include");
  assert.equal(options.headers.has("Authorization"), false);
}

test("legacy credential cleanup only removes the former sessionStorage value", async (context) => {
  const removed = mockBrowser(context, () => {
    throw new Error("Unexpected request");
  });
  const auth = await import(authUrl);
  auth.clearLegacyAdminAuthorization();
  assert.deepEqual(removed, ["hamper.adminAuthorization"]);
  globalThis.window.sessionStorage.removeItem = () => {
    throw new DOMException("Blocked", "SecurityError");
  };
  assert.doesNotThrow(auth.clearLegacyAdminAuthorization);
  assert.deepEqual(Object.keys(auth), ["clearLegacyAdminAuthorization"]);
});

test("login sends credentials once, checks the HttpOnly cookie and never stores credentials", async (context) => {
  const calls = [];
  const removed = mockBrowser(context, async (url, options) => {
    calls.push([url, options]);
    return calls.length === 1 ? response({ ok: true }) : response([fixture]);
  });
  const { api, cache } = await loadApi();
  const plots = await api.login("админ:владелец", "пароль:🔐");
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "https://worker.test/api/admin/login");
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    login: "админ:владелец",
    password: "пароль:🔐",
  });
  assert.equal(calls[0][1].headers.get("Content-Type"), "application/json");
  assert.equal(calls[1][0], "https://worker.test/api/admin/plots");
  assert.equal(calls[1][1].body, undefined);
  assert.equal(calls[1][1].headers.has("Content-Type"), false);
  calls.forEach(([, options]) => assertCookieRequest(options));
  assert.equal(plots[0].area, "8,12");
  assert.equal(cache.cached[0].id, fixture.id);
  assert.equal(Object.hasOwn(cache.cached[0], "street"), false);
  assert.ok(removed.every((key) => key === "hamper.adminAuthorization"));
});

test("opening /admin validates the server cookie without reading client credentials", async (context) => {
  mockBrowser(context, async (url, options) => {
    assert.equal(url, "https://worker.test/api/admin/plots");
    assertCookieRequest(options);
    return response([fixture]);
  });
  const first = await loadApi();
  assert.equal((await first.api.getAdminPlots())[0].id, fixture.id);
  const refreshed = await loadApi();
  assert.equal((await refreshed.api.getAdminPlots())[0].id, fixture.id);
});

test("admin inquiries are read with the session cookie and a keyset cursor without storing personal data", async (context) => {
  const inquiry = {
    id: 42,
    name: "Анна",
    phone: "+7 999 123-45-67",
    project: "Ойнеловские дали",
    plot: "1-02",
    comment: "Уведомить об освобождении участка\nЗвонить после 18:00",
    consent: true,
    createdAt: "2026-10-22T10:25:00.000Z",
  };
  mockBrowser(context, async (url, options) => {
    assert.equal(
      url,
      "https://worker.test/api/admin/inquiries?limit=50&before=43",
    );
    assertCookieRequest(options);
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.has("Content-Type"), false);
    return response({ items: [inquiry], nextCursor: 42 });
  });
  const { api } = await loadApi();
  assert.deepEqual(await api.getAdminInquiries({ before: 43 }), {
    items: [
      { ...inquiry, telegramStatus: "not_configured", telegramAttempts: 0 },
    ],
    nextCursor: 42,
  });
});

test("Journal preserves validated Telegram delivery states and attempt counts", async (context) => {
  const inquiry = {
    id: 42,
    name: "Анна",
    phone: "+7 999 123-45-67",
    project: null,
    plot: null,
    comment: null,
    consent: true,
    createdAt: "2026-10-22T10:25:00.000Z",
  };
  let body;
  mockBrowser(context, async () => response(body));
  const { api } = await loadApi();
  for (const [telegramStatus, telegramAttempts] of [
    ["not_configured", 0],
    ["pending", 0],
    ["pending", 1],
    ["sent", 1],
    ["failed", 3],
  ]) {
    const item = { ...inquiry, telegramStatus, telegramAttempts };
    body = { items: [item], nextCursor: null };
    assert.deepEqual(await api.getAdminInquiries(), body);
  }
});

test("malformed inquiry pages cannot expose unvalidated personal data or a broken pagination cursor", async (context) => {
  const inquiry = {
    id: 42,
    name: "Анна",
    phone: "+7 999 123-45-67",
    project: null,
    plot: null,
    comment: null,
    consent: true,
    createdAt: "2026-10-22T10:25:00.000Z",
  };
  let body;
  mockBrowser(context, async () => response(body));
  const { api } = await loadApi();
  const invalid = [
    [],
    { items: null, nextCursor: null },
    { items: [inquiry] },
    { items: [{ ...inquiry, id: "42" }], nextCursor: null },
    { items: [{ ...inquiry, consent: false }], nextCursor: null },
    { items: [{ ...inquiry, project: {} }], nextCursor: null },
    { items: [{ ...inquiry, createdAt: "yesterday" }], nextCursor: null },
    { items: [{ ...inquiry, telegramStatus: "delivered" }], nextCursor: null },
    { items: [{ ...inquiry, telegramStatus: null }], nextCursor: null },
    { items: [{ ...inquiry, telegramAttempts: "1" }], nextCursor: null },
    { items: [{ ...inquiry, telegramAttempts: -1 }], nextCursor: null },
    { items: [{ ...inquiry, telegramAttempts: 1.5 }], nextCursor: null },
    { items: [{ ...inquiry, telegramAttempts: null }], nextCursor: null },
    {
      items: [{ ...inquiry, createdAt: "2026-10-22 10:25:00" }],
      nextCursor: null,
    },
    { items: [inquiry, inquiry], nextCursor: null },
    { items: [inquiry], nextCursor: 43 },
    { items: [], nextCursor: 42 },
  ];
  for (body of invalid)
    await assert.rejects(
      api.getAdminInquiries(),
      (error) => error.status === 502,
    );
});

test("inquiry reads preserve authentication failures and stay unavailable in the local public demo", async (context) => {
  let calls = 0;
  mockBrowser(context, async () => {
    calls += 1;
    return response({ error: "Требуется авторизация" }, 401);
  });
  const { api } = await loadApi();
  await assert.rejects(
    api.getAdminInquiries(),
    (error) => error.status === 401,
  );
  const mockApi = await loadApi({ DEV: true, VITE_USE_MOCK_DATA: "true" });
  await assert.rejects(
    mockApi.api.getAdminInquiries(),
    (error) => error.status === 403,
  );
  assert.equal(calls, 1);
});

test("loading older inquiries rejects a page outside the requested keyset boundary", async (context) => {
  mockBrowser(context, async () =>
    response({
      items: [
        {
          id: 42,
          name: "Анна",
          phone: "+7 999 123-45-67",
          project: null,
          plot: null,
          comment: null,
          consent: true,
          createdAt: "2026-10-22T10:25:00.000Z",
        },
      ],
      nextCursor: null,
    }),
  );
  const { api } = await loadApi();
  await assert.rejects(
    api.getAdminInquiries({ before: 42 }),
    (error) => error.status === 502,
  );
});

test("wrong credentials stop before loading plots", async (context) => {
  let calls = 0;
  mockBrowser(context, async () => {
    calls += 1;
    return response({ error: "Неверный логин или пароль" }, 401);
  });
  const { api, ApiError } = await loadApi();
  await assert.rejects(
    api.login("wrong", "wrong"),
    (error) =>
      error instanceof ApiError &&
      error.status === 401 &&
      /Неверный логин/.test(error.message),
  );
  assert.equal(calls, 1);
});

test("a browser refusing the login cookie gets a clear error", async (context) => {
  let calls = 0;
  mockBrowser(context, async () =>
    ++calls === 1
      ? response({ ok: true })
      : response({ error: "Требуется авторизация" }, 401),
  );
  const { api } = await loadApi();
  await assert.rejects(
    api.login("admin", "password"),
    /Браузер не сохранил вход/,
  );
  assert.equal(calls, 2);
});

test("re-entry restores a local price change without overwriting another admin's new address", async (context) => {
  const saved = {
    ...fixture,
    street: "Старая улица",
    description: "Старое описание",
  };
  const draft = { ...saved, price: "1500000" };
  const fresh = {
    ...saved,
    street: "Новая улица",
    description: "Обновлено другим владельцем",
    status: "Забронирован",
    updatedAt: "2026-01-02 00:00:00",
  };
  let sent;
  mockBrowser(context, async (url, options) => {
    if (url.endsWith("/login")) return response({ ok: true });
    if (options.method === "PUT") {
      sent = JSON.parse(options.body).plots;
      return response(sent.map((update) => ({ ...fresh, ...update })));
    }
    return response([fresh]);
  });
  const { api } = await loadApi();
  const loaded = await api.login("admin", "password");
  const restored = mergeAdminDrafts(
    loaded,
    [draft],
    new Map([[saved.id, saved]]),
  );
  assert.equal(restored[0].price, draft.price);
  assert.equal(restored[0].street, fresh.street);
  assert.equal(restored[0].description, fresh.description);
  assert.equal(restored[0].status, fresh.status);
  assert.equal(restored[0].updatedAt, fresh.updatedAt);
  await api.updatePlots(
    restored.map((plot) => ({ id: plot.id, ...toPlotUpdate(plot) })),
  );
  assert.equal(sent[0].price, draft.price);
  assert.equal(sent[0].street, fresh.street);
  assert.equal(sent[0].description, fresh.description);
});

test("draft restoration ignores formatting changes and preserves explicit local text deletion", () => {
  const saved = { ...fixture, street: "Старая улица" };
  const draft = { ...saved, area: "8,12", street: "" };
  const fresh = {
    ...saved,
    area: "9,5",
    street: "Новая улица",
    price: "1400000",
  };
  const restored = mergeAdminDrafts(
    [fresh],
    [draft],
    new Map([[saved.id, saved]]),
  );
  assert.equal(restored[0].area, fresh.area);
  assert.equal(restored[0].price, fresh.price);
  assert.equal(restored[0].street, "");
  assert.equal(mergeAdminDrafts([fresh], [draft], new Map())[0], fresh);
  assert.deepEqual(
    mergeAdminDrafts([], [draft], new Map([[saved.id, saved]])),
    [],
  );
});

test("re-entry keeps local full payment price edits and clears while adopting untouched remote changes", () => {
  const saved = { ...fixture, fullPaymentPrice: "1000000.50" };
  const remote = { ...saved, price: "1500000", fullPaymentPrice: "1100000" };
  for (const fullPaymentPrice of ["900000", "", "0", "1,"]) {
    const [restored] = mergeAdminDrafts(
      [remote],
      [{ ...saved, fullPaymentPrice }],
      new Map([[saved.id, saved]]),
    );
    assert.equal(restored.fullPaymentPrice, fullPaymentPrice);
    assert.equal(restored.price, "1500000");
  }
  const [formatted] = mergeAdminDrafts(
    [remote],
    [{ ...saved, fullPaymentPrice: "1 000 000,50 ₽", street: "Новая улица" }],
    new Map([[saved.id, saved]]),
  );
  assert.equal(formatted.fullPaymentPrice, "1100000");
  assert.equal(formatted.street, "Новая улица");
});

test("draft restoration merges edited cadastral and permit fields without reverting remote metadata", () => {
  const saved = {
    ...fixture,
    cadastralNumber: "47:07:0123456:100",
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: "https://domclick.ru/card/100",
  };
  const draft = {
    ...saved,
    cadastralNumber: "",
    gpzuDone: true,
  };
  const remote = {
    ...saved,
    cadastralNumber: "47:07:0123456:200",
    buildingPermitDone: true,
    mortgageUrl: "https://domclick.ru/card/200",
  };
  const [restored] = mergeAdminDrafts(
    [remote],
    [draft],
    new Map([[saved.id, saved]]),
  );
  assert.equal(restored.cadastralNumber, "");
  assert.equal(restored.gpzuDone, true);
  assert.equal(restored.buildingPermitDone, true);
  assert.equal(restored.mortgageUrl, "https://domclick.ru/card/200");
  assert.deepEqual(toPlotUpdate(fixture), {
    area: "8.12",
    status: "Свободен",
    price: "1200000",
    fullPaymentPrice: "",
    street: "",
    description: "",
    cadastralNumber: "",
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: "",
  });
});

test("logout calls the server to expire the cookie and reports network failures", async (context) => {
  let fail = false;
  mockBrowser(context, async (url, options) => {
    assert.equal(url, "https://worker.test/api/admin/logout");
    assert.equal(options.method, "POST");
    assert.equal(options.body, undefined);
    assertCookieRequest(options);
    if (fail) throw new TypeError("Network error");
    return response({ ok: true });
  });
  const { api } = await loadApi();
  assert.deepEqual(await api.logout(), { ok: true });
  fail = true;
  await assert.rejects(api.logout(), /Не удалось подключиться/);
});

test("public plots and contact requests omit cookies, authorization and unnecessary preflight", async (context) => {
  const calls = [];
  mockBrowser(context, async (url, options) => {
    calls.push([url, options]);
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers.has("Authorization"), false);
    return url.endsWith("/contact")
      ? response({ ok: true })
      : response([fixture]);
  });
  const { api } = await loadApi({ DEV: true });
  const plots = await api.getPlots();
  assert.equal(plots[0].id, fixture.id);
  assert.equal(calls[0][1].headers.has("Content-Type"), false);
  const contact = {
    name: "Покупатель",
    phone: "+7 (999) 111-22-33",
    project: "Другие участки",
    plot: fixture.id,
    comment: "Вопрос",
    consent: true,
  };
  await api.sendContact(contact);
  assert.equal(calls[1][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1][1].body), contact);
});

test("contact submission requires an explicit consent before any network request", async (context) => {
  let calls = 0;
  mockBrowser(context, async () => {
    calls += 1;
    return response({ ok: true });
  });
  const { api, ApiError } = await loadApi();
  for (const consent of [undefined, false, null, "true", 1]) {
    await assert.rejects(
      api.sendContact({
        name: "Анна",
        phone: "+7 999 123-45-67",
        project: "",
        plot: "",
        comment: "",
        consent,
      }),
      (error) => error instanceof ApiError && error.status === 400,
    );
  }
  assert.equal(calls, 0);
});

test("protected mutations use cookie authentication and return validated data", async (context) => {
  const calls = [];
  mockBrowser(context, async (url, options) => {
    calls.push([url, options]);
    assertCookieRequest(options);
    const body = JSON.parse(options.body);
    const singleId = url.includes("/plots/")
      ? decodeURIComponent(url.split("/plots/")[1])
      : fixture.id;
    return response(
      body.plots
        ? body.plots.map((plot) => ({ ...fixture, ...plot }))
        : { ...fixture, id: singleId, ...body },
      options.method === "POST" ? 201 : 200,
    );
  });
  const { api, cache } = await loadApi();
  const update = {
    area: "12",
    price: "1500000",
    fullPaymentPrice: "1400000,50",
    status: "Забронирован",
    street: "Улица",
    description: "Описание",
  };
  assert.equal((await api.createPlot({ id: "new-2", ...update })).id, "new-2");
  assert.equal(
    (await api.updatePlot("номер/с пробелом", update)).price,
    "1500000",
  );
  assert.equal(
    calls[1][0],
    "https://worker.test/api/admin/plots/%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%2F%D1%81%20%D0%BF%D1%80%D0%BE%D0%B1%D0%B5%D0%BB%D0%BE%D0%BC",
  );
  assert.equal(
    (await api.updatePlots([{ id: fixture.id, ...update }]))[0].status,
    "Забронирован",
  );
  assert.equal(
    cache.cached.find(({ id }) => id === fixture.id).fullPaymentPrice,
    "1400000,50",
  );
  assert.equal(
    JSON.parse(calls[2][1].body).plots[0].fullPaymentPrice,
    "1400000,50",
  );
  const cleared = await api.updatePlot(fixture.id, {
    ...update,
    fullPaymentPrice: "",
  });
  assert.equal(cleared.fullPaymentPrice, null);
  assert.equal(
    cache.cached.find(({ id }) => id === fixture.id).fullPaymentPrice,
    null,
  );
});

test("partial or mismatched bulk success cannot mark editor rows as saved", async (context) => {
  let returned = [];
  mockBrowser(context, async () => response(returned));
  const { api, cache } = await loadApi();
  const updates = [{ ...fixture, street: "", description: "" }];
  await assert.rejects(api.updatePlots(updates), /некорректные данные/);
  assert.equal(cache.revision, 0);
  returned = [{ ...fixture, id: "unexpected" }];
  await assert.rejects(api.updatePlots(updates), /некорректные данные/);
  assert.equal(cache.revision, 0);
});

test("a response for a different created or edited plot never updates the cache", async (context) => {
  mockBrowser(context, async () => response({ ...fixture, id: "unexpected" }));
  const { api, cache } = await loadApi();
  const update = {
    area: "10",
    price: "500000",
    status: "Свободен",
    street: "",
    description: "",
  };
  await assert.rejects(
    api.createPlot({ id: "new-plot", ...update }),
    /некорректные данные/,
  );
  await assert.rejects(
    api.updatePlot(fixture.id, update),
    /некорректные данные/,
  );
  assert.equal(cache.revision, 0);
});

test("malformed public plot payloads are rejected before caching", async (context) => {
  let body;
  mockBrowser(context, async () => response(body));
  const { api, cache } = await loadApi();
  for (const invalid of [
    null,
    {},
    [{ ...fixture, id: "" }],
    [{ ...fixture, area: "" }],
    [{ ...fixture, area: "-1" }],
    [{ ...fixture, price: "NaN" }],
    [{ ...fixture, area: "1.001" }],
    [{ ...fixture, status: "unknown" }],
    [fixture, fixture],
    [{ ...fixture, description: {} }],
    [{ ...fixture, cadastralNumber: "47:07:12345:1" }],
    [{ ...fixture, cadastralNumber: 123 }],
    [{ ...fixture, gpzuDone: "true" }],
    [{ ...fixture, gpzuDone: null }],
    [{ ...fixture, buildingPermitDone: 1 }],
    [{ ...fixture, mortgageUrl: "http://domclick.ru/card/1" }],
    [{ ...fixture, mortgageUrl: "https://domclick.ru.evil.test/card/1" }],
    [{ ...fixture, mortgageUrl: "https://user@domclick.ru/card/1" }],
    [{ ...fixture, mortgageUrl: "https://domclick.ru:8443/card/1" }],
    [{ ...fixture, mortgageUrl: "https://.domclick.ru/card/1" }],
    [{ ...fixture, mortgageUrl: "https://fake..domclick.ru/card/1" }],
  ]) {
    body = invalid;
    await assert.rejects(api.getPlots(), /некорректные данные/);
    assert.deepEqual(cache.cached, []);
  }
  body = [{ ...fixture, area: "8,12 сот.", price: "1 200 000 ₽" }];
  assert.equal((await api.getPlots())[0].price, "1200000");
});

test("legacy plots normalize missing sales metadata and validated metadata survives admin saves", async (context) => {
  let body = [fixture];
  mockBrowser(context, async () => response(body));
  const { api, cache } = await loadApi();
  const legacy = (await api.getPlots())[0];
  assert.equal(legacy.cadastralNumber, null);
  assert.equal(legacy.gpzuDone, false);
  assert.equal(legacy.buildingPermitDone, false);
  assert.equal(legacy.mortgageUrl, null);
  const detailed = {
    ...fixture,
    cadastralNumber: " 47:07:0123456:123 ",
    gpzuDone: true,
    buildingPermitDone: false,
    mortgageUrl: " https://spb.domclick.ru/card/123 ",
  };
  body = [detailed];
  const result = (await api.getAdminPlots())[0];
  assert.equal(result.cadastralNumber, "47:07:0123456:123");
  assert.equal(result.mortgageUrl, "https://spb.domclick.ru/card/123");
  assert.equal(cache.cached[0].gpzuDone, true);
  assert.equal(cache.cached[0].buildingPermitDone, false);
});

test("plot reads normalize optional full payment prices without changing legacy base prices", async (context) => {
  let body = [fixture];
  mockBrowser(context, async () => response(body));
  const { api, cache } = await loadApi();
  assert.equal((await api.getPlots())[0].fullPaymentPrice, null);
  for (const value of [null, "", "  "]) {
    body = [{ ...fixture, fullPaymentPrice: value }];
    assert.equal((await api.getPlots())[0].fullPaymentPrice, null);
  }
  body = [{ ...fixture, fullPaymentPrice: "1 000 000,50 ₽" }];
  const [publicPlot] = await api.getPlots();
  assert.equal(publicPlot.fullPaymentPrice, "1000000,50");
  assert.equal(publicPlot.price, "1200000");
  assert.equal((await api.getAdminPlots())[0].fullPaymentPrice, "1000000,50");
  assert.equal(cache.cached[0].fullPaymentPrice, "1000000,50");
});

test("malformed full payment prices are rejected while legacy price relationships remain readable", async (context) => {
  let fullPaymentPrice;
  mockBrowser(context, async () =>
    response([{ ...fixture, fullPaymentPrice }]),
  );
  const { api, cache } = await loadApi();
  for (const invalid of [0, false, {}, "0", "-1", "1.001", "NaN", "₽"]) {
    fullPaymentPrice = invalid;
    await assert.rejects(api.getPlots(), /некорректные данные/);
    assert.deepEqual(cache.cached, []);
  }
  for (const legacy of ["1200000", "1300000"]) {
    fullPaymentPrice = legacy;
    assert.equal((await api.getPlots())[0].fullPaymentPrice, legacy);
  }
});

test("full payment prices can be cleared and otherwise must be positive and below the base price", () => {
  for (const cleared of ["", "  "]) {
    assert.equal(numbers.isValidFullPaymentPrice("1200000", cleared), true);
  }
  for (const price of ["1000000", "1 000 000,50 ₽", "0.01"]) {
    assert.equal(numbers.isValidFullPaymentPrice("1 200 000 ₽", price), true);
  }
  for (const price of ["0", "-1", "1.001", "₽", "1200000", "1300000"]) {
    assert.equal(numbers.isValidFullPaymentPrice("1200000", price), false);
  }
  assert.equal(numbers.isValidFullPaymentPrice("NaN", "1000000"), false);
});

test("public plot reads enforce the mortgage URL limit after percent encoding", async (context) => {
  let mortgageUrl = "https://domclick.ru/card/" + "я".repeat(500);
  mockBrowser(context, async () => response([{ ...fixture, mortgageUrl }]));
  const { api, cache } = await loadApi();
  await assert.rejects(api.getPlots(), /некорректные данные/);
  assert.deepEqual(cache.cached, []);
  mortgageUrl = "https://domclick.ru/card/" + "я".repeat(300);
  assert.equal((await api.getPlots())[0].mortgageUrl, mortgageUrl);
  mortgageUrl = "https://domclick.ru/card/" + "%D1%8F".repeat(300);
  assert.equal((await api.getPlots())[0].mortgageUrl, mortgageUrl);
});

test("promotion settings use public reads, authenticated admin writes and publish confirmed saves", async (context) => {
  const calls = [];
  const settings = { promotion: { enabled: true, discountPercent: 15 } };
  mockBrowser(context, async (url, options) => {
    calls.push([url, options]);
    return response(settings);
  });
  const { api } = await loadApi();
  assert.deepEqual(await api.getSettings(), settings);
  assert.equal(calls[0][0], "https://worker.test/api/settings");
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].headers.has("Content-Type"), false);
  assert.deepEqual(await api.getAdminSettings(), settings);
  assertCookieRequest(calls[1][1]);
  assert.equal(calls[1][0], "https://worker.test/api/admin/settings");
  assert.deepEqual(await api.updateSettings(settings), settings);
  assert.equal(calls[2][1].method, "PUT");
  assertCookieRequest(calls[2][1]);
  assert.deepEqual(JSON.parse(calls[2][1].body), settings);
  assert.deepEqual(await api.getSettings(), settings);
  assert.equal(calls.length, 3);
});

test("malformed promotion reads and saves never replace confirmed settings", async (context) => {
  const confirmed = { promotion: { enabled: false, discountPercent: 10 } };
  let body = confirmed;
  let calls = 0;
  mockBrowser(context, async () => {
    calls += 1;
    return response(body);
  });
  const { api, settingsStore } = await loadApi();
  await api.getSettings();
  for (const invalid of [
    null,
    {},
    { promotion: null },
    { promotion: { enabled: "true", discountPercent: 10 } },
    { promotion: { enabled: true, discountPercent: "10" } },
    { promotion: { enabled: true, discountPercent: 0 } },
    { promotion: { enabled: true, discountPercent: 101 } },
    { promotion: { enabled: true, discountPercent: 1.5 } },
  ]) {
    body = invalid;
    await assert.rejects(
      api.getSettings({ force: true }),
      /некорректные данные/,
    );
    assert.deepEqual(
      settingsStore.getSiteSettingsSnapshot().settings,
      confirmed,
    );
    await assert.rejects(api.getAdminSettings(), /некорректные данные/);
    assert.deepEqual(
      settingsStore.getSiteSettingsSnapshot().settings,
      confirmed,
    );
    const callsBeforeUpdate = calls;
    await assert.rejects(api.updateSettings(invalid), /целым числом/);
    assert.equal(calls, callsBeforeUpdate);
  }
  body = { promotion: { enabled: true, discountPercent: 100 } };
  assert.deepEqual(await api.getSettings(), body);
  assert.equal(settingsStore.getSiteSettingsSnapshot().error, "");
});

test("HTML fallback, malformed JSON and HTTP errors produce readable API errors", async (context) => {
  let result;
  mockBrowser(context, async () => result);
  const { api, ApiError } = await loadApi();
  result = response("<html>App shell</html>", 200, "text/html");
  await assert.rejects(
    api.getAdminPlots(),
    (error) =>
      error instanceof ApiError &&
      error.status === 502 &&
      /Проверьте адрес API/.test(error.message),
  );
  result = new Response("{bad-json", {
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(api.getAdminPlots(), (error) => error.status === 502);
  result = response("Bad gateway", 503, "text/plain");
  await assert.rejects(
    api.getAdminPlots(),
    (error) =>
      error.status === 503 && /Сервер временно недоступен/.test(error.message),
  );
  result = response({ error: "Требуется авторизация" }, 401);
  await assert.rejects(api.getAdminPlots(), (error) => error.status === 401);
});

test("aborting a protected request stops fetch and preserves AbortError", async (context) => {
  let calls = 0;
  mockBrowser(context, async (_url, options) => {
    calls += 1;
    return new Promise((_resolve, reject) =>
      options.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
  });
  const { api } = await loadApi();
  const controller = new AbortController();
  const pending = api.getAdminPlots({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(api.getAdminPlots({ signal: controller.signal }), {
    name: "AbortError",
  });
  assert.equal(calls, 1);
});
