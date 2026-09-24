const env = import.meta.env;

export const contactConfig = {
  phone: env.VITE_PHONE_MAKS,
  phone2: env.VITE_PHONE_VLAD,
  phoneHref: env.VITE_PHONE_HREF,
  whatsapp: env.VITE_WHATSAPP_MAKS,
  vladWhatsapp: env.VITE_WHATSAPP_VLAD,
  maksWhatsapp: env.VITE_WHATSAPP_MAKS,
  vladTelegram: env.VITE_TELEGRAM_VLAD,
  maksTelegram: env.VITE_TELEGRAM_MAKS,
  email: env.VITE_CONTACT_EMAIL,
} as const;