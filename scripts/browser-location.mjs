import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";

// Isolated React fixture: real component and browser, synthetic location/clipboard only.
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = await mkdtemp(
  path.join(tmpdir(), "hamper-location-harness-"),
);
const entry = path.join(artifacts, "entry.tsx");
const buildRoot = path.join(artifacts, "dist");
const coordinates = "60.000000,30.000000";
const navigatorUrl =
  "yandexnavi://build_route_on_map?lat_to=60.000000&lon_to=30.000000";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];
const sockets = [];
console.log(`Location harness artifacts: ${artifacts}`);
await writeFile(
  path.join(artifacts, "index.html"),
  '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>',
);
await writeFile(
  entry,
  `
import React from ${JSON.stringify(root + "/node_modules/react/index.js")};
import { createRoot } from ${JSON.stringify(root + "/node_modules/react-dom/client.js")};
import { MapLocationAction } from ${JSON.stringify(root + "/src/components/MapLocationAction.tsx")};
import ${JSON.stringify(root + "/src/styles/global.css")};
import ${JSON.stringify(root + "/src/pages/Oinelovo.css")};
const coordinates=new URLSearchParams(location.search).get('empty')==='1'?'':${JSON.stringify(coordinates)};
const navigatorUrl=new URLSearchParams(location.search).get('empty')==='1'?'':${JSON.stringify(navigatorUrl)};
createRoot(document.querySelector('#root')!).render(<div className="oinelovo-page" style={{padding:'2rem'}}><MapLocationAction location={{coordinates,navigatorUrl}}/></div>);
`,
);
await build({
  root: artifacts,
  configFile: false,
  plugins: [react()],
  publicDir: false,
  build: { outDir: buildRoot, emptyOutDir: true },
  resolve: {
    alias: [
      {
        find: "react-dom",
        replacement: path.join(root, "node_modules/react-dom"),
      },
      { find: "react", replacement: path.join(root, "node_modules/react") },
    ],
    dedupe: ["react", "react-dom"],
  },
  logLevel: "error",
});
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const target = url.pathname.startsWith("/fonts/")
      ? path.join(root, "public", url.pathname)
      : path.join(
          buildRoot,
          url.pathname === "/" ? "index.html" : url.pathname,
        );
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": target.endsWith(".js")
        ? "text/javascript"
        : target.endsWith(".css")
          ? "text/css"
          : target.endsWith(".woff2")
            ? "font/woff2"
            : "text/html",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
