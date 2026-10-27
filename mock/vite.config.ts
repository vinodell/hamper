import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mockContactEnv } from "./contacts.ts";

// The public demo is isolated: it never proxies requests to the real API.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: "/",
  define:
    command === "serve"
      ? Object.fromEntries(
          Object.entries({
            VITE_USE_MOCK_DATA: "true",
            ...mockContactEnv,
          }).map(([name, value]) => [
            `import.meta.env.${name}`,
            JSON.stringify(value),
          ]),
        )
      : undefined,
}));
