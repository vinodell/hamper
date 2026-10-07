import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { formatPhone, usePlots } from "../hooks";
import { TgLogo, WhatsupLogo } from "../images";
import { policyMsg, siteConfig, PHONE_PATTERN, type Plot } from "../lib";
import { api } from "../lib/api";

import "./Contacts.css";

const mobileContacts = [
  {
    id: "vlad",
    phone: siteConfig.phone2,
    telegram: siteConfig.vladTelegram,
    whatsapp: siteConfig.vladWhatsapp,
  },
  {
    id: "maks",
    phone: siteConfig.phone,
    telegram: siteConfig.maksTelegram,
    whatsapp: siteConfig.maksWhatsapp,
  },
];

export const Contacts = ({ selectedPlot }: { selectedPlot?: Plot | null }) => {
  const [phone, setPhone] = useState("");
  const { plots, error: plotsError } = usePlots();
  const [chosenProject, setChosenProject] = useState("");
  const [chosenPlot, setChosenPlot] = useState("");
  const [formState, setFormState] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");
  const pendingSubmission = useRef(false);
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

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(event.target.value));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingSubmission.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    pendingSubmission.current = true;
    setFormState("sending");
    setSubmitError("");
    api
      .sendContact({
        name: String(form.get("name") ?? ""),
        phone,
        project: chosenProject,
        plot: availableChosenPlot,
        comment: String(form.get("comment") ?? ""),
      })
      .then(() => {
        setFormState("success");
        formElement.reset();
        setPhone("");
        setChosenProject("");
        setChosenPlot("");
      })
      .catch((reason: unknown) => {
        setFormState("error");
        setSubmitError(
          reason instanceof Error
            ? reason.message
            : "Не удалось отправить заявку. Попробуйте ещё раз.",
        );
      })
      .finally(() => {
        pendingSubmission.current = false;
      });
  };

  const handleProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setChosenProject(event.target.value);
    setChosenPlot("");
  };

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

  return (
    <section className="contact-section" id="form">
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
            {mobileContacts.map(({ id, phone, telegram, whatsapp }) => (
              <div className="mobile-contacts" key={id}>
                <span className="contact-phone">
                  <Phone size={18} />
                  {phone}
                </span>
                <a
                  className="social-logo"
                  href={`https://t.me/${telegram}`}
                  aria-label="Написать в Telegram"
                >
                  <TgLogo />
                </a>
                <a
                  className="social-logo"
                  href={`https://wa.me/${whatsapp}`}
                  aria-label="Написать в WhatsApp"
                >
                  <WhatsupLogo />
                </a>
              </div>
            ))}
            <div className="mobile-contacts email-container">
              <a href={`mailto:${siteConfig.email}`}>
                <Mail size={18} />
                {siteConfig.email}
              </a>
            </div>
          </div>
        </div>

        <form
          className="contact-form"
          onSubmit={handleSubmit}
          aria-busy={formState === "sending"}
        >
          <label>
            Ваше имя
            <input
              name="name"
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
              onChange={handlePhoneChange}
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
              onChange={handleProjectChange}
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
              disabled={formState === "sending"}
            >
              <option value="">Выберите участок</option>
              {availablePlots.length > 0 ? (
                availablePlots.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))
              ) : (
                <option value="" disabled key="no-lands">
                  Нет доступных участков
                </option>
              )}
            </select>
          </label>
          {plotsError && <small role="alert">{plotsError}</small>}
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
          <button
            className="button button-gold"
            type="submit"
            disabled={formState === "sending"}
          >
            {formState === "sending" ? "Отправляем…" : "Отправить заявку"}
            <ArrowUpRight size={17} />
          </button>
          {formState === "success" && (
            <small className="form-success">
              Заявка отправлена. Мы скоро свяжемся с Вами.
            </small>
          )}
          {formState === "error" && (
            <small className="form-error" role="alert">
              {submitError}
            </small>
          )}
          <small>{policyMsg}</small>
        </form>
      </div>
    </section>
  );
};
