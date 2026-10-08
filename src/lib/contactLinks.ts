function httpsHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function telegramHref(value: string | undefined): string | undefined {
  const contact = value?.trim();
  if (!contact) return undefined;
  if (/^https:\/\//i.test(contact)) return httpsHref(contact);
  const username = contact.replace(/^@/, "");
  return /^[\w]+$/.test(username) ? `https://t.me/${username}` : undefined;
}

export function whatsappHref(value: string | undefined): string | undefined {
  const contact = value?.trim();
  if (!contact) return undefined;
  if (/^https:\/\//i.test(contact)) return httpsHref(contact);
  if (!/^[+\d\s()-]+$/.test(contact)) return undefined;
  const number = contact.replace(/\D/g, "");
  return /^\d{7,15}$/.test(number) ? `https://wa.me/${number}` : undefined;
}
