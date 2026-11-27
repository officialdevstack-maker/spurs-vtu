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

Admin access is stored in the database. Staff are customers with a role, managed at
Admin → User management → Roles & permissions. Owners (full access) are granted only from a script:

    npm run admin:owner -- <spurs-id | email | username | phone>
    npm run admin:owner -- <same> --revoke

The person must have logged in to Spur VTU once first. Suspended staff lose admin access.

## Sign-in

VTU authenticates with the node-accounts OIDC service through `@spurs/auth`.
Set `APP_URL` to this app's public origin, `SPURS_ISSUER` to the node-accounts
OIDC issuer, `SPURS_CLIENT_ID` to the client registered for this app, and
`SPURS_SESSION_SECRET` to a random secret. Register `<APP_URL>/auth/callback`
as the client's redirect URI. If the registered client is confidential, also
set `SPURS_CLIENT_SECRET`; leave it unset for a public client. For local
development, set `APP_URL` to `http://localhost:3700`.

The SDK is installed from the node-accounts GitHub repository.

## PostgreSQL

Set `DATABASE_URL` in `.env` to the dedicated VTU PostgreSQL connection string.
Use `.env.example` as a template and keep the real URL private. The app requires
TLS for PostgreSQL connections. Server-side database access is available through
`getPool` and `checkDatabaseConnection` in `lib/db`; the connection pool is
created lazily on first use.

## VTU wallet and payment gateway funding

The VTU keeps customer NGN balances and an idempotent wallet ledger in its own
PostgreSQL database. New VTU balances start at zero; existing balances in the
former external wallet are not imported. Run `npm run db:migrate` before
deploying this wallet or payment gateway change.

Set `PROVIDER_SECRET_KEY` in the server environment, then configure the
Flutterwave public key, secret key, and webhook secret hash under
**Admin → Gateways → Payment**. Add `<APP_URL>/api/webhooks/flutterwave` as the
Flutterwave webhook URL. The webhook verifies the configured hash and then
verifies each transaction with Flutterwave before crediting the local ledger.

Customers can create a permanent virtual account using their own BVN or create
a temporary, amount-specific virtual account. VTU sends a BVN directly to
Flutterwave to provision a permanent account and does not store it.

PaymentPoint can be configured alongside Flutterwave under
**Admin → Gateways → Payment** using the API key, API secret, and business ID
from the PaymentPoint account. If PaymentPoint provides a separate webhook
signing key, enter it; otherwise the API secret is used. Configure
`<APP_URL>/api/webhooks/paymentpoint` as its webhook URL. PaymentPoint webhook
signatures are verified with HMAC-SHA256 before a matching account payment is
credited. Customers with a phone number on their profile can create a permanent
PaymentPoint account or an amount-specific temporary OPay account.

Payment provider credentials are encrypted at rest. Set `PROVIDER_SECRET_KEY`
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

## Public API and webhooks

Run `npm run db:migrate`. Customers on the API package create keys at
`/dashboard/api`. Signed-in mobile users call the same `/api/v1` routes with a
Spurs bearer token and must send their transaction PIN with purchases.

Set `SPURS_MOBILE_CLIENT_IDS` to the comma-separated OIDC client IDs used by
mobile apps. Configure a scheduled HTTP GET to `/api/cron/deliver-webhooks`
every minute with `Authorization: Bearer <CRON_SECRET>`. This sends queued
reseller webhooks and retries failed deliveries.

## Announcements

Run `npm run db:migrate` to add the welcome message, broadcast and notifications
tables. Configure `RESEND_API_KEY` and `MAIL_FROM` for email, or `TERMII_API_KEY`
and `TERMII_SENDER_ID` for SMS. Configure a scheduled HTTP GET to
`/api/cron/send-broadcasts` every minute with
`Authorization: Bearer <CRON_SECRET>` so broadcasts that outgrow a request can
continue in later runs.

## Connect to a Spurs Business workspace

When a workspace owner asks to connect this VTU site, set the workspace ID and
verification token they provide as `SPURS_BUSINESS_WORKSPACE_ID` and
`SPURS_BUSINESS_VERIFY_TOKEN`. Deploy the site, then the Business app can verify
ownership by reading `/.well-known/spurs-business.json`. The endpoint returns
those two values and disables caching; keep the token private until verification
is complete.

After verification, set the per-workspace secret issued by the Business app as
`BUSINESS_INTERNAL_API_SECRET` on this site and redeploy. This secret is sent
only with authenticated server-to-server requests. Do not expose it in browser
code or commit it to source control.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
