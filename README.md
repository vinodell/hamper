# Hamper

## Local environment

Copy `.env.example` to `.env.local` and fill in the contact values. The local env file is ignored by Git.

```bash
npm install
npm run dev
```

## GitHub Pages

The deploy workflow reads the same values from GitHub repository secrets. Add these secrets before deploying:

- `VITE_PHONE_MAKS`
- `VITE_PHONE_VLAD`
- `VITE_PHONE_HREF`
- `VITE_WHATSAPP_MAKS`
- `VITE_WHATSAPP_VLAD`
- `VITE_TELEGRAM_MAKS`
- `VITE_TELEGRAM_VLAD`
- `VITE_CONTACT_EMAIL`
- `VITE_API_URL` — deployed Worker URL, for example `https://hamper-api.<account>.workers.dev`

`VITE_*` variables are embedded into the browser bundle by Vite. Do not put passwords, API keys, tokens, or other true secrets in them. Use a server-side environment for those values.

## Cloudflare Worker API

Create the D1 database and update `worker/wrangler.jsonc` with its ID:

```bash
npx wrangler d1 create hamper-production
npx wrangler d1 execute hamper-production --remote --file=worker/schema.sql
npx wrangler d1 execute hamper-production --remote --file=worker/seed.sql
```

Generate the admin password hash locally and store the output as `ADMIN_PASSWORD_HASH`:

```bash
node scripts/create-password-hash.mjs
```

Set Worker secrets with `wrangler secret put`:

```bash
npx wrangler secret put ADMIN_LOGIN --config worker/wrangler.jsonc
npx wrangler secret put ADMIN_PASSWORD_HASH --config worker/wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config worker/wrangler.jsonc
npx wrangler secret put TELEGRAM_BOT_TOKEN --config worker/wrangler.jsonc
npx wrangler secret put TELEGRAM_CHAT_ID --config worker/wrangler.jsonc
npx wrangler secret put PUBLIC_ORIGIN --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

Then set `VITE_API_URL` to the deployed Worker URL in GitHub repository secrets and redeploy the Pages frontend.

The Worker deploy workflow uses the `github-pages` GitHub Environment (the same environment as the Pages deployment). Add these values under **Settings → Environments → github-pages**:

- Environment secret `CLOUDFLARE_API_TOKEN` with Workers deploy permissions
- Environment variable `CLOUDFLARE_ACCOUNT_ID` (or an Environment secret with the same name)

Repository-level secrets/variables with these names also work. The workflow validates both values before invoking Wrangler.

The D1 schema and seed are intentionally separate from Worker deploy. Run them once after creating the database, then use `/admin` at `https://vinodell.github.io/hamper/admin`.

## Individual plots (Другие участки)

The public page reads prices, areas, availability and IDs from the existing plots API.
Add photos and categories in `src/data/individualPlots.ts`, keyed by the exact plot ID
shown in the admin panel:

```ts
"2-01": {
  title: "Участок у леса",
  category: "ИЖС", // or "Дачка"
  photos: [
    { src: "images/plots/2-01/01.webp", alt: "Вид участка со стороны дороги" },
    { src: "images/plots/2-01/02.webp", alt: "Вид участка со стороны леса" },
    { src: "images/plots/2-01/03.webp", alt: "Подъезд к участку" },
  ],
},
```

Place these image files under `public/images/plots/2-01/`. Paths are resolved against
Vite's base URL, including `/hamper/` on GitHub Pages. Absolute HTTPS image URLs are
also supported. Add three or more photos as available; the carousel also handles
missing photos and loading failures. Unknown categories display as «Уточняется»;
no legal land category is inferred from other fields. Deploy the frontend after
editing this catalog. Prices and statuses continue to be managed through the admin panel.

Local fixtures in `localTest/plots.ts` include demonstration categories and photos.
They are used only by the development server on localhost and excluded from production.

Component styles live beside their TSX files. `src/styles/global.css` contains shared
tokens, fonts, resets, typography, layout primitives and accessible motion defaults.
