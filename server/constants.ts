export const ADMIN_COOKIE = "hamper_admin";
export const ADMIN_COOKIE_TTL_SECONDS = 86_400;
export const PASSWORD_HASH_ITERATIONS = 100_000;
export const PASSWORD_HASH_ALGORITHM = "SHA-256";
export const CONTACT_NAME_MAX_LENGTH = 120;
export const CONTACT_PHONE_MAX_LENGTH = 40;
export const OTHER_PLOTS_SETTLEMENT = "Другие участки";
export const PLOT_ID_MAX_LENGTH = 80;
export const PLOT_STREET_MAX_LENGTH = 200;
export const PLOT_DESCRIPTION_MAX_LENGTH = 4_000;
export const PLOT_CADASTRAL_NUMBER_MAX_LENGTH = 80;
export const PLOT_MORTGAGE_URL_MAX_LENGTH = 2_048;
export const FULL_PAYMENT_PRICE_ERROR =
  "Цена при 100% оплате должна быть больше нуля и ниже основной цены";
export const BULK_PLOTS_MAX_LENGTH = 500;
export const REQUEST_BODY_MAX_BYTES = 32 * 1024;
export const BULK_REQUEST_BODY_MAX_BYTES = 12 * 1024 * 1024;

export const plotStatuses = ["Свободен", "Забронирован", "Продан"] as const;
export type PlotStatus = (typeof plotStatuses)[number];
export const allowedStatuses: ReadonlySet<PlotStatus> = new Set(plotStatuses);
