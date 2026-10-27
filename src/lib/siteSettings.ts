import { PLOTS_REFRESH_MS } from "./constants";
import { waitForSharedRequest } from "./waitForSharedRequest";

export interface SiteSettings {
  promotion: {
    enabled: boolean;
    discountPercent: number;
  };
}

/** An editor fallback only. Public promotions require a successful API read. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  promotion: { enabled: false, discountPercent: 10 },
};

export function isValidSiteSettings(value: unknown): value is SiteSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  if (!("promotion" in value)) return false;
  const promotion = value.promotion;
  return (
    typeof promotion === "object" &&
    promotion !== null &&
    !Array.isArray(promotion) &&
    "enabled" in promotion &&
    typeof promotion.enabled === "boolean" &&
    "discountPercent" in promotion &&
    typeof promotion.discountPercent === "number" &&
    Number.isInteger(promotion.discountPercent) &&
    promotion.discountPercent >= 1 &&
    promotion.discountPercent <= 100
  );
}

export interface SiteSettingsSnapshot {
  settings: SiteSettings | null;
  loading: boolean;
  error: string;
}

let snapshot: SiteSettingsSnapshot = {
  settings: null,
  loading: true,
  error: "",
};
let updatedAt = 0;
let revision = 0;
let pending: Promise<SiteSettings> | null = null;
let refreshQueued = false;
const listeners = new Set<() => void>();

function publish(next: SiteSettingsSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function publishReady(settings: SiteSettings) {
  updatedAt = Date.now();
  if (
    !snapshot.loading &&
    !snapshot.error &&
    snapshot.settings?.promotion.enabled === settings.promotion.enabled &&
    snapshot.settings.promotion.discountPercent ===
      settings.promotion.discountPercent
  )
    return;
  publish({ settings, loading: false, error: "" });
}

export const getSiteSettingsSnapshot = () => snapshot;
export const getSiteSettingsRevision = () => revision;

export function subscribeSiteSettings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A successful admin read/save becomes visible to the public views immediately. */
export function publishSavedSiteSettings(
  settings: SiteSettings,
  expectedRevision?: number,
) {
  if (expectedRevision !== undefined && expectedRevision !== revision) return;
  revision += 1;
  if (pending) refreshQueued = true;
  publishReady(settings);
}

export function loadCachedSiteSettings(
  load: () => Promise<SiteSettings>,
  options: { force?: boolean; maxAgeMs?: number; signal?: AbortSignal } = {},
): Promise<SiteSettings> {
  if (options.signal?.aborted)
    return Promise.reject(new DOMException("Запрос отменён", "AbortError"));
  if (options.force) {
    revision += 1;
    updatedAt = 0;
    if (pending) refreshQueued = true;
  }
  if (pending) return waitForSharedRequest(pending, options.signal);
  if (
    snapshot.settings &&
    !snapshot.error &&
    Date.now() - updatedAt < (options.maxAgeMs ?? PLOTS_REFRESH_MS)
  )
    return Promise.resolve(snapshot.settings);
  if (snapshot.loading !== !snapshot.settings)
    publish({ ...snapshot, loading: !snapshot.settings });

  pending = (async () => {
    do {
      refreshQueued = false;
      const requestRevision = revision;
      try {
        const settings = await load();
        if (requestRevision === revision) publishReady(settings);
      } catch (reason) {
        if (requestRevision === revision) {
          publish({
            ...snapshot,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "Не удалось загрузить настройки. Попробуйте ещё раз.",
          });
          throw reason;
        }
      }
    } while (refreshQueued);
    if (!snapshot.settings)
      throw new Error("Не удалось загрузить настройки. Попробуйте ещё раз.");
    return snapshot.settings;
  })().then(
    (settings) => {
      pending = null;
      if (refreshQueued) return loadCachedSiteSettings(load, { force: true });
      return settings;
    },
    (reason: unknown) => {
      pending = null;
      if (refreshQueued) return loadCachedSiteSettings(load, { force: true });
      throw reason;
    },
  );
  return waitForSharedRequest(pending, options.signal);
}
