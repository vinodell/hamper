import { isValidPlotNumber, normalizePlotNumber } from "./plotNumbers";
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
  if (status === 401) return "Неверный логин или пароль. Войдите снова.";
  if (status === 403) return "Недостаточно прав для этого действия.";
  if (status === 404) return "Данные не найдены. Проверьте адрес API.";
  if (status === 429)
    return "Слишком много запросов. Попробуйте немного позже.";
  if (status >= 500) return "Сервер временно недоступен. Попробуйте ещё раз.";
  return "Не удалось выполнить запрос. Проверьте данные и попробуйте ещё раз.";
}

async function request(
  path: string,
  options: RequestOptions & { method?: "POST" | "PUT"; body?: string } = {},
): Promise<unknown> {
  const adminRequest = path.startsWith("/api/admin/");
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
  // A bodyless public GET needs no Content-Type or CORS preflight.
  const headers = new Headers(
    options.body === undefined
      ? undefined
      : { "Content-Type": "application/json" },
  );

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      ...options,
      credentials: adminRequest ? "include" : "omit",
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("application/json")) {
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
        options.method
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
    !value.id.length ||
    value.id !== value.id.trim() ||
    value.id.length > 80 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(value.id) ||
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
  const area = normalizePlotNumber(value.area);
  const price = normalizePlotNumber(value.price);
  if (!isValidPlotNumber(area) || !isValidPlotNumber(price))
    throw invalidResponse();
  return {
    id: value.id,
    settlement: value.settlement,
    area: area.replace(".", ","),
    status: value.status,
    price: price.replace(".", ","),
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

function parseList<T extends Plot>(
  value: unknown,
  parseItem: (item: unknown) => T,
): T[] {
  if (!Array.isArray(value)) throw invalidResponse();
  const ids = new Set<string>();
  return value.map((item) => {
    const plot = parseItem(item);
    if (ids.has(plot.id)) throw invalidResponse();
    ids.add(plot.id);
    return plot;
  });
}

/** Admin responses are already validated; only omit their private fields. */
function toPublicPlot({ street, updatedAt, ...plot }: AdminPlot): Plot {
  return plot;
}

function parseOk(value: unknown): { ok: true } {
  if (!isRecord(value) || value.ok !== true) throw invalidResponse();
  return { ok: true };
}

async function fetchPublicPlots(): Promise<Plot[]> {
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MOCK_DATA === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  ) {
    const { mockPlots } = await import("../../localTest/plots");
    return mockPlots;
  }
  return parseList(await request("/api/plots"), parsePublicPlot);
}

export const api = {
  login: async (
    login: string,
    password: string,
    options: RequestOptions = {},
  ) => {
    try {
      parseOk(
        await request("/api/admin/login", {
          ...options,
          method: "POST",
          body: JSON.stringify({ login, password }),
        }),
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401)
        throw new ApiError("Неверный логин или пароль", 401);
      throw reason;
    }
    try {
      // Verify that the browser accepted the cookie before opening the panel.
      return await api.getAdminPlots(options);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401)
        throw new ApiError(
          "Браузер не сохранил вход. Разрешите cookies для сайта и повторите попытку.",
          401,
        );
      throw reason;
    }
  },
  logout: async (options: RequestOptions = {}) => {
    return parseOk(
      await request("/api/admin/logout", { ...options, method: "POST" }),
    );
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
    replaceCachedPlots(plots.map(toPublicPlot), revision);
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
    if (plot.id !== data.id.trim()) throw invalidResponse();
    mergeSavedPlots([toPublicPlot(plot)]);
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
    const expectedIds = new Set(data.map(({ id }) => id));
    if (
      plots.length !== data.length ||
      plots.some(({ id }) => !expectedIds.has(id))
    )
      throw invalidResponse();
    mergeSavedPlots(plots.map(toPublicPlot));
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
    if (plot.id !== id.trim()) throw invalidResponse();
    mergeSavedPlots([toPublicPlot(plot)]);
    return plot;
  },
  sendContact: async (data: ContactPayload, options: RequestOptions = {}) =>
    parseOk(
      await request("/api/contact", {
        ...options,
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
