# Spur VTU Mobile API

This document describes the HTTP API available to the Spur VTU mobile application.

## 1. API basics

### Base URLs

- Production: replace `https://spurtvu.example.com` with the deployed Spur VTU origin.
- Local development: `http://localhost:3700`

All API routes use HTTPS in production.

```text
BASE_URL=https://your-domain.example
Authorization: Bearer <access-token>
Content-Type: application/json
Accept: application/json
```

The live OpenAPI summary is available from:

```text
GET /api/v1/openapi
```

It is suitable for discovery and code generation, but this document is the detailed mobile integration reference.

### Authentication

The API accepts an OIDC access token or a scoped API key:

```http
Authorization: Bearer <access-token-or-api-key>
```

The access token must be issued by the configured Spurs OIDC issuer and accepted by one of `SPURS_CLIENT_ID` or `SPURS_MOBILE_CLIENT_IDS`.

API-key scopes:

| Scope | Access |
|---|---|
| `balance` | Wallet, cashback, profile, notifications and devices |
| `catalog` | Catalogs and account-number/meter verification |
| `purchase` | Purchases, PIN operations and package upgrades |
| `transactions` | Transaction history, receipts and support |

Mobile users should normally use an OIDC access token. API keys are intended for registered resellers and server integrations.

### Currency and amounts

All financial values in API JSON are represented in Nigerian naira as JSON numbers unless an endpoint explicitly says otherwise.

For example:

```json
{
  "balance": 1250.75,
  "amount": 500
}
```

Do not round or convert currency in the app. The server already calculates wallet and package values. Temporary funding accepts:

- Minimum: `100`
- Maximum: `1,000,000`
- Maximum precision: two decimal places

### JSON responses

Successful responses use:

```json
{
  "ok": true,
  "data": {}
}
```

Error responses use:

```json
{
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "Enter a valid request."
  }
}
```

When a response includes `requestId`, use it when reporting support issues.

### HTTP status codes

| Status | Meaning |
|---|---|
| `200` | Request completed successfully |
| `201` | Resource created |
| `400` | Invalid JSON or invalid request fields |
| `401` | Missing, invalid or expired credentials |
| `403` | Suspended account, invalid PIN or forbidden scope |
| `404` | Resource not found |
| `409` | Duplicate, conflict or already exists |
| `422` | Purchase or domain validation failed |
| `429` | Rate limited |
| `500` | Server error |
| `503` | Required service unavailable |

JSON request bodies are limited to 32 KB.

### Error codes

| Code | When it is returned |
|---|---|
| `unauthorized` | Credentials missing or invalid |
| `account_suspended` | Customer account is suspended |
| `forbidden` | Bearer/API key lacks the required scope |
| `ip_not_allowed` | API-key IP allowlist rejected the request |
| `invalid_request` | Required or malformed fields |
| `pin_required` | Purchase PIN has not been supplied |
| `pin_invalid` | PIN is wrong or the PIN is locked |
| `purchase_failed` | Purchase could not be started |
| `not_found` | Resource was not found |
| `conflict` | Duplicate or conflicting operation |
| `rate_limited` | Too many requests |
| `server_error` | Unexpected server failure |
| `unavailable` | Dependent provider or database unavailable |

### Rate limiting

Authenticated API activity is limited to 60 requests per 60-second window per API key or OIDC user. Responses may include:

```http
Retry-After: 60
```

When receiving `429`, do not immediately retry. Respect `Retry-After` and make the next attempt later.

---

## 2. Health and configuration

### Health check

```http
GET /api/health
```

This endpoint is unauthenticated.

```json
{
  "ok": true,
  "status": "healthy"
}
```

Unhealthy responses return HTTP `503`.

### Mobile configuration

```http
GET /api/v1/config
```

No authentication is required.

```json
{
  "ok": true,
  "data": {
    "minimumVersion": "1.2.0",
    "maintenance": false,
    "maintenanceMessage": null
  }
}
```

