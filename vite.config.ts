import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { adminPath, projectRoutes } from "./src/lib/routes.ts";

function staticAppRoutes(): Plugin {
  return {
    name: "static-app-routes",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const html = bundle["index.html"];
        if (!html || html.type !== "asset")
          this.error("The application build is missing index.html");

        const paths = [adminPath, ...projectRoutes.map(({ path }) => path)];
        const files = [
          "404.html",
          ...paths.map((path) => `${path.slice(1)}index.html`),
        ];
        for (const fileName of files)
          this.emitFile({ type: "asset", fileName, source: html.source });
      },
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), staticAppRoutes()],
  // Old local/CI API URLs must never enter a Hostland production bundle.
  define:
    command === "build" ? { "import.meta.env.VITE_API_URL": '""' } : undefined,
  base: "/",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
}));
