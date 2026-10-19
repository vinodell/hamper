import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { transformWithOxc } from "vite";

const root = new URL("../", import.meta.url);
const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const constants = await transformWithOxc(
  await readFile(new URL("worker/src/constants.ts", root), "utf8"),
  "constants.ts",
);
const source = await transformWithOxc(
  await readFile(new URL("worker/src/index.ts", root), "utf8"),
  "index.ts",
);
const worker = (
  await import(
    moduleUrl(
      source.code.replace(
        /(["'])\.\/constants\1/g,
        JSON.stringify(moduleUrl(constants.code)),
      ),
    )
  )
).default;
const schema = await readFile(new URL("worker/schema.sql", root), "utf8");

function d1Adapter(database) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      let values = [];
      return {
        bind(...parameters) {
          values = parameters;
          return this;
        },
        async all() {
          return { success: true, results: statement.all(...values) };
        },
        async first() {
          return statement.get(...values) ?? null;
        },
      };
    },
    async batch(statements) {
      database.exec("BEGIN");
      try {
        const results = await Promise.all(statements.map((item) => item.all()));
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function fixture(context, initialSchema = schema) {
  const database = new DatabaseSync(":memory:");
  database.exec(initialSchema);
  context.after(() => database.close());
  const env = {
    DB: d1Adapter(database),
    ADMIN_LOGIN: "sales-admin",
    ADMIN_PASSWORD_HASH: "local-test-hash",
    PUBLIC_ORIGIN: "https://site.test",
  };
  const payload = `v1.${Math.floor(Date.now() / 1000) + 86400}.00000000-0000-4000-8000-000000000000`;
  const signature = createHmac("sha256", env.ADMIN_PASSWORD_HASH)
    .update(
      `hamper-admin-v1\n${env.ADMIN_LOGIN}\n${env.ADMIN_PASSWORD_HASH}\n${payload}`,
    )
    .digest("base64url");
  return {
    database,
    async request(
      path,
      { method = "GET", body, admin = false, origin = env.PUBLIC_ORIGIN } = {},
    ) {
      return worker.fetch(
        new Request(`https://worker.test${path}`, {
          method,
          headers: {
            Origin: origin,
            ...(admin
              ? { Cookie: `hamper_admin=${payload}.${signature}` }
              : {}),
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        env,
      );
    },
  };
}

const plot = {
  id: "sales-1",
  area: "10",
  status: "Свободен",
  price: "1500000",
  street: "Служебная улица",
  description: "Участок у леса",
};
const salesFields = {
  cadastralNumber: "47:07:1044001:123",
  gpzuDone: true,
  buildingPermitDone: false,
  mortgageUrl: "https://spb.domclick.ru/card/sale__lot__123456",
};

test("admin can create plot documents and a mortgage listing visible in the public catalogue", async (context) => {
  const { request } = fixture(context);
  const created = await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, ...salesFields },
  });
  assert.equal(created.status, 201);
  const saved = await created.json();
  for (const [key, value] of Object.entries(salesFields))
    assert.equal(saved[key], value, key);
  const catalogue = await request("/api/plots");
  assert.equal(catalogue.status, 200);
  const [visible] = await catalogue.json();
  for (const [key, value] of Object.entries(salesFields))
    assert.equal(visible[key], value, key);
  assert.equal("street" in visible, false);
  assert.equal("updatedAt" in visible, false);
});

test("admin can edit sales details and older single-plot saves preserve those details", async (context) => {
  const { request } = fixture(context);
  await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, ...salesFields },
  });
  const changed = {
    cadastralNumber: "47:07:1044001:456",
    gpzuDone: false,
    buildingPermitDone: true,
    mortgageUrl: "https://domclick.ru/card/sale__lot__789",
  };
  const updated = await request(`/api/admin/plots/${plot.id}`, {
    method: "PUT",
    admin: true,
    body: { ...plot, ...changed },
  });
  assert.equal(updated.status, 200);
  const saved = await updated.json();
  for (const [key, value] of Object.entries(changed))
    assert.equal(saved[key], value, key);
  const legacy = await request(`/api/admin/plots/${plot.id}`, {
    method: "PUT",
    admin: true,
    body: { area: "11", status: "Свободен", price: "1600000" },
  });
  assert.equal(legacy.status, 200);
  const preserved = await legacy.json();
  for (const [key, value] of Object.entries(changed))
    assert.equal(preserved[key], value, key);
  assert.equal(preserved.street, plot.street);
  assert.equal(preserved.description, plot.description);
  const [publicPlot] = await (await request("/api/plots")).json();
  assert.equal(publicPlot.price, "1600000");
  assert.equal(publicPlot.gpzuDone, false);
  assert.equal(publicPlot.buildingPermitDone, true);
});

