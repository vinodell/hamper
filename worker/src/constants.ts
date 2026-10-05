export const SESSION_COOKIE = "hamper_session";
export const SESSION_COOKIE_ATTRIBUTES = "HttpOnly; Secure; SameSite=None; Partitioned; Path=/";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const PASSWORD_HASH_ITERATIONS = 100_000;
export const PASSWORD_HASH_ALGORITHM = "SHA-256";
export const CONTACT_NAME_MAX_LENGTH = 120;
export const CONTACT_PHONE_MAX_LENGTH = 40;
export const TELEGRAM_API_URL = "https://api.telegram.org";
export const TELEGRAM_TIMEOUT_MS = 10_000;
export const OTHER_PLOTS_SETTLEMENT = "Другие участки";
export const PLOT_ID_MAX_LENGTH = 80;
export const PLOT_STREET_MAX_LENGTH = 200;
export const PLOT_DESCRIPTION_MAX_LENGTH = 4_000;
export const BULK_PLOTS_MAX_LENGTH = 500;

export const plotStatuses = ["Свободен", "Забронирован", "Продан"] as const;
export type PlotStatus = (typeof plotStatuses)[number];
export const allowedStatuses: ReadonlySet<PlotStatus> = new Set(plotStatuses);
