import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The public demo is isolated: it never proxies requests to the real API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
});
