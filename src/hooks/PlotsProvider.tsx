import { useEffect, useState, type ReactNode } from "react";
import { individualPlots } from "../data/individualPlots";
import { api } from "../lib/api";
import { PLOTS_REFRESH_MS } from "../lib/constants";
import { PLOTS_UPDATED_EVENT } from "../lib/plotEvents";
import { PlotsContext, type PlotsState } from "./PlotsContext";

/** The map, table, gallery and form all consume the same API snapshot. */
export function PlotsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlotsState>({
    plots: [], loading: true, error: "",
  });

  useEffect(() => {
    let active = true;
    if (
      import.meta.env.DEV &&
      ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
    ) {
      import("../../localTest/plots")
        .then(({ mockPlots }) => {
          if (active) setState({ plots: mockPlots, loading: false, error: "" });
        })
        .catch(() => {
          if (active) setState({
            plots: [], loading: false,
            error: "Не удалось загрузить локальные участки.",
          });
        });
      return () => { active = false; };
    }

    let pending = false;
    let refreshQueued = false;
    const refresh = async () => {
      if (!active) return;
      if (pending) {
        refreshQueued = true;
        return;
      }
      pending = true;
      try {
        const plots = await api.getPlots();
        // An admin save may have happened while this request was in flight.
        if (active && !refreshQueued) setState({
          plots: plots.map((plot) => ({ ...plot, ...individualPlots[plot.id] })),
          loading: false,
          error: "",
        });
      } catch {
        if (active && !refreshQueued) setState((current) => ({
          ...current, loading: false,
          error: "Не удалось обновить участки. Повторяем загрузку…",
        }));
      } finally {
        pending = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    };
    const refreshVisible = () => {
      if (!document.hidden) void refresh();
    };
    const channel = typeof BroadcastChannel === "undefined"
      ? null : new BroadcastChannel(PLOTS_UPDATED_EVENT);
    channel?.addEventListener("message", refresh);
    window.addEventListener(PLOTS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(refreshVisible, PLOTS_REFRESH_MS);
    void refresh();

    return () => {
      active = false;
      channel?.close();
      window.clearInterval(interval);
      window.removeEventListener(PLOTS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, []);

  return <PlotsContext.Provider value={state}>{children}</PlotsContext.Provider>;
}
