import {
  allowedStatuses,
  PASSWORD_HASH_ITERATIONS,
  PASSWORD_HASH_ALGORITHM,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  TELEGRAM_API_URL,
  TELEGRAM_TIMEOUT_MS,
  OTHER_PLOTS_SETTLEMENT,
  PLOT_ID_MAX_LENGTH,
  PLOT_STREET_MAX_LENGTH,
  PLOT_DESCRIPTION_MAX_LENGTH,
  BULK_PLOTS_MAX_LENGTH,
  type PlotStatus,
} from "./constants";
import type { Env, PlotRow } from "./types";

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface PlotUpdate {
  area: string;
  status: PlotStatus;
  price: string;
  street: string | null;
  description: string | null;
}

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, request?: Request, env?: Env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(request && env ? corsHeaders(request, env) : {}),
    },
  });
}

function fromBase64Url(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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
      {
        name: "PBKDF2",
        salt,
        iterations: PASSWORD_HASH_ITERATIONS,
        hash: PASSWORD_HASH_ALGORITHM,
      },
      key,
      expected.length * 8,
    ),
  );
  if (derived.length !== expected.length) return false;
  return constantTimeEqual(derived, expected);
}

async function hasAdminAccess(request: Request, env: Env) {
  const encoded = request.headers
    .get("Authorization")
    ?.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/i)?.[1];
  if (!encoded || encoded.length > 32_768) return false;

  let credentials: string;
  try {
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    );
    credentials = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return false;
  }

  const separator = credentials.indexOf(":");
  if (separator < 1) return false;
  const login = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  if (login !== env.ADMIN_LOGIN || !password || password.length > 4096)
    return false;
  return verifyPassword(password, env.ADMIN_PASSWORD_HASH);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new RequestError(400, "Некорректный JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new RequestError(400, "Некорректный формат данных");
  return value as Record<string, unknown>;
}

function validatePlotId(value: unknown) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f]/.test(value))
    throw new RequestError(400, "Некорректный номер участка");
  const id = value.trim();
  if (!id || id.length > PLOT_ID_MAX_LENGTH)
    throw new RequestError(400, "Некорректный номер участка");
  return id;
}

function positiveDecimal(value: unknown) {
  if (typeof value !== "string")
    throw new RequestError(400, "Некорректные данные участка");
  const decimal = value.trim().replace(",", ".");
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(decimal) ||
    !Number.isFinite(Number(decimal)) ||
    Number(decimal) <= 0
  )
    throw new RequestError(400, "Некорректные данные участка");
  return decimal;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > maxLength)
    throw new RequestError(400, "Некорректные текстовые данные");
  return value.trim() || null;
}

function validatePlotUpdate(body: Record<string, unknown>): PlotUpdate {
  if (
    typeof body.status !== "string" ||
    !allowedStatuses.has(body.status as PlotStatus)
  )
    throw new RequestError(400, "Некорректный статус участка");
  return {
    area: positiveDecimal(body.area),
    status: body.status as PlotStatus,
    price: positiveDecimal(body.price),
    street: optionalText(body.street, PLOT_STREET_MAX_LENGTH),
    description: optionalText(body.description, PLOT_DESCRIPTION_MAX_LENGTH),
  };
}

