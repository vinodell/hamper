import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../lib/api";
import { PLOTS_REFRESH_MS } from "../lib/constants";
import { PLOTS_UPDATED_EVENT } from "../lib/plotEvents";
import { getPlotsSnapshot, subscribePlots } from "../lib/plotsCache";
import { PlotsContext } from "./PlotsContext";

/** The home page, map, table, gallery and form share the bootstrap snapshot. */
export function PlotsProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    subscribePlots,
    getPlotsSnapshot,
    getPlotsSnapshot,
  );

  useEffect(() => {
    const refresh = (force = false, maxAgeMs = PLOTS_REFRESH_MS) => {
      void api.getPlots({ force, maxAgeMs }).catch(() => {
        // The store reports the error while preserving previously loaded rows.
      });
    };
    const refreshVisible = () => {
      if (!document.hidden) refresh();
    };
    // A local save has already merged the response into memory. Reading that
    // fresh snapshot avoids a second GET after every successful admin write.
    const refreshSaved = () => refresh();
    const refreshRemote = () => refresh(true);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(PLOTS_UPDATED_EVENT);
    channel?.addEventListener("message", refreshRemote);
    window.addEventListener(PLOTS_UPDATED_EVENT, refreshSaved);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(() => {
      // A previous request may have finished slightly after the last tick.
      // Refresh every 30 seconds, still joining requests started by focus.
      if (!document.hidden) refresh(false, 0);
    }, PLOTS_REFRESH_MS);
    refresh();

    return () => {
      channel?.close();
      window.clearInterval(interval);
      window.removeEventListener(PLOTS_UPDATED_EVENT, refreshSaved);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, []);

  return (
    <PlotsContext.Provider value={state}>{children}</PlotsContext.Provider>
  );
}
