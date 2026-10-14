import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("create-password-hash.mjs", import.meta.url),
);

test("password hash CLI rejects passwords that admin login cannot accept", () => {
  for (const password of ["", "x".repeat(4097)]) {
    const result = spawnSync(process.execPath, [script], {
      input: `${password}\n`,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /1.*4096/);
    assert.equal(
      /[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}/.test(result.stdout),
      false,
    );
  }
});
