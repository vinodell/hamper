import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pbkdf2Sync } from "node:crypto";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { transformWithOxc } from "vite";

// An isolated integration check: real UI, Worker and SQL, synthetic data only.
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = await mkdtemp(path.join(tmpdir(), "hamper-sales-browser-"));
console.log(`Browser artifacts: ${artifacts}`);
const buildRoot = path.join(artifacts, "build");
const checks = [];
const runtimeErrors = [];
const screenshots = [];
const requests = [];
const telegram = [];
const clients = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const constants = await transformWithOxc(
  await readFile(path.join(root, "worker/src/constants.ts"), "utf8"),
  "constants.ts",
);
const source = await transformWithOxc(
  await readFile(path.join(root, "worker/src/index.ts"), "utf8"),
  "worker.ts",
);
const worker = (
  await import(
    moduleUrl(
      source.code.replace(
        /(["'])\.\/constants\1/g,
        JSON.stringify(moduleUrl(constants.code)),
      ),
    )
  )
).default;
const database = new DatabaseSync(":memory:");
database.exec(await readFile(path.join(root, "worker/schema.sql"), "utf8"));
const insert = database.prepare(
  "INSERT INTO plots (id, settlement, area, status, price, description, mortgage_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
);
for (const [id, settlement, status, mortgage] of [
  ["1-01", "Ойнеловские дали", "Свободен", null],
  [
    "1-02",
    "Ойнеловские дали",
    "Забронирован",
    "https://domclick.ru/card/reserved-test",
  ],
  [
    "1-03",
    "Ойнеловские дали",
    "Свободен",
    "https://domclick.ru/card/other-test",
  ],
  ["1-04", "Ойнеловские дали", "Свободен", null],
  ["2-01", "Другие участки", "Свободен", null],
  ["2-02", "Другие участки", "Забронирован", null],
])
  insert.run(
    id,
    settlement,
    "8.12",
    status,
    "1500000",
    "Тестовый участок для проверки интерфейса",
    mortgage,
  );

const DB = {
  prepare(sql) {
    const statement = database.prepare(sql);
    let values = [];
    return {
      bind(...parameters) {
        values = parameters;
        return this;
      },
      async all() {
        return { success: true, results: statement.all(...values) };
      },
      async first() {
        return statement.get(...values) ?? null;
      },
    };
  },
  async batch(statements) {
    database.exec("BEGIN");
    try {
      const result = await Promise.all(
        statements.map((statement) => statement.all()),
      );
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};
const adminLogin = "browser-test-admin";
const adminPassword = "browser-test-password";
const salt = Buffer.from("browser-test-only-salt");
const hash = pbkdf2Sync(adminPassword, salt, 100_000, 32, "sha256");
let holdTelegram = false;
let signingVersion = 1;
let releaseTelegram;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  if (
    String(input).startsWith("https://api.telegram.org/botbrowser-test-token/")
  ) {
    telegram.push(JSON.parse(options.body));
    if (holdTelegram)
      await new Promise((resolve) => {
        releaseTelegram = resolve;
      });
    return Response.json({ ok: true });
  }
  return originalFetch(input, options);
};
let siteOrigin;
let apiOrigin;
const apiServer = http.createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const record = { method: request.method, path: request.url };
    if (body.length) record.body = JSON.parse(body.toString());
    requests.push(record);
    const result = await worker.fetch(
      new Request(apiOrigin + request.url, {
        method: request.method,
        headers: request.headers,
        ...(["GET", "HEAD"].includes(request.method) ? {} : { body }),
      }),
      {
        DB,
        ADMIN_LOGIN: adminLogin,
        ADMIN_PASSWORD_HASH: `${salt.toString("base64url")}:${hash.toString("base64url")}`,
        SESSION_SECRET: `browser-test-signing-${signingVersion}`,
        PUBLIC_ORIGIN: siteOrigin,
        TELEGRAM_BOT_TOKEN: "browser-test-token",
        TELEGRAM_CHAT_ID: "browser-test-chat",
      },
    );
    record.status = result.status;
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    response.writeHead(500);
    response.end(JSON.stringify({ error: String(error) }));
  }
});
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const siteServer = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, siteOrigin).pathname;
    if (!pathname.startsWith("/hamper/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const relative = decodeURIComponent(pathname.slice("/hamper/".length));
    const target = path.resolve(
      buildRoot,
      relative.endsWith("/") || !relative ? `${relative}index.html` : relative,
    );
    if (!target.startsWith(buildRoot + path.sep)) {
      response.writeHead(400);
      response.end();
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(target)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
const run = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(output)),
    );
  });
