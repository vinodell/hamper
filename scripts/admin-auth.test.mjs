import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

// Compile the real Worker in memory, without a deployment or generated files.
const sourceRoot = new URL("../worker/src/", import.meta.url);
const asModule = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const constantsSource = await transformWithOxc(
  await readFile(new URL("constants.ts", sourceRoot), "utf8"),
  "constants.ts",
);
const constantsUrl = asModule(constantsSource.code);
const { PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_ALGORITHM } =
  await import(constantsUrl);
const workerSource = await transformWithOxc(
  await readFile(new URL("index.ts", sourceRoot), "utf8"),
  "index.ts",
);
const { default: worker } = await import(
  asModule(
    workerSource.code.replace(
      /(["'])\.\/constants\1/g,
      JSON.stringify(constantsUrl),
    ),
  )
);

const login = "test-admin";
const password = "local-test-password";
function passwordHash(value) {
  const salt = Buffer.from("local-auth-test-salt");
  const hash = pbkdf2Sync(
    value,
    salt,
    PASSWORD_HASH_ITERATIONS,
    32,
    PASSWORD_HASH_ALGORITHM.replace("-", "").toLowerCase(),
  );
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}
const hash = passwordHash(password);
const authorization = (username = login, secret = password) =>
  `Basic ${Buffer.from(`${username}:${secret}`, "utf8").toString("base64")}`;
const plot = {
  id: "fixture-1",
  area: "10",
  status: "Свободен",
  price: "500000",
  street: "Тестовая улица",
  description: "Тестовый участок",
};

function fixture() {
  const calls = [];
  const rows = new Map([
    [
      plot.id,
      {
        ...plot,
        settlement: "Тестовый посёлок",
        updated_at: "2026-01-01 00:00:00",
      },
    ],
  ]);
  const DB = {
    prepare(sql) {
      calls.push(sql);
      let values = [];
      return {
        bind(...parameters) {
          values = parameters;
          return this;
        },
        async all() {
          if (sql === "SELECT id FROM plots")
            return { results: [...rows.keys()].map((id) => ({ id })) };
          assert.equal(sql, "SELECT * FROM plots ORDER BY settlement, id");
          return { results: [...rows.values()] };
        },
        async first() {
          if (sql.startsWith("INSERT INTO plots")) {
            const [id, settlement, area, status, price, street, description] =
              values;
            if (rows.has(id)) return null;
            const row = {
              id,
              settlement,
              area,
              status,
              price,
              street,
              description,
              updated_at: "2026-01-01 00:00:00",
            };
            rows.set(id, row);
            return row;
          }
          assert.ok(sql.startsWith("UPDATE plots SET"));
          const [area, status, price, street, description, id] = values;
          const existing = rows.get(id);
          if (!existing) return null;
          const row = { ...existing, area, status, price, street, description };
          rows.set(id, row);
          return row;
        },
      };
    },
    async batch(statements) {
      calls.push("batch");
      return Promise.all(
        statements.map(async (statement) => {
          const row = await statement.first();
          return { success: true, results: row ? [row] : [] };
        }),
      );
    },
  };
  return {
    calls,
    rows,
    env: {
      DB,
      ADMIN_LOGIN: login,
      ADMIN_PASSWORD_HASH: hash,
      PUBLIC_ORIGIN: "https://site.test",
    },
  };
}

function request(path, { method = "GET", body, headers = {} } = {}) {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      Origin: "https://site.test",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function assertCookieFree(response) {
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.equal(response.headers.has("Access-Control-Allow-Credentials"), false);
}

const operations = [
  ["read", "/api/admin/plots", { method: "GET" }],
  ["create", "/api/admin/plots", { method: "POST", body: { ...plot, id: "new-1" } }],
  ["bulk update", "/api/admin/plots", {
    method: "PUT", body: { plots: [{ ...plot, area: "12", status: "Продан" }] },
  }],
  ["single update", `/api/admin/plots/${plot.id}`, {
    method: "PUT", body: { ...plot, price: "600000", description: "Обновлено" },
  }],
];

test("every admin read/write rejects invalid credentials before accessing D1", async (t) => {
  const invalidHeaders = [
    ["missing credentials", {}],
    ["wrong login", { Authorization: authorization("wrong-login") }],
    ["wrong password", { Authorization: authorization(login, "wrong-password") }],
    ["invalid base64", { Authorization: "Basic !!!!" }],
    ["missing separator", { Authorization: `Basic ${Buffer.from(login).toString("base64")}` }],
    ["unsupported scheme", { Authorization: "Bearer old-session" }],
    ["old cookie only", { Cookie: "hamper_session=old-cookie-value" }],
  ];
  for (const [operation, path, options] of operations) {
    for (const [reason, headers] of invalidHeaders) {
      await t.test(`${operation}: ${reason}`, async () => {
        const { env, calls } = fixture();
        const response = await worker.fetch(request(path, { ...options, headers }), env);
        assert.equal(response.status, 401);
        assert.equal(typeof (await response.json()).error, "string");
        assert.deepEqual(calls, []);
        assertCookieFree(response);
      });
    }
  }
});

test("correct Basic credentials permit all admin operations", async (t) => {
  for (const [operation, path, options] of operations) {
    await t.test(operation, async () => {
      const { env, calls, rows } = fixture();
      const response = await worker.fetch(
        request(path, { ...options, headers: { Authorization: authorization() } }),
        env,
      );
      assert.equal(response.status, options.method === "POST" ? 201 : 200);
      const result = await response.json();
      const returned = Array.isArray(result) ? result[0] : result;
      const expected = options.body?.plots?.[0] ?? options.body ?? plot;
      assert.equal(returned.id, options.method === "POST" ? "new-1" : plot.id);
      assert.equal(returned.status, expected.status);
      assert.equal(returned.area, expected.area);
      assert.equal(returned.price, expected.price);
      assert.equal(returned.description, expected.description);
      assert.equal(typeof returned.updatedAt, "string");
      assert.ok(calls.length > 0);
      if (options.method === "POST") assert.ok(rows.has("new-1"));
      if (operation === "bulk update") assert.ok(calls.includes("batch"));
      assertCookieFree(response);

      // A successful request must not grant access to the next request.
      calls.length = 0;
      const unauthenticated = await worker.fetch(request(path, options), env);
      assert.equal(unauthenticated.status, 401);
      assert.deepEqual(calls, []);
    });
  }
});

test("Basic credentials support UTF-8 logins and passwords containing colons", async () => {
  const { env } = fixture();
  env.ADMIN_LOGIN = "администратор";
  const unicodePassword = "пароль:с двоеточием:🔐";
  env.ADMIN_PASSWORD_HASH = passwordHash(unicodePassword);
  const response = await worker.fetch(
    request("/api/admin/plots", {
      headers: {
        Authorization: authorization(env.ADMIN_LOGIN, unicodePassword),
        Cookie: "hamper_session=ignored-old-cookie",
      },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assertCookieFree(response);
});

test("preflight allows Authorization without authentication or cookies", async () => {
  const { env, calls } = fixture();
  const response = await worker.fetch(
    request("/api/admin/plots", {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), env.PUBLIC_ORIGIN);
  assert.deepEqual(
    new Set(response.headers.get("Access-Control-Allow-Headers").toLowerCase().split(/\s*,\s*/)),
    new Set(["authorization", "content-type"]),
  );
  assert.ok(response.headers.get("Access-Control-Allow-Methods").includes("PUT"));
  assert.deepEqual(calls, []);
  assertCookieFree(response);
});

test("former cookie-session endpoints are removed", async (t) => {
  for (const [path, method] of [
    ["/api/auth/login", "POST"],
    ["/api/auth/logout", "POST"],
    ["/api/auth/me", "GET"],
  ]) {
    await t.test(path, async () => {
      const { env, calls } = fixture();
      const response = await worker.fetch(
        request(path, { method, headers: { Authorization: authorization() } }),
        env,
      );
      assert.equal(response.status, 404);
      assert.deepEqual(calls, []);
      assertCookieFree(response);
    });
  }
});

test("public responses and validation errors stay cookie-free", async () => {
  const { env } = fixture();
  const publicResponse = await worker.fetch(request("/api/plots"), env);
  assert.equal(publicResponse.status, 200);
  assertCookieFree(publicResponse);

  const invalidUpdate = await worker.fetch(
    request(`/api/admin/plots/${plot.id}`, {
      method: "PUT",
      body: { ...plot, area: "-1" },
      headers: { Authorization: authorization() },
    }),
    env,
  );
  assert.equal(invalidUpdate.status, 400);
  assertCookieFree(invalidUpdate);
});
