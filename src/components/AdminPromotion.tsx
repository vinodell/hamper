import { BadgePercent, RefreshCw, Save } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api, ApiError } from "../lib/api";
import { notifyPlotsUpdated } from "../lib/plotEvents";
import {
  createPromotionDraft,
  mergePromotionDraft,
  type PromotionDraft,
} from "../lib/promotionDrafts";

interface AdminPromotionProps {
  disabled: boolean;
  draft: PromotionDraft;
  onDraftChange: Dispatch<SetStateAction<PromotionDraft>>;
  onAuthenticationError: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}

export function AdminPromotion({
  disabled,
  draft,
  onDraftChange,
  onAuthenticationError,
  onDirtyChange,
  onSavingChange,
}: AdminPromotionProps) {
  const { saved, enabled, discount } = draft;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const percentage = Number(discount);
  const valid =
    discount.trim() !== "" &&
    Number.isInteger(percentage) &&
    percentage >= 1 &&
    percentage <= 100;
  const dirty =
    saved !== null &&
    (enabled !== saved.promotion.enabled ||
      percentage !== saved.promotion.discountPercent ||
      !valid);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const settings = await api.getAdminSettings({ signal });
        if (signal?.aborted) return;
        onDraftChange((current) => mergePromotionDraft(settings, current));
      } catch (reason) {
        if (signal?.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) {
          onAuthenticationError();
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось загрузить настройки акции.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onAuthenticationError, onDraftChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || saving || !dirty || !valid) return;
    setSaving(true);
    onSavingChange(true);
    setError("");
    setMessage("");
    try {
      const settings = await api.updateSettings({
        promotion: { enabled, discountPercent: percentage },
      });
      onDraftChange(createPromotionDraft(settings));
      setMessage("Настройки акции сохранены.");
      notifyPlotsUpdated();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        onAuthenticationError();
        return;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить настройки акции.",
      );
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  };

  return (
    <section
      className="admin-promotion"
      aria-labelledby="admin-promotion-title"
    >
      <div className="admin-promotion-heading">
        <span className="admin-promotion-icon">
          <BadgePercent size={24} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">АКЦИЯ НА САЙТЕ</p>
          <h2 id="admin-promotion-title">Показывайте актуальное предложение</h2>
        </div>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {!saved && !loading && (
        <button
          type="button"
          className="button button-dark"
          onClick={() => void load()}
          disabled={disabled}
        >
          <RefreshCw size={16} aria-hidden="true" /> Повторить загрузку акции
        </button>
      )}
      <form onSubmit={save} aria-busy={loading || saving}>
        <fieldset
          disabled={disabled || loading || saving || !saved}
          className="admin-promotion-controls"
        >
          <legend className="admin-visually-hidden">
            Настройки отображения акции
          </legend>
          <label className="admin-promotion-toggle">
            <input
              className="tw:peer tw:sr-only"
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={(event) => {
                const checked = event.target.checked;
                onDraftChange((current) => ({ ...current, enabled: checked }));
                setMessage("");
              }}
            />
            <span
              className={`admin-switch-track tw:peer-focus-visible:outline-2 tw:peer-focus-visible:outline-offset-4 tw:motion-safe:transition-colors tw:duration-200 ${enabled ? "is-enabled" : ""}`}
              aria-hidden="true"
            >
              <span className="tw:motion-safe:transition-transform tw:duration-200" />
            </span>
            <span>
              <strong>Показывать ленту акции</strong>
              <small>
                {enabled
                  ? "Лента включена на публичных страницах"
                  : "Лента скрыта на публичных страницах"}
              </small>
            </span>
          </label>
          <label className="admin-discount-input">
            Скидка до, %
            <input
              name="discountPercent"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              required
              value={discount}
              onChange={(event) => {
                const value = event.target.value;
                onDraftChange((current) => ({ ...current, discount: value }));
                setMessage("");
              }}
            />
          </label>
          <button
            className="button button-dark tw:motion-safe:transition-transform tw:duration-200"
            type="submit"
            disabled={!dirty || !valid}
          >
            <Save size={17} aria-hidden="true" />
            {saving ? "Сохраняем…" : "Сохранить акцию"}
          </button>
        </fieldset>
      </form>
      <div
        className="admin-promotion-preview"
        data-enabled={enabled}
        aria-label="Предпросмотр текста акции"
      >
        <span>
          {loading
            ? "Загружаем настройки…"
            : valid
              ? `Скидки до ${percentage}% на участки`
              : "Укажите скидку от 1 до 100%"}
        </span>
        <span>{enabled ? "В эфире" : "Скрыто"}</span>
      </div>
      {message && (
        <p className="admin-save-status" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