Check `maintenance` before starting a service. If `minimumVersion` is not null, compare it against the app's semantic version and force or recommend an update.

---

## 3. Account

### Get current account

```http
GET /api/v1/me
Authorization: Bearer <access-token>
```

Required scope: `balance`

Response:

```json
{
  "ok": true,
  "data": {
    "id": "oidc-user-id",
    "name": "Customer Name",
    "username": "customer",
    "phone": "08031234567",
    "email": "customer@example.com",
    "status": "active",
    "verified": true,
    "package": {
      "id": "basic",
      "name": "Basic"
    },
    "hasPin": true,
    "pinRequired": true,
    "locked": false,
    "walletBalance": 1250.75,
    "cashbackBalance": 75,
    "unreadCount": 3,
    "useCashbackDefault": false,
    "confirmPurchases": true
  }
}
```

The mobile app should call this endpoint on launch and after profile, PIN or wallet changes.

### Update profile

```http
PATCH /api/v1/me
Authorization: Bearer <access-token>
Content-Type: application/json
```

Required scope: `balance`

Request:

```json
{
  "phone": "08031234567",
  "settings": {
    "notifyEmail": true,
    "notifySms": true,
    "notifyPush": true,
    "notifyTransactions": true,
    "notifyPromotions": true,
    "loginAlerts": true,
    "useCashbackDefault": false,
    "confirmPurchases": true,
    "theme": "system"
  }
}
```

`phone` can be `null`. If present, it must normalize to an 11-digit Nigerian phone number beginning with `0`.

`theme` must be one of:

- `light`
- `dark`
- `system`

All notification fields are required booleans.

Response:

```json
{
  "ok": true,
  "data": {
    "updated": true
  }
}
```

### Request account deletion

```http
DELETE /api/v1/me/account
Authorization: Bearer <access-token>
```

Required scope: `balance`

This requests deletion by suspending the account and recording `deletion_requested_at`. The mobile app should immediately show a pending-deletion state and stop making purchases.

```json
{
  "ok": true,
  "data": {
    "deletionRequested": true
  }
}
```

---

## 4. Wallet

### Read wallet balance

```http
GET /api/v1/balance
Authorization: Bearer <access-token>
```

Required scope: `balance`

```json
{
  "ok": true,
  "data": {
    "balance": 1250.75,
    "currency": "NGN"
  }
}
```

### Get funding options and pending intents

```http
GET /api/v1/wallet/funding
Authorization: Bearer <access-token>
```

Required scope: `balance`

```json
{
  "ok": true,
  "data": {
    "permanent": {
      "accountNumber": "1234567890",
      "bankName": "Example Bank",
      "accountName": "Customer Name"
    },
    "pending": [
      {
        "reference": "funding-uuid",
        "amountKobo": 50000,
        "accountNumber": "0987654321",
        "bankName": "Example Bank",
        "status": "pending",
        "expiresAt": "2026-11-26T13:00:00.000Z"
      }
    ]
  }
}
```

`pending[].amountKobo` is an implementation detail from the funding helper; the mobile app should display `amountKobo / 100` in naira.

If no permanent account exists, `permanent` is `null`.

### Create permanent virtual account

```http
POST /api/v1/wallet/funding/permanent
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "bvn": "12345678901"
}
```

Required scope: `balance`

The BVN is:

- Validated as exactly 11 digits.
- Sent only to Flutterwave.
- Never returned, stored by Spur VTU, or logged.

Response:

```json
{
  "ok": true,
  "data": {
    "accountNumber": "1234567890",
    "bankName": "Example Bank",
    "accountName": "Customer Name"
  }
}
```

Do not cache or show the BVN. The account details can be cached.

### Create temporary virtual account

```http
POST /api/v1/wallet/funding/temporary
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "amount": 500
}
```

Required scope: `balance`

Response:

