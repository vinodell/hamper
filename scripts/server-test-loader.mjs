import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";

const modules = new Map();

export async function importServerModule(relativePath) {
  const sourceUrl = new URL(`../server/${relativePath}`, import.meta.url);
  return import(await compile(sourceUrl));
}

async function compile(sourceUrl) {
  if (modules.has(sourceUrl.href)) return modules.get(sourceUrl.href);
  const source = await readFile(sourceUrl, "utf8");
  const transformed = await transformWithOxc(source, sourceUrl.pathname);
  let code = transformed.code;
  const imports = [...code.matchAll(/(["'])(\.\.?\/[^"']+\.js)\1/g)];
  for (const [literal, , relativePath] of imports) {
    const dependency = new URL(relativePath.replace(/\.js$/, ".ts"), sourceUrl);
    code = code.replaceAll(literal, JSON.stringify(await compile(dependency)));
  }
  code += `\n//# sourceURL=${sourceUrl.href}\n`;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  modules.set(sourceUrl.href, moduleUrl);
  return moduleUrl;
}
