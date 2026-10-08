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
const { mergeAdminDrafts, toPlotUpdate } = await import(
  asModule(
    (await compile("adminDrafts")).replace(
      /(["'])\.\/plotNumbers\1/g,
      JSON.stringify(numbersUrl),
    ),
  )
);
const apiCode = await compile("api");
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
    export const plotStatuses = ["Свободен", "Забронирован", "Продан"];`);
  const replacements = {
    adminAuth: authUrl,
    plotNumbers: numbersUrl,
    constants: constantsUrl,
    plotsCache: cacheUrl,
  };
  const code = apiCode
    .replace(
      /(["'])\.\/(adminAuth|plotNumbers|constants|plotsCache)\1/g,
      (_, _quote, name) => JSON.stringify(replacements[name]),
    )
    .replaceAll("import.meta.env", JSON.stringify(env));
  return {
    ...(await import(`${asModule(code)}#${sequence}`)),
    cache: await import(cacheUrl),
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
  };
  await api.sendContact(contact);
  assert.equal(calls[1][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1][1].body), contact);
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
  const { api } = await loadApi();
  const update = {
    area: "12",
    price: "1500000",
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
  ]) {
    body = invalid;
    await assert.rejects(api.getPlots(), /некорректные данные/);
    assert.deepEqual(cache.cached, []);
  }
  body = [{ ...fixture, area: "8,12 сот.", price: "1 200 000 ₽" }];
  assert.equal((await api.getPlots())[0].price, "1200000");
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
