import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

const file = new URL("../src/hooks/setMobilePhone.ts", import.meta.url);
const { code } = await transformWithOxc(
  await readFile(file, "utf8"),
  file.pathname,
);
const { formatPhone } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

const { code: constantsCode } = await transformWithOxc(
  await readFile(new URL("../src/lib/constants.ts", import.meta.url), "utf8"),
  "constants.ts",
);
const { code: routesCode } = await transformWithOxc(
  await readFile(new URL("../src/lib/routes.ts", import.meta.url), "utf8"),
  "routes.ts",
);
const routesUrl = `data:text/javascript;base64,${Buffer.from(routesCode).toString("base64")}`;
const constantsModule = constantsCode
  .replaceAll("import.meta.env", "{}")
  .replace(
    /(from\s+)(["'])(lucide-react|\.\/routes)\2/g,
    (_match, prefix, _quote, module) =>
      `${prefix}${JSON.stringify(module === "./routes" ? routesUrl : import.meta.resolve(module))}`,
  );
const { PHONE_PATTERN } = await import(
  `data:text/javascript;base64,${Buffer.from(constantsModule).toString("base64")}`
);

test("native phone validation accepts complete raw input and common separators before blur", () => {
  const pattern = new RegExp(`^(?:${PHONE_PATTERN})$`, "v");
  for (const input of [
    "8123456789",
    "7123456789",
    "89991234567",
    "+79991234567",
    "+7 812 345 67 89",
    "8 (999) 123-45-67",
    "+7 (812) 345-67-89",
  ]) {
    assert.equal(pattern.test(input), true, input);
  }
  for (const input of [
    "",
    "8999123",
    "+44 20 1234 5678",
    "phone: 89991234567",
  ]) {
    assert.equal(pattern.test(input), false, input);
  }
});

test("national phone numbers retain a leading 7 or 8", () => {
  assert.equal(formatPhone("8123456789"), "+7 (812) 345-67-89");
  assert.equal(formatPhone("7123456789"), "+7 (712) 345-67-89");
});

test("extra digits after explicit +7 do not shift a national number's leading 7 or 8", () => {
  assert.equal(formatPhone("+7 (812) 345-67-890"), "+7 (812) 345-67-89");
  assert.equal(formatPhone("+7 (712) 345-67-890"), "+7 (712) 345-67-89");
});

test("explicit +7 and eleven-digit country or trunk prefixes produce the same number", () => {
  for (const input of ["+7 812 345 67 89", "78123456789", "88123456789"]) {
    assert.equal(formatPhone(input), "+7 (812) 345-67-89");
  }
});

test("completed national input formats once and the formatted value remains stable", () => {
  for (const [input, expected] of [
    ["8123456789", "+7 (812) 345-67-89"],
    ["7123456789", "+7 (712) 345-67-89"],
    ["9991234567", "+7 (999) 123-45-67"],
  ]) {
    const phone = formatPhone(input);
    assert.equal(phone, expected);
    assert.equal(formatPhone(phone), expected);
  }
});

test("completed input accepts eleven-digit country and trunk prefixes", () => {
  for (const input of ["79991234567", "89991234567", "+79991234567"]) {
    assert.equal(formatPhone(input), "+7 (999) 123-45-67");
  }
});

test("backspacing a formatted number removes its digits through an empty field", () => {
  let phone = "+7 (812) 345-67-89";
  for (const expected of [
    "+7 (812) 345-67-8",
    "+7 (812) 345-67",
    "+7 (812) 345-6",
    "+7 (812) 345",
    "+7 (812) 34",
    "+7 (812) 3",
    "+7 (812",
    "+7 (81",
    "+7 (8",
    "",
  ]) {
    phone = formatPhone(phone.slice(0, -1));
    assert.equal(phone, expected);
  }
});
