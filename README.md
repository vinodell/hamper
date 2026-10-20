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
npx wrangler d1 migrations apply hamper-production --remote --config worker/wrangler.jsonc
npx wrangler d1 execute hamper-production --remote --config worker/wrangler.jsonc --file=worker/seed.sql
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

In `/admin`, **Добавить участок** in **Другие участки** creates a plot with a unique number. Area and price must be positive with up to two decimal places. **Сохранить участки** sends one `PUT /api/admin/plots` with `{ plots: [...] }`; the Worker validates the whole batch and saves it in a database transaction.

## Promotions, plot documents and applications

The admin promotion panel saves its own settings with **Сохранить акцию**. Its
switch controls the home/project ribbons and the promotion card above the plots
table. The discount is an integer from 1 to 100; it changes the displayed offer,
while plot prices remain the values entered by the administrator.

Expand **Документы и ссылка** for a plot to enter its cadastral number, mark
**ГПЗУ получен** / **Разрешение на строительство**, and set the mortgage listing
URL. Empty cadastral numbers and unmarked documents are shown as unconfirmed.
Mortgage links accept HTTPS URLs on `domclick.ru` and its subdomains. **Купить в
ипотеку** appears in the selected available plot's map popup only after its
listing URL is saved; no listing URLs or document completion are invented.

The table's **Подробнее** opens the plot details. **Забронировать участок**
selects that plot in the application form. Applications are requests for contact;
the administrator confirms a reservation by changing the plot status.
For a reserved map parcel, **Уведомить, если участок освободится** appears next
to the close control. It opens an inquiry with the project and plot fixed, adds
the notification request to the submitted comment, and still requires personal
data consent. This uses the existing application channel.
The optional **При 100% оплате** price is edited next to the base price in the
admin table and when adding a plot. It must be positive, have up to two decimal
places, and be lower than the base price. When set, public tables, lists and map
details show the crossed-out base price, the full-payment price and its badge.
Leaving the field empty removes both the badge and the special price. Sorting
and the project's minimum price use the displayed amount; promotion percentages
do not calculate plot prices. See [implementation details](docs/full-payment-and-motion.md).

The personal-data checkbox starts unchecked, resets after a successful send,
and is required to enable submission. Both the client and the Worker reject a
request unless `consent` is the boolean `true`; the Telegram message records the
confirmation.

### Database upgrade

Before publishing this Worker against an existing database, apply the checked-in
migrations. They preserve the plots and add metadata columns plus the singleton
promotion settings. The Worker deploy workflow applies pending migrations before
deployment. On an empty database the same migration command initializes all tables.

```bash
npx wrangler d1 migrations apply hamper-production --remote --config worker/wrangler.jsonc
```

Use migrations for setup and upgrades. `worker/schema.sql` is a reference snapshot
of the latest schema for isolated fixtures; applying it to an existing table does
not add missing columns. Do not apply `0001_sales_features.sql` a second time
manually; the migrations command tracks which files have already run.

### Browser verification

`npm run test:browser` builds an isolated Pages version and checks the real UI,
Worker, and a temporary SQLite database in Chrome/Chromium. It uses synthetic
credentials/plots and intercepts Telegram sends; it does not use production D1.
It checks promotion saves across tabs, plot document edits, popup booking,
mandatory consent, per-plot mortgage links, and layouts at 375/768/1440/1920 px.
The command prints a directory containing screenshots and its JSON report.
Set `CHROME_BIN` if the browser is not at a standard installation path. Node 24+
is needed for the SQLite-backed tests.

Tailwind is a Vite build-time dependency for scoped `tw:` utilities, with the
existing theme and CSS retained. Preflight is omitted to preserve the site's
existing defaults. See the [Tailwind Vite setup](https://tailwindcss.com/docs/installation/using-vite)
and [individual imports](https://tailwindcss.com/docs/preflight#disabling-preflight)
for the integration used here.

## Local API and public data

Public pages share an in-memory plot cache and refresh visible data. Failed requests retain previous data and show a retry message; saves publish confirmed data immediately. Malformed responses, duplicate plot IDs, invalid numeric values, and incomplete save responses are rejected.

Local demo plots are used only with `VITE_USE_MOCK_DATA=true` on localhost in development. Without this flag the app requests the configured API, so an incorrect API URL or HTML fallback is visible as an error.

To test real requests locally, create an ignored `worker/.dev.vars` with `ADMIN_LOGIN`, `ADMIN_PASSWORD_HASH`, `PUBLIC_ORIGIN=http://localhost:5173`, and the Telegram secrets, then run `npm run worker:dev`. Use `VITE_API_URL=http://localhost:8787` for the frontend. Local HTTP on localhost uses an HttpOnly `SameSite=Lax` cookie. Keep real contact sends disabled or use a test Telegram destination during development.

Run `npm test`, `npm run worker:typecheck`, and `npm run build` before publishing. `npm run test:data` covers shared request cancellation, cache refresh/save races, sorting, map status resolution, and Telegram success/error responses.

`npm run typecheck` checks the frontend, Vite configuration, and Worker together.
The public plots API omits administrative street and update timestamp fields.
JSON bodies are limited by their actual UTF-8 size: 32 KiB for ordinary requests
and 12 MiB for bulk plot updates; larger requests return HTTP 413.
The build output in `dist` is generated locally and by CI, and is not versioned.

The [code quality audit](docs/code-quality-audit.md) records the verified fixes,
validation results, and remaining work.

Both deployment workflows run the full tests before publishing. The GitHub Pages build requires `VITE_API_URL` in the `github-pages` environment or repository secrets.

Project and admin links end in `/`, matching the directory URLs served by GitHub Pages and avoiding an extra redirect on direct visits or reloads.
