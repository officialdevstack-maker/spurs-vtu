This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Admin access

Set `ADMIN_SPURS_IDS` to a comma-separated list of authorized Spurs account IDs
(`sub` claims) to access `/admin`. If the variable is unset or empty, admin
access is denied to everyone.

## PostgreSQL

Set `DATABASE_URL` in `.env` to the dedicated VTU PostgreSQL connection string.
Use `.env.example` as a template and keep the real URL private. The app requires
TLS for PostgreSQL connections. Server-side database access is available through
`getPool` and `checkDatabaseConnection` in `lib/db`; the connection pool is
created lazily on first use.

Provider credentials are encrypted at rest. Set `PROVIDER_SECRET_KEY` in `.env`
to a dedicated, randomly generated 32-byte base64 key before saving provider
secrets. Keep this key private and back it up securely; changing it makes
previously encrypted provider secrets unreadable.

## Provider webhooks

Run `npm run db:migrate` to add per-provider callback tokens and callback history.
Set `APP_URL` to the public HTTPS origin (without a trailing slash) and configure
`CRON_SECRET` with at least 32 random characters (for example, generate a
32-byte hex value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
Give providers the callback
URL shown on **Admin → Gateways → Webhooks** and configure a scheduled HTTP GET
to `/api/cron/fail-pending` with the header
`Authorization: Bearer <CRON_SECRET>`. Auto-fail is disabled until enabled on
that page. Treat provider callback URLs and `CRON_SECRET` as credentials.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
