import { isValidPlotNumber, normalizePlotNumber } from "../lib/plotNumbers";
import { LogOut, Plus, Save, ShieldCheck, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  api,
  ApiError,
  type AdminPlot,
  type PlotCreate,
  type PlotUpdate,
} from "../lib/api";
import { plotStatuses } from "../lib";
import { mergeAdminDrafts, toPlotUpdate } from "../lib/adminDrafts";
import { notifyPlotsUpdated } from "../lib/plotEvents";
import { LoadingIndicator } from "../components/LoadingIndicator";

import "./Admin.css";

const emptyPlot: PlotCreate = {
  id: "",
  area: "",
  status: "Свободен",
  price: "",
  street: "",
  description: "",
};

const samePlot = (left: AdminPlot, right: AdminPlot) => {
  const a = toPlotUpdate(left);
  const b = toPlotUpdate(right);
  return (
    a.area === b.area &&
    a.status === b.status &&
    a.price === b.price &&
    a.street === b.street &&
    a.description === b.description
  );
};

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [plots, setPlots] = useState<AdminPlot[]>([]);
  const [savedPlots, setSavedPlots] = useState<AdminPlot[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => Boolean(getAdminAuthorization()));
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlot, setNewPlot] = useState<PlotCreate>({ ...emptyPlot });
  const [saveMessage, setSaveMessage] = useState("");
  const busy = saving || creating;

  const savedById = useMemo(
    () => new Map(savedPlots.map((plot) => [plot.id, plot])),
    [savedPlots],
  );
  const changedPlots = useMemo(
    () =>
      plots.filter((plot) => {
        const saved = savedById.get(plot.id);
        return saved && !samePlot(plot, saved);
      }),
    [plots, savedById],
  );
  const changedIds = useMemo(
    () => new Set(changedPlots.map((plot) => plot.id)),
    [changedPlots],
  );

  useEffect(() => {
    const controller = new AbortController();
    api
      .getAdminPlots({ signal: controller.signal })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setAuthenticated(true);
        setPlots(loaded);
        setSavedPlots(loaded);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setAuthenticated(false);
        if (!(reason instanceof ApiError && reason.status === 401))
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить участки",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loggingIn) return;
      setLoggingIn(true);
      setError("");
      try {
        const loaded = await api.login(login, password);
        setSavedPlots(loaded);
        setPlots(mergeAdminDrafts(loaded, changedPlots, savedById));
        setLogin("");
        setAuthenticated(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Не удалось войти");
      } finally {
        setPassword("");
        setLoggingIn(false);
      }
    },
    [changedPlots, login, loggingIn, password, savedById],
  );

  const updatePlot = useCallback(
    (id: string, key: keyof PlotUpdate, value: string) => {
      if (busy) return;
      if (
        (key === "area" || key === "price") &&
        !/^\d*(?:[.,]\d{0,2})?$/.test(value)
      )
        return;
      setSaveMessage("");
      setError("");
      setPlots((current) =>
        current.map((plot) =>
          plot.id === id ? { ...plot, [key]: value } : plot,
        ),
      );
    },
    [busy],
  );

  const handleMutationError = useCallback(
    (reason: unknown, fallback: string, forCreate = false) => {
      if (reason instanceof ApiError && reason.status === 401) {
        setAuthenticated(false);
        setPassword("");
        setError("Войдите снова — несохранённые изменения останутся в форме.");
      } else if (forCreate) {
        setCreateError(reason instanceof Error ? reason.message : fallback);
      } else {
        setError(reason instanceof Error ? reason.message : fallback);
      }
    },
    [],
  );

  const updateNewPlot = useCallback(
    (key: keyof PlotCreate, value: string) => {
      if (busy) return;
      if (
        (key === "area" || key === "price") &&
        !/^\d*(?:[.,]\d{0,2})?$/.test(value)
      )
        return;
      setCreateError("");
      setNewPlot((current) => ({ ...current, [key]: value }));
    },
    [busy],
  );

  const createPlot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const id = newPlot.id.trim();
    if (!id || id.length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(id)) {
      setCreateError(
        "Укажите номер участка: от 1 до 80 символов без управляющих символов.",
      );
      return;
    }
    if (plots.some((plot) => plot.id === id)) {
      setCreateError(
        `Участок с номером ${id} уже существует. Укажите другой номер.`,
      );
      return;
    }
    if (!isValidPlotNumber(newPlot.area) || !isValidPlotNumber(newPlot.price)) {
      setCreateError(
        "Площадь и цена должны быть больше нуля, не более двух знаков после запятой.",
      );
      return;
    }
    setCreating(true);
    setCreateError("");
    setSaveMessage("");
    setError("");
    try {
      const created = await api.createPlot({
        ...newPlot,
        id,
        area: normalizePlotNumber(newPlot.area),
        price: normalizePlotNumber(newPlot.price),
        street: newPlot.street.trim(),
        description: newPlot.description.trim(),
      });
      setPlots((current) => [...current, created]);
      setSavedPlots((current) => [...current, created]);
      setNewPlot({ ...emptyPlot });
      setShowCreateForm(false);
      setSaveMessage(`Участок ${created.id} добавлен.`);
      notifyPlotsUpdated();
    } catch (reason) {
      handleMutationError(reason, "Не удалось добавить участок", true);
    } finally {
      setCreating(false);
    }
  };

  const saveAllChanges = async () => {
    if (busy || changedPlots.length === 0) return;
    const invalid = changedPlots.filter(
      (plot) => !isValidPlotNumber(plot.area) || !isValidPlotNumber(plot.price),
    );
    if (invalid.length) {
      setError(
        `Проверьте участки ${invalid.map((plot) => plot.id).join(", ")}: площадь и цена должны быть больше нуля, не более двух знаков после запятой.`,
      );
      return;
    }
    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const updated = await api.updatePlots(
        changedPlots.map((plot) => ({ id: plot.id, ...toPlotUpdate(plot) })),
      );
      const saved = new Map(updated.map((plot) => [plot.id, plot]));
      const mergeSaved = (current: AdminPlot[]) =>
        current.map((plot) => saved.get(plot.id) ?? plot);
      setPlots(mergeSaved);
      setSavedPlots(mergeSaved);
      setSaveMessage("Все изменения сохранены.");
      notifyPlotsUpdated();
    } catch (reason) {
      handleMutationError(
        reason,
        "Не удалось сохранить изменения. Повторите сохранение.",
      );
    } finally {
      setSaving(false);
    }
  };

  const logout = useCallback(async () => {
    if (busy) return;
    api.logout();
    setAuthenticated(false);
    setLogin("");
    setPassword("");
    setError("");
    try {
      await api.logout();
      setAuthenticated(false);
      setLogin("");
      setPassword("");
      setPlots([]);
      setSavedPlots([]);
      setNewPlot({ ...emptyPlot });
      setCreateError("");
      setShowCreateForm(false);
      setSaveMessage("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выйти. Попробуйте ещё раз.",
      );
    } finally {
      setLoggingOut(false);
    }
  }, [busy]);

  const settlementGroups = useMemo(() => {
    const groups = new Map<string, AdminPlot[]>();
    for (const plot of plots) {
      const group = groups.get(plot.settlement);
      if (group) group.push(plot);
      else groups.set(plot.settlement, [plot]);
    }
    if (!groups.has("Другие участки")) groups.set("Другие участки", []);
    return groups;
  }, [plots]);

  if (loading)
    return (
      <main className="admin-shell">
        <LoadingIndicator label="Загружаем панель управления…" />
      </main>
    );

  if (!authenticated)
    return (
      <main className="admin-shell">
        <form
          className="admin-login"
          onSubmit={handleLogin}
          aria-busy={loggingIn}
        >
          <div className="admin-login__icon">
            <ShieldCheck size="1.5rem" />
          </div>
          <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
          <h1>Вход в управление</h1>
          <label>
            Логин
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loggingIn}
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
              disabled={loggingIn}
              required
            />
          </label>
          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button button-gold"
            type="submit"
            disabled={loggingIn}
          >
            {loggingIn ? "Входим…" : "Войти"}
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
              Добавляйте участки и обновляйте цены. Сохранённые изменения сразу
              доступны на сайте.
            </p>
          </div>
          <button
            className="button button-dark"
            type="button"
            onClick={logout}
            disabled={busy}
          >
            <LogOut size="1.0625rem" /> {loggingOut ? "Выходим…" : "Выйти"}
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
            disabled={busy || changedPlots.length === 0}
            onClick={saveAllChanges}
          >
            <Save size="1.0625rem" />
            {saving ? "Сохраняем…" : "Сохранить все изменения"}
          </button>
        </div>
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        {plots.length === 0 && (
          <p className="admin-empty">Участков пока нет.</p>
        )}
        <div className="admin-settlements">
          {Array.from(
            settlementGroups,
            ([settlement, settlementPlots], index) => (
              <section
                className="admin-settlement"
                key={settlement}
                aria-labelledby={`settlement-${index}`}
              >
                <header className="admin-settlement-header">
                  <h2 id={`settlement-${index}`}>
                    {settlement || "Без посёлка"}
                  </h2>
                  <div className="admin-settlement-actions">
                    <span className="admin-settlement-count">
                      Участков: {settlementPlots.length}
                    </span>
                    {settlement === "Другие участки" && (
                      <button
                        className="button button-gold admin-add-plot"
                        type="button"
                        disabled={busy}
                        aria-expanded={showCreateForm}
                        aria-controls="admin-create-plot"
                        onClick={() => {
                          setShowCreateForm((current) => !current);
                          setCreateError("");
                        }}
                      >
                        {showCreateForm ? (
                          <X size="1.0625rem" />
                        ) : (
                          <Plus size="1.0625rem" />
                        )}
                        {showCreateForm ? "Закрыть форму" : "Добавить участок"}
                      </button>
                    )}
                  </div>
                </header>
                {settlement === "Другие участки" && showCreateForm && (
                  <form
                    id="admin-create-plot"
                    className="admin-create-plot"
                    aria-labelledby="admin-create-heading"
                    aria-busy={creating}
                    onSubmit={createPlot}
                  >
                    <div className="admin-create-heading">
                      <h3 id="admin-create-heading">Новый участок</h3>
                      <p>
                        Участок появится в разделе «Другие участки» после
                        добавления.
                      </p>
                    </div>
                    <fieldset className="admin-create-fields" disabled={busy}>
                      <legend className="admin-visually-hidden">
                        Данные нового участка
                      </legend>
                      <label>
                        Номер участка
                        <input
                          autoFocus
                          required
                          maxLength={80}
                          value={newPlot.id}
                          onChange={(event) =>
                            updateNewPlot("id", event.target.value)
                          }
                          placeholder="Например, 2-02"
                        />
                      </label>
                      <label>
                        Площадь, сот.
                        <input
                          required
                          inputMode="decimal"
                          value={newPlot.area}
                          onChange={(event) =>
                            updateNewPlot("area", event.target.value)
                          }
                          placeholder="8,12"
                        />
                      </label>
                      <label>
                        Цена, ₽
                        <input
                          required
                          inputMode="decimal"
                          value={newPlot.price}
                          onChange={(event) =>
                            updateNewPlot("price", event.target.value)
                          }
                          placeholder="1800000"
                        />
                      </label>
                      <label>
                        Статус
                        <select
                          value={newPlot.status}
                          onChange={(event) =>
                            updateNewPlot("status", event.target.value)
                          }
                        >
                          {plotStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-create-wide">
                        Улица или адрес
                        <input
                          maxLength={200}
                          value={newPlot.street}
                          onChange={(event) =>
                            updateNewPlot("street", event.target.value)
                          }
                          placeholder="Необязательно"
                        />
                      </label>
                      <label className="admin-create-wide">
                        Описание
                        <textarea
                          rows={3}
                          maxLength={4000}
                          value={newPlot.description}
                          onChange={(event) =>
                            updateNewPlot("description", event.target.value)
                          }
                          placeholder="Особенности участка — необязательно"
                        />
                      </label>
                    </fieldset>
                    {createError && (
                      <div className="admin-error" role="alert">
                        {createError}
                      </div>
                    )}
                    <div className="admin-create-footer">
                      <p>Номер, площадь и цена обязательны.</p>
                      <button
                        className="button button-gold"
                        type="submit"
                        disabled={busy}
                      >
                        <Plus size="1.0625rem" />{" "}
                        {creating ? "Добавляем…" : "Добавить участок на сайт"}
                      </button>
                    </div>
                  </form>
                )}
                {settlementPlots.length === 0 && (
                  <p className="admin-empty">
                    Здесь пока нет участков. Добавьте первое предложение.
                  </p>
                )}
                <div
                  className="admin-table-wrap"
                  role="region"
                  aria-labelledby={`settlement-${index}`}
                  tabIndex={0}
                >
                  <table
                    className="admin-table"
                    aria-labelledby={`settlement-${index}`}
                  >
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
                        <tr
                          key={plot.id}
                          data-changed={changedIds.has(plot.id)}
                        >
                          <td>
                            <strong>{plot.id}</strong>
                          </td>
                          <td>
                            <input
                              disabled={busy}
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
                              disabled={busy}
                              value={plot.status}
                              onChange={(event) =>
                                updatePlot(
                                  plot.id,
                                  "status",
                                  event.target.value,
                                )
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
                              disabled={busy}
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
                              disabled={busy}
                              maxLength={200}
                              value={plot.street ?? ""}
                              onChange={(event) =>
                                updatePlot(
                                  plot.id,
                                  "street",
                                  event.target.value,
                                )
                              }
                              aria-label={`Улица ${plot.id}`}
                            />
                          </td>
                          <td>
                            <input
                              disabled={busy}
                              maxLength={4000}
                              value={plot.description ?? ""}
                              onChange={(event) =>
                                updatePlot(
                                  plot.id,
                                  "description",
                                  event.target.value,
                                )
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
            ),
          )}
        </div>
      </div>
    </main>
  );
}
