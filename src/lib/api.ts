import { normalizePlotNumber } from "./plotNumbers";
import { apiUrl, plotStatuses, type Plot, type PlotStatus } from "./constants";
import {
  getPlotsRevision,
  loadCachedPlots,
  mergeSavedPlots,
  replaceCachedPlots,
} from "./plotsCache";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

const REQUEST_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResponse() {
  return new ApiError(
    "Сервер вернул некорректные данные. Попробуйте ещё раз.",
    502,
  );
}

function statusMessage(status: number) {
  if (status === 401) return "Сессия завершилась. Войдите снова.";
  if (status === 403) return "Недостаточно прав для этого действия.";
  if (status === 404) return "Данные не найдены. Проверьте адрес API.";
  if (status === 429)
    return "Слишком много запросов. Попробуйте немного позже.";
  if (status >= 500) return "Сервер временно недоступен. Попробуйте ещё раз.";
  return "Не удалось выполнить запрос. Проверьте данные и попробуйте ещё раз.";
}

async function request(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted)
    throw new DOMException("Запрос отменён", "AbortError");
  options.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const headers = new Headers(options.headers);
  // A bodyless GET needs no Content-Type: this avoids a CORS preflight on
  // public loads and on the initial admin/session request.
  if (options.body !== undefined && options.body !== null)
    headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(contentType)) {
      if (!response.ok)
        throw new ApiError(statusMessage(response.status), response.status);
      throw new ApiError(
        "Сервер вернул ответ вместо данных. Проверьте адрес API.",
        502,
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted)
        throw new DOMException("Запрос отменён", "AbortError");
      throw new ApiError(
        response.ok
          ? invalidResponse().message
          : statusMessage(response.status),
        response.ok ? 502 : response.status,
      );
    }
    if (!response.ok)
      throw new ApiError(
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : statusMessage(response.status),
        response.status,
      );
    return payload;
  } catch (reason) {
    if (timedOut)
      throw new ApiError(
        options.method && options.method !== "GET"
          ? "Сервер не ответил вовремя. Обновите данные перед повторной отправкой."
          : "Сервер не ответил вовремя. Попробуйте ещё раз.",
        0,
      );
    if (options.signal?.aborted)
      throw new DOMException("Запрос отменён", "AbortError");
    if (reason instanceof ApiError) throw reason;
    throw new ApiError(
      "Не удалось подключиться к серверу. Проверьте соединение и повторите попытку.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export interface AdminPlot extends Plot {
  street: string | null;
  description: string | null;
  updatedAt: string;
}

export interface PlotUpdate {
  area: string;
  status: PlotStatus;
  price: string;
  street: string;
  description: string;
}

export interface PlotCreate extends PlotUpdate {
  id: string;
}

export interface ContactPayload {
  name: string;
  phone: string;
  project: string;
  plot: string;
  comment: string;
}

function isPlotStatus(value: unknown): value is PlotStatus {
  return plotStatuses.some((status) => status === value);
}

function parsePublicPlot(value: unknown): Plot {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.settlement !== "string" ||
    typeof value.area !== "string" ||
    typeof value.price !== "string" ||
    !isPlotStatus(value.status) ||
    !(
      value.description === undefined ||
      value.description === null ||
      typeof value.description === "string"
    )
  )
    throw invalidResponse();
  return {
    id: value.id,
    settlement: value.settlement,
    area: normalizePlotNumber(value.area).replace(".", ","),
    status: value.status,
    price: normalizePlotNumber(value.price).replace(".", ","),
    description: value.description,
  };
}

function parseAdminPlot(value: unknown): AdminPlot {
  const plot = parsePublicPlot(value);
  if (
    !isRecord(value) ||
    !(value.street === null || typeof value.street === "string") ||
    !(value.description === null || typeof value.description === "string") ||
    typeof value.updatedAt !== "string"
  )
    throw invalidResponse();
  return {
    ...plot,
    street: value.street,
    description: value.description,
    updatedAt: value.updatedAt,
  };
}

function parseList<T>(value: unknown, parseItem: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw invalidResponse();
  return value.map(parseItem);
}

function parseOk(value: unknown): { ok: true } {
  if (!isRecord(value) || value.ok !== true) throw invalidResponse();
  return { ok: true };
}

async function fetchPublicPlots(): Promise<Plot[]> {
  if (
    import.meta.env.DEV &&
    !import.meta.env.VITE_API_URL &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  ) {
    const { mockPlots } = await import("../../localTest/plots");
    return mockPlots;
  }
  return parseList(
    await request("/api/plots", { credentials: "omit" }),
    parsePublicPlot,
  );
}

export const api = {
  login: async (
    login: string,
    password: string,
    options: RequestOptions = {},
  ) =>
    parseOk(
      await request("/api/auth/login", {
        ...options,
        method: "POST",
        body: JSON.stringify({ login, password }),
      }),
    ),
  logout: async (options: RequestOptions = {}) =>
    parseOk(await request("/api/auth/logout", { ...options, method: "POST" })),
  me: async (options: RequestOptions = {}) => {
    const payload = await request("/api/auth/me", options);
    if (!isRecord(payload) || typeof payload.authenticated !== "boolean")
      throw invalidResponse();
    return { authenticated: payload.authenticated };
  },
  getPlots: (
    options: RequestOptions & { force?: boolean; maxAgeMs?: number } = {},
  ) => loadCachedPlots(fetchPublicPlots, options),
  getAdminPlots: async (options: RequestOptions = {}) => {
    const revision = getPlotsRevision();
    const plots = parseList(
      await request("/api/admin/plots", options),
      parseAdminPlot,
    );
    replaceCachedPlots(plots.map(parsePublicPlot), revision);
    return plots;
  },
  createPlot: async (data: PlotCreate, options: RequestOptions = {}) => {
    const plot = parseAdminPlot(
      await request("/api/admin/plots", {
        ...options,
        method: "POST",
        body: JSON.stringify(data),
      }),
    );
    mergeSavedPlots([parsePublicPlot(plot)]);
    return plot;
  },
  updatePlots: async (data: PlotCreate[], options: RequestOptions = {}) => {
    const plots = parseList(
      await request("/api/admin/plots", {
        ...options,
        method: "PUT",
        body: JSON.stringify({ plots: data }),
      }),
      parseAdminPlot,
    );
    mergeSavedPlots(plots.map(parsePublicPlot));
    return plots;
  },
  updatePlot: async (
    id: string,
    data: PlotUpdate,
    options: RequestOptions = {},
  ) => {
    const plot = parseAdminPlot(
      await request(`/api/admin/plots/${encodeURIComponent(id)}`, {
        ...options,
        method: "PUT",
        body: JSON.stringify(data),
      }),
    );
    mergeSavedPlots([parsePublicPlot(plot)]);
    return plot;
  },
  sendContact: async (data: ContactPayload, options: RequestOptions = {}) =>
    parseOk(
      await request("/api/contact", {
        ...options,
        credentials: "omit",
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),
};

/** Start the shared request before the first React render or route transition. */
export function preloadPlots() {
  void api.getPlots().catch(() => {
    // The cache exposes the error to public views and retains previous data.
  });
}
