import { LogOut, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AdminPlot, type PlotUpdate } from "../lib/api";
import { ADMIN_SAVE_FEEDBACK_MS, plotStatuses, type PlotStatus } from "../lib";

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
      setAuthenticated(true);
      setPlots(await api.getPlots());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
    }
  };

  const updatePlot = (id: string, key: keyof PlotUpdate, value: string) => {
    setPlots((current) =>
      current.map((plot) =>
        plot.id === id ? { ...plot, [key]: value } : plot,
      ),
    );
  };

  const savePlot = async (plot: AdminPlot) => {
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
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Участок</th>
                <th>Проект</th>
                <th>Площадь</th>
                <th>Статус</th>
                <th>Цена</th>
                <th>Улица</th>
                <th>Описание</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plots.map((plot) => (
                <tr key={plot.id}>
                  <td>
                    <strong>{plot.id}</strong>
                  </td>
                  <td>{plot.settlement}</td>
                  <td>
                    <input
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
      </div>
    </main>
  );
}
