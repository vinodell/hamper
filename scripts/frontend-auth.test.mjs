import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

const source = await readFile(
  new URL("../src/lib/adminAuth.ts", import.meta.url),
  "utf8",
);
const compiled = await transformWithOxc(source, "adminAuth.ts");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`;
const storageKey = "hamper.adminAuthorization";
let moduleSequence = 0;

const loadAuth = () => import(`${moduleUrl}#${++moduleSequence}`);

function storage(initial = []) {
  const values = new Map(initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function useStorage(context, sessionStorage) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage },
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
}

test("Basic credentials support UTF-8 and colons in the password", async () => {
  const auth = await loadAuth();
  const login = "админ";
  const password = "пароль:🔐";
  assert.equal(
    auth.createBasicAuthorization(login, password),
    `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`,
  );
});

test("a colon in the username produces a readable validation error", async () => {
  const auth = await loadAuth();
  assert.throws(
    () => auth.createBasicAuthorization("admin:other", "password"),
    /Логин не должен содержать двоеточие/,
  );
});

test("a page reload restores authorization from current-tab storage", async (context) => {
  const saved = "Basic YWRtaW46cGFzc3dvcmQ=";
  useStorage(context, storage([[storageKey, saved]]));
  const auth = await loadAuth();
  assert.equal(auth.getAdminAuthorization(), saved);
});

test("saving and clearing authorization persist across page reloads", async (context) => {
  const tabStorage = storage();
  useStorage(context, tabStorage);
  const firstPage = await loadAuth();
  assert.equal(firstPage.getAdminAuthorization(), null);

  const saved = firstPage.createBasicAuthorization("admin", "password");
  firstPage.saveAdminAuthorization(saved);
  assert.equal(tabStorage.getItem(storageKey), saved);

  const reloadedPage = await loadAuth();
  assert.equal(reloadedPage.getAdminAuthorization(), saved);
  reloadedPage.clearAdminAuthorization();
  assert.equal(reloadedPage.getAdminAuthorization(), null);
  assert.equal(tabStorage.getItem(storageKey), null);

  const afterLogoutReload = await loadAuth();
  assert.equal(afterLogoutReload.getAdminAuthorization(), null);
});

test("blocked storage still permits login and logout for the current page", async (context) => {
  const blocked = () => {
    throw new DOMException("Storage is blocked", "SecurityError");
  };
  useStorage(context, {
    getItem: blocked,
    setItem: blocked,
    removeItem: blocked,
  });
  const auth = await loadAuth();
  assert.equal(auth.getAdminAuthorization(), null);

  const saved = auth.createBasicAuthorization("admin", "password");
  assert.doesNotThrow(() => auth.saveAdminAuthorization(saved));
  assert.equal(auth.getAdminAuthorization(), saved);
  assert.doesNotThrow(() => auth.clearAdminAuthorization());
  assert.equal(auth.getAdminAuthorization(), null);

  const reloadedPage = await loadAuth();
  assert.equal(reloadedPage.getAdminAuthorization(), null);
});