```json
{
  "ok": true,
  "data": {
    "accountNumber": "0987654321",
    "bankName": "Example Bank",
    "accountName": "Customer Name",
    "amount": 500,
    "reference": "funding-uuid",
    "expiresAt": "2026-11-26T13:00:00.000Z"
  }
}
```

Save `reference` for support and status tracking. A temporary account is tied to the requested amount and expires according to `expiresAt`.

### Confirming funding

Wallet funding is confirmed by Flutterwave webhooks. The mobile app should not mark funding successful merely because an account was created.

Recommended flow:

1. Create the funding account.
2. Show bank-transfer instructions.
3. Poll `GET /api/v1/balance` while the user waits.
4. Stop polling after the balance increases or the funding intent expires.
5. Refresh `GET /api/v1/wallet/funding` to reconcile pending intents.

---

## 5. Cashback

### Get cashback balance and history

```http
GET /api/v1/cashback
Authorization: Bearer <access-token>
```

Required scope: `balance`

```json
{
  "ok": true,
  "data": {
    "balance": 75,
    "settings": {
      "enabled": true,
      "rules": []
    },
    "history": [
      {
        "reference": "transaction-id:earn",
        "direction": "credit",
        "amount": 10,
        "source": "earn",
        "service": "data",
        "at": "2026-11-26T10:30:00.000Z"
      }
    ]
  }
}
```

`history` is capped at 50 entries.

The app may use the `useCashbackDefault` setting from `/api/v1/me` as the default `useCashback` purchase value.

---

## 6. Promotions

### Preview promotion

```http
POST /api/v1/promo/preview
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "code": "SAVE100",
  "service": "data",
  "price": 1000
}
```

Required scope: `purchase`

Supported services:

- `airtime`
- `data`
- `cable`
- `electricity`

Successful response:

```json
{
  "ok": true,
  "data": {
    "code": "SAVE100",
    "discount": 100,
    "finalPrice": 900
  }
}
```

Invalid or ineligible promotions return HTTP `422` with code `promo_invalid`.

This is a preview only. The server revalidates the promotion when the purchase is submitted.

---

## 7. Transaction PIN

Four-digit PINs are required for mobile purchases unless API-key authentication is used. Use the PIN only for secure purchase requests and PIN-management screens. Never store it persistently or log it.

### Set PIN

```http
POST /api/v1/pin
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "pin": "2468"
}
```

The PIN must be exactly four digits and cannot be repeated or one of the server's weak PIN patterns.

### Change PIN

```http
POST /api/v1/pin/change
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "currentPin": "2468",
  "nextPin": "9753"
}
```

### Remove PIN

```http
POST /api/v1/pin/remove
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "pin": "2468"
}
```

Removing the PIN means the account no longer requires a transaction PIN. API-key purchase behavior is unchanged.

### Request PIN reset

```http
POST /api/v1/pin/reset/request
Authorization: Bearer <access-token>
```

Success:

```json
{
  "ok": true,
  "data": {
    "resetUrl": "https://your-domain.example/pin/reset?token=<reset-token>"
  }
}
```

Open `resetUrl` in an authenticated web browser or universal/deep link. The reset token is single-use and short-lived.

A recent repeat request can return HTTP `429` with code `rate_limited`.

### PIN lock behavior

After repeated incorrect PIN attempts, the PIN may be locked temporarily. `/api/v1/me` contains `hasPin`, `pinRequired`, and `locked`. Purchase and PIN-change responses contain the remaining lock or attempt information in `error.message`.

---

## 8. Purchase catalog

Catalog prices can differ by customer package.

### Airtime catalog

```http
GET /api/v1/catalog/airtime
Authorization: Bearer <access-token>
```

Required scope: `catalog`

Returns networks and package-aware airtime pricing. In the airtime API, package fields are network discount data rather than plan objects.

### Data catalog

```http
GET /api/v1/catalog/data
Authorization: Bearer <access-token>
```

Required scope: `catalog`

