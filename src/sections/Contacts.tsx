import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { formatPhone, usePlots } from "../hooks";
import { TgLogo, WhatsupLogo } from "../images";
import { siteConfig, PHONE_PATTERN, type Plot } from "../lib";
import { api } from "../lib/api";

import "./Contacts.css";

const mobileContacts = [
  {
    id: "vlad",
    phone: siteConfig.phone2,
    phoneHref: siteConfig.phone2Href,
    telegram: siteConfig.vladTelegram,
    whatsapp: siteConfig.vladWhatsapp,
  },
  {
    id: "maks",
    phone: siteConfig.phone,
    phoneHref: siteConfig.phoneHref,
    telegram: siteConfig.maksTelegram,
    whatsapp: siteConfig.maksWhatsapp,
  },
].filter(({ phone, telegram, whatsapp }) => phone || telegram || whatsapp);

type ContactsProps = {
  selectedPlot?: Plot | null;
  initialProject?: string;
  id?: string;
  onSubmittingChange?: (submitting: boolean) => void;
};

export const Contacts = ({
  selectedPlot,
  initialProject = "",
  id = "form",
  onSubmittingChange,
}: ContactsProps) => {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const { plots, loading: plotsLoading, error: plotsError } = usePlots();
  const [chosenProject, setChosenProject] = useState(initialProject);
  const [chosenPlot, setChosenPlot] = useState("");
  const [formState, setFormState] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");
  const pendingSubmission = useRef(false);

  const availablePlots = useMemo(
    () =>
      plots.filter(
        (plot) =>
          plot.settlement === chosenProject && plot.status === "Свободен",
      ),
    [chosenProject, plots],
  );
  const availableChosenPlot = availablePlots.some(
    (plot) => plot.id === chosenPlot,
  )
    ? chosenPlot
    : "";

  useEffect(() => {
    if (
      pendingSubmission.current ||
      !selectedPlot ||
      selectedPlot.status !== "Свободен"
    )
      return;
    setChosenProject(selectedPlot.settlement);
    setChosenPlot(selectedPlot.id);
    setFormState("idle");
  }, [selectedPlot]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingSubmission.current) return;
    if (!consent) {
      setFormState("error");
      setSubmitError(
        "Для отправки заявки необходимо согласие на обработку персональных данных.",
      );
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    pendingSubmission.current = true;
    setFormState("sending");
    onSubmittingChange?.(true);
    setSubmitError("");
    try {
      await api.sendContact({
        name: String(form.get("name") ?? ""),
        phone: formatPhone(phone),
        project: chosenProject,
        plot: availableChosenPlot,
        comment: String(form.get("comment") ?? ""),
        consent,
      });
      setFormState("success");
      formElement.reset();
      setPhone("");
      setConsent(false);
      setChosenProject(initialProject);
      setChosenPlot("");
    } catch (reason) {
      setFormState("error");
      setSubmitError(
        reason instanceof Error
          ? reason.message
          : "Не удалось отправить заявку. Попробуйте ещё раз.",
      );
    } finally {
      pendingSubmission.current = false;
      onSubmittingChange?.(false);
    }
  };

  return (
    <section className="contact-section" id={id}>
      <div className="container contact-grid">
        <div className="contact-copy">
          <p className="eyebrow light my-text-bold">КОНТАКТЫ</p>

          <h2 className="my-text-bold">
            Записаться
            <br />
            <em className="my-text-bold">на просмотр</em>
          </h2>

          <p className="my-text-regular">
            Оставьте заявку, и мы свяжемся с Вами, чтобы рассказать о поселках и
            подобрать подходящий участок.
          </p>

          <div className="contact-details">
            {mobileContacts.map(
              ({ id, phone, phoneHref, telegram, whatsapp }) => (
                <div className="mobile-contacts" key={id}>
                  {phone && (
                    <a
                      className="contact-phone"
                      href={phoneHref}
                      aria-label={`Позвонить: ${phone}`}
                    >
                      <Phone size="1.125rem" />
                      {phone}
                    </a>
                  )}
                  {telegram && (
                    <a
                      className="social-logo"
                      href={`https://t.me/${telegram}`}
                      aria-label="Написать в Telegram"
                    >
                      <TgLogo />
                    </a>
                  )}
                  {whatsapp && (
                    <a
                      className="social-logo"
                      href={`https://wa.me/${whatsapp}`}
                      aria-label="Написать в WhatsApp"
                    >
                      <WhatsupLogo />
                    </a>
                  )}
                </div>
              ),
            )}
            {siteConfig.email && (
              <div className="mobile-contacts email-container">
                <a href={`mailto:${siteConfig.email}`}>
                  <Mail size="1.125rem" />
                  {siteConfig.email}
                </a>
              </div>
            )}
          </div>
        </div>

        <form
          className="contact-form"
          onSubmit={handleSubmit}
          onChange={() => {
            if (formState === "success" || formState === "error")
              setFormState("idle");
          }}
          aria-busy={formState === "sending"}
        >
          <label>
            Ваше имя
            <input
              name="name"
              autoComplete="name"
              placeholder="Как к Вам обращаться"
              maxLength={120}
              disabled={formState === "sending"}
              required
            />
          </label>

          <label>
            Телефон *
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onBlur={(event) => setPhone(formatPhone(event.target.value))}
              name="phone"
              placeholder="+7 (___) ___-__-__"
              pattern={PHONE_PATTERN}
              required
              autoComplete="tel"
              inputMode="tel"
              aria-label="Телефон"
              disabled={formState === "sending"}
            />
          </label>
          <label>
            Интересующий объект
            <select
              name="project"
              value={chosenProject}
              onChange={(event) => {
                setChosenProject(event.target.value);
                setChosenPlot("");
              }}
              disabled={formState === "sending"}
            >
              <option value="" disabled>
                Выберите объект
              </option>
              <option>Ойнеловские дали</option>
              <option>Другие участки</option>
            </select>
          </label>
          <label>
            Номер участка
            <select
              name="plot"
              value={availableChosenPlot}
              onChange={(event) => setChosenPlot(event.target.value)}
              disabled={
                formState === "sending" || plotsLoading || !chosenProject
              }
            >
              <option value="">
                {!chosenProject
                  ? "Сначала выберите объект"
                  : plotsLoading
                    ? "Загружаем участки…"
                    : "Выберите участок"}
              </option>
              {availablePlots.length > 0 ? (
                availablePlots.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))
              ) : chosenProject && !plotsLoading && !plotsError ? (
                <option value="" disabled key="no-lands">
                  Нет доступных участков
                </option>
              ) : null}
            </select>
          </label>
          {plotsError && <small role="alert">{plotsError}</small>}
          {chosenPlot && !availableChosenPlot && !plotsLoading && (
            <small role="status">
              Выбранный участок больше не доступен. Выберите другой или оставьте
              заявку без номера участка.
            </small>
          )}
          <label>
            Комментарий
            <textarea
              name="comment"
              rows={3}
              maxLength={2000}
              placeholder="Ваш вопрос"
              disabled={formState === "sending"}
            />
          </label>
          <label className="contact-consent tw:motion-safe:transition-colors tw:duration-200">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              disabled={formState === "sending"}
            />
            <span>
              Я согласен на обработку персональных данных для связи по моей
              заявке.
            </span>
          </label>
          <button
            className="button button-gold"
            type="submit"
            disabled={formState === "sending" || !consent}
          >
            {formState === "sending" ? "Отправляем…" : "Отправить заявку"}
            <ArrowUpRight size="1.0625rem" />
          </button>
          {formState === "success" && (
            <small className="form-success" role="status">
              Заявка отправлена. Мы скоро свяжемся с Вами.
            </small>
          )}
          {formState === "error" && (
            <small className="form-error" role="alert">
              {submitError}
            </small>
          )}
        </form>
      </div>
    </section>
  );
};
