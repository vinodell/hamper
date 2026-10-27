import { Phone } from "lucide-react";
import { TgLogo } from "../images/tg_logo";
import { WhatsupLogo } from "../images/whatsup_logo";
import { contactPeople } from "../lib/contactDetails";

import "./ContactPeople.css";

const messengers = [
  {
    key: "telegram",
    name: "Telegram",
    baseUrl: "https://t.me/",
    Icon: TgLogo,
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    baseUrl: "https://wa.me/",
    Icon: WhatsupLogo,
  },
] as const;

export function ContactPeople({ className = "" }: { className?: string }) {
  if (contactPeople.length === 0) return null;

  return (
    <div
      className={`contact-people ${className}`.trim()}
      aria-label="Телефоны и мессенджеры"
    >
      {contactPeople.map((person) => (
        <div className="contact-person" key={person.id}>
          {person.phone && (
            <a className="contact-person__phone" href={person.phoneHref}>
              <Phone size={18} strokeWidth={1.5} aria-hidden="true" />
              {person.phone}
            </a>
          )}
          <div className="contact-person__messengers">
            {messengers.map(({ key, name, baseUrl, Icon }) =>
              person[key] ? (
                <a
                  className={`contact-messenger contact-messenger--${key}`}
                  href={`${baseUrl}${person[key]}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Написать в ${name}${person.phone ? `: ${person.phone}` : ""}`}
                  key={key}
                >
                  <Icon />
                </a>
              ) : null,
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