let chrome;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
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
    } catch {}
  }
  assert.ok(
    executable,
    "Set CHROME_BIN to an installed Chrome/Chromium executable",
  );
  const profile = path.join(artifacts, "chrome");
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
  let chromeErrors = "";
  chrome.stderr.on("data", (chunk) => (chromeErrors += chunk));
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      if (chrome.exitCode !== null) throw Error(chromeErrors);
      await delay(100);
    }
  }
  assert.ok(port, "Chrome CDP started");
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  const ws = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  sockets.push(ws);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let requestId = 0;
  const pending = new Map();
  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++requestId;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(Error(`CDP timeout ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.addEventListener("message", (event) => {
    const packet = JSON.parse(event.data);
    if (packet.id) {
      const waiting = pending.get(packet.id);
      if (waiting) {
        pending.delete(packet.id);
        clearTimeout(waiting.timeout);
        packet.error
          ? waiting.reject(Error(JSON.stringify(packet.error)))
          : waiting.resolve(packet.result);
      }
    } else if (packet.method === "Runtime.exceptionThrown")
      errors.push(
        packet.params.exceptionDetails.exception?.description ??
          packet.params.exceptionDetails.text,
      );
    else if (packet.method === "Fetch.requestPaused") {
      const { requestId, request } = packet.params;
      void command(
        request.url.startsWith(origin + "/")
          ? "Fetch.continueRequest"
          : "Fetch.failRequest",
        request.url.startsWith(origin + "/")
          ? { requestId }
          : { requestId, errorReason: "BlockedByClient" },
      ).catch((e) => errors.push(String(e)));
    }
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await delay(50);
    }
    throw Error(
      `Timed out ${expression}; ${await evaluate("document.body.innerText")}`,
    );
  };
  const activate = async (selector) => {
    const point = await evaluate(
      `(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()`,
    );
    for (const type of ["mousePressed", "mouseReleased"])
      await command("Input.dispatchMouseEvent", {
        type,
        ...point,
        button: "left",
        clickCount: 1,
      });
  };
  const screenshot = async (name) => {
    const result = await command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      path.join(artifacts, name + ".png"),
      Buffer.from(result.data, "base64"),
    );
  };
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.copyCalls=[];window.copyResolve=null;window.copyReject=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText(text){window.copyCalls.push(text);return new Promise((resolve,reject)=>{window.copyResolve=resolve;window.copyReject=reject})}}});`,
  });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await command("Page.navigate", { url: origin + "/" });
  await until("document.querySelector('button')");
  assert.equal(
    await evaluate(
      "document.querySelector('button').getAttribute('aria-label')??document.querySelector('button').textContent.trim()",
    ),
    "Скопировать координаты массива",
  );
  await activate("button");
  await until("window.copyCalls.length===1");
  assert.deepEqual(await evaluate("window.copyCalls"), [coordinates]);
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('Координаты до массива скопированы в буфер обмена'))",
    ),
    false,
    "No success before clipboard promise resolves",
  );
  await screenshot("copy-pending");
  await evaluate("window.copyResolve()");
  await until(
    "[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('Координаты до массива скопированы в буфер обмена'))",
  );
  await screenshot("copy-success");
  assert.deepEqual(errors, []);
  console.log(
    "PASS desktop copying waits for clipboard fulfillment, uses fixture coordinates, then announces success",
  );

  await activate("button");
  await until("window.copyCalls.length===2");
  await evaluate(
    "window.copyReject(new DOMException('Denied','NotAllowedError'))",
  );
  await until(
    `document.querySelector('[role=status]').textContent===${JSON.stringify("Не удалось скопировать координаты. Скопируйте их вручную: " + coordinates)}`,
  );
  assert.equal(
    await evaluate("document.querySelector('button').disabled"),
    false,
    "Copy can be retried after an error",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('button').getAttribute('aria-describedby')===document.querySelector('[role=status]').id",
    ),
    true,
  );
  await screenshot("copy-error");
  console.log(
    "PASS clipboard rejection exposes the coordinates for manual copying and allows retry",
  );

  await command("Page.navigate", { url: origin + "/" });
  await until("document.querySelector('button')");
  await evaluate(
    "Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})",
  );
  await activate("button");
  await until(
    `document.querySelector('[role=status]').textContent===${JSON.stringify("Не удалось скопировать координаты. Скопируйте их вручную: " + coordinates)}`,
  );
  assert.deepEqual(await evaluate("window.copyCalls"), []);
  console.log(
    "PASS unavailable Clipboard API provides the same manual-copy fallback",
  );

  for (const width of [375, 760, 761, 768, 1440, 1920]) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    const mobile = width <= 760;
    await until(
      mobile
        ? "document.querySelector('a')"
        : "document.querySelector('button')",
    );
    if (mobile) {
      assert.deepEqual(
        await evaluate(
          "(()=>{const a=document.querySelector('a');return{label:a.getAttribute('aria-label'),href:a.getAttribute('href'),buttons:document.querySelectorAll('button').length}})()",
        ),
        {
          label: "Открыть маршрут в Яндекс Навигаторе",
          href: navigatorUrl,
          buttons: 0,
        },
      );
    } else {
      assert.equal(
        await evaluate(
          "document.querySelector('button').getAttribute('aria-label')",
        ),
        "Скопировать координаты массива",
      );
      assert.equal(await evaluate("document.querySelectorAll('a').length"), 0);
    }
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    if ([375, 768, 1440, 1920].includes(width))
      await screenshot(`layout-${width}`);
  }
  assert.deepEqual(
    await evaluate("window.copyCalls"),
    [],
    "Viewport switching and navigator links never call clipboard",
  );
  console.log(
    "PASS mobile uses the supplied Navigator link without copying; desktop returns at the 760/761px boundary, all four layouts fit",
  );

  await command("Page.navigate", { url: origin + "/?empty=1" });
  await until("document.querySelector('button')");
  assert.equal(
    await evaluate("document.querySelector('button').disabled"),
    true,
  );
  await evaluate("document.querySelector('button').click()");
  assert.deepEqual(await evaluate("window.copyCalls"), []);
  assert.equal(
    await evaluate("document.querySelector('[role=status]').textContent"),
    "Координаты скоро появятся",
  );
  await screenshot("empty-desktop");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await until(
    "document.querySelector('button')?.getAttribute('aria-label')==='Открыть маршрут в Яндекс Навигаторе'",
  );
  assert.equal(
    await evaluate("document.querySelector('button').disabled"),
    true,
  );
  assert.equal(await evaluate("document.querySelectorAll('a').length"), 0);
  assert.deepEqual(await evaluate("window.copyCalls"), []);
  await screenshot("empty-mobile");
  console.log(
    "PASS empty coordinates and route remain visibly unavailable, without a success or navigable link",
  );

  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await command("Page.navigate", { url: origin + "/" });
  await until("document.querySelector('button')");
  await activate("button");
  await until("window.copyCalls.length===1");
  await evaluate("window.copyResolve()");
  await until(
    "document.querySelector('[role=status]').textContent==='Координаты до массива скопированы в буфер обмена'",
  );
  assert.notEqual(
    await evaluate(
      "getComputedStyle(document.querySelector('.map-location-action__icon')).animationName",
    ),
    "none",
  );
  await command("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('.map-location-action__icon')).animationName",
    ),
    "none",
  );
  assert.equal(
    await evaluate(
      "getComputedStyle(document.querySelector('button')).transitionDuration",
    ),
    "0s",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS reduced motion disables confirmation movement while preserving the success message",
  );
  console.log(`Done ${artifacts}`);
} finally {
  sockets.forEach((s) => s.close());
  chrome?.kill();
  server.closeAllConnections();
  server.close();
}
