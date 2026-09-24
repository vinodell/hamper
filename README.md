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

`VITE_*` variables are embedded into the browser bundle by Vite. Do not put passwords, API keys, tokens, or other true secrets in them. Use a server-side environment for those values.