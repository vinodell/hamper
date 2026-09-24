import { useMemo, useState } from "react";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { formatPhone } from "../hooks";
import { TgLogo, WhatsupLogo } from "../images";
import { plots, Plot, policyMsg, siteConfig } from "../lib";

export const Contacts = () => {
  const [phone, setPhone] = useState("");
  const [chosenLand] = useState<Plot[]>(plots);
  const [chosenProject, setChosenProject] = useState<string>("");
  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(event.target.value));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const choseProject = (event: any) => {
    setChosenProject(event.target.value);
  };

  const filteredLand = useMemo(() => {
    return chosenLand.filter((item) => {
      return item.settlement === chosenProject && item.status === "Свободен";
    });
  }, [chosenProject, chosenLand]);

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
              pattern="\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}"
              required
              autoComplete="tel"
              inputMode="tel"
              aria-label="Телефон"
            />
          </label>
          <label>
            Интересующий объект
            <select name="plot" value={chosenProject} onChange={choseProject}>
              <option value="" disabled>
                Выберите объект
              </option>
              <option>Ойнеловские дали</option>
              <option>Другие участки</option>
            </select>
          </label>
          <label>
            Номер участка
            <select name="plot" defaultValue="">
              {filteredLand.length > 0 ? (
                filteredLand.map((item, index) => (
                  <option key={index}>{item.id}</option>
                ))
              ) : (
                <option key="no-lands">Нет доступных участков</option>
              )}
            </select>
          </label>
          <label>
            Комментарий
            <textarea name="comment" rows={3} placeholder="Ваш вопрос" />
          </label>
          <button className="button button-gold" type="submit">
            Отправить заявку
            <ArrowUpRight size={17} />
          </button>
          <small>{policyMsg}</small>
        </form>
      </div>
    </section>
  );
};
