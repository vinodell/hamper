import { isValidPlotNumber } from "../lib/plotNumbers";
import { LogOut, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type AdminPlot, type PlotUpdate } from "../lib/api";
import { ADMIN_SAVE_FEEDBACK_MS, plotStatuses } from "../lib";

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [plots, setPlots] = useState<AdminPlot[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((result) => {
        setAuthenticated(result.authenticated);
        if (result.authenticated)
          api
            .getPlots()
            .then(setPlots)
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
      setPlots(await api.getPlots());
      setPassword("");
      setAuthenticated(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    }
  };

  const updatePlot = (id: string, key: keyof PlotUpdate, value: string) => {
    if ((key === "area" || key === "price") && !/^\d*(?:[.,]\d{0,2})?$/.test(value)) return;
    setPlots((current) =>
      current.map((plot) =>
        plot.id === id ? { ...plot, [key]: value } : plot,
      ),
    );
  };

  const savePlot = async (plot: AdminPlot) => {
    if (!isValidPlotNumber(plot.area) || !isValidPlotNumber(plot.price)) {
      setError("Площадь и цена должны быть больше нуля, не более двух знаков после запятой.");
      return;
    }
    setSavingId(plot.id);
    setError("");
    try {
      const updated = await api.updatePlot(plot.id, {
        area: plot.area,
        status: plot.status,
        price: plot.price,
        street: plot.street ?? "",
        description: plot.description ?? "",
      });
      setPlots((current) =>
        current.map((item) => (item.id === plot.id ? updated : item)),
      );
      setSavedId(plot.id);
      window.setTimeout(() => setSavedId(null), ADMIN_SAVE_FEEDBACK_MS);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setAuthenticated(false);
        setPassword("");
        setError("Сессия завершилась или недоступна. Войдите снова.");
        return;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить участок",
      );
    } finally {
      setSavingId(null);
    }
  };

  const logout = async () => {
    await api.logout();
    setAuthenticated(false);
    setPlots([]);
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
          <button className="button button-dark" type="button" onClick={logout}>
            <LogOut size={17} /> Выйти
          </button>
        </header>
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
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {settlementPlots.map((plot) => (
                    <tr key={plot.id}>
                      <td>
                        <strong>{plot.id}</strong>
                      </td>
                      <td>
                        <input
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
                          value={plot.street ?? ""}
                          onChange={(event) =>
                            updatePlot(plot.id, "street", event.target.value)
                          }
                          aria-label={`Улица ${plot.id}`}
                        />
                      </td>
                      <td>
                        <input
                          value={plot.description ?? ""}
                          onChange={(event) =>
                            updatePlot(plot.id, "description", event.target.value)
                          }
                          aria-label={`Описание ${plot.id}`}
                        />
                      </td>
                      <td>
                        <button
                          className="admin-save"
                          type="button"
                          disabled={savingId === plot.id}
                          onClick={() => savePlot(plot)}
                        >
                          {savedId === plot.id ? (
                            "Сохранено"
                          ) : (
                            <>
                              <Save size={16} /> Сохранить
                            </>
                          )}
                        </button>
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
