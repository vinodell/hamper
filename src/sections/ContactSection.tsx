import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { useState } from "react";

import { TgLogo } from "../images";
import { useNavigate } from "react-router-dom";
import { policyMsg, siteConfig } from "../lib";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  const localNumber = digits.startsWith("7") ? digits.slice(1) : digits;

  if (!localNumber) return "";
  if (localNumber.length <= 3) return `+7 (${localNumber}`;
  if (localNumber.length <= 6)
    return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3)}`;
  if (localNumber.length <= 8)
    return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6)}`;
  return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6, 8)}-${localNumber.slice(8)}`;
}

export function ContactSection() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(event.target.value));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const redirectToTg = () => {
    navigate("https://t.me/vinodell");
  };

  return (
    <section className="contact-section" id="form">
      <div className="container contact-grid">
        <div className="contact-copy">
          <p className="eyebrow light">КОНТАКТЫ</p>

          <h2>
            Записаться
            <br />
            <em>на просмотр</em>
          </h2>

          <p>
            Оставьте заявку, и мы свяжемся с вами, чтобы рассказать о поселках и
            подобрать подходящий участок.
          </p>

          <div className="contact-details">
            <div className="mobile-contacts">
              <a href={siteConfig.phoneHref}>
                <Phone size={18} />
                {siteConfig.phone2}
              </a>
              <a href="https://t.me/lifescrip">
                <TgLogo />
              </a>
            </div>
            <div className="mobile-contacts">
              <a href={siteConfig.phoneHref}>
                <Phone size={18} />
                {siteConfig.phone}
              </a>
              <a href="https://t.me/lifescrip">
                <TgLogo />
              </a>
            </div>
            <div className="mobile-contacts">
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
            Интересующий участок
            <select name="plot" defaultValue="">
              <option value="" disabled>
                Выберите объект
              </option>

              <option>Ойнелово парк</option>
              <option>Другие участки</option>
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
}
