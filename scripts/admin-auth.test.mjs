import assert from "node:assert/strict";
import { createHmac, pbkdf2Sync } from "node:crypto";
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
const {
  ADMIN_COOKIE,
  ADMIN_COOKIE_TTL_SECONDS,
  PASSWORD_HASH_ITERATIONS,
  PASSWORD_HASH_ALGORITHM,
} = await import(constantsUrl);
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

function signedCookie(
  env,
  expiresAt = Math.floor(Date.now() / 1000) + ADMIN_COOKIE_TTL_SECONDS,
) {
  const payload = `v1.${expiresAt}.00000000-0000-4000-8000-000000000000`;
  const signature = createHmac(
    "sha256",
    env.SESSION_SECRET || env.ADMIN_PASSWORD_HASH,
  )
    .update(
      `hamper-admin-v1\n${env.ADMIN_LOGIN}\n${env.ADMIN_PASSWORD_HASH}\n${payload}`,
    )
    .digest("base64url");
  return `${ADMIN_COOKIE}=${payload}.${signature}`;
}

async function loginCookie(env) {
  const response = await worker.fetch(
    request("/api/admin/login", {
      method: "POST",
      body: { login: env.ADMIN_LOGIN, password },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  return response.headers.get("Set-Cookie").split(";")[0];
}

const operations = [
  ["read", "/api/admin/plots", { method: "GET" }],
  [
    "create",
    "/api/admin/plots",
    { method: "POST", body: { ...plot, id: "new-1" } },
  ],
  [
    "bulk update",
    "/api/admin/plots",
    {
      method: "PUT",
      body: { plots: [{ ...plot, area: "12", status: "Продан" }] },
    },
  ],
  [
    "single update",
    `/api/admin/plots/${plot.id}`,
    {
      method: "PUT",
      body: { ...plot, price: "600000", description: "Обновлено" },
    },
  ],
];

test("login verifies credentials once and grants a signed HttpOnly cookie for one day", async () => {
  const { env, calls } = fixture();
  const response = await worker.fetch(
    request("/api/admin/login", {
      method: "POST",
      body: { login, password },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const cookie = response.headers.get("Set-Cookie");
  for (const attribute of [
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
    "Path=/api/admin",
    "Max-Age=86400",
  ])
    assert.ok(cookie.includes(attribute), attribute);
  assert.equal(cookie.includes(login), false);
  assert.equal(cookie.includes(password), false);
  assert.equal(
    response.headers.get("Access-Control-Allow-Credentials"),
    "true",
  );
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    env.PUBLIC_ORIGIN,
  );
  assert.deepEqual(calls, []);
});

test("invalid login does not issue a cookie or access the database", async (t) => {
  for (const body of [
    { login: "wrong-login", password },
    { login, password: "wrong-password" },
    { login, password: "" },
    { login },
    { login, password: "a".repeat(4097) },
  ])
    await t.test(JSON.stringify(body).slice(0, 80), async () => {
      const { env, calls } = fixture();
      const response = await worker.fetch(
        request("/api/admin/login", { method: "POST", body }),
        env,
      );
      assert.equal(response.status, 401);
      assert.equal(response.headers.has("Set-Cookie"), false);
      assert.deepEqual(calls, []);
    });
  const { env, calls } = fixture();
  const response = await worker.fetch(
    new Request("https://worker.test/api/admin/login", {
      method: "POST",
      headers: {
        Origin: env.PUBLIC_ORIGIN,
        "Content-Type": "application/json",
      },
      body: "{broken",
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.deepEqual(calls, []);
});

test("JSON login accepts UTF-8 and colons without retaining credentials", async () => {
  const { env } = fixture();
  env.ADMIN_LOGIN = "админ:владелец";
  const secret = "пароль:🔐";
  env.ADMIN_PASSWORD_HASH = passwordHash(secret);
  const response = await worker.fetch(
    request("/api/admin/login", {
      method: "POST",
      body: { login: env.ADMIN_LOGIN, password: secret },
    }),
    env,
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("Set-Cookie").split(";")[0];
  const read = await worker.fetch(
    request("/api/admin/plots", { headers: { Cookie: cookie } }),
    env,
  );
  assert.equal(read.status, 200);
});

test("every protected read and write rejects invalid cookies before accessing D1", async (t) => {
  for (const [operation, path, options] of operations) {
    const { env, calls } = fixture();
    const valid = signedCookie(env);
    for (const [reason, headers] of [
      ["missing", {}],
      [
        "former Basic credentials",
        {
          Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
        },
      ],
      ["former session cookie", { Cookie: "hamper_session=old-value" }],
      ["malformed", { Cookie: `${ADMIN_COOKIE}=malformed` }],
      [
        "expired",
        { Cookie: signedCookie(env, Math.floor(Date.now() / 1000) - 1) },
      ],
      [
        "future beyond one day",
        {
          Cookie: signedCookie(
            env,
            Math.floor(Date.now() / 1000) + 2 * ADMIN_COOKIE_TTL_SECONDS,
          ),
        },
      ],
      ["forged signature", { Cookie: `${valid.slice(0, -3)}xxx` }],
      ["oversized", { Cookie: `${ADMIN_COOKIE}=${"x".repeat(1000)}` }],
    ])
      await t.test(`${operation}: ${reason}`, async () => {
        const response = await worker.fetch(
          request(path, { ...options, headers }),
          env,
        );
        assert.equal(response.status, 401);
        assert.equal(typeof (await response.json()).error, "string");
        assert.ok(response.headers.get("Set-Cookie").includes("Max-Age=0"));
        assert.deepEqual(calls, []);
      });
  }
});

test("cookie established by login permits all admin operations without password verification", async (t) => {
  for (const [operation, path, options] of operations)
    await t.test(operation, async () => {
      const { env, calls, rows } = fixture();
      const cookie = await loginCookie(env);
      const response = await worker.fetch(
        request(path, { ...options, headers: { Cookie: cookie } }),
        env,
      );
      assert.equal(response.status, options.method === "POST" ? 201 : 200);
      const result = await response.json();
      const returned = Array.isArray(result) ? result[0] : result;
      const expected = options.body?.plots?.[0] ?? options.body ?? plot;
      assert.equal(returned.id, options.method === "POST" ? "new-1" : plot.id);
      for (const key of ["status", "area", "price", "description"])
        assert.equal(returned[key], expected[key]);
      assert.equal(typeof returned.updatedAt, "string");
      assert.ok(calls.length > 0);
      if (options.method === "POST") assert.ok(rows.has("new-1"));
      if (operation === "bulk update") assert.ok(calls.includes("batch"));
      // A normal read/write must not extend the one-day authentication lifetime.
      assert.equal(response.headers.has("Set-Cookie"), false);
    });
});

test("changed login, password hash or optional signing secret invalidates earlier cookies", async (t) => {
  for (const key of ["ADMIN_LOGIN", "ADMIN_PASSWORD_HASH", "SESSION_SECRET"])
    await t.test(key, async () => {
      const { env, calls } = fixture();
      env.SESSION_SECRET = "existing-optional-test-signing-secret";
      const cookie = await loginCookie(env);
      env[key] =
        key === "ADMIN_PASSWORD_HASH"
          ? passwordHash("new-password")
          : "new-value";
      const response = await worker.fetch(
        request("/api/admin/plots", { headers: { Cookie: cookie } }),
        env,
      );
      assert.equal(response.status, 401);
      assert.deepEqual(calls, []);
    });
});

test("foreign and missing Origin cannot log in, log out or mutate data", async (t) => {
  const { env, calls } = fixture();
  const cookie = await loginCookie(env);
  for (const origin of ["https://attacker.test", "null", ""]) {
    for (const [path, options] of [
      ["/api/admin/login", { method: "POST", body: { login, password } }],
      ["/api/admin/logout", { method: "POST" }],
      ...operations
        .filter(([, , { method }]) => method !== "GET")
        .map(([, path, options]) => [path, options]),
    ])
      await t.test(
        `${origin || "missing"}: ${path} ${options.method}`,
        async () => {
          const response = await worker.fetch(
            request(path, {
              ...options,
              headers: { Origin: origin, Cookie: cookie },
            }),
            env,
          );
          assert.equal(response.status, 403);
          assert.equal(response.headers.has("Set-Cookie"), false);
          assert.deepEqual(calls, []);
        },
      );
  }
});

test("admin CORS permits only the configured frontend and has no Authorization header", async () => {
  const { env, calls } = fixture();
  const allowed = await worker.fetch(
    request("/api/admin/plots", { method: "OPTIONS" }),
    env,
  );
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers.get("Access-Control-Allow-Origin"),
    env.PUBLIC_ORIGIN,
  );
  assert.equal(allowed.headers.get("Access-Control-Allow-Credentials"), "true");
  assert.equal(
    allowed.headers.get("Access-Control-Allow-Headers"),
    "Content-Type",
  );
  const denied = await worker.fetch(
    request("/api/admin/plots", {
      method: "OPTIONS",
      headers: { Origin: "https://attacker.test" },
    }),
    env,
  );
  assert.equal(denied.status, 403);
  assert.notEqual(
    denied.headers.get("Access-Control-Allow-Origin"),
    "https://attacker.test",
  );
  assert.deepEqual(calls, []);
});

test("unset PUBLIC_ORIGIN trusts same origin, never reflects a foreign site", async () => {
  const { env, calls } = fixture();
  delete env.PUBLIC_ORIGIN;
  const response = await worker.fetch(
    request("/api/admin/login", {
      method: "POST",
      body: { login, password },
    }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://worker.test",
  );
  const sameOrigin = await worker.fetch(
    request("/api/admin/login", {
      method: "POST",
      body: { login, password },
      headers: { Origin: "https://worker.test" },
    }),
    env,
  );
  assert.equal(sameOrigin.status, 200);
  assert.deepEqual(calls, []);
});

test("logout expires the browser cookie using the same path and attributes", async () => {
  const { env, calls } = fixture();
  const cookie = await loginCookie(env);
  const response = await worker.fetch(
    request("/api/admin/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(
    response.headers.get("Set-Cookie"),
    `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; Max-Age=0; Secure; SameSite=None; Partitioned; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  );
  const afterLogout = await worker.fetch(request("/api/admin/plots"), env);
  assert.equal(afterLogout.status, 401);
  assert.deepEqual(calls, []);
});

test("HTTP localhost uses a Lax HttpOnly cookie for local development", async () => {
  const { env } = fixture();
  env.PUBLIC_ORIGIN = "http://localhost:5173";
  const response = await worker.fetch(
    new Request("http://localhost:8787/api/admin/login", {
      method: "POST",
      headers: {
        Origin: env.PUBLIC_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login, password }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("Set-Cookie");
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.equal(cookie.includes("Secure"), false);
  assert.equal(cookie.includes("Partitioned"), false);
});

test("public requests remain cookie-free and work without authentication", async () => {
  const { env } = fixture();
  const response = await worker.fetch(
    request("/api/plots", {
      headers: { Cookie: `${ADMIN_COOKIE}=invalid` },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.has("Set-Cookie"), false);
  assert.equal(response.headers.has("Access-Control-Allow-Credentials"), false);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  const data = await response.json();
  assert.equal(data[0].id, plot.id);
});

test("admin validation preserves atomic bulk saves and reports missing/duplicate plots", async (t) => {
  for (const [name, body, status] of [
    ["invalid numeric value", { plots: [{ ...plot, area: "-1" }] }, 400],
    ["duplicate IDs", { plots: [plot, plot] }, 400],
    ["missing ID", { plots: [{ ...plot, id: "missing" }] }, 404],
    ["empty batch", { plots: [] }, 400],
  ])
    await t.test(name, async () => {
      const { env, calls, rows } = fixture();
      const before = structuredClone([...rows]);
      const response = await worker.fetch(
        request("/api/admin/plots", {
          method: "PUT",
          body,
          headers: { Cookie: await loginCookie(env) },
        }),
        env,
      );
      assert.equal(response.status, status);
      assert.deepEqual([...rows], before);
      assert.equal(calls.includes("batch"), false);
    });
});
