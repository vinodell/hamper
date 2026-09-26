import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const readline = createInterface({ input, output });
const password = await readline.question("Admin password: ");
readline.close();

const salt = randomBytes(16);
const derived = await new Promise((resolve, reject) => {
  import("node:crypto")
    .then(({ pbkdf2 }) =>
      pbkdf2(password, salt, 100_000, 32, "sha256", (error, key) =>
        error ? reject(error) : resolve(key),
      ),
    )
    .catch(reject);
});

console.log(
  `${salt.toString("base64url")}:${Buffer.from(derived).toString("base64url")}`,
);
