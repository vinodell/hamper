# Hamper

just private website

## Local environment

Copy `.env.example` to `.env.local` and fill in the contact values. The local env file is ignored by Git.

Telegram values are usernames without `@` or `https://t.me/`; WhatsApp values are phone numbers containing only digits. The interface adds the fixed link prefixes.

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
# Optional: reuse a separately managed signing secret if one is already configured.
npx wrangler secret put SESSION_SECRET --config worker/wrangler.jsonc
npx wrangler secret put TELEGRAM_BOT_TOKEN --config worker/wrangler.jsonc
npx wrangler secret put TELEGRAM_CHAT_ID --config worker/wrangler.jsonc
npx wrangler secret put PUBLIC_ORIGIN --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

Set `PUBLIC_ORIGIN` to the exact frontend origin, such as `https://vinodell.github.io` (without `/hamper`). Set `VITE_API_URL` to the deployed API Worker URL in the frontend build environment. Deploy the API and matching frontend together.

## Admin sign-in

Open `/admin/` and enter the configured login and password. `POST /api/admin/login` verifies them once and sets a signed HttpOnly cookie valid for 24 hours. The frontend then loads `/api/admin/plots` to check that the browser accepted the cookie. Reloading the page reuses this cookie; there are no client tokens, stored passwords, session database, redirects, or separate authentication routes. The previous Basic-auth value is removed from tab storage when opening the admin page.

Every admin read/write checks the cookie signature and expiry on the server. Changing the configured login, password hash, or optional `SESSION_SECRET` invalidates existing cookies. The existing password hash provides signing key material when `SESSION_SECRET` is absent, so no new secret is required. **Выйти** sends `POST /api/admin/logout` and expires the browser cookie. Expired authentication returns to the login form and preserves unsaved editor rows until re-entry.

HTTPS cookies use `HttpOnly; Secure; SameSite=None; Partitioned` so separate GitHub Pages and Worker sites can work with browsers supporting partitioned cookies. Browser settings that block these cookies will produce a readable sign-in error. Using the same site for the frontend and API also avoids third-party-cookie restrictions. Admin requests accept only the configured frontend origin; public plot/contact requests send no auth cookies or Authorization header.

In `/admin`, **Добавить участок** in **Другие участки** creates a plot with a unique number. Area and price must be positive with up to two decimal places. **Сохранить все изменения** sends one `PUT /api/admin/plots` with `{ plots: [...] }`; the Worker validates the whole batch and saves it in a database transaction. No database migration is required.

## Local API and public data

Public pages share an in-memory plot cache and refresh visible data. Failed requests retain previous data and show a retry message; saves publish confirmed data immediately. Malformed responses, duplicate plot IDs, invalid numeric values, and incomplete save responses are rejected.

Local demo plots are used only with `VITE_USE_MOCK_DATA=true` on localhost in development. Without this flag the app requests the configured API, so an incorrect API URL or HTML fallback is visible as an error.

To test real requests locally, create an ignored `worker/.dev.vars` with `ADMIN_LOGIN`, `ADMIN_PASSWORD_HASH`, `PUBLIC_ORIGIN=http://localhost:5173`, and the Telegram secrets, then run `npm run worker:dev`. Use `VITE_API_URL=http://localhost:8787` for the frontend. Local HTTP on localhost uses an HttpOnly `SameSite=Lax` cookie. Keep real contact sends disabled or use a test Telegram destination during development.

Run `npm test`, `npm run worker:typecheck`, and `npm run build` before publishing. `npm run test:data` covers shared request cancellation, cache refresh/save races, sorting, map status resolution, and Telegram success/error responses.

Both deployment workflows run the full tests before publishing. The GitHub Pages build requires `VITE_API_URL` in the `github-pages` environment or repository secrets.

Project and admin links end in `/`, matching the directory URLs served by GitHub Pages and avoiding an extra redirect on direct visits or reloads.
