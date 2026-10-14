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
