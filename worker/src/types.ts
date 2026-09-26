import type { PlotStatus } from "./constants";

export interface Env {
  DB: D1Database;
  ADMIN_LOGIN: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  PUBLIC_ORIGIN?: string;
}

export interface PlotRow {
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
  street: string | null;
  description: string | null;
  updated_at: string;
}