```json
{
  "ok": true,
  "data": {
    "networks": [
      {
        "id": "mtn",
        "name": "MTN",
        "types": ["SME", "VTU"],
        "plans": [
          {
            "id": "mtn-1",
            "typeId": "sme",
            "size": "1GB",
            "validity": "30 days",
            "price": 270
          }
        ]
      }
    ]
  }
}
```

Use `plan.id` as `planId` when purchasing data.

### Cable catalog

```http
GET /api/v1/catalog/cable
Authorization: Bearer <access-token>
```

Required scope: `catalog`

Response shape:

```json
{
  "ok": true,
  "data": {
    "operators": [
      {
        "id": "dstv",
        "name": "DStv",
        "plans": [
          {
            "id": "dstv-plan",
            "name": "Compact",
            "validity": "30 days",
            "price": 10500
          }
        ]
      }
    ]
  }
}
```

### Electricity catalog

```http
GET /api/v1/catalog/electricity
Authorization: Bearer <access-token>
```

Required scope: `catalog`

```json
{
  "ok": true,
  "data": {
    "discos": [
      {
        "id": "ikedc",
        "name": "Ikeja Electric",
        "min": 1000,
        "max": 50000,
        "discount": 1.5
      }
    ]
  }
}
```

### Verify smartcard

```http
POST /api/v1/verify/smartcard
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "operatorId": "dstv",
  "smartcard": "12345678901"
}
```

`smartcard` must contain 10 or 11 digits.

### Verify meter

```http
POST /api/v1/verify/meter
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "discoId": "ikedc",
  "meterType": "prepaid",
  "meter": "12345678901"
}
```

Meter numbers contain 10–13 digits. `meterType` is `prepaid` or `postpaid`.

---

## 9. Purchases

For every purchase:

- Generate a UUID in the app before the request.
- Reuse the same UUID for every retry of that exact purchase.
- Never reuse a purchase reference for a different recipient or amount.
- Do not debit or assume success before receiving an API response.
- Query the transaction after network or provider uncertainty.

Purchase submissions accept common optional fields:

| Field | Type | Description |
|---|---|---|
| `pin` | string | Required for OIDC/mobile users |
| `useCashback` | boolean | Use available cashback |
| `promoCode` | string | Optional promotion code |
| `skipNetworkCheck` | boolean | Explicitly override ported-number mismatch for airtime/data |

API-key clients automatically bypass PIN verification.

### Airtime

```http
POST /api/v1/purchase/airtime
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "networkId": "mtn",
  "typeId": "VTU",
  "amount": 500,
  "phone": "08031234567",
  "reference": "550e8400-e29b-41d4-a716-446655440000",
  "pin": "2468",
  "useCashback": false,
  "promoCode": "SAVE100",
  "skipNetworkCheck": false
}
```

Required scope: `purchase`

### Data

```http
POST /api/v1/purchase/data
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "planId": "mtn-1",
  "phone": "08031234567",
  "reference": "550e8400-e29b-41d4-a716-446655440001",
  "pin": "2468",
  "useCashback": true,
  "promoCode": null,
  "skipNetworkCheck": false
}
```

Required scope: `purchase`

### Cable TV

```http
POST /api/v1/purchase/cable
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "planId": "dstv-plan",
  "smartcard": "12345678901",
  "phone": "08031234567",
  "reference": "550e8400-e29b-41d4-a716-446655440002",
  "pin": "2468",
  "useCashback": false,
  "promoCode": null
}
```

Required scope: `purchase`

### Electricity

```http
POST /api/v1/purchase/electricity
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "discoId": "ikedc",
  "meterType": "prepaid",
  "meter": "12345678901",
  "amount": 5000,
  "phone": "08031234567",
  "reference": "550e8400-e29b-41d4-a716-446655440003",
  "pin": "2468",
  "useCashback": false,
  "promoCode": null
}
```

Required scope: `purchase`

### Purchase response

Success:

