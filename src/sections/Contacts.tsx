import { usePlots } from "../hooks/usePlots";
import { useMemo, useState } from "react";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { formatPhone } from "../hooks";
import { TgLogo, WhatsupLogo } from "../images";
import { policyMsg, siteConfig, PHONE_PATTERN } from "../lib";
import { api } from "../lib/api";

export const Contacts = () => {
  const [phone, setPhone] = useState("");
  const { plots: chosenLand, error: plotsError } = usePlots();
  const [chosenProject, setChosenProject] = useState<string>("");
  const [chosenPlot, setChosenPlot] = useState("");
  const [formState, setFormState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(event.target.value));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setFormState("sending");
    api.sendContact({ name: String(form.get("name") ?? ""), phone, project: chosenProject, plot: availableChosenPlot, comment: String(form.get("comment") ?? "") })
      .then(() => { setFormState("success"); formElement.reset(); setPhone(""); setChosenProject(""); setChosenPlot(""); })
      .catch(() => setFormState("error"));
  };

  const choseProject = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setChosenProject(event.target.value);
    setChosenPlot("");
  };

  const filteredLand = useMemo(() => {
    return chosenLand.filter((item) => {
      return item.settlement === chosenProject && item.status === "Свободен";
    });
  }, [chosenProject, chosenLand]);

  const availableChosenPlot = filteredLand.some((plot) => plot.id === chosenPlot) ? chosenPlot : "";

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
            <div className="mobile-contacts">
              <a href={siteConfig.phoneHref}>
                <Phone size={18} />
                {siteConfig.phone2}
              </a>
              <a href={`https://t.me/${siteConfig.vladTelegram}`}>
                <TgLogo />
              </a>
              <a href={`https://wa.me/${siteConfig.vladWhatsapp}`}>
                <WhatsupLogo />
              </a>
            </div>
            <div className="mobile-contacts">
              <a href={siteConfig.phoneHref}>
                <Phone size={18} />
                {siteConfig.phone}
              </a>
              <a href={`https://t.me/${siteConfig.maksTelegram}`}>
                <TgLogo />
              </a>
              <a href={`https://wa.me/${siteConfig.maksWhatsapp}`}>
                <WhatsupLogo />
              </a>
            </div>
            <div className="mobile-contacts email-container">
              <a href={`mailto:${siteConfig.email}`}>
                <Mail size={18} />
                {siteConfig.email}
              </a>
            </div>
          </div>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <label>
            Ваше имя
            <input name="name" placeholder="Как к Вам обращаться" required />
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
            />
          </label>
          <label>
            Интересующий объект
            <select name="project" value={chosenProject} onChange={choseProject}>
              <option value="" disabled>
                Выберите объект
              </option>
              <option>Ойнеловские дали</option>
              <option>Другие участки</option>
            </select>
          </label>
          <label>
            Номер участка
            <select name="plot" value={availableChosenPlot} onChange={(event) => setChosenPlot(event.target.value)}>
              <option value="">Выберите участок</option>
              {filteredLand.length > 0 ? (
                filteredLand.map((item) => (
                  <option key={item.id} value={item.id}>{item.id}</option>
                ))
              ) : (
                <option value="" disabled key="no-lands">Нет доступных участков</option>
              )}
            </select>
          </label>
          {plotsError && <small role="alert">{plotsError}</small>}
          <label>
            Комментарий
            <textarea name="comment" rows={3} placeholder="Ваш вопрос" />
          </label>
          <button className="button button-gold" type="submit" disabled={formState === "sending"}>
            Отправить заявку
            <ArrowUpRight size={17} />
          </button>
          {formState === "success" && <small className="form-success">Заявка отправлена. Мы скоро свяжемся с Вами.</small>}
          {formState === "error" && <small className="form-error">Не удалось отправить заявку. Попробуйте еще раз.</small>}
          <small>{policyMsg}</small>
        </form>
      </div>
    </section>
  );
};
