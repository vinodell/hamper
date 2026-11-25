const plotNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

/** Convert legacy values with units into numeric strings used by the editor. */
export function normalizePlotNumber(value: string): string {
  return value
    .replace(/\s/g, "")
    .replace(/(?:сот\.?|₽|руб\.?)$/u, "")
    .replace(",", ".");
}

/** Parse a validated API/editor value without changing its stored text. */
export function parsePlotNumber(value: string): number {
  return Number(value.replace(",", "."));
}

export function isValidPlotNumber(value: string): boolean {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return false;
  const number = parsePlotNumber(value);
  return Number.isFinite(number) && number > 0;
}

/** Empty clears the offer; a full-payment offer must improve the base price. */
export function isValidFullPaymentPrice(
  price: string,
  fullPaymentPrice: string,
): boolean {
  if (!fullPaymentPrice.trim()) return true;
  const base = normalizePlotNumber(price);
  const offer = normalizePlotNumber(fullPaymentPrice);
  return (
    isValidPlotNumber(base) &&
    isValidPlotNumber(offer) &&
    Number(offer) < Number(base)
  );
}

export function formatPlotNumber(value: string): string {
  // Public values have already been normalized and validated by the API.
  return plotNumberFormatter.format(parsePlotNumber(value));
}
