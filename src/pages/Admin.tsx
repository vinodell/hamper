import { isValidPlotNumber, normalizePlotNumber } from "../lib/plotNumbers";
import { LogOut, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type AdminPlot, type PlotUpdate } from "../lib/api";
import { plotStatuses } from "../lib";
import { notifyPlotsUpdated } from "../lib/plotEvents";

import "./Admin.css";

const toPlotUpdate = (plot: AdminPlot): PlotUpdate => ({
  area: normalizePlotNumber(plot.area),
  status: plot.status,
  price: normalizePlotNumber(plot.price),
  street: plot.street ?? "",
  description: plot.description ?? "",
});

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [plots, setPlots] = useState<AdminPlot[]>([]);
  const [savedPlots, setSavedPlots] = useState<AdminPlot[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const savedById = new Map(savedPlots.map((plot) => [plot.id, plot]));
  const changedPlots = plots.filter((plot) => {
    const saved = savedById.get(plot.id);
    return saved && JSON.stringify(toPlotUpdate(plot)) !== JSON.stringify(toPlotUpdate(saved));
  });
  const changedIds = new Set(changedPlots.map((plot) => plot.id));

  useEffect(() => {
    api
      .me()
      .then((result) => {
        setAuthenticated(result.authenticated);
        if (result.authenticated)
          return api
            .getPlots()
            .then((loaded) => {
              setPlots(loaded);
              setSavedPlots(loaded);
            })
            .catch((reason: Error) => setError(reason.message));
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await api.login(login, password);
      const session = await api.me();
      if (!session.authenticated) {
        throw new Error("Браузер не сохранил сессию. Разрешите cookies для сайта или попробуйте другой браузер.");
      }
      const loaded = await api.getPlots();
      // Preserve unsaved rows if the session expired during a batch save.
      const drafts = new Map(changedPlots.map((plot) => [plot.id, plot]));
      setSavedPlots(loaded);
      setPlots(loaded.map((plot) => {
        const draft = drafts.get(plot.id);
        return draft ? { ...plot, ...toPlotUpdate(draft) } : plot;
      }));
      setPassword("");
      setAuthenticated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    }
  };

  const updatePlot = (id: string, key: keyof PlotUpdate, value: string) => {
    if (saving) return;
    if ((key === "area" || key === "price") && !/^\d*(?:[.,]\d{0,2})?$/.test(value)) return;
    setSaveMessage("");
    setError("");
    setPlots((current) =>
      current.map((plot) =>
        plot.id === id ? { ...plot, [key]: value } : plot,
      ),
    );
  };

  const saveAllChanges = async () => {
    if (saving || changedPlots.length === 0) return;
    const invalid = changedPlots.filter(
      (plot) => !isValidPlotNumber(plot.area) || !isValidPlotNumber(plot.price),
    );
    if (invalid.length) {
      setError(`Проверьте участки ${invalid.map((plot) => plot.id).join(", ")}: площадь и цена должны быть больше нуля, не более двух знаков после запятой.`);
      return;
    }
    setSaving(true);
    setSaveMessage("");
    setError("");
    const saved = new Map<string, AdminPlot>();
    const failed: string[] = [];
    let failureMessage = "";
    let sessionExpired = false;
    try {
      for (const plot of changedPlots) {
        try {
          const updated = await api.updatePlot(plot.id, toPlotUpdate(plot));
          saved.set(plot.id, updated);
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 401) {
            sessionExpired = true;
            break;
          }
          failed.push(plot.id);
          failureMessage = reason instanceof Error ? reason.message : "Ошибка запроса";
        }
      }

      if (saved.size) {
        const mergeSaved = (current: AdminPlot[]) =>
          current.map((plot) => saved.get(plot.id) ?? plot);
        setPlots(mergeSaved);
        setSavedPlots(mergeSaved);
        notifyPlotsUpdated();
      }
      if (sessionExpired) {
        setAuthenticated(false);
        setPassword("");
        setError("Сессия завершилась. Войдите снова — несохранённые изменения останутся в форме.");
      } else if (failed.length) {
        setError(`Сохранено участков: ${saved.size}. Не удалось сохранить: ${failed.join(", ")}. ${failureMessage}. Повторите сохранение.`);
      } else {
        setSaveMessage("Все изменения сохранены.");
      }
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await api.logout();
    setAuthenticated(false);
    setPlots([]);
    setSavedPlots([]);
    setSaveMessage("");
    setError("");
  };

  const settlementGroups = new Map<string, AdminPlot[]>();
  for (const plot of plots) {
    const group = settlementGroups.get(plot.settlement);
    if (group) group.push(plot);
    else settlementGroups.set(plot.settlement, [plot]);
  }

  if (loading)
    return (
      <main className="admin-shell">
        <div className="admin-loading">Проверяем сессию…</div>
      </main>
    );

  if (!authenticated)
    return (
      <main className="admin-shell">
        <form className="admin-login" onSubmit={handleLogin}>
          <div className="admin-login__icon">
            <ShieldCheck />
          </div>
          <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
          <h1>Admin tool</h1>
          <label>
            Логин
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}
          <button className="button button-gold" type="submit">
            Войти
          </button>
        </form>
      </main>
    );

  return (
    <main className="admin-shell">
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
            <h1>Участки и цены</h1>
            <p>
              Изменения сохраняются в Cloudflare D1 и сразу доступны на сайте.
            </p>
          </div>
          <button className="button button-dark" type="button" onClick={logout} disabled={saving}>
            <LogOut size={17} /> Выйти
          </button>
        </header>
        <div className="admin-savebar">
          <p className="admin-save-status" role="status">
            {saving
              ? "Сохраняем изменения…"
              : changedPlots.length
                ? `Изменено участков: ${changedPlots.length}`
                : saveMessage || "Нет несохранённых изменений"}
          </p>
          <button
            className="button button-gold admin-save-all"
            type="button"
            disabled={saving || changedPlots.length === 0}
            onClick={saveAllChanges}
          >
            <Save size={17} />
            {saving ? "Сохраняем…" : "Сохранить все изменения"}
          </button>
        </div>
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        {plots.length === 0 && <p className="admin-empty">Участков пока нет.</p>}
        <div className="admin-settlements">
        {Array.from(settlementGroups, ([settlement, settlementPlots], index) => (
          <section className="admin-settlement" key={settlement} aria-labelledby={`settlement-${index}`}>
            <header className="admin-settlement-header">
              <h2 id={`settlement-${index}`}>{settlement || "Без посёлка"}</h2>
              <span className="admin-settlement-count">Участков: {settlementPlots.length}</span>
            </header>
            <div className="admin-table-wrap" role="region" aria-labelledby={`settlement-${index}`} tabIndex={0}>
              <table className="admin-table" aria-labelledby={`settlement-${index}`}>

                <thead>
                  <tr>
                    <th>Участок</th>
                    <th>Площадь, сот.</th>
                    <th>Статус</th>
                    <th>Цена, ₽</th>
                    <th>Улица</th>
                    <th>Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementPlots.map((plot) => (
                    <tr key={plot.id} data-changed={changedIds.has(plot.id)}>
                      <td>
                        <strong>{plot.id}</strong>
                      </td>
                      <td>
                        <input
                          disabled={saving}
                          inputMode="decimal"
                          value={plot.area}
                          onChange={(event) =>
                            updatePlot(plot.id, "area", event.target.value)
                          }
                          aria-label={`Площадь ${plot.id}`}
                        />
                      </td>
                      <td>
                        <select
                          disabled={saving}
                          value={plot.status}
                          onChange={(event) =>
                            updatePlot(plot.id, "status", event.target.value)
                          }
                          aria-label={`Статус ${plot.id}`}
                        >
                          {plotStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          disabled={saving}
                          inputMode="decimal"
                          value={plot.price}
                          onChange={(event) =>
                            updatePlot(plot.id, "price", event.target.value)
                          }
                          aria-label={`Цена ${plot.id}`}
                        />
                      </td>
                      <td>
                        <input
                          disabled={saving}
                          value={plot.street ?? ""}
                          onChange={(event) =>
                            updatePlot(plot.id, "street", event.target.value)
                          }
                          aria-label={`Улица ${plot.id}`}
                        />
                      </td>
                      <td>
                        <input
                          disabled={saving}
                          value={plot.description ?? ""}
                          onChange={(event) =>
                            updatePlot(plot.id, "description", event.target.value)
                          }
                          aria-label={`Описание ${plot.id}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        </div>
      </div>
    </main>
  );
}
