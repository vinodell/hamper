import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The public demo needs only Vite; do not start a Worker or its inspector.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
});
