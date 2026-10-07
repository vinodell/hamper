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

export function isValidPlotNumber(value: string): boolean {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return false;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 0;
}

export function formatPlotNumber(value: string): string {
  const normalized = normalizePlotNumber(value);
  const number = Number(normalized);
  return normalized && Number.isFinite(number)
    ? plotNumberFormatter.format(number)
    : value;
}
