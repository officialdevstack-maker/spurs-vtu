import { apiOk } from "@/lib/api/response";

export async function GET() {
  return apiOk({
    openapi: "3.1.0",
    info: { title: "Spur VTU API", version: "1.0.0" },
    servers: [{ url: process.env.APP_URL ?? "" }],
    paths: {
      "/api/v1/me": { get: { summary: "Current customer", security: [{ bearerAuth: [] }] } },
      "/api/v1/pin": { post: { summary: "Set transaction PIN", security: [{ bearerAuth: [] }] } },
      "/api/v1/pin/change": { post: { summary: "Change transaction PIN", security: [{ bearerAuth: [] }] } },
      "/api/v1/pin/remove": { post: { summary: "Remove transaction PIN", security: [{ bearerAuth: [] }] } },
      "/api/v1/pin/reset/request": { post: { summary: "Request PIN reset", security: [{ bearerAuth: [] }] } },
      "/api/v1/wallet/funding": { get: { summary: "Wallet funding details", security: [{ bearerAuth: [] }] } },
      "/api/v1/wallet/funding/permanent": { post: { summary: "Create permanent funding account", security: [{ bearerAuth: [] }] } },
      "/api/v1/wallet/funding/temporary": { post: { summary: "Create temporary funding account", security: [{ bearerAuth: [] }] } },
      "/api/v1/promo/preview": { post: { summary: "Preview a promotion", security: [{ bearerAuth: [] }] } },
      "/api/v1/cashback": { get: { summary: "Cashback balance and history", security: [{ bearerAuth: [] }] } },
      "/api/v1/notifications": { get: { summary: "List notifications", security: [{ bearerAuth: [] }] } },
      "/api/v1/devices": { post: { summary: "Register push device", security: [{ bearerAuth: [] }] } },
      "/api/v1/packages": { get: { summary: "List packages", security: [{ bearerAuth: [] }] } },
      "/api/v1/support": { get: { summary: "List support tickets" }, post: { summary: "Create support ticket" } },
      "/api/v1/referrals": { get: { summary: "Referral overview" }, post: { summary: "Apply referral code" } },
      "/api/v1/config": { get: { summary: "Mobile app configuration" } },
      "/api/health": { get: { summary: "Database health" } },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  });
}
