import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PLOTS_REFRESH_MS, type Plot } from "../lib/constants";

export function usePlots() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (
      import.meta.env.DEV &&
      ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
    ) {
      import("../../localTest/plots")
        .then(({ mockPlots }) => {
          if (active) { setPlots(mockPlots); setError(""); }
        })
        .catch(() => {
          if (active) setError("Не удалось загрузить локальные участки.");
        })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }

    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await api.getPlots();
        if (active) {
          setPlots(next);
          setError("");
        }
      } catch {
        if (active)
          setError("Не удалось обновить участки. Повторяем загрузку…");
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    const refreshVisible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(refreshVisible, PLOTS_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, []);

  return { plots, loading, error };
}
