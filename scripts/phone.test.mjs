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

test("national phone numbers retain a leading 7 or 8", () => {
  assert.equal(formatPhone("8123456789"), "+7 (812) 345-67-89");
  assert.equal(formatPhone("7123456789"), "+7 (712) 345-67-89");
});

test("explicit +7 and eleven-digit country or trunk prefixes produce the same number", () => {
  for (const input of ["+7 812 345 67 89", "78123456789", "88123456789"]) {
    assert.equal(formatPhone(input), "+7 (812) 345-67-89");
  }
});

test("incremental entry retains national digits and formatted values remain stable", () => {
  for (const [digits, expected] of [
    ["8123456789", "+7 (812) 345-67-89"],
    ["7123456789", "+7 (712) 345-67-89"],
    ["9991234567", "+7 (999) 123-45-67"],
  ]) {
    let phone = "";
    for (const digit of digits) {
      phone = formatPhone(phone + digit);
      assert.equal(formatPhone(phone), phone);
    }
    assert.equal(phone, expected);
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
