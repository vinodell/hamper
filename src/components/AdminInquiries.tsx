import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenCheck,
  CheckCheck,
  CircleCheck,
  Clock3,
  Inbox,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError, type AdminInquiry } from "../lib/api";

import "./AdminInquiries.css";

const inquiryDate = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

const telegramPresentation: Record<
  AdminInquiry["telegramStatus"],
  { label: string; detail: string; icon: LucideIcon }
> = {
  not_configured: {
    label: "Telegram не настроен",
    detail: "Заявка сохранена в Journal",
    icon: Send,
  },
  pending: {
    label: "В очереди Telegram",
    detail: "Ожидает отправки. Заявка уже сохранена",
    icon: Clock3,
  },
  sent: {
    label: "Отправлено в Telegram",
    detail: "Заявка также сохранена в Journal",
    icon: CircleCheck,
  },
  failed: {
    label: "Не отправлено в Telegram",
    detail: "Заявка сохранена — свяжитесь с клиентом",
    icon: TriangleAlert,
  },
};

function TelegramDelivery({ inquiry }: { inquiry: AdminInquiry }) {
  const {
    label,
    detail,
    icon: Icon,
  } = telegramPresentation[inquiry.telegramStatus];
  return (
    <div
      className="admin-inquiry-delivery"
      data-status={inquiry.telegramStatus}
    >
      <Icon size="1rem" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>
          {detail}
          {inquiry.telegramAttempts > 0 &&
            ` · Попыток: ${inquiry.telegramAttempts}`}
        </span>
      </div>
    </div>
  );
}

interface AdminInquiriesProps {
  onAuthenticationError: () => void;
  disabled?: boolean;
}

export function AdminInquiries({
  onAuthenticationError,
  disabled = false,
}: AdminInquiriesProps) {
  const [items, setItems] = useState<AdminInquiry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (before?: number) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const page = await api.getAdminInquiries({
          signal: controller.signal,
          before,
        });
        if (controller.signal.aborted) return;
        setItems((current) =>
          before === undefined ? page.items : [...current, ...page.items],
        );
        setNextCursor(page.nextCursor);
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setItems([]);
          onAuthenticationError();
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось загрузить заявки. Попробуйте ещё раз.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [onAuthenticationError],
  );

  useEffect(() => {
    void load();
    return () => requestRef.current?.abort();
  }, [load]);

  return (
    <section
      id="journal"
      className="admin-inquiries"
      aria-labelledby="admin-inquiries-title"
    >
      <header className="admin-inquiries-header">
        <div className="admin-inquiries-heading">
          <span className="admin-inquiries-icon" aria-hidden="true">
            <BookOpenCheck size="1.5rem" />
          </span>
          <div>
            <p className="eyebrow">ЖУРНАЛ ЗАЯВОК</p>
            <h2 id="admin-inquiries-title">Journal</h2>
          </div>
        </div>
        <div className="admin-inquiries-intro">
          <p>Все обращения с сайта — в одном месте.</p>
          <p>Заявки сохраняются здесь независимо от отправки в Telegram.</p>
        </div>
        <button
          className="button button-dark admin-inquiries-refresh"
          type="button"
          disabled={disabled || loading}
          onClick={() => void load()}
        >
          <RefreshCw size="1rem" aria-hidden="true" />
          Обновить заявки
        </button>
      </header>

      {error && (
        <div className="admin-error" role="alert">
          {error}
          {items.length > 0 && " Уже загруженные заявки сохранены на экране."}
        </div>
      )}
      <div className="admin-inquiries-content" aria-busy={loading}>
        <div className="admin-inquiries-toolbar">
          <p className="admin-inquiries-status" role="status">
            {loading
              ? "Загружаем заявки…"
              : error
                ? ""
                : items.length
                  ? `Загружено заявок: ${items.length}`
                  : "Заявок пока нет. Новые обращения появятся здесь."}
          </p>
          <p className="admin-inquiries-order">
            Сначала новые · Время по Москве
          </p>
        </div>
        {!loading && !error && items.length === 0 && (
          <div className="admin-inquiries-empty" aria-hidden="true">
            <Inbox size="1.75rem" />
          </div>
        )}
        {items.length > 0 && (
          <div
            className="admin-inquiries-scroll"
            role="region"
            aria-label="Список заявок"
            tabIndex={0}
          >
            <ol className="admin-inquiries-list">
              {items.map((inquiry) => (
                <li key={inquiry.id} className="admin-inquiry">
                  <div className="admin-inquiry-meta">
                    <span>Заявка №{inquiry.id}</span>
                    <time dateTime={inquiry.createdAt}>
                      {inquiryDate.format(new Date(inquiry.createdAt))}
                    </time>
                  </div>
                  <div className="admin-inquiry-contact">
                    <span className="admin-inquiry-avatar" aria-hidden="true">
                      <UserRound size="1.125rem" />
                    </span>
                    <div>
                      <h3>{inquiry.name}</h3>
                      <a
                        className="admin-inquiry-phone"
                        href={`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`}
                      >
                        <Phone size="0.875rem" aria-hidden="true" />
                        {inquiry.phone}
                      </a>
                    </div>
                  </div>
                  {(inquiry.project || inquiry.plot) && (
                    <dl className="admin-inquiry-details">
                      {inquiry.project && (
                        <div>
                          <dt>Проект</dt>
                          <dd>{inquiry.project}</dd>
                        </div>
                      )}
                      {inquiry.plot && (
                        <div>
                          <dt>Участок</dt>
                          <dd>{inquiry.plot}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {inquiry.comment && (
                    <div className="admin-inquiry-message">
                      <MessageSquare size="1rem" aria-hidden="true" />
                      <p className="admin-inquiry-comment">{inquiry.comment}</p>
                    </div>
                  )}
                  <TelegramDelivery inquiry={inquiry} />
                  <p className="admin-inquiry-consent">
                    <CheckCheck size="1rem" aria-hidden="true" />
                    Согласие на обработку данных получено
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
        {nextCursor !== null && (
          <button
            className="button button-dark admin-inquiries-more"
            type="button"
            disabled={disabled || loading}
            onClick={() => void load(nextCursor)}
          >
            {loading ? "Загружаем…" : "Показать ещё"}
          </button>
        )}
      </div>
    </section>
  );
}
