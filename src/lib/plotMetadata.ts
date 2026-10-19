/** Blank optional metadata is accepted; API readers normalize it to null. */
export function isValidCadastralNumber(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length <= 80 &&
    (trimmed === "" || /^\d{2}:\d{2}:\d{6,7}:\d{1,10}$/.test(trimmed))
  );
}

/** Only links to the Sber Domclick listing service may leave the map. */
export function isValidMortgageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > 2048) return false;
  try {
    const url = new URL(trimmed);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.href.length <= 2048 &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*domclick\.ru$/.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}