function updatePlotStatement(env: Env, id: string, plot: PlotUpdate) {
  return env.DB.prepare(
    "UPDATE plots SET area = ?, status = ?, price = ?, street = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *",
  ).bind(
    plot.area,
    plot.status,
    plot.price,
    plot.street,
    plot.description,
    id,
  );
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

  if (url.pathname === "/api/contact" && request.method === "POST") {
    const body = await readBody(request);
    if (
      typeof body.name !== "string" ||
      typeof body.phone !== "string" ||
      !body.name.trim() ||
      !body.phone.trim() ||
      body.name.length > CONTACT_NAME_MAX_LENGTH ||
      body.phone.length > CONTACT_PHONE_MAX_LENGTH
    )
      return json({ error: "Заполните имя и телефон" }, 400, request, env);
    const project = optionalText(body.project, 200);
    const plot = optionalText(body.plot, PLOT_ID_MAX_LENGTH);
    const comment = optionalText(body.comment, 2000);
    const message = [
      `📩 Новая заявка Hamper`,
      "",
      `👤 Имя: ${body.name.trim()}`,
      `📞 Телефон: ${body.phone.trim()}`,
      `🏡 Проект: ${project || "не указан"}`,
      `📍 Участок: ${plot || "не указан"}`,
      `💬 Комментарий: ${comment || "—"}`,
    ].join("\n");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
      const telegramResponse = await fetch(
        `${TELEGRAM_API_URL}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
          signal: controller.signal,
        },
      );
      if (!telegramResponse.ok)
        return json({ error: "Не удалось отправить заявку" }, 502, request, env);
      const result: unknown = await telegramResponse.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("ok" in result) ||
        result.ok !== true
      )
        return json({ error: "Не удалось отправить заявку" }, 502, request, env);
    } catch {
      return json({ error: "Не удалось отправить заявку" }, 502, request, env);
    } finally {
      clearTimeout(timeout);
    }
    return json({ ok: true }, 200, request, env);
  }

  if (
    url.pathname === "/api/admin/plots" &&
    ["GET", "POST", "PUT"].includes(request.method)
  ) {
    if (!(await hasAdminAccess(request, env)))
      return json({ error: "Требуется авторизация" }, 401, request, env);

    if (request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM plots ORDER BY settlement, id",
      ).all<PlotRow>();
      return json(result.results.map(mapPlot), 200, request, env);
    }

    const body = await readBody(request);
    if (request.method === "POST") {
      const id = validatePlotId(body.id);
      const plot = validatePlotUpdate(body);
      const row = await env.DB.prepare(
        "INSERT INTO plots (id, settlement, area, status, price, street, description) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING *",
      )
        .bind(
          id,
          OTHER_PLOTS_SETTLEMENT,
          plot.area,
          plot.status,
          plot.price,
          plot.street,
          plot.description,
        )
        .first<PlotRow>();
      if (!row)
        return json(
          { error: "Участок с таким номером уже существует" },
          409,
          request,
          env,
        );
      return json(mapPlot(row), 201, request, env);
    }

    if (
      !Array.isArray(body.plots) ||
      body.plots.length === 0 ||
      body.plots.length > BULK_PLOTS_MAX_LENGTH
    )
      throw new RequestError(400, "Некорректный список участков");
    const updates = body.plots.map((value: unknown) => {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new RequestError(400, "Некорректные данные участка");
      const record = value as Record<string, unknown>;
      return { id: validatePlotId(record.id), plot: validatePlotUpdate(record) };
    });
    const uniqueIds = new Set(updates.map(({ id }) => id));
    if (uniqueIds.size !== updates.length)
      throw new RequestError(400, "Номера участков не должны повторяться");
    const existing = await env.DB.prepare("SELECT id FROM plots").all<{
      id: string;
    }>();
    const existingIds = new Set(existing.results.map(({ id }) => id));
    if (updates.some(({ id }) => !existingIds.has(id)))
      return json({ error: "Участок не найден" }, 404, request, env);
    const results = await env.DB.batch<PlotRow>(
      updates.map(({ id, plot }) => updatePlotStatement(env, id, plot)),
    );
    return json(
      results.flatMap(({ results: rows }) => rows.map(mapPlot)),
      200,
      request,
      env,
    );
  }

  const plotMatch = url.pathname.match(/^\/api\/admin\/plots\/([^/]+)$/);
  if (plotMatch && request.method === "PUT") {
    if (!(await hasAdminAccess(request, env)))
      return json({ error: "Требуется авторизация" }, 401, request, env);
    let id: string;
    try {
      id = validatePlotId(decodeURIComponent(plotMatch[1]));
    } catch {
      throw new RequestError(400, "Некорректный номер участка");
    }
    const plot = validatePlotUpdate(await readBody(request));
    const result = await updatePlotStatement(env, id, plot).first<PlotRow>();
    if (!result) return json({ error: "Участок не найден" }, 404, request, env);
    return json(mapPlot(result), 200, request, env);
  }

  return json({ error: "Not found" }, 404, request, env);
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      if (error instanceof RequestError)
        return json({ error: error.message }, error.status, request, env);
      console.error(
        "API request failed",
        request.method,
        new URL(request.url).pathname,
      );
      return json({ error: "Не удалось выполнить запрос" }, 500, request, env);
    }
  },
} satisfies ExportedHandler<Env>;
