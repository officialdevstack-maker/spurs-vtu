import { authenticateApi } from "@/lib/api/auth";
import { apiError, apiOk, readJson } from "@/lib/api/response";
import { getPool } from "@/lib/db";
import { getPinState } from "@/lib/db/pin";
import { getWalletBalanceKobo } from "@/lib/db/wallet";
import { getCashbackBalanceKobo } from "@/lib/db/cashback";
import { getProfileSettings } from "@/lib/db/profile";
import { getUnreadCount } from "@/lib/db/announcements";
import { saveProfile } from "@/lib/db/profile";
import { parseSettings } from "@/lib/profile";
import { normalizePhone, PHONE_PATTERN } from "@/lib/phone";

export async function GET(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  try {
    const { rows } = await getPool().query<{
      id: string; name: string | null; username: string | null; phone: string | null;
      email: string | null; status: "active" | "suspended"; package_id: string;
      package_name: string | null; verified: boolean;
    }>(
      `select c.id, c.name, c.username, c.phone, c.email, c.status, c.package_id,
              p.name as package_name, c.email is not null as verified
       from customers c left join packages p on p.id = c.package_id
       where c.id = $1`,
      [auth.ctx.customerId],
    );
    const customer = rows[0];
    if (!customer) return apiError("not_found", "Account not found.", 404);
    const [pin, wallet, cashback, settings, unread] = await Promise.all([
      getPinState(auth.ctx.customerId),
      getWalletBalanceKobo(auth.ctx.customerId),
      getCashbackBalanceKobo(auth.ctx.customerId),
      getProfileSettings(auth.ctx.customerId),
      getUnreadCount(auth.ctx.customerId),
    ]);
    return apiOk({
      id: customer.id,
      name: customer.name,
      username: customer.username,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
      verified: customer.verified,
      package: { id: customer.package_id, name: customer.package_name ?? customer.package_id },
      hasPin: pin.hasPin,
      pinRequired: pin.required,
      locked: false,
      walletBalance: Number(wallet) / 100,
      cashbackBalance: Number(cashback) / 100,
      unreadCount: unread,
      useCashbackDefault: settings.useCashbackDefault,
      confirmPurchases: settings.confirmPurchases,
    });
  } catch (error) {
    console.error("[api] me", error);
    return apiError("server_error", "Something went wrong.", 500);
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticateApi(request, "balance");
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body) return apiError("invalid_request", "Send a JSON body.", 400);
  const settings = parseSettings(body.settings);
  if (!settings) return apiError("invalid_request", "Notification settings are invalid.", 400);
  const rawPhone = body.phone;
  if (rawPhone !== null && typeof rawPhone !== "string") {
    return apiError("invalid_request", "Phone must be a string or null.", 400);
  }
  const phone = typeof rawPhone === "string" && rawPhone.trim()
    ? normalizePhone(rawPhone)
    : null;
  if (phone && !PHONE_PATTERN.test(phone)) {
    return apiError("invalid_request", "Enter an 11-digit phone number.", 400);
  }
  try {
    await saveProfile(auth.ctx.customerId, phone, settings);
    return apiOk({ updated: true });
  } catch (error) {
    console.error("[api] update me", error);
    return apiError("server_error", "Could not update your profile.", 500);
  }
}