test("promotion settings persist independently of plot saves and are readable publicly", async (context) => {
  const { request } = fixture(context);
  const initial = await request("/api/settings");
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), {
    promotion: { enabled: true, discountPercent: 10 },
  });
  const saved = await request("/api/admin/settings", {
    method: "PUT",
    admin: true,
    body: { promotion: { enabled: false, discountPercent: 23 } },
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), {
    promotion: { enabled: false, discountPercent: 23 },
  });
  await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: plot,
  });
  for (const path of ["/api/settings", "/api/admin/settings"]) {
    const response = await request(path, { admin: path.includes("/admin/") });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      promotion: { enabled: false, discountPercent: 23 },
    });
  }
});

test("existing databases migrate without losing plots and receive safe sales defaults", async (context) => {
  const initial = await readFile(
    new URL("worker/migrations/0000_initial.sql", root),
    "utf8",
  );
  const migration = await readFile(
    new URL("worker/migrations/0001_sales_features.sql", root),
    "utf8",
  );
  const legacySchema = `
    CREATE TABLE plots (
      id TEXT PRIMARY KEY, settlement TEXT NOT NULL, area TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Свободен', 'Забронирован', 'Продан')),
      price TEXT NOT NULL, street TEXT, description TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO plots (id, settlement, area, status, price, street, description)
      VALUES ('sales-1', 'Посёлок', '10', 'Свободен', '1500000', 'Улица', 'Существующий участок');
  `;
  const { request } = fixture(context, legacySchema + initial + migration);
  const catalogue = await request("/api/plots");
  assert.equal(catalogue.status, 200);
  const [existing] = await catalogue.json();
  assert.equal(existing.description, "Существующий участок");
  assert.equal(existing.cadastralNumber, null);
  assert.equal(existing.gpzuDone, false);
  assert.equal(existing.buildingPermitDone, false);
  assert.equal(existing.mortgageUrl, null);
  const settings = await request("/api/settings");
  assert.equal(settings.status, 200);
  assert.deepEqual(await settings.json(), {
    promotion: { enabled: true, discountPercent: 10 },
  });
  const updated = await request(`/api/admin/plots/${plot.id}`, {
    method: "PUT",
    admin: true,
    body: { ...plot, ...salesFields },
  });
  assert.equal(updated.status, 200);
  assert.equal(
    (await updated.json()).cadastralNumber,
    salesFields.cadastralNumber,
  );
});

test("the complete migration chain initializes an empty database for sales requests", async (context) => {
  const initial = await readFile(
    new URL("worker/migrations/0000_initial.sql", root),
    "utf8",
  );
  const sales = await readFile(
    new URL("worker/migrations/0001_sales_features.sql", root),
    "utf8",
  );
  const { request } = fixture(context, initial + sales);
  const settings = await request("/api/settings");
  assert.equal(settings.status, 200);
  assert.deepEqual(await settings.json(), {
    promotion: { enabled: true, discountPercent: 10 },
  });
  const created = await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, ...salesFields },
  });
  assert.equal(created.status, 201);
  const catalogue = await request("/api/plots");
  assert.equal(catalogue.status, 200);
  const [visible] = await catalogue.json();
  assert.equal(visible.id, plot.id);
  for (const [key, value] of Object.entries(salesFields))
    assert.equal(visible[key], value, key);
});

test("mortgage listings reject invalid hosts and unsafe URL schemes without creating a plot", async (context) => {
  const { request } = fixture(context);
  for (const mortgageUrl of [
    "https://.domclick.ru/card/123",
    "https://fake..domclick.ru/card/123",
    "https://domclick.ru.attacker.test/card/123",
    "https://fakedomclick.ru/card/123",
    "http://domclick.ru/card/123",
    "javascript:alert(1)",
    "https://admin:secret@domclick.ru/card/123",
    "https://domclick.ru:8443/card/123",
    "https://domclick.ru/" + "x".repeat(2048),
    42,
  ]) {
    const response = await request("/api/admin/plots", {
      method: "POST",
      admin: true,
      body: { ...plot, mortgageUrl },
    });
    assert.equal(response.status, 400, String(mortgageUrl).slice(0, 120));
  }
  assert.deepEqual(await (await request("/api/plots")).json(), []);
});