```json
{
  "ok": true,
  "data": {
    "reference": "550e8400-e29b-41d4-a716-446655440000",
    "status": "success",
    "message": "Airtime purchase completed."
  }
}
```

Possible `status` values:

- `success`
- `pending`
- `failed`

PIN required:

```http
403
```

```json
{
  "ok": false,
  "error": {
    "code": "pin_required",
    "message": "Set up your transaction PIN first."
  }
}
```

Purchase failure:

```http
422
```

```json
{
  "ok": false,
  "error": {
    "code": "purchase_failed",
    "message": "Something went wrong."
  }
}
```

After HTTP `500`, always query the transaction with the original reference before retrying.

---

## 10. Transaction history

### List transactions

```http
GET /api/v1/transactions?page=1&status=all&service=all&q=
Authorization: Bearer <access-token>
```

Required scope: `transactions`

Query parameters:

| Parameter | Values | Default |
|---|---|---|
| `page` | Positive integer | `1` |
| `status` | `all`, `success`, `pending`, `failed` | `all` |
| `service` | `all`, `airtime`, `data`, `cable`, `electricity`, `wallet` | `all` |
| `q` | Search text, maximum 100 characters | Empty |

Page size is 20.

Response:

```json
{
  "ok": true,
  "data": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "items": [
      {
        "reference": "550e8400-e29b-41d4-a716-446655440000",
        "service": "data",
        "title": "MTN 1GB",
        "amount": 270,
        "detail": "08031234567",
        "direction": "debit",
        "status": "success",
        "at": "2026-11-26T10:30:00.000Z",
        "failureReason": null,
        "refunded": false,
        "cashbackUsed": 20
      }
    ]
  }
}
```

The history endpoint is currently page-number based. Existing rows can shift while paging; mobile apps should refresh and avoid caching pages as immutable snapshots.

### Get transaction status

```http
GET /api/v1/transactions/{reference}
Authorization: Bearer <access-token>
```

Required scope: `transactions`

`reference` may be:

- A UUID
- A Flutterwave funding ID beginning with `flw-`

Response:

```json
{
  "ok": true,
  "data": {
    "reference": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "title": "MTN 1GB",
    "failureReason": null
  }
}
```

Polling is appropriate for `pending` transactions. Stop once `success` or `failed` is returned.

### Get receipt

```http
GET /api/v1/transactions/{reference}/receipt
Authorization: Bearer <access-token>
```

Required scope: `transactions`

### Share receipt

```http
POST /api/v1/transactions/{reference}/receipt
Authorization: Bearer <access-token>
```

This returns public page and image URLs for a successful debit purchase.

```json
{
  "ok": true,
  "data": {
    "page": "https://your-domain.example/receipt/page-token",
    "image": "https://your-domain.example/receipt/image-token"
  }
}
```

Only successful purchases can be shared.

---

## 11. Packages

### List and compare packages

```http
GET /api/v1/packages
Authorization: Bearer <access-token>
```

Required scope: `catalog`

```json
{
  "ok": true,
  "data": {
    "current": "basic",
    "items": [
      {
        "id": "basic",
        "name": "Basic",
        "description": "Standard package",
        "sortOrder": 1,
        "upgradeFee": 0,
        "isDefault": true,
        "customers": 100
      }
    ]
  }
}
```

### Upgrade package

```http
POST /api/v1/packages/upgrade
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "packageId": "pro",
  "pin": "2468"
}
```

Required scope: `purchase`

The customer can only move to a higher package. Package upgrades may charge `upgradeFee` to the wallet.

---

## 12. Notifications

### List notifications

```http
GET /api/v1/notifications?limit=50
Authorization: Bearer <access-token>
```

Required scope: `balance`

