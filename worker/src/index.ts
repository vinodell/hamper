interface Env {
  DB: D1Database;
  ADMIN_LOGIN: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  PUBLIC_ORIGIN?: string;
}

type PlotStatus = "Свободен" | "Забронирован" | "Продан";

interface PlotRow {
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
  street: string | null;
  description: string | null;
  updated_at: string;
}

const SESSION_COOKIE = "hamper_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const allowedStatuses = new Set<PlotStatus>([
  "Свободен",
  "Забронирован",
  "Продан",
]);

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index];
  return difference === 0;
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.PUBLIC_ORIGIN ?? origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, request?: Request, env?: Env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(request && env ? corsHeaders(request, env) : {}),
    },
  });
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("Cookie") ?? "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
      }),
  );
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  data.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

async function createSession(login: string, secret: string) {
  const payload = `${login}.${Date.now() + SESSION_TTL_SECONDS * 1000}.${crypto.randomUUID()}`;
  return `${toBase64Url(new TextEncoder().encode(payload))}.${await hmac(payload, secret)}`;
}

async function hasValidSession(request: Request, env: Env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const payload = new TextDecoder().decode(fromBase64Url(encoded));
  const expected = await hmac(payload, env.SESSION_SECRET);
  if (expected.length !== signature.length) return false;
  const validSignature = constantTimeEqual(
    new TextEncoder().encode(expected),
    new TextEncoder().encode(signature),
  );
  const expiresAt = Number(payload.split(".")[1]);
  return validSignature && Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function verifyPassword(password: string, encodedHash: string) {
  const [saltText, hashText] = encodedHash.split(":");
  if (!saltText || !hashText) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(hashText);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      key,
      expected.length * 8,
    ),
  );
  if (derived.length !== expected.length) return false;
  return constantTimeEqual(derived, expected);
}

async function requireSession(request: Request, env: Env) {
  return hasValidSession(request, env);
}

function mapPlot(row: PlotRow) {
  return {
    id: row.id,
    settlement: row.settlement,
    area: row.area,
    status: row.status,
    price: row.price,
    street: row.street,
    description: row.description,
    updatedAt: row.updated_at,
  };
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders(request, env) });

  if (url.pathname === "/api/health")
    return json({ ok: true }, 200, request, env);

  if (url.pathname === "/api/plots" && request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM plots ORDER BY settlement, id",
    ).all<PlotRow>();
    return json(result.results.map(mapPlot), 200, request, env);
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await request.json<{ login?: string; password?: string }>();
    if (
      !body.login ||
      !body.password ||
      body.login !== env.ADMIN_LOGIN ||
      !(await verifyPassword(body.password, env.ADMIN_PASSWORD_HASH))
    ) {
      return json({ error: "Неверный логин или пароль" }, 401, request, env);
    }
    const session = await createSession(body.login, env.SESSION_SECRET);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request, env),
        "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_TTL_SECONDS}`,
      },
    });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(request, env),
        "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`,
      },
    });
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return json(
      { authenticated: await hasValidSession(request, env) },
      200,
      request,
      env,
    );
  }

  if (url.pathname === "/api/contact" && request.method === "POST") {
    const body = await request.json<{
      name?: string;
      phone?: string;
      project?: string;
      plot?: string;
      comment?: string;
    }>();
    if (
      !body.name ||
      !body.phone ||
      body.name.length > 120 ||
      body.phone.length > 40
    )
      return json({ error: "Заполните имя и телефон" }, 400, request, env);
    const message = [
      `Новая заявка Hamper`,
      `Имя: ${body.name}`,
      `Телефон: ${body.phone}`,
      `Проект: ${body.project ?? "не указан"}`,
      `Участок: ${body.plot ?? "не указан"}`,
      `Комментарий: ${body.comment ?? "—"}`,
    ].join("\n");
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
      },
    );
    if (!telegramResponse.ok)
      return json({ error: "Не удалось отправить заявку" }, 502, request, env);
    return json({ ok: true }, 200, request, env);
  }

  const plotMatch = url.pathname.match(/^\/api\/admin\/plots\/([^/]+)$/);
  if (plotMatch && request.method === "PUT") {
    if (!(await requireSession(request, env)))
      return json({ error: "Требуется авторизация" }, 401, request, env);
    const body = await request.json<{
      area?: string;
      status?: PlotStatus;
      price?: string;
      street?: string;
      description?: string;
    }>();
    if (
      !body.area ||
      !body.price ||
      !body.status ||
      !allowedStatuses.has(body.status)
    )
      return json({ error: "Некорректные данные участка" }, 400, request, env);
    const result = await env.DB.prepare(
      "UPDATE plots SET area = ?, status = ?, price = ?, street = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *",
    )
      .bind(
        body.area,
        body.status,
        body.price,
        body.street ?? null,
        body.description ?? null,
        plotMatch[1],
      )
      .first<PlotRow>();
    if (!result) return json({ error: "Участок не найден" }, 404, request, env);
    return json(mapPlot(result), 200, request, env);
  }

  return json({ error: "Not found" }, 404, request, env);
}

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
