import { useEffect, useState } from "react";
import { api, type AdminPlot } from "../lib/api";
import { PLOTS_REFRESH_MS } from "../lib/constants";

export function usePlots() {
  const [plots, setPlots] = useState<AdminPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await api.getPlots();
        if (active) { setPlots(next); setError(""); }
      } catch {
        if (active) setError("Не удалось обновить участки. Повторяем загрузку…");
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    const refreshVisible = () => { if (!document.hidden) void refresh(); };
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
