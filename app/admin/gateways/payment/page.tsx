import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { getAppBaseUrl } from "@/lib/admin/app-url";
import { PaymentProvidersManager } from "@/components/admin/payments/manager";
import { getPaymentPointProviderSettings, getPaymentProviderSettings } from "@/lib/db/payment-providers";

export const metadata: Metadata = { title: "Payment gateways | Spur VTU" };

export default async function PaymentGatewaysPage() {
  await connection();
  await requirePermission("gateways.manage");
  const [settings, paymentPointSettings, base] = await Promise.all([
    getPaymentProviderSettings(),
    getPaymentPointProviderSettings(),
    getAppBaseUrl(),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Payment</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">
          Manage payment provider credentials and account creation.
        </p>
      </header>

      <PaymentProvidersManager
        settings={settings}
        paymentPointSettings={paymentPointSettings}
        webhookUrls={{
          flutterwave: `${base}/api/webhooks/flutterwave`,
          paymentpoint: `${base}/api/webhooks/paymentpoint`,
        }}
      />
    </div>
  );
}
