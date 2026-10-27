import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Mail, ShieldCheck } from "lucide-react";
import { formatPhone, usePlots } from "../hooks";
import { ContactPeople } from "../components/ContactPeople";
import { PhoneInput } from "../components/PhoneInput";
import { siteConfig, type Plot } from "../lib";
import { api } from "../lib/api";
import { isValidRussianPhone, PHONE_REQUIRED_MESSAGE } from "../lib/phone";

import "./Contacts.css";
import "../components/ContactDialog.css";

export type ContactRequestKind = "viewing" | "availability";

type ContactsProps = {
  selectedPlot?: Plot | null;
  requestKind?: ContactRequestKind;
  initialProject?: string;
  id?: string;
  variant?: "section" | "dialog";
  onSubmittingChange?: (submitting: boolean) => void;
};

export const Contacts = ({
  selectedPlot,
  requestKind = "viewing",
  initialProject = "",
  id = "form",
  variant = "section",
  onSubmittingChange,
}: ContactsProps) => {
  const isDialog = variant === "dialog";
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const { plots, loading: plotsLoading, error: plotsError } = usePlots();
  const [chosenProject, setChosenProject] = useState(initialProject);
  const [chosenPlot, setChosenPlot] = useState("");
  const [formState, setFormState] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");
  const phoneErrorId = useId();
  const validPhone = isValidRussianPhone(phone);
  const invalidPhone = formState === "error" && !validPhone;
  const pendingSubmission = useRef(false);
  const availabilityPlot =
    requestKind === "availability" && selectedPlot?.status === "Забронирован"
      ? selectedPlot
      : null;
  const commentPrefix = availabilityPlot
    ? `Прошу уведомить, если участок ${availabilityPlot.id} освободится от брони.`
    : "";
  const commentMaxLength = commentPrefix
    ? 2000 - commentPrefix.length - 1
    : 2000;

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
    if (pendingSubmission.current) return;
    setConsent(false);
    setFormState("idle");
    if (
      requestKind !== "viewing" ||
      !selectedPlot ||
      selectedPlot.status !== "Свободен"
    )
      return;
    setChosenProject(selectedPlot.settlement);
    setChosenPlot(selectedPlot.id);
  }, [selectedPlot, requestKind]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingSubmission.current) return;
    if (!validPhone) {
      setFormState("error");
      setSubmitError(PHONE_REQUIRED_MESSAGE);
      return;
    }
    if (!consent) {
      setFormState("error");
      setSubmitError(
        "Для отправки заявки необходимо согласие на обработку персональных данных.",
      );
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const userComment = String(form.get("comment") ?? "");
    if (userComment.length > commentMaxLength) {
      setFormState("error");
      setSubmitError(`Сократите комментарий до ${commentMaxLength} символов.`);
      return;
    }
    pendingSubmission.current = true;
    setFormState("sending");
    onSubmittingChange?.(true);
    setSubmitError("");
    try {
      await api.sendContact({
        name: String(form.get("name") ?? ""),
        phone: formatPhone(phone),
        project: availabilityPlot?.settlement ?? chosenProject,
        plot: availabilityPlot?.id ?? availableChosenPlot,
        comment: commentPrefix
          ? `${commentPrefix}${userComment ? `\n${userComment}` : ""}`
          : userComment,
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
        {isDialog ? (
          <div className="contact-dialog-intro">
            <p>
              {availabilityPlot
                ? `Участок ${availabilityPlot.id} сейчас забронирован. Оставьте контакты — мы сообщим, если он освободится.`
                : "Познакомьтесь с посёлком и выберите свой участок. Оставьте контакты — мы согласуем удобное время просмотра."}
            </p>
          </div>
        ) : (
          <div className="contact-copy">
            <p className="eyebrow light my-text-bold">КОНТАКТЫ</p>

            <h2 className="my-text-bold">
              {availabilityPlot ? "Получить" : "Записаться"}
              <br />
              <em className="my-text-bold">
                {availabilityPlot ? "уведомление" : "на просмотр"}
              </em>
            </h2>

            <p className="my-text-regular">
              {availabilityPlot
                ? `Участок ${availabilityPlot.id} забронирован. Оставьте контакты — мы свяжемся с Вами, если он освободится.`
                : "Оставьте заявку, и мы свяжемся с Вами, чтобы рассказать о поселках и подобрать подходящий участок."}
            </p>

            <div className="contact-details">
              <ContactPeople />
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
        )}

        <form
          className={`contact-form${isDialog ? " contact-form--dialog tw:sm:grid-cols-2" : ""}`}
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
            <PhoneInput
              value={phone}
              onChange={setPhone}
              onBlur={() => {
                if (phone && !validPhone) {
                  setFormState("error");
                  setSubmitError(PHONE_REQUIRED_MESSAGE);
                }
              }}
              disabled={formState === "sending"}
              invalid={invalidPhone}
              describedBy={invalidPhone ? phoneErrorId : undefined}
            />
          </label>
          <label>
            Интересующий объект
            {availabilityPlot ? (
              <input
                name="project"
                value={availabilityPlot.settlement}
                readOnly
                disabled={formState === "sending"}
              />
            ) : (
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
            )}
          </label>
          <label>
            Номер участка
            {availabilityPlot ? (
              <input
                name="plot"
                value={availabilityPlot.id}
                readOnly
                disabled={formState === "sending"}
              />
            ) : (
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
            )}
          </label>
          {!availabilityPlot && plotsError && (
            <small
              className={isDialog ? "tw:sm:col-span-2" : undefined}
              role="alert"
            >
              {plotsError}
            </small>
          )}
          {!availabilityPlot &&
            chosenPlot &&
            !availableChosenPlot &&
            !plotsLoading && (
              <small
                className={isDialog ? "tw:sm:col-span-2" : undefined}
                role="status"
              >
                Выбранный участок больше не доступен. Выберите другой или
                оставьте заявку без номера участка.
              </small>
            )}
          <label className={isDialog ? "tw:sm:col-span-2" : undefined}>
            Комментарий
            {isDialog && (
              <span className="contact-field-optional"> · необязательно</span>
            )}
            <textarea
              name="comment"
              rows={isDialog ? 2 : 3}
              maxLength={commentMaxLength}
              placeholder={
                isDialog
                  ? "Пожелания или удобное время для звонка"
                  : "Ваш вопрос"
              }
              disabled={formState === "sending"}
            />
          </label>
          <label
            className={`contact-consent tw:motion-safe:transition-colors tw:duration-200${isDialog ? " tw:sm:col-span-2" : ""}`}
          >
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
            className={`button button-gold${isDialog ? " tw:group tw:sm:col-span-2 tw:motion-safe:transition-colors tw:duration-200" : ""}`}
            type="submit"
            disabled={formState === "sending" || !consent || !validPhone}
          >
            {formState === "sending"
              ? "Отправляем…"
              : availabilityPlot
                ? "Оставить заявку на уведомление"
                : "Отправить заявку"}
            <ArrowUpRight
              size="1.0625rem"
              aria-hidden="true"
              className={
                isDialog
                  ? "tw:shrink-0 tw:motion-safe:transition-transform tw:duration-200 tw:motion-safe:group-hover:translate-x-0.5 tw:motion-safe:group-hover:-translate-y-0.5"
                  : undefined
              }
            />
          </button>
          {isDialog && (
            <p className="contact-dialog-privacy tw:sm:col-span-2 tw:flex tw:items-center tw:justify-center tw:gap-2">
              <ShieldCheck
                size={15}
                className="tw:shrink-0"
                aria-hidden="true"
              />
              Используем контакты только для связи по заявке
            </p>
          )}
          {formState === "success" && (
            <small
              className={`form-success${isDialog ? " tw:sm:col-span-2 tw:flex tw:items-start tw:gap-2" : ""}`}
              role="status"
            >
              {isDialog && (
                <Check size={18} className="tw:shrink-0" aria-hidden="true" />
              )}
              <span>
                {availabilityPlot
                  ? "Заявка на уведомление отправлена. Мы свяжемся с Вами, если участок освободится."
                  : "Заявка отправлена. Мы скоро свяжемся с Вами."}
              </span>
            </small>
          )}
          {formState === "error" && (
            <small
              id={phoneErrorId}
              className={`form-error${isDialog ? " tw:sm:col-span-2" : ""}`}
              role="alert"
            >
              {submitError}
            </small>
          )}
        </form>
      </div>
    </section>
  );
};
