export class ValidationError extends Error {}

export function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > maxLength)
    throw new ValidationError("Некорректные текстовые данные");
  return value.trim() || null;
}
