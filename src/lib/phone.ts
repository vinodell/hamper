export const PHONE_REQUIRED_MESSAGE =
  "Укажите российский номер телефона полностью: +7 (999) 123-45-67.";

export function isValidRussianPhone(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    /^[+\d\s().-]+$/.test(value) &&
    /^(?:7|8)\d{10}$/.test(value.replace(/\D/g, ""))
  );
}
