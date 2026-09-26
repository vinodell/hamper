import { apiUrl, type Plot, type PlotStatus } from "./constants";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error ?? "Ошибка запроса", response.status);
  return payload as T;
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

export interface ContactPayload {
  name: string;
  phone: string;
  project: string;
  plot: string;
  comment: string;
}

export const api = {
  login: (login: string, password: string) =>
    request<{ ok: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ authenticated: boolean }>("/api/auth/me"),
  getPlots: () => request<AdminPlot[]>("/api/plots"),
  updatePlot: (id: string, data: PlotUpdate) =>
    request<AdminPlot>(`/api/admin/plots/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  sendContact: (data: ContactPayload) =>
    request<{ ok: true }>("/api/contact", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
