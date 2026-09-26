import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [react(), cloudflare()],
	base: process.env.GITHUB_ACTIONS ? '/hamper/' : '/',
    resolve: {
        alias: {},
    },
});