`limit` is between 1 and 100 and defaults to 50.

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "notification-id",
        "title": "Purchase successful",
        "body": "Your MTN 1GB purchase went through.",
        "read": false,
        "at": "2026-11-26T10:30:00.000Z"
      }
    ]
  }
}
```

### Mark all notifications read

```http
POST /api/v1/notifications/read
Authorization: Bearer <access-token>
```

Required scope: `balance`

```json
{
  "ok": true,
  "data": {
    "read": true
  }
}
```

---

## 13. Push devices

### Register push device

```http
POST /api/v1/devices
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "kind": "fcm",
  "token": "firebase-or-expo-token"
}
```

Required scope: `balance`

`kind` is either:

- `fcm`
- `web`

Call this after login and whenever the push token changes. Tokens are updated or attached to the authenticated customer.

### Remove push device

```http
DELETE /api/v1/devices/{id}
Authorization: Bearer <access-token>
```

Required scope: `balance`

Device IDs are database IDs, not raw FCM/APNs push tokens.

---

## 14. Referrals

### Get referral status

```http
GET /api/v1/referrals
Authorization: Bearer <access-token>
```

Required scope: `balance`

```json
{
  "ok": true,
  "data": {
    "code": "ABCDEFGH",
    "invited": 3,
    "rewarded": 2,
    "earned": 150,
    "waitingOnFirstPurchase": false,
    "hasReferrer": true
  }
}
```

### Apply referral code

```http
POST /api/v1/referrals
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "code": "ABCDEFGH"
}
```

Required scope: `balance`

The code must belong to another customer and meet the account-age and first-purchase eligibility rules.

---

## 15. Support

### List support tickets

```http
GET /api/v1/support
Authorization: Bearer <access-token>
```

Required scope: `transactions`

### Create support ticket

```http
POST /api/v1/support
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "subject": "Purchase has not completed",
  "body": "My MTN purchase is pending.",
  "transactionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Required scope: `transactions`

`transactionId` is optional.

Success:

```json
{
  "ok": true,
  "data": {
    "id": "ticket-id"
  }
}
```

### Get support ticket

```http
GET /api/v1/support/{id}
Authorization: Bearer <access-token>
```

Required scope: `transactions`

### Reply to support ticket

```http
POST /api/v1/support/{id}
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "body": "The transaction remains pending."
}
```

Required scope: `transactions`

The server rejects replies to closed tickets.

### Close support ticket

```http
POST /api/v1/support/{id}/close
Authorization: Bearer <access-token>
```

Required scope: `transactions`

---

## 16. Mobile implementation checklist

### Startup

1. Call `/api/v1/config`.
2. Validate the app version.
3. If maintenance is enabled, block transaction actions.
4. Refresh `/api/v1/me`.
5. Register or refresh the push token.

### Purchase

1. Load the relevant catalog.
2. Verify smartcard or meter where applicable.
3. Preview a promo code if used.
4. Generate a UUID.
5. Show the complete amount and cashback impact.
6. Confirm purchase in the UI if `confirmPurchases` is true.
7. Prompt for the transaction PIN if `hasPin` and `pinRequired`.
8. Submit once.
9. On transport/network failure, query `/api/v1/transactions/{reference}`.
10. Do not submit a second purchase with the same reference for a different action.

### Pending purchase

After `status: "pending"`:

1. Store the reference locally.
2. Display the pending state.
3. Poll `/api/v1/transactions/{reference}` with backoff.
4. Refresh `/api/v1/me` or `/api/v1/balance` after success or failure.
5. Refresh `/api/v1/transactions` for history.

### Token handling

- Treat access tokens as secrets.
- Store tokens only in the platform secure storage.
- Never send a PIN or BVN in logs, analytics, crash reports or support tickets.
- Handle `401` by refreshing or logging out.
- Handle `403` account-suspended state by blocking transactions.
- Handle `429` by stopping retries and respecting `Retry-After`.

### Security

- Use certificate validation and HTTPS only.
- Do not use `GET` for state-changing operations.
- Do not cache purchase responses or account deletion responses.
- Reuse references for retries, but never for new purchases.
- Never collect or persist a BVN outside the permanent-account request.
- Never log phone numbers, smartcard numbers, meter numbers or transaction PINs.
