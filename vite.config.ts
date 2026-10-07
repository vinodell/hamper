import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { adminPath, projectRoutes } from "./src/lib/routes.ts";

function githubPagesRoutes(): Plugin {
  return {
    name: "github-pages-routes",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const html = bundle["index.html"];
        if (!html || html.type !== "asset")
          this.error("GitHub Pages build is missing index.html");

        // Pages resolves directories to index.html; BrowserRouter renders the
        // matching screen after this shared application shell has loaded.
        const paths = [adminPath, ...projectRoutes.map(({ path }) => path)];
        const files = [
          "404.html",
          ...paths.map((path) => `${path.slice(1)}/index.html`),
        ];
        for (const fileName of files)
          this.emitFile({ type: "asset", fileName, source: html.source });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const githubPages = mode === "github-pages";
  if (githubPages) {
    const { VITE_API_URL } = loadEnv(mode, process.cwd(), "VITE_API_URL");
    if (!VITE_API_URL)
      throw new Error(
        "GitHub Pages requires VITE_API_URL pointing to the deployed API Worker. Set it in the github-pages environment or repository secrets.",
      );
    const apiUrl = new URL(VITE_API_URL);
    if (!["https:", "http:"].includes(apiUrl.protocol))
      throw new Error("VITE_API_URL must be an absolute HTTP(S) API URL.");
  }

  return {
    plugins: [react(), githubPages ? githubPagesRoutes() : cloudflare()],
    base: githubPages ? "/hamper/" : "/",
  };
});
