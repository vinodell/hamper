export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
  const localNumber = digits.startsWith("7") ? digits.slice(1) : digits;

  if (!localNumber) return "";
  if (localNumber.length <= 3) return `+7 (${localNumber}`;
  if (localNumber.length <= 6)
    return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3)}`;
  if (localNumber.length <= 8)
    return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6)}`;
  return `+7 (${localNumber.slice(0, 3)}) ${localNumber.slice(3, 6)}-${localNumber.slice(6, 8)}-${localNumber.slice(8)}`;
}
