import { individualPlots } from "../data/individualPlots";
import { PLOTS_REFRESH_MS, type Plot } from "./constants";

export interface PlotsSnapshot {
  plots: Plot[];
  loading: boolean;
  error: string;
}

// Public data lives in memory only. Authentication and editor drafts stay local
// to the admin page, and navigating between pages keeps the same snapshot.
let snapshot: PlotsSnapshot = { plots: [], loading: true, error: "" };
let hasSnapshot = false;
let updatedAt = 0;
let revision = 0;
let pending: Promise<Plot[]> | null = null;
let refreshQueued = false;
const listeners = new Set<() => void>();

function publish(next: PlotsSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function withDetails(plot: Plot): Plot {
  return { ...plot, ...individualPlots[plot.id] };
}

export const getPlotsSnapshot = () => snapshot;
export const getPlotsRevision = () => revision;

export function subscribePlots(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Publish an authoritative complete list without caching admin-only fields. */
export function replaceCachedPlots(plots: Plot[], expectedRevision?: number) {
  if (expectedRevision !== undefined && expectedRevision !== revision) return;
  revision += 1;
  publishCompletePlots(plots);
}

function publishCompletePlots(plots: Plot[]) {
  hasSnapshot = true;
  updatedAt = Date.now();
  publish({ plots: plots.map(withDetails), loading: false, error: "" });
}

/** Call only after the server confirms a successful mutation. */
export function mergeSavedPlots(plots: Plot[]) {
  revision += 1;
  // A request started before this save must not replace the saved rows. Re-read
  // after it finishes, so unrelated changes made by another admin also arrive.
  if (pending) refreshQueued = true;
  if (!hasSnapshot) return;
  const saved = new Map(plots.map((plot) => [plot.id, withDetails(plot)]));
  const merged = snapshot.plots.map((plot) => {
    const replacement = saved.get(plot.id);
    saved.delete(plot.id);
    return replacement ?? plot;
  });
  updatedAt = Date.now();
  publish({ plots: [...merged, ...saved.values()], loading: false, error: "" });
}

export function invalidatePlotsCache() {
  revision += 1;
  updatedAt = 0;
  if (pending) refreshQueued = true;
}

function waitForPlots(promise: Promise<Plot[]>, signal?: AbortSignal) {
  if (!signal) return promise;
  if (signal.aborted)
    return Promise.reject(new DOMException("Запрос отменён", "AbortError"));
  // Cancel the caller's wait, preserving the shared preload for other views.
  return new Promise<Plot[]>((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("Запрос отменён", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

export function loadCachedPlots(
  load: () => Promise<Plot[]>,
  options: { force?: boolean; maxAgeMs?: number; signal?: AbortSignal } = {},
): Promise<Plot[]> {
  if (options.signal?.aborted)
    return Promise.reject(new DOMException("Запрос отменён", "AbortError"));
  if (options.force) invalidatePlotsCache();
  if (pending) return waitForPlots(pending, options.signal);
  if (
    hasSnapshot &&
    Date.now() - updatedAt < (options.maxAgeMs ?? PLOTS_REFRESH_MS)
  )
    return Promise.resolve(snapshot.plots);

  publish({ ...snapshot, loading: !hasSnapshot });
  pending = (async () => {
    do {
      refreshQueued = false;
      const requestRevision = revision;
      try {
        const plots = await load();
        if (requestRevision === revision) publishCompletePlots(plots);
      } catch (reason) {
        if (requestRevision === revision) {
          publish({
            ...snapshot,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "Не удалось загрузить участки. Попробуйте ещё раз.",
          });
          throw reason;
        }
      }
    } while (refreshQueued);
    return snapshot.plots;
  })().then(
    () => {
      pending = null;
      // An invalidation may arrive between the fetch loop completing and this
      // promise settling. Include that refresh in the shared result as well.
      if (refreshQueued) return loadCachedPlots(load, { force: true });
      return snapshot.plots;
    },
    (reason: unknown) => {
      pending = null;
      if (refreshQueued) return loadCachedPlots(load, { force: true });
      throw reason;
    },
  );
  return waitForPlots(pending, options.signal);
}
