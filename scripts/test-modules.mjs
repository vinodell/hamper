import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';

const root = new URL('../', import.meta.url);
export const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

export async function compile(file, imports = {}) {
  const source = await readFile(new URL(file, root), 'utf8');
  const { code } = await transformWithOxc(source, file);
  return moduleUrl(
    code.replace(/(from\s+)(["'])([^"']+)\2/g, (match, prefix, _quote, name) =>
      imports[name] ? `${prefix}${JSON.stringify(imports[name])}` : match,
    ),
  );
}
