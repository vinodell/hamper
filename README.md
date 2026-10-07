# Hamper

## Local environment

Copy `.env.example` to `.env.local` and fill in the contact values. The local env file is ignored by Git.

```bash
npm install
npm run dev
```

## Cloudflare Worker API

Create the D1 database and update `worker/wrangler.jsonc` with its ID:

```bash
npx wrangler d1 create hamper-production
npx wrangler d1 execute hamper-production --remote --file=worker/schema.sql
npx wrangler d1 execute hamper-production --remote --file=worker/seed.sql
```

```bash
node scripts/create-password-hash.mjs
```

Set Worker secrets with `wrangler secret put`:

```bash
npx wrangler secret put ADMIN_LOGIN --config worker/wrangler.jsonc
npx wrangler secret put ADMIN_PASSWORD_HASH --config worker/wrangler.jsonc
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

## Plot management and loading

In `/admin`, use **Добавить участок** in **Другие участки** to create a plot. Its number must be unique across all projects; area and price must be positive numbers with up to two decimal places. The existing database schema supports creation without a migration.

Admin sign-in uses the login and password from the form with HTTP Basic authorization. The Worker checks `ADMIN_LOGIN` and `ADMIN_PASSWORD_HASH` on every admin request. The authorization value is kept in the current tab's `sessionStorage`, so refreshing retains sign-in and **Выйти** clears it locally. If tab storage is unavailable, sign-in lasts until the page is refreshed. No cookies or `SESSION_SECRET` are used. Changing the configured password invalidates the previous credentials immediately.

Sign-in verifies credentials and loads plots with one protected `GET /api/admin/plots`. Creation uses `POST /api/admin/plots`; **Сохранить все изменения** sends one `PUT /api/admin/plots` with `{ plots: [...] }`, saved in a database transaction. Deploy the updated API Worker, then publish the matching frontend. The old `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me` endpoints are removed.

Public plots start loading at application startup and share an in-memory cache across project pages. Visible pages refresh the snapshot every 30 seconds, and successful admin changes update the current tab immediately and notify other tabs. Authentication is always checked on the server.

Local development uses demo plots only on localhost when `VITE_API_URL` is empty. Set `VITE_API_URL` to use the real API during development.
