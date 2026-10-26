import { siteConfig } from "./constants";

export const contactPeople = [
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
