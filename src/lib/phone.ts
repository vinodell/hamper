export const PHONE_PATTERN =
  /\s*(?:\+\s*7|7|8)?(?:[\s.\-\(\)]*\d){10}[\s.\-\(\)]*/.source;

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

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  // Strip exactly one explicit country prefix or one prefix on a full bare
  // number. A national number may itself start with 7 or 8.
  const hasPrefix =
    /^\s*\+\s*7/.test(value) || (digits.length > 10 && /^[78]/.test(digits));
  const localNumber = (hasPrefix ? digits.slice(1) : digits).slice(0, 10);

  if (!localNumber) return "";
  if (localNumber.length <= 3) return `+7 (${localNumber}`;
  if (localNumber.length <= 6)
    return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3)}`;
  if (localNumber.length <= 8)
    return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6)}`;
  return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6, 8)}-${localNumber.slice(8)}`;
};
