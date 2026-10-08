import { individualPlots } from "../data/individualPlots";
import { PLOTS_REFRESH_MS, type Plot } from "./constants";

export interface PlotsSnapshot {
  plots: Plot[];
  loading: boolean;
  error: string;
}

// Public data lives in memory only. The server owns authentication; editor
// drafts stay on the admin page. Public pages share this snapshot.
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

function samePlot(left: Plot, right: Plot): boolean {
  return (
    left.id === right.id &&
    left.settlement === right.settlement &&
    left.area === right.area &&
    left.status === right.status &&
    left.price === right.price &&
    left.description === right.description &&
    left.title === right.title &&
    left.category === right.category &&
    // Photos come from static metadata or the immutable local mock, not the API.
    left.photos === right.photos
  );
}

function publishReadyPlots(plots: Plot[]) {
  updatedAt = Date.now();
  // Polling identical server rows should not rerender the map, gallery or form.
  if (
    !snapshot.loading &&
    !snapshot.error &&
    plots.length === snapshot.plots.length &&
    plots.every((plot, index) => plot === snapshot.plots[index])
  )
    return;
  publish({ plots, loading: false, error: "" });
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
  const previous = new Map(snapshot.plots.map((plot) => [plot.id, plot]));
  const next = plots.map((plot) => {
    const detailed = withDetails(plot);
    const existing = previous.get(plot.id);
    return existing && samePlot(existing, detailed) ? existing : detailed;
  });
  publishReadyPlots(next);
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
    return replacement && !samePlot(plot, replacement) ? replacement : plot;
  });
  publishReadyPlots([...merged, ...saved.values()]);
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
    !snapshot.error &&
    Date.now() - updatedAt < (options.maxAgeMs ?? PLOTS_REFRESH_MS)
  )
    return Promise.resolve(snapshot.plots);

  // Background requests keep the visible data and do not change loading.
  // Preserve the snapshot reference until there is a state change to report.
  if (snapshot.loading !== !hasSnapshot)
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