let chrome;
try {
  await listen(apiServer);
  await listen(siteServer);
  apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
  siteOrigin = `http://127.0.0.1:${siteServer.address().port}`;
  await run(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "build",
      "--mode",
      "github-pages",
      "--outDir",
      buildRoot,
    ],
    { cwd: root, env: { ...process.env, VITE_API_URL: apiOrigin } },
  );
  let executable;
  for (const candidate of [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean)) {
    try {
      await access(candidate);
      executable = candidate;
      break;
    } catch {
      /* Try the next installed browser. */
    }
  }
  assert.ok(
    executable,
    "Set CHROME_BIN to an installed Chrome/Chromium executable.",
  );
  const profile = path.join(artifacts, "chrome-profile");
  let chromeErrors = "";
  chrome = spawn(
    executable,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--no-proxy-server",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  chrome.stderr.on("data", (chunk) => {
    chromeErrors += chunk;
  });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      if (chrome.exitCode !== null) throw new Error(chromeErrors);
      await delay(100);
    }
  }
  assert.ok(port, "Chrome remote debugging started");
  async function connect(target) {
    const websocket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      websocket.addEventListener("open", resolve, { once: true });
      websocket.addEventListener("error", reject, { once: true });
    });
    let id = 0;
    const pending = new Map();
    const command = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const requestId = ++id;
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`CDP timeout: ${method}`));
        }, 15_000);
        pending.set(requestId, { resolve, reject, timeout });
        websocket.send(JSON.stringify({ id: requestId, method, params }));
      });
    websocket.addEventListener("message", (event) => {
      const packet = JSON.parse(event.data);
      if (packet.id) {
        const waiting = pending.get(packet.id);
        if (waiting) {
          pending.delete(packet.id);
          clearTimeout(waiting.timeout);
          packet.error
            ? waiting.reject(new Error(JSON.stringify(packet.error)))
            : waiting.resolve(packet.result);
        }
      } else if (packet.method === "Runtime.exceptionThrown")
        runtimeErrors.push(
          packet.params.exceptionDetails.exception?.description ??
            packet.params.exceptionDetails.text,
        );
      else if (packet.method === "Fetch.requestPaused") {
        const { requestId, request } = packet.params;
        const local =
          request.url.startsWith(siteOrigin + "/") ||
          request.url.startsWith(apiOrigin + "/");
        void command(
          local ? "Fetch.continueRequest" : "Fetch.failRequest",
          local ? { requestId } : { requestId, errorReason: "BlockedByClient" },
        ).catch((error) => runtimeErrors.push(String(error)));
      }
    });
    const client = {
      websocket,
      command,
      async evaluate(expression) {
        const result = await command("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        });
        if (result.exceptionDetails)
          throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      },
    };
    clients.push(client);
    await command("Page.enable");
    await command("Runtime.enable");
    await command("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await command("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    return client;
  }
  const targets = () =>
    originalFetch(`http://127.0.0.1:${port}/json/list`).then((response) =>
      response.json(),
    );
  const main = await connect(
    (await targets()).find((target) => target.type === "page"),
  );
  async function until(client, expression) {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await client.evaluate(`Boolean(${expression})`)) return;
      await delay(50);
    }
    throw new Error(
      `Timed out: ${expression}; ${JSON.stringify(await client.evaluate("({url:location.href,text:document.body.innerText.slice(0,1000)})"))}`,
    );
  }
  async function navigate(client, route, ready) {
    await client.command("Page.navigate", {
      url: `${siteOrigin}/hamper${route}`,
    });
    await until(client, ready);
  }
  async function fill(client, selector, value) {
    await client.evaluate(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing field');const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await delay(40);
  }
  async function activate(client, selector) {
    const point = await client.evaluate(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing control '+${JSON.stringify(selector)});element.scrollIntoView({block:'center',behavior:'instant'});const bounds=element.getBoundingClientRect();return{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};})()`,
    );
    await client.command("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...point,
      button: "left",
      clickCount: 1,
    });
    await client.command("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...point,
      button: "left",
      clickCount: 1,
    });
  }
  async function escape(client) {
    await client.command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await client.command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
  }
  async function screenshot(client, name) {
    const result = await client.command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const file = path.join(artifacts, `${name}.png`);
    await writeFile(file, Buffer.from(result.data, "base64"));
    screenshots.push(file);
  }
  async function check(name, work) {
    await work();
    checks.push(name);
    console.log(`✓ ${name}`);
  }

  await navigate(main, "/", "document.querySelector('.promotion-ribbon')");
  await check(
    "Promotion starts from the persisted 10 percent setting",
    async () => {
      assert.match(
        await main.evaluate(
          "document.querySelector('.promotion-ribbon').getAttribute('aria-label')",
        ),
        /10%/,
      );
    },
  );
  await check(
    "Consent is unchecked and submitting cannot bypass it",
    async () => {
      assert.equal(
        await main.evaluate("document.querySelector('[name=consent]').checked"),
        false,
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('.contact-form [type=submit]').disabled",
        ),
        true,
      );
      await main.evaluate(
        "document.querySelector('.contact-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))",
      );
      await delay(80);
      assert.equal(telegram.length, 0);
      assert.equal(
        requests.some(
          (request) =>
            request.path === "/api/contact" && request.method === "POST",
        ),
        false,
      );
    },
  );
  const created = await main.command("Target.createTarget", {
    url: "about:blank",
  });
  const admin = await connect(
    (await targets()).find((target) => target.id === created.targetId),
  );
  await navigate(admin, "/admin/", "document.querySelector('.admin-login')");
  await fill(admin, "[autocomplete=username]", adminLogin);
  await fill(admin, "[autocomplete=current-password]", adminPassword);
  await activate(admin, ".admin-login [type=submit]");
  await until(
    admin,
    "document.querySelector('.admin-promotion input[role=switch]')&&!document.querySelector('.admin-promotion fieldset').disabled",
  );
  await check(
    "Admin changes the promotion and other tabs follow the confirmed save",
    async () => {
      await fill(admin, "[name=discountPercent]", "25");
      await activate(admin, ".admin-promotion-toggle");
      await activate(admin, ".admin-promotion [type=submit]");
      await until(
        admin,
        "document.querySelector('.admin-promotion [role=status]')",
      );
      await until(main, "!document.querySelector('.promotion-ribbon')");
      await navigate(
        admin,
        "/admin/",
        "document.querySelector('.admin-promotion input[role=switch]')&&!document.querySelector('.admin-promotion fieldset').disabled",
      );
      assert.equal(
        await admin.evaluate(
          "document.querySelector('[name=discountPercent]').value",
        ),
        "25",
      );
      assert.equal(
        await admin.evaluate("document.querySelector('[role=switch]').checked"),
        false,
      );
      await activate(admin, ".admin-promotion-toggle");
      await activate(admin, ".admin-promotion [type=submit]");
      await until(
        main,
        "document.querySelector('.promotion-ribbon')?.getAttribute('aria-label').includes('25%')",
      );
    },
  );
  const mortgage = "https://spb.domclick.ru/card/sale__lot__browser-test";
  async function reenterAdmin() {
    await until(admin, "document.querySelector('.admin-login')");
    await fill(admin, "[autocomplete=username]", adminLogin);
    await fill(admin, "[autocomplete=current-password]", adminPassword);
    await activate(admin, ".admin-login [type=submit]");
    await until(
      admin,
      "document.querySelector('.admin-promotion input[role=switch]')&&!document.querySelector('.admin-promotion fieldset').disabled",
    );
  }
  await check(
    "Promotion save expiry opens login and preserves the promotion draft",
    async () => {
      await fill(admin, "[name=discountPercent]", "27");
      signingVersion += 1;
      await activate(admin, ".admin-promotion [type=submit]");
      await reenterAdmin();
      assert.equal(
        await admin.evaluate(
          "document.querySelector('[name=discountPercent]').value",
        ),
        "27",
      );
      assert.match(
        await main.evaluate(
          "document.querySelector('.promotion-ribbon').getAttribute('aria-label')",
        ),
        /25%/,
      );
      await fill(admin, "[name=discountPercent]", "25");
    },
  );
  await check(
    "Plot save expiry preserves both plot and promotion edits",
    async () => {
      await fill(admin, "[name=discountPercent]", "28");
      await fill(admin, '[aria-label="Цена 2-01"]', "1700000");
      signingVersion += 1;
      await activate(admin, ".admin-save-all");
      await reenterAdmin();
      assert.equal(
        await admin.evaluate(
          "document.querySelector('[name=discountPercent]').value",
        ),
        "28",
      );
      assert.equal(
        await admin.evaluate(
          "document.querySelector('[aria-label=\"Цена 2-01\"]').value",
        ),
        "1700000",
      );
      await fill(admin, "[name=discountPercent]", "25");
      await fill(admin, '[aria-label="Цена 2-01"]', "1500000");
    },
  );
  await check(
    "Admin saves cadastral data, document checkboxes and a per-plot mortgage URL",
    async () => {
      for (const id of ["1-01", "2-01"]) {
        await admin.evaluate(
          `document.querySelector('[aria-label="Цена ${id}"]').closest('tr').querySelector('details').open=true`,
        );
        await fill(
          admin,
          `[aria-label="Кадастровый номер ${id}"]`,
          "47:07:1044001:123",
        );
        await activate(admin, `[aria-label="ГПЗУ получен ${id}"]`);
        await fill(admin, `[aria-label="Ссылка Домклик ${id}"]`, mortgage);
      }
      await activate(admin, ".admin-save-all");
      await until(
        admin,
        "document.querySelector('.admin-savebar .admin-save-status').textContent.includes('Все изменения сохранены')",
      );
      const saved = requests.findLast(
        (request) =>
          request.method === "PUT" && request.path === "/api/admin/plots",
      );
      assert.equal(saved.body.plots.length, 2);
      assert.equal(saved.body.plots[0].gpzuDone, true);
      assert.equal(saved.body.plots[0].buildingPermitDone, false);
    },
  );
  await check(
    "New plots save document flags without copying another plot's metadata",
    async () => {
      await activate(admin, ".admin-add-plot");
      await fill(
        admin,
        '#admin-create-plot input[placeholder="Например, 2-02"]',
        "2-03",
      );
      await fill(admin, '#admin-create-plot input[placeholder="8,12"]', "9.25");
      await fill(
        admin,
        '#admin-create-plot input[placeholder="1800000"]',
        "1900000",
      );
      await activate(
        admin,
        '[aria-label="Разрешение на строительство нового участка"]',
      );
      await fill(
        admin,
        '[aria-label="Ссылка Домклик нового участка"]',
        "https://domclick.ru/card/new-browser-test",
      );
      await activate(admin, "#admin-create-plot [type=submit]");
      await until(
        admin,
        "!document.querySelector('#admin-create-plot')&&document.querySelector('[aria-label=\"Цена 2-03\"]')",
      );
      const createdPlot = requests.findLast(
        (request) =>
          request.path === "/api/admin/plots" && request.method === "POST",
      );
      assert.equal(createdPlot.body.gpzuDone, false);
      assert.equal(createdPlot.body.buildingPermitDone, true);
      assert.equal(createdPlot.body.cadastralNumber, "");
    },
  );
  await navigate(
    main,
    "/projects/drugie-uchastki/",
    "document.querySelector('.plot-details-button')",
  );
  await check(
    "Unspecified cadastral data stays unconfirmed in a new plot popup",
    async () => {
      await activate(main, '[aria-label="Подробнее об участке 2-03"]');
      await until(main, "document.querySelector('dialog[open]')");
      assert.match(
        await main.evaluate(
          "document.querySelector('dialog[open] .plot-documents__cadastral dd').textContent",
        ),
        /Не указан/,
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('dialog[open] .plot-documents__list li:first-child').dataset.done",
        ),
        "false",
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('dialog[open] .plot-documents__list li:last-child').dataset.done",
        ),
        "true",
      );
      await escape(main);
    },
  );
  await check(
    "Table popup shows saved documents and the full-payment price label",
    async () => {
      await activate(main, '[aria-label="Подробнее об участке 2-01"]');
      await until(main, "document.querySelector('dialog[open]')");
      assert.match(
        await main.evaluate(
          "document.querySelector('dialog[open]').textContent",
        ),
        /47:07:1044001:123/,
      );
      assert.equal(
        await main.evaluate(
          "document.querySelectorAll('dialog[open] [data-done=true]').length",
        ),
        1,
      );
      assert.ok(
        await main.evaluate(
          "Boolean(document.querySelector('dialog[open] .full-payment-badge'))",
        ),
      );
    },
  );
  await check(
    "Booking preselects the plot and requires a fresh user consent",
    async () => {
      await activate(main, ".plot-details-dialog__book");
      await until(
        main,
        "!document.querySelector('dialog[open]')&&document.querySelector('[name=plot]').value==='2-01'",
      );
      assert.equal(
        await main.evaluate("document.querySelector('[name=consent]').checked"),
        false,
      );
      await fill(main, "[name=name]", "Тестовый посетитель");
      await fill(main, "[name=phone]", "+79991234567");
      await activate(main, "[name=consent]");
      await activate(main, ".contact-form [type=submit]");
      await until(main, "document.querySelector('.form-success')");
      assert.equal(telegram.length, 1);
      assert.match(telegram[0].text, /2-01/);
      assert.equal(
        requests.findLast(
          (request) =>
            request.path === "/api/contact" && request.method === "POST",
        ).body.consent,
        true,
      );
      assert.equal(
        await main.evaluate("document.querySelector('[name=consent]').checked"),
        false,
      );
    },
  );
  await check(
    "Reserved plots show details without a booking action",
    async () => {
      await activate(main, '[aria-label="Подробнее об участке 2-02"]');
      await until(main, "document.querySelector('dialog[open]')");
      assert.equal(
        await main.evaluate(
          "Boolean(document.querySelector('.plot-details-dialog__book'))",
        ),
        false,
      );
      await escape(main);
    },
  );
  await navigate(
    main,
    "/projects/oynelovskie-dali/",
    "document.querySelector('[data-plot-id=\"1-01\"]')",
  );
  async function openMap(id) {
    await main.evaluate(
      `document.querySelector('[data-plot-id="${id}"]').focus()`,
    );
    await main.command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      text: "\r",
      unmodifiedText: "\r",
    });
    await until(main, "document.querySelector('dialog[open]')");
  }
  await check(
    "A map selection links to that plot's mortgage listing",
    async () => {
      await openMap("1-01");
      assert.equal(
        await main.evaluate(
          "document.querySelector('dialog[open] a[href^=\"https://\"]').href",
        ),
        mortgage,
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('dialog[open] a[href^=\"https://\"]').rel.includes('noreferrer')",
        ),
        true,
      );
      assert.match(
        await main.evaluate(
          "document.querySelector('dialog[open]').textContent",
        ),
        /Купить в ипотеку/,
      );
    },
  );
  await check(
    "Open map details follow document changes from the admin tab",
    async () => {
      await activate(admin, '[aria-label="ГПЗУ получен 1-01"]');
      await activate(admin, '[aria-label="Разрешение на строительство 1-01"]');
      await activate(admin, ".admin-save-all");
      await until(
        main,
        "document.querySelector('dialog[open] .plot-documents__list li:last-child')?.dataset.done==='true'",
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('dialog[open] .plot-documents__list li:first-child').dataset.done",
        ),
        "false",
      );
      await escape(main);
    },
  );
  await check(
    "Other and unconfigured map plots do not reuse the previous mortgage link",
    async () => {
      await openMap("1-03");
      assert.equal(
        await main.evaluate(
          "document.querySelector('dialog[open] a[href^=\"https://\"]').href",
        ),
        "https://domclick.ru/card/other-test",
      );
      await escape(main);
      await openMap("1-04");
      assert.equal(
        await main.evaluate(
          "Boolean(document.querySelector('dialog[open] a[href^=\"https://\"]'))",
        ),
        false,
      );
      await escape(main);
      await openMap("1-02");
      assert.equal(
        await main.evaluate(
          "Boolean(document.querySelector('dialog[open] a[href^=\"https://\"]'))",
        ),
        false,
      );
      await escape(main);
    },
  );
  await check(
    "A pending inquiry keeps its consent and result visible until completion",
    async () => {
      await openMap("1-01");
      await activate(main, "dialog[open] a[href='#form']");
      await until(main, "document.querySelector('#inquiry-form')");
      assert.equal(
        await main.evaluate(
          "document.querySelector('#inquiry-form [name=plot]').value",
        ),
        "1-01",
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('#inquiry-form [name=consent]').checked",
        ),
        false,
      );
      await fill(main, "#inquiry-form [name=name]", "Тестовый посетитель");
      await fill(main, "#inquiry-form [name=phone]", "+7 999 123 45 67");
      await activate(main, "#inquiry-form [name=consent]");
      holdTelegram = true;
      await activate(main, "#inquiry-form [type=submit]");
      await until(
        main,
        "document.querySelector('#inquiry-form form').getAttribute('aria-busy')==='true'",
      );
      await escape(main);
      assert.equal(
        await main.evaluate("Boolean(document.querySelector('#inquiry-form'))"),
        true,
      );
      for (let attempt = 0; attempt < 40 && !releaseTelegram; attempt++)
        await delay(50);
      assert.ok(releaseTelegram);
      holdTelegram = false;
      releaseTelegram();
      releaseTelegram = undefined;
      await until(
        main,
        "document.querySelector('#inquiry-form .form-success')",
      );
      await activate(main, ".project-dialog__close");
    },
  );
  await check("Reduced motion disables the ticker animation", async () => {
    assert.equal(
      await main.evaluate(
        "getComputedStyle(document.querySelector('.promotion-ribbon__track')).animationName",
      ),
      "none",
    );
  });
  await check(
    "The ticker can be paused and Tailwind utilities are compiled",
    async () => {
      await main.command("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
      assert.equal(
        await main.evaluate(
          "getComputedStyle(document.querySelector('.promotion-ribbon__track')).animationName",
        ),
        "promotion-ticker",
      );
      await activate(main, ".promotion-ribbon__pause");
      assert.equal(
        await main.evaluate(
          "getComputedStyle(document.querySelector('.promotion-ribbon__track')).animationPlayState",
        ),
        "paused",
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('.promotion-ribbon__pause').getAttribute('aria-pressed')",
        ),
        "true",
      );
      await main.command("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await navigate(
        main,
        "/projects/drugie-uchastki/",
        "document.querySelector('.promotion-card__copy')",
      );
      assert.equal(
        await main.evaluate(
          "getComputedStyle(document.querySelector('.promotion-card__copy')).display",
        ),
        "flex",
      );
    },
  );
  for (const width of [375, 768, 1440, 1920]) {
    await main.command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    for (const route of [
      "/",
      "/projects/drugie-uchastki/",
      "/projects/oynelovskie-dali/",
    ]) {
      await navigate(
        main,
        route,
        route === "/"
          ? "document.querySelector('.promotion-ribbon')"
          : route.includes("drugie")
            ? "document.querySelector('.plot-details-button')"
            : "document.querySelector('.oinelovo-page')",
      );
      await check(`Responsive layout ${width}px ${route}`, async () => {
        assert.equal(
          await main.evaluate(
            "document.documentElement.scrollWidth>innerWidth",
          ),
          false,
        );
        await main.evaluate("document.fonts.ready.then(()=>true)");
      });
      if (route.includes("drugie")) {
        await activate(main, '[aria-label="Подробнее об участке 2-01"]');
        await screenshot(main, `popup-${width}`);
        assert.equal(
          await main.evaluate(
            "document.querySelector('dialog[open]').getBoundingClientRect().width<=innerWidth",
          ),
          true,
        );
        await escape(main);
      } else if (route.includes("oynelovskie")) {
        await openMap("1-01");
        await screenshot(main, `map-popup-${width}`);
        await escape(main);
      }
    }
    await admin.command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await admin.evaluate("scrollTo({top:0,behavior:'instant'})");
    await screenshot(admin, `admin-${width}`);
    await check(`Admin layout ${width}px`, async () => {
      const layout = await admin.evaluate(
        "({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.admin-table-wrap')).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,20)})",
      );
      assert.equal(
        layout.scrollWidth > layout.width,
        false,
        JSON.stringify(layout),
      );
    });
  }
  assert.deepEqual(runtimeErrors, []);
  const report = { checks, runtimeErrors, screenshots, artifacts };
  await writeFile(
    path.join(artifacts, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      { passed: checks.length, runtimeErrors: runtimeErrors.length, artifacts },
      null,
      2,
    ),
  );
} finally {
  releaseTelegram?.();
  clients.forEach((client) => client.websocket.close());
  chrome?.kill();
  apiServer.closeAllConnections();
  siteServer.closeAllConnections();
  apiServer.close();
  siteServer.close();
  globalThis.fetch = originalFetch;
  database.close();
}
