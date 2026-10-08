import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithOxc } from "vite";

const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const root = new URL("../", import.meta.url);
const routes = await transformWithOxc(
  await readFile(new URL("src/lib/routes.ts", root), "utf8"),
  "routes.ts",
);
const routesUrl = moduleUrl(routes.code);
const { adminPath, projectRoutes } = await import(routesUrl);
const config = await transformWithOxc(
  await readFile(new URL("vite.config.ts", root), "utf8"),
  "vite.config.ts",
);
const { default: createConfig } = await import(
  moduleUrl(
    config.code.replace(
      /(from\s+)(["'])([^"']+)\2/g,
      (_match, prefix, _quote, path) =>
        `${prefix}${JSON.stringify(
          path === "./src/lib/routes.ts"
            ? routesUrl
            : import.meta.resolve(path),
        )}`,
    ),
  )
);

test("Pages navigation uses directory URLs and emits each matching index.html", () => {
  const savedApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = "https://worker.test";
  try {
    const pagesConfig = createConfig({ mode: "github-pages" });
    const plugin = pagesConfig.plugins.find(
      (entry) => entry.name === "github-pages-routes",
    );
    const source = "<!doctype html><div id=root></div>";
    const files = [];
    plugin.generateBundle.handler.call(
      {
        emitFile: (asset) => files.push(asset),
        error: (message) => {
          throw new Error(message);
        },
      },
      {},
      { "index.html": { type: "asset", source } },
    );

    const expectedPages = [
      ["/admin/", "admin/index.html"],
      ["/projects/oynelovskie-dali/", "projects/oynelovskie-dali/index.html"],
      ["/projects/drugie-uchastki/", "projects/drugie-uchastki/index.html"],
    ];
    assert.deepEqual(
      [adminPath, ...projectRoutes.map(({ path }) => path)],
      expectedPages.map(([path]) => path),
    );
    assert.deepEqual(
      files.map(({ fileName }) => fileName),
      ["404.html", ...expectedPages.map(([, fileName]) => fileName)],
    );
    assert.ok(files.every((asset) => asset.source === source));
  } finally {
    if (savedApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = savedApiUrl;
  }
});
