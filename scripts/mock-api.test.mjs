import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { transformWithOxc } from "vite";

const projectRoot = new URL("../", import.meta.url);
const compiledRoot = await mkdtemp(join(tmpdir(), "hamper-mock-api-"));
after(() => rm(compiledRoot, { recursive: true, force: true }));
let sequence = 0;

async function loadApi(env = { DEV: true, VITE_USE_MOCK_DATA: "true" }) {
  const modules = new Map();
  const scope = ++sequence;
  async function compile(file) {
    if (modules.has(file.href)) return modules.get(file.href);
    const source = await readFile(file, "utf8");
    let { code } = await transformWithOxc(source, fileURLToPath(file));
    code = code.replaceAll("import.meta.env", JSON.stringify(env));
    const imports = [
      ...code.matchAll(/(?:from\s*|import\s*\()(["'])([^"']+)\1/g),
    ];
    for (const [, quote, specifier] of imports) {
      const target = specifier.startsWith(".")
        ? await compile(new URL(`${specifier}.ts`, file))
        : import.meta.resolve(specifier);
      code = code.replaceAll(
        `${quote}${specifier}${quote}`,
        JSON.stringify(target),
      );
    }
    const output = join(
      compiledRoot,
      String(scope),
      relative(fileURLToPath(projectRoot), fileURLToPath(file)),
    ).replace(/\.ts$/, ".mjs");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, code);
    const url = pathToFileURL(output).href;
    modules.set(file.href, url);
    return url;
  }
  return import(await compile(new URL("src/lib/api.ts", projectRoot)));
}

function browser(context, { hostname = "localhost", fetchImpl } = {}) {
  const descriptors = Object.fromEntries(
    ["window", "fetch"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hostname } },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value:
      fetchImpl ??
      (() => assert.fail("The local demo must not send API requests")),
  });
  context.after(() => {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

test("the local public demo shows its promotion without connecting to an API", async (context) => {
  browser(context);
  const { api } = await loadApi();
  assert.deepEqual(await api.getSettings(), {
    promotion: { enabled: true, discountPercent: 12 },
  });
});

test("the local demo exposes plot scenarios for map actions, price offers and document details", async (context) => {
  browser(context);
  const { api } = await loadApi();
  const plots = await api.getPlots();
  const find = (id) => {
    const plot = plots.find((item) => item.id === id);
    assert.ok(plot, `The demo is missing plot ${id}`);
    return plot;
  };
  assert.equal(
    plots.filter((plot) => plot.settlement === "Ойнеловские дали").length,
    21,
  );
  assert.deepEqual(
    [find("1-01").status, find("1-02").status, find("1-04").status],
    ["Свободен", "Забронирован", "Продан"],
  );
  assert.equal(find("1-01").price, "1500000");
  assert.equal(find("1-01").fullPaymentPrice, "1300000");
  assert.equal(find("1-03").fullPaymentPrice, null);
  assert.equal(find("1-01").gpzuDone, true);
  assert.equal(find("1-01").buildingPermitDone, true);
  assert.equal(find("1-02").gpzuDone, false);
  assert.equal(find("1-02").buildingPermitDone, false);
  assert.equal(find("1-01").cadastralNumber, "47:07:0123456:101");
  assert.equal(find("1-02").cadastralNumber, null);
  assert.equal(
    find("1-01").mortgageUrl,
    "https://domclick.ru/card/sale__lot__100000001",
  );
  assert.equal(
    find("1-03").mortgageUrl,
    "https://domclick.ru/card/sale__lot__100000003",
  );
  assert.equal(find("local-2-01").category, "ИЖС");
  assert.equal(find("local-2-01").photos.length, 3);
});

const contact = {
  name: "Демо посетитель",
  phone: "+7 (999) 123-45-67",
  project: "Ойнеловские дали",
  plot: "1-02",
  comment: "Прошу уведомить, если участок 1-02 освободится от брони.",
  consent: true,
};

test("the local demo accepts an inquiry locally and still requires explicit consent", async (context) => {
  browser(context);
  const { api } = await loadApi();
  await assert.rejects(api.sendContact({ ...contact, consent: false }), {
    status: 400,
  });
  await assert.rejects(api.sendContact({ ...contact, consent: "true" }), {
    status: 400,
  });
  assert.deepEqual(await api.sendContact(contact), { ok: true });
});

test("cancelling a local demo inquiry prevents a successful submission result", async (context) => {
  browser(context);
  const { api } = await loadApi();
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  await assert.rejects(
    api.sendContact(contact, { signal: alreadyCancelled.signal }),
    { name: "AbortError" },
  );
  const controller = new AbortController();
  const pending = api.sendContact(contact, { signal: controller.signal });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, { name: "AbortError" });
});

test("admin actions are isolated from the local public demo and cannot replace its cached data", async (context) => {
  browser(context);
  const { api } = await loadApi();
  const plots = await api.getPlots();
  const settings = await api.getSettings();
  for (const action of [
    () => api.login("demo", "demo"),
    () => api.logout(),
    () => api.getAdminPlots(),
    () => api.getAdminSettings(),
    () =>
      api.updateSettings({
        promotion: { enabled: false, discountPercent: 50 },
      }),
    () => api.createPlot({ id: "1-01" }),
    () => api.updatePlots([]),
    () => api.updatePlot("1-01", {}),
  ]) {
    await assert.rejects(action(), { status: 403 });
  }
  assert.equal(await api.getPlots(), plots);
  assert.equal(await api.getSettings(), settings);
});

for (const [scenario, env, hostname] of [
  [
    "production even with a mock flag",
    { DEV: false, VITE_USE_MOCK_DATA: "true" },
    "localhost",
  ],
  ["development without a mock flag", { DEV: true }, "localhost"],
  [
    "development with a disabled mock flag",
    { DEV: true, VITE_USE_MOCK_DATA: "false" },
    "localhost",
  ],
  [
    "development with a mock flag on a public host",
    { DEV: true, VITE_USE_MOCK_DATA: "true" },
    "demo.example.com",
  ],
]) {
  test(`${scenario} continues using real public and admin API requests`, async (context) => {
    const requested = [];
    const livePlot = {
      id: "server-plot",
      settlement: "Другие участки",
      area: "9",
      price: "2200000",
      status: "Свободен",
      street: null,
      description: null,
      updatedAt: "2026-10-21 12:00:00",
    };
    browser(context, {
      hostname,
      fetchImpl: async (url, options) => {
        const path = new URL(url).pathname;
        requested.push([path, options.credentials]);
        let payload;
        if (path === "/api/plots" || path === "/api/admin/plots")
          payload = [livePlot];
        else if (path === "/api/settings")
          payload = { promotion: { enabled: false, discountPercent: 20 } };
        else if (path === "/api/contact") payload = { ok: true };
        else assert.fail(`Unexpected API request: ${path}`);
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const { api } = await loadApi({
      ...env,
      VITE_API_URL: "https://api.example.test",
    });
    assert.equal((await api.getPlots())[0].id, "server-plot");
    assert.deepEqual(await api.getSettings(), {
      promotion: { enabled: false, discountPercent: 20 },
    });
    assert.deepEqual(await api.sendContact(contact), { ok: true });
    assert.equal((await api.getAdminPlots())[0].id, "server-plot");
    assert.deepEqual(requested, [
      ["/api/plots", "omit"],
      ["/api/settings", "omit"],
      ["/api/contact", "omit"],
      ["/api/admin/plots", "include"],
    ]);
  });
}

for (const hostname of ["127.0.0.1", "[::1]"]) {
  test(`the explicit development demo also works on loopback ${hostname}`, async (context) => {
    browser(context, { hostname });
    const { api } = await loadApi();
    assert.equal((await api.getSettings()).promotion.enabled, true);
    assert.equal((await api.getPlots())[0].fullPaymentPrice, "1300000");
  });
}