test("mortgage URL limits include percent encoding so saved plots remain readable", async (context) => {
  const { request } = fixture(context);
  const oversized = await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: {
      ...plot,
      mortgageUrl: "https://domclick.ru/card/" + "я".repeat(500),
    },
  });
  assert.equal(oversized.status, 400);
  assert.deepEqual(await (await request("/api/plots")).json(), []);
  const accepted = await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: {
      ...plot,
      mortgageUrl: "https://domclick.ru/card/" + "я".repeat(300),
    },
  });
  assert.equal(accepted.status, 201);
  const expected = "https://domclick.ru/card/" + "%D1%8F".repeat(300);
  assert.equal((await accepted.json()).mortgageUrl, expected);
  const [visible] = await (await request("/api/plots")).json();
  assert.equal(visible.mortgageUrl, expected);
});

test("bulk plot edits save document flags and preserve omitted details across older bulk requests", async (context) => {
  const { request } = fixture(context);
  await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, ...salesFields },
  });
  await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, id: "sales-2" },
  });
  const saved = await request("/api/admin/plots", {
    method: "PUT",
    admin: true,
    body: {
      plots: [
        {
          ...plot,
          gpzuDone: false,
          buildingPermitDone: true,
          cadastralNumber: "",
          mortgageUrl: null,
        },
        { ...plot, id: "sales-2", ...salesFields },
      ],
    },
  });
  assert.equal(saved.status, 200);
  const [cleared, second] = await saved.json();
  assert.equal(cleared.cadastralNumber, null);
  assert.equal(cleared.mortgageUrl, null);
  assert.equal(cleared.gpzuDone, false);
  assert.equal(cleared.buildingPermitDone, true);
  assert.equal(second.gpzuDone, true);
  const legacy = await request("/api/admin/plots", {
    method: "PUT",
    admin: true,
    body: {
      plots: [
        { id: plot.id, area: "12", price: "1800000", status: "Свободен" },
        { id: "sales-2", area: "13", price: "2000000", status: "Свободен" },
      ],
    },
  });
  assert.equal(legacy.status, 200);
  const catalogue = await (await request("/api/plots")).json();
  assert.equal(catalogue[0].buildingPermitDone, true);
  assert.equal(catalogue[0].description, plot.description);
  assert.equal(catalogue[1].cadastralNumber, salesFields.cadastralNumber);
  assert.equal(catalogue[1].mortgageUrl, salesFields.mortgageUrl);
});

test("malformed cadastral numbers or document flags reject a complete bulk save atomically", async (context) => {
  const { request } = fixture(context);
  await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, ...salesFields },
  });
  await request("/api/admin/plots", {
    method: "POST",
    admin: true,
    body: { ...plot, id: "sales-2" },
  });
  for (const invalid of [
    { cadastralNumber: "47:7:1044001:123" },
    { cadastralNumber: "47:07:10440:123" },
    { cadastralNumber: "x".repeat(81) },
    { cadastralNumber: 123 },
    { gpzuDone: "true" },
    { gpzuDone: null },
    { buildingPermitDone: 1 },
    { mortgageUrl: "https://example.com/" },
  ]) {
    const response = await request("/api/admin/plots", {
      method: "PUT",
      admin: true,
      body: {
        plots: [
          { ...plot, price: "9999999", gpzuDone: false },
          { ...plot, id: "sales-2", ...invalid },
        ],
      },
    });
    assert.equal(response.status, 400, JSON.stringify(invalid));
  }
  const [unchanged] = await (await request("/api/plots")).json();
  assert.equal(unchanged.price, plot.price);
  assert.equal(unchanged.gpzuDone, true);
});

test("promotion settings require the admin cookie, trusted Origin and strictly valid values", async (context) => {
  const { request } = fixture(context);
  const valid = { promotion: { enabled: true, discountPercent: 25 } };
  for (const method of ["GET", "PUT"]) {
    const unauthenticated = await request("/api/admin/settings", {
      method,
      ...(method === "PUT" ? { body: valid } : {}),
    });
    assert.equal(unauthenticated.status, 401);
    const foreign = await request("/api/admin/settings", {
      method,
      admin: true,
      origin: "https://attacker.test",
      ...(method === "PUT" ? { body: valid } : {}),
    });
    assert.equal(foreign.status, 403);
  }
  for (const promotion of [
    null,
    [],
    {},
    { enabled: "true", discountPercent: 25 },
    { enabled: false, discountPercent: "25" },
    { enabled: true, discountPercent: 0 },
    { enabled: true, discountPercent: 101 },
    { enabled: true, discountPercent: 1.5 },
    { enabled: true },
  ]) {
    const invalid = await request("/api/admin/settings", {
      method: "PUT",
      admin: true,
      body: { promotion },
    });
    assert.equal(invalid.status, 400, JSON.stringify(promotion));
  }
  const publicSettings = await request("/api/settings");
  assert.equal(publicSettings.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(publicSettings.headers.has("Set-Cookie"), false);
  assert.deepEqual(await publicSettings.json(), {
    promotion: { enabled: true, discountPercent: 10 },
  });
});
