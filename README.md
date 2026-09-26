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

The Worker deploy workflow also needs these GitHub secrets:

- `CLOUDFLARE_API_TOKEN` with Workers deploy permissions
- `CLOUDFLARE_ACCOUNT_ID`

The D1 schema and seed are intentionally separate from Worker deploy. Run them once after creating the database, then use `/admin` at `https://vinodell.github.io/hamper/admin`.