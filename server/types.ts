export type SqlValue = string | number | null;
export interface SqlResult<T = Record<string, unknown>> {
  success: boolean;
  results: T[];
}
export interface SqlStatement {
  bind(...values: SqlValue[]): SqlStatement;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  batch<T = Record<string, unknown>>(
    statements: SqlStatement[],
  ): Promise<SqlResult<T>[]>;
}

import type { PlotStatus } from "./constants.js";

export interface Env {
  DB: SqlDatabase;
  ADMIN_LOGIN: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET?: string;
  PUBLIC_ORIGIN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface PlotRow {
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
  full_payment_price: string | null;
  street: string | null;
  description: string | null;
  cadastral_number: string | null;
  gpzu_done: number;
  building_permit_done: number;
  mortgage_url: string | null;
  updated_at: string;
}

export interface SiteSettingsRow {
  promotion_enabled: number;
  promotion_discount_percent: number;
}

export interface InquiryRow {
  id: number;
  name: string;
  phone: string;
  project: string | null;
  plot: string | null;
  comment: string | null;
  consent: number;
  created_at: string;
  telegram_status?: "not_configured" | "pending" | "sent" | "failed";
  telegram_attempts?: number;
}
