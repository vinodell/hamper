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
  ["1-05", "Ойнеловские дали", "Продан", null],
  ["1-06", "Ойнеловские дали", "Свободен", null],
  ["1-07", "Ойнеловские дали", "Свободен", null],
  [
    "1-08",
    "Ойнеловские дали",
    "Свободен",
    "https://domclick.ru/card/all-plots-test",
  ],
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
  async function pressKey(client, key, code, virtualKeyCode) {
    for (const type of ["keyDown", "keyUp"])
      await client.command("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        ...(type === "keyDown" && (key === "Enter" || key === " ")
          ? { text: key === "Enter" ? "\r" : " " }
          : {}),
      });
  }
  async function assertPrice(client, selector, base, fullPayment = null) {
    const price = await client.evaluate(
      `(()=>{const price=document.querySelector(${JSON.stringify(selector)});if(!price)throw Error('Missing price '+${JSON.stringify(selector)});const number=selector=>price.querySelector(selector)?.textContent.replace(/[^0-9]/g,'')??null;return{value:number('.plot-price__value'),original:number('s'),badge:Boolean(price.querySelector('.full-payment-badge'))};})()`,
    );
    assert.deepEqual(price, {
      value: fullPayment ?? base,
      original: fullPayment ? base : null,
      badge: Boolean(fullPayment),
    });
  }
  const tablePrice = (id) =>
    `tr:has([aria-label="Подробнее об участке ${id}"]) .plot-price`;
  async function screenshot(client, name) {
    const result = await client.command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const file = path.join(artifacts, `${name}.png`);
    await writeFile(file, Buffer.from(result.data, "base64"));
    screenshots.push(file);
  }
  async function checkShortInquiry(client, name) {
    await client.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 667,
      deviceScaleFactor: 1,
      mobile: true,
    });
    assert.equal(
      await client.evaluate(
        "(()=>{const bounds=document.querySelector('dialog[open]').getBoundingClientRect();return bounds.top>=0&&bounds.bottom<=innerHeight;})()",
      ),
      true,
    );
    await screenshot(client, `${name}-short-top-375`);
    await client.evaluate(
      "document.querySelector('#inquiry-form [type=submit]').scrollIntoView({block:'center',behavior:'instant'})",
    );
    assert.equal(
      await client.evaluate(
        "(()=>{const bounds=document.querySelector('#inquiry-form [type=submit]').getBoundingClientRect();return bounds.top>=0&&bounds.bottom<=innerHeight;})()",
      ),
      true,
    );
    await screenshot(client, `${name}-short-submit-375`);
    await client.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: true,
    });
  }
  async function assertTooltipVisible(client) {
    const visible = await client.evaluate(
      "(()=>{const tooltip=document.querySelector('[role=tooltip]');const bounds=tooltip.getBoundingClientRect();const previous=tooltip.style.pointerEvents;tooltip.style.pointerEvents='auto';try{return{withinViewport:bounds.left>=0&&bounds.top>=0&&bounds.right<=innerWidth&&bounds.bottom<=innerHeight,aboveContent:[[bounds.left+12,bounds.top+12],[bounds.right-12,bounds.top+12],[bounds.left+12,bounds.bottom-12],[bounds.right-12,bounds.bottom-12]].every(([x,y])=>tooltip.contains(document.elementFromPoint(x,y)))};}finally{tooltip.style.pointerEvents=previous;}})()",
    );
    assert.deepEqual(visible, { withinViewport: true, aboveContent: true });
  }
  async function assertAvailableControlsFit(client, selector) {
    const failures = await client.evaluate(
      `(()=>{const failures=[];for(const row of document.querySelectorAll(${JSON.stringify(selector)}+' li')){const bounds=row.getBoundingClientRect();const controls=[row.querySelector('.plot-price'),row.querySelector('a[href*="domclick.ru"]'),row.querySelector('button')].filter(Boolean).map(element=>element.getBoundingClientRect());if(controls.some(control=>control.left<bounds.left-1||control.right>bounds.right+1))failures.push(row.innerText+' overflows');for(let index=0;index<controls.length;index++)for(let other=index+1;other<controls.length;other++){const a=controls[index],b=controls[other];if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)failures.push(row.innerText+' overlaps');}}return failures;})()`,
    );
    assert.deepEqual(failures, []);
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
  await check(
    "Plots without a full-payment price show one unlabelled price in lists and dialogs",
    async () => {
      await navigate(
        main,
        "/projects/drugie-uchastki/",
        "document.querySelector('.plot-details-button')",
      );
      await assertPrice(main, tablePrice("2-02"), "1500000");
      await activate(main, '[aria-label="Подробнее об участке 2-02"]');
      await until(main, "document.querySelector('dialog[open]')");
      await assertPrice(main, "dialog[open] .plot-price", "1500000");
      await escape(main);
      await navigate(
        main,
        "/projects/oynelovskie-dali/",
        "document.querySelector('[data-plot-id=\"1-04\"]')",
      );
      await assertPrice(main, ".oinelovo-plot-list .plot-price", "1500000");
      await openMap("1-04");
      await assertPrice(main, "dialog[open] .plot-price", "1500000");
      await escape(main);
      await navigate(main, "/", "document.querySelector('.promotion-ribbon')");
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
      await fill(admin, '[aria-label="Цена при 100% оплате 2-01"]', "1100000");
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
      assert.equal(
        await admin.evaluate(
          "document.querySelector('[aria-label=\"Цена при 100% оплате 2-01\"]').value",
        ),
        "1100000",
      );
      await fill(admin, "[name=discountPercent]", "25");
      await fill(admin, '[aria-label="Цена 2-01"]', "1500000");
      await fill(admin, '[aria-label="Цена при 100% оплате 2-01"]', "");
    },
  );
  await check(
    "Admin saves cadastral data, document checkboxes and a per-plot mortgage URL",
    async () => {
      for (const id of ["1-01", "2-01"]) {
        await fill(
          admin,
          `[aria-label="Цена при 100% оплате ${id}"]`,
          id === "1-01" ? "1250000" : "1200000",
        );
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
      assert.equal(
        saved.body.plots.find((plot) => plot.id === "1-01").fullPaymentPrice,
        "1250000",
      );
      assert.equal(
        saved.body.plots.find((plot) => plot.id === "2-01").fullPaymentPrice,
        "1200000",
      );
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
      await fill(
        admin,
        '[aria-label="Цена при 100% оплате нового участка"]',
        "1650000",
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
      assert.equal(createdPlot.body.fullPaymentPrice, "1650000");
      assert.equal(
        database
          .prepare("SELECT full_payment_price FROM plots WHERE id=?")
          .get("2-03").full_payment_price,
        "1650000",
      );
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
      await assertPrice(main, tablePrice("2-03"), "1900000", "1650000");
      await assertPrice(main, "dialog[open] .plot-price", "1900000", "1650000");
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
      const listing = await main.evaluate(
        "(()=>{const row=document.querySelector('tr:has([aria-label=\"Подробнее об участке 2-01\"])');const link=row.querySelector('a[href*=\"domclick.ru\"]');return link?{href:link.href,label:link.getAttribute('aria-label'),icon:Boolean(link.querySelector('svg'))}:null;})()",
      );
      assert.equal(listing.href, mortgage);
      assert.ok(listing.label.includes("2-01"));
      assert.match(listing.label, /Домклик/iu);
      assert.equal(listing.icon, true);
      await activate(main, '[aria-label="Подробнее об участке 2-01"]');
      await until(main, "document.querySelector('dialog[open]')");
      await assertPrice(main, tablePrice("2-01"), "1500000", "1200000");
      await assertPrice(main, "dialog[open] .plot-price", "1500000", "1200000");
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
    "Clearing a full-payment price updates the table and open dialog across tabs",
    async () => {
      await fill(admin, '[aria-label="Цена при 100% оплате 2-01"]', "");
      await activate(admin, ".admin-save-all");
      await until(
        main,
        "!document.querySelector('dialog[open] .full-payment-badge')&&!document.querySelector('dialog[open] s')",
      );
      await assertPrice(main, tablePrice("2-01"), "1500000");
      await assertPrice(main, "dialog[open] .plot-price", "1500000");
      assert.equal(
        database
          .prepare("SELECT full_payment_price FROM plots WHERE id=?")
          .get("2-01").full_payment_price,
        null,
      );
      await fill(admin, '[aria-label="Цена при 100% оплате 2-01"]', "1200000");
      await activate(admin, ".admin-save-all");
      await until(
        main,
        "document.querySelector('dialog[open] .full-payment-badge')",
      );
      await assertPrice(main, tablePrice("2-01"), "1500000", "1200000");
      await assertPrice(main, "dialog[open] .plot-price", "1500000", "1200000");
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
    "Selecting an available plot opens the same details and booking flow as the map",
    async () => {
      await activate(
        main,
        '.oinelovo-available [aria-label="Выбрать участок 1-01"]',
      );
      await until(main, "document.querySelector('dialog[open]')");
      assert.equal(
        await main.evaluate("Boolean(document.querySelector('#inquiry-form'))"),
        false,
        "Selecting a plot must first show its details before opening the inquiry",
      );
      assert.match(
        await main.evaluate("document.querySelector('dialog[open]').innerText"),
        /Забронировать участок/,
      );
      await assertPrice(main, "dialog[open] .plot-price", "1500000", "1250000");
      await activate(main, "dialog[open] a[href='#form']");
      await until(main, "document.querySelector('#inquiry-form')");
      await until(
        main,
        "document.querySelector('#inquiry-form [name=plot]')?.value==='1-01'",
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('#inquiry-form [name=plot]').value",
        ),
        "1-01",
      );
      await escape(main);
    },
  );
  await check(
    "The full available-plot list opens the chosen parcel and preserves its booking context",
    async () => {
      await activate(main, ".oinelovo-available .oinelovo-text-button");
      await until(
        main,
        "document.querySelector('dialog[open] [aria-label=\"Выбрать участок 1-08\"]')",
      );
      const link = await main.evaluate(
        "document.querySelector('dialog[open] [aria-label=\"Выбрать участок 1-08\"]').closest('li').querySelector('a[href*=\"domclick.ru\"]').href",
      );
      assert.equal(link, "https://domclick.ru/card/all-plots-test");
      await activate(main, 'dialog[open] [aria-label="Выбрать участок 1-08"]');
      await until(
        main,
        "document.querySelector('dialog[open] a[href=\"https://domclick.ru/card/all-plots-test\"]')",
      );
      assert.equal(
        await main.evaluate("document.querySelectorAll('dialog[open]').length"),
        1,
      );
      assert.match(
        await main.evaluate("document.querySelector('dialog[open]').innerText"),
        /Забронировать участок/,
      );
      await activate(main, "dialog[open] a[href='#form']");
      await until(
        main,
        "document.querySelector('#inquiry-form [name=plot]')?.value==='1-08'",
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('#inquiry-form [name=consent]').checked",
        ),
        false,
      );
      await escape(main);
    },
  );
  await check(
    "Each configured available plot exposes its own accessible Domclick icon link",
    async () => {
      for (const [id, expected] of [
        ["1-01", mortgage],
        ["1-03", "https://domclick.ru/card/other-test"],
        ["1-04", null],
      ]) {
        const link = await main.evaluate(
          `(()=>{const row=document.querySelector('.oinelovo-available [aria-label="Выбрать участок ${id}"]').closest('li');const link=row.querySelector('a[href*="domclick.ru"]');return link?{href:link.href,target:link.target,rel:link.rel,label:link.getAttribute('aria-label')??link.textContent,icon:Boolean(link.querySelector('svg'))}:null;})()`,
        );
        if (expected === null) {
          assert.equal(link, null);
        } else {
          assert.equal(link.href, expected);
          assert.equal(link.target, "_blank");
          assert.ok(link.rel.includes("noopener"));
          assert.ok(link.rel.includes("noreferrer"));
          assert.match(link.label, /Домклик/iu);
          assert.ok(link.label.includes(id));
          assert.equal(link.icon, true);
        }
      }
    },
  );
  await check(
    "Sold map parcels use the requested red and remain unavailable to select",
    async () => {
      const sold = await main.evaluate(
        `(()=>{const zone=document.querySelector('[data-plot-id="1-05"]');return{fill:getComputedStyle(zone).fill,legend:getComputedStyle(document.querySelector('.oinelovo-status--sold')).backgroundColor,selectable:zone.dataset.selectable,role:zone.getAttribute('role'),tabIndex:zone.getAttribute('tabindex')};})()`,
      );
      assert.deepEqual(sold, {
        fill: "rgba(201, 48, 62, 0.55)",
        legend: "rgb(201, 48, 62)",
        selectable: "false",
        role: "img",
        tabIndex: null,
      });
    },
  );
  await check(
    "Map list, tooltip and accessible label use the saved full-payment price",
    async () => {
      await assertPrice(
        main,
        ".oinelovo-plot-list .plot-price",
        "1500000",
        "1250000",
      );
      await pressKey(main, "Tab", "Tab", 9);
      await main.evaluate(
        "document.querySelector('[data-plot-id=\"1-01\"]').focus()",
      );
      await until(main, "document.querySelector('[role=tooltip]')");
      await assertPrice(
        main,
        "[role=tooltip] .plot-price",
        "1500000",
        "1250000",
      );
      const accessible = await main.evaluate(
        `(()=>{const zone=document.querySelector('[data-plot-id="1-01"]');return{label:zone.getAttribute('aria-label'),description:zone.getAttribute('aria-describedby'),tooltip:document.querySelector('[role=tooltip]').id};})()`,
      );
      assert.match(accessible.label, /Стоимость при 100% оплате 1\s250\s000/);
      assert.match(accessible.label, /Базовая цена 1\s500\s000/);
      assert.equal(accessible.description, accessible.tooltip);
    },
  );
  await check(
    "A map selection links to that plot's mortgage listing",
    async () => {
      await openMap("1-01");
      await assertPrice(main, "dialog[open] .plot-price", "1500000", "1250000");
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
      await assertPrice(main, "dialog[open] .plot-price", "1500000");
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
  const availabilityButton =
    '[aria-label="Уведомить об освобождении участка 1-02"]';
  await check(
    "Only reserved map parcels offer an availability request",
    async () => {
      for (const id of ["1-01", "1-04"]) {
        await openMap(id);
        assert.equal(
          await main.evaluate(
            "Boolean(document.querySelector('dialog[open] [aria-label^=\"Уведомить об освобождении участка\"]'))",
          ),
          false,
        );
        await escape(main);
      }
      await openMap("1-02");
      assert.equal(
        await main.evaluate(
          `Boolean(document.querySelector(${JSON.stringify(availabilityButton)}))`,
        ),
        true,
      );
      assert.equal(
        await main.evaluate(
          "document.querySelector('[data-plot-id=\"1-05\"]').getAttribute('aria-haspopup')",
        ),
        null,
      );
    },
  );
  await check(
    "Availability notification supports focus, hover motion, and reduced motion",
    async () => {
      await pressKey(main, "Tab", "Tab", 9);
      await main.evaluate(
        `document.querySelector(${JSON.stringify(availabilityButton)}).focus()`,
      );
      assert.equal(
        await main.evaluate(
          `document.activeElement===document.querySelector(${JSON.stringify(availabilityButton)})`,
        ),
        true,
      );
      assert.notEqual(
        await main.evaluate(
          `getComputedStyle(document.querySelector(${JSON.stringify(availabilityButton)})).outlineStyle`,
        ),
        "none",
      );
      await screenshot(main, "notification-focus");
      const point = await main.evaluate(
        `(()=>{const element=document.querySelector(${JSON.stringify(availabilityButton)});const bounds=element.getBoundingClientRect();return{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};})()`,
      );
      await main.evaluate("document.activeElement.blur()");
      await main.command("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: 0,
        y: 0,
      });
      await main.command("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
      await main.command("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        ...point,
      });
      await until(
        main,
        `document.querySelector(${JSON.stringify(availabilityButton)}).getAnimations({subtree:true}).some(animation=>animation.playState==='running')`,
      );
      await screenshot(main, "notification-hover");
      await main.command("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await delay(100);
      assert.equal(
        await main.evaluate(
          `document.querySelector(${JSON.stringify(availabilityButton)}).getAnimations({subtree:true}).some(animation=>animation.playState==='running')`,
        ),
        false,
      );
    },
  );
  await check(
    "A reserved availability inquiry keeps its plot and purpose and requires consent",
    async () => {
      await activate(main, availabilityButton);
      await until(main, "document.querySelector('#inquiry-form')");
      assert.equal(
        await main.evaluate("document.querySelectorAll('dialog[open]').length"),
        1,
      );
      const form = await main.evaluate(
        `(()=>{const form=document.querySelector('#inquiry-form');return{project:form.querySelector('[name=project]').value,plot:form.querySelector('[name=plot]').value,projectLocked:form.querySelector('[name=project]').readOnly,plotLocked:form.querySelector('[name=plot]').readOnly,consent:form.querySelector('[name=consent]').checked,submitDisabled:form.querySelector('[type=submit]').disabled,text:form.closest('dialog').innerText};})()`,
      );
      assert.equal(form.project, "Ойнеловские дали");
      assert.equal(form.plot, "1-02");
      assert.equal(form.projectLocked, true);
      assert.equal(form.plotLocked, true);
      assert.equal(form.consent, false);
      assert.equal(form.submitDisabled, true);
      assert.match(form.text, /Участок 1-02 (?:сейчас )?забронирован/);
      assert.match(form.text, /если он освободится/iu);
      const comment = "Предпочитаю звонок после 18:00";
      const telegramBefore = telegram.length;
      await fill(main, "#inquiry-form [name=name]", "Ожидающий посетитель");
      await fill(main, "#inquiry-form [name=phone]", "+7 999 123 45 67");
      await fill(main, "#inquiry-form [name=comment]", comment);
      await activate(main, "#inquiry-form [name=consent]");
      await activate(main, "#inquiry-form [type=submit]");
      await until(
        main,
        "document.querySelector('#inquiry-form .form-success')",
      );
      assert.equal(telegram.length, telegramBefore + 1);
      const sent = requests.findLast(
        (request) =>
          request.path === "/api/contact" && request.method === "POST",
      );
      assert.equal(sent.body.project, "Ойнеловские дали");
      assert.equal(sent.body.plot, "1-02");
      assert.equal(sent.body.consent, true);
      assert.match(sent.body.comment, /уведомить.*освобод/iu);
      assert.ok(sent.body.comment.endsWith(comment));
      assert.match(telegram.at(-1).text, /Ойнеловские дали/);
      assert.match(telegram.at(-1).text, /1-02/);
      assert.match(telegram.at(-1).text, /уведомить.*освобод/iu);
      assert.ok(telegram.at(-1).text.includes(comment));
      await activate(main, ".project-dialog__close");
    },
  );
  await check(
    "A later free-plot inquiry starts without the availability purpose",
    async () => {
      await openMap("1-01");
      await activate(main, "dialog[open] a[href='#form']");
      await until(
        main,
        "document.querySelector('#inquiry-form [name=plot]')?.value==='1-01'",
      );
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
      assert.equal(
        await main.evaluate(
          "document.querySelector('#inquiry-form [name=comment]').value",
        ),
        "",
      );
      assert.doesNotMatch(
        await main.evaluate(
          "document.querySelector('#inquiry-form').innerText",
        ),
        /уведомить.*освобод/iu,
      );
      const comment = "Хочу посмотреть свободный участок";
      await fill(main, "#inquiry-form [name=name]", "Следующий посетитель");
      await fill(main, "#inquiry-form [name=phone]", "+7 999 123 45 67");
      await fill(main, "#inquiry-form [name=comment]", comment);
      await activate(main, "#inquiry-form [name=consent]");
      await activate(main, "#inquiry-form [type=submit]");
      await until(
        main,
        "document.querySelector('#inquiry-form .form-success')",
      );
      const sent = requests.findLast(
        (request) =>
          request.path === "/api/contact" && request.method === "POST",
      );
      assert.equal(sent.body.plot, "1-01");
      assert.equal(sent.body.comment, comment);
      assert.doesNotMatch(telegram.at(-1).text, /уведомить.*освобод/iu);
      await activate(main, ".project-dialog__close");
    },
  );
  await check(
    "A pending inquiry keeps its consent and result visible until completion",
    async () => {
      await activate(
        main,
        '.oinelovo-available [aria-label="Выбрать участок 1-01"]',
      );
      await until(main, "document.querySelector('dialog[open]')");
      await activate(main, "dialog[open] a[href='#form']");
      await until(
        main,
        "document.querySelector('#inquiry-form [name=plot]')?.value==='1-01'",
      );
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
  await check(
    "FAQ opens and closes smoothly with pointer and keyboard, including rapid toggles",
    async () => {
      await main.command("Page.bringToFront");
      await main.command("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
      });
      const trigger = ".oinelovo-faq .oinelovo-question-trigger";
      const panel = ".oinelovo-faq .oinelovo-question-panel";
      const panelHeight = () =>
        main.evaluate(
          `document.querySelector(${JSON.stringify(panel)}).getBoundingClientRect().height`,
        );
      assert.equal(await panelHeight(), 0);
      await activate(main, trigger);
      await delay(60);
      const openingHeight = await panelHeight();
      await delay(260);
      const expandedHeight = await panelHeight();
      assert.ok(
        openingHeight > 0 && openingHeight < expandedHeight,
        JSON.stringify({ openingHeight, expandedHeight }),
      );
      const expanded = await main.evaluate(
        `(()=>{const trigger=document.querySelector(${JSON.stringify(trigger)}),panel=document.querySelector(${JSON.stringify(panel)});return{expanded:trigger.getAttribute('aria-expanded'),controls:trigger.getAttribute('aria-controls'),id:panel.id,hidden:panel.getAttribute('aria-hidden'),inert:panel.inert};})()`,
      );
      assert.equal(expanded.expanded, "true");
      assert.equal(expanded.controls, expanded.id);
      assert.equal(expanded.hidden, "false");
      assert.equal(expanded.inert, false);
      await pressKey(main, "Enter", "Enter", 13);
      assert.equal(
        await main.evaluate(
          `document.querySelector(${JSON.stringify(trigger)}).getAttribute('aria-expanded')`,
        ),
        "false",
      );
      await delay(60);
      const closingHeight = await panelHeight();
      await delay(260);
      assert.ok(
        closingHeight > 0 && closingHeight < expandedHeight,
        JSON.stringify({ closingHeight, expandedHeight }),
      );
      assert.equal(await panelHeight(), 0);
      assert.equal(
        await main.evaluate(
          `document.querySelector(${JSON.stringify(panel)}).inert`,
        ),
        true,
      );
      for (let toggle = 0; toggle < 3; toggle++) {
        await activate(main, trigger);
        await delay(40);
      }
      await delay(280);
      assert.equal(
        await main.evaluate(
          `document.querySelector(${JSON.stringify(trigger)}).getAttribute('aria-expanded')`,
        ),
        "true",
      );
      assert.ok((await panelHeight()) > 0);
      await pressKey(main, " ", "Space", 32);
      await delay(280);
      assert.equal(await panelHeight(), 0);
    },
  );
  await check(
    "FAQ respects reduced motion and exposes its answer immediately",
    async () => {
      await main.command("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await activate(main, ".oinelovo-faq .oinelovo-question-trigger");
      await until(
        main,
        "document.querySelector('.oinelovo-faq .oinelovo-question-trigger').getAttribute('aria-expanded')==='true'",
      );
      const immediate = await main.evaluate(
        "document.querySelector('.oinelovo-faq .oinelovo-question-panel').getBoundingClientRect().height",
      );
      await delay(80);
      assert.ok(immediate > 0);
      assert.equal(
        await main.evaluate(
          "document.querySelector('.oinelovo-faq .oinelovo-question-panel').getBoundingClientRect().height",
        ),
        immediate,
      );
      assert.equal(
        await main.evaluate(
          "getComputedStyle(document.querySelector('.oinelovo-faq .oinelovo-question-trigger svg')).transitionDuration",
        ),
        "0s",
      );
      await pressKey(main, "Enter", "Enter", 13);
      await until(
        main,
        "document.querySelector('.oinelovo-faq .oinelovo-question-panel').getBoundingClientRect().height===0",
      );
      for (const [selector, target, pressed] of [
        [
          ".oinelovo-thumbnails > button",
          ".oinelovo-thumbnails > button img",
          false,
        ],
        [
          ".oinelovo-purchase .oinelovo-button",
          ".oinelovo-purchase .oinelovo-button",
          true,
        ],
      ]) {
        const point = await main.evaluate(
          `(()=>{const button=document.querySelector(${JSON.stringify(selector)});button.scrollIntoView({block:'center',behavior:'instant'});const bounds=button.getBoundingClientRect();return{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}})()`,
        );
        await main.command("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          ...point,
        });
        if (pressed)
          await main.command("Input.dispatchMouseEvent", {
            type: "mousePressed",
            ...point,
            button: "left",
            clickCount: 1,
          });
        assert.equal(
          await main.evaluate(
            `getComputedStyle(document.querySelector(${JSON.stringify(target)})).transform`,
          ),
          "none",
        );
        if (pressed)
          await main.command("Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x: 0,
            y: 0,
            button: "left",
            clickCount: 1,
          });
      }
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
  await check(
    "The featured individual plot uses the same saved full-payment price",
    async () => {
      await navigate(
        main,
        "/projects/drugie-uchastki/",
        "document.querySelector('article.individual-plot')",
      );
      await assertPrice(
        main,
        'article.individual-plot[aria-label="Участок 2-01"] .plot-price',
        "1500000",
        "1200000",
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
        await main.evaluate(
          "document.querySelector('.oinelovo-available').scrollIntoView({block:'center',behavior:'instant'})",
        );
        await assertAvailableControlsFit(main, ".oinelovo-available");
        await screenshot(main, `available-plots-${width}`);
        await activate(main, ".oinelovo-available .oinelovo-text-button");
        await until(
          main,
          "document.querySelector('dialog[open] [aria-label=\"Выбрать участок 1-08\"]')",
        );
        await assertAvailableControlsFit(
          main,
          "dialog[open] .oinelovo-plot-list",
        );
        await screenshot(main, `all-plots-${width}`);
        await escape(main);
        await check(`Location control layout ${width}px`, async () => {
          await main.evaluate(
            "document.querySelector('#location').scrollIntoView({block:'center',behavior:'instant'})",
          );
          const label =
            width < 768
              ? "Открыть маршрут в Яндекс Навигаторе"
              : "Скопировать координаты массива";
          const action = await main.evaluate(
            `(()=>{const action=document.querySelector('#location [aria-label="${label}"]');return action?{visible:action.getBoundingClientRect().width>0,hint:Boolean(action.title.trim())}:null;})()`,
          );
          assert.deepEqual(action, {
            visible: true,
            hint: true,
          });
          await main.evaluate(
            `(()=>{const action=document.querySelector('#location [aria-label="${label}"]');if(!action.disabled)action.focus({preventScroll:true});})()`,
          );
          await screenshot(main, `location-${width}`);
        });
        if (width >= 768) {
          await pressKey(main, "Tab", "Tab", 9);
          await main.evaluate(
            "document.querySelector('[data-plot-id=\"1-01\"]').focus()",
          );
          await until(main, "document.querySelector('[role=tooltip]')");
          await check(`Map tooltip is visible above content ${width}px`, () =>
            assertTooltipVisible(main),
          );
          await screenshot(main, `map-tooltip-${width}`);
          await escape(main);
        }
        await openMap("1-01");
        await screenshot(main, `map-popup-${width}`);
        await escape(main);
        await openMap("1-02");
        await screenshot(main, `reserved-map-${width}`);
        await activate(main, availabilityButton);
        await until(main, "document.querySelector('#inquiry-form')");
        await screenshot(main, `availability-form-${width}`);
        await check(`Availability inquiry layout ${width}px`, async () => {
          const layout = await main.evaluate(
            "(()=>{const dialog=document.querySelector('dialog[open]');const bounds=dialog.getBoundingClientRect();return{withinViewport:bounds.left>=0&&bounds.right<=innerWidth,withinDialog:dialog.scrollWidth<=dialog.clientWidth};})()",
          );
          assert.deepEqual(layout, {
            withinViewport: true,
            withinDialog: true,
          });
          if (width === 375) await checkShortInquiry(main, "availability-form");
        });
        await escape(main);
        await openMap("1-01");
        await activate(main, "dialog[open] a[href='#form']");
        await until(
          main,
          "document.querySelector('#inquiry-form [name=plot]')?.value==='1-01'",
        );
        await screenshot(main, `viewing-form-${width}`);
        await check(`Viewing inquiry layout ${width}px`, async () => {
          const layout = await main.evaluate(
            "(()=>{const dialog=document.querySelector('dialog[open]');const bounds=dialog.getBoundingClientRect();return{withinViewport:bounds.left>=0&&bounds.right<=innerWidth,withinDialog:dialog.scrollWidth<=dialog.clientWidth};})()",
          );
          assert.deepEqual(layout, {
            withinViewport: true,
            withinDialog: true,
          });
          if (width === 375) await checkShortInquiry(main, "viewing-form");
        });
        await escape(main);
        await activate(main, ".oinelovo-faq .oinelovo-question-trigger");
        await main.evaluate(
          "document.querySelector('.oinelovo-faq').scrollIntoView({block:'center',behavior:'instant'})",
        );
        await screenshot(main, `faq-${width}`);
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
