/** Convert legacy values with units into numeric strings used by the editor. */
export function normalizePlotNumber(value: string): string {
  return value.replace(/\s/g, "").replace(/(?:сот\.?|₽|руб\.?)$/u, "").replace(",", ".");
}

export function isValidPlotNumber(value: string): boolean {
  return /^\d+(?:[.,]\d{1,2})?$/.test(value) &&
    Number.isFinite(Number(value.replace(",", "."))) && Number(value.replace(",", ".")) > 0;
}

export function formatPlotNumber(value: string): string {
  const normalized = normalizePlotNumber(value);
  const number = Number(normalized);
  return normalized && Number.isFinite(number)
    ? number.toLocaleString("ru-RU", { maximumFractionDigits: 2 })
    : value;
}
