import { Phone } from "lucide-react";
import { TgLogo, WhatsupLogo } from "../images";
import { contactPeople } from "../lib/contactDetails";

export function HomeContacts() {
  return (
    <section
      className="home-contact-wrap"
      id="form"
      aria-labelledby="home-contact-title"
    >
      <div className="container home-contact">
        <div className="home-contact__content">
          <h2 id="home-contact-title">Хотите подобрать участок?</h2>
          <div
            className="home-contact__people"
            aria-label="Телефоны и мессенджеры"
          >
            {contactPeople.map(
              ({ id, phone, phoneHref, telegram, whatsapp }) => (
                <div className="home-contact-person" key={id}>
                  {phone && (
                    <a className="home-contact-person__phone" href={phoneHref}>
                      <Phone size={18} strokeWidth={1.5} aria-hidden="true" />
                      {phone}
                    </a>
                  )}
                  <div className="home-contact-person__messengers">
                    {whatsapp && (
                      <a
                        className="home-messenger home-messenger--whatsapp"
                        href={`https://wa.me/${whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Написать в WhatsApp${phone ? `: ${phone}` : ""}`}
                      >
                        <WhatsupLogo />
                      </a>
                    )}
                    {telegram && (
                      <a
                        className="home-messenger home-messenger--telegram"
                        href={`https://t.me/${telegram}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Написать в Telegram${phone ? `: ${phone}` : ""}`}
                      >
                        <TgLogo />
                      </a>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
        <div className="home-contact__photo">
          <img
            src={`${import.meta.env.BASE_URL}images/nature/oinelovo-960.webp`}
            alt="Сосновый лес у тихого озера"
            width={960}
            height={384}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
