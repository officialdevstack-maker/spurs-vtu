import type { Metadata } from "next";
import { connection } from "next/server";
import { API_PACKAGE_ID, RATE_LIMIT } from "@/lib/api/keys";
import { listApiKeys } from "@/lib/db/api-keys";
import { getApiWebhook, listRecentDeliveries } from "@/lib/db/api-webhooks";
import { getCustomerPackage } from "@/lib/db/packages";
import { getPinState } from "@/lib/db/pin";
import { requireSpursUser } from "@/lib/spurs";
import { KeyManager } from "./key-manager";
import { WebhookManager } from "./webhook-manager";

export const metadata: Metadata = { title: "API | Spur VTU" };
export const instant = false;

export default async function ApiPage() {
  await connection();
  const user = await requireSpursUser();
  const pkg = await getCustomerPackage(user.sub);
  const eligible = pkg?.id === API_PACKAGE_ID;
  const [keys, webhook, deliveries, pinState] = eligible
    ? await Promise.all([
        listApiKeys(user.sub),
        getApiWebhook(user.sub),
        listRecentDeliveries(user.sub),
        getPinState(user.sub),
      ])
    : [[], null, [], { hasPin: false, required: false }];
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">API</h1>
        <p className="mt-1 text-gray-600 dark:text-[#9FB3B7]">Buy airtime, data, cable TV and electricity from your own app or bot. Orders use your wallet and package prices.</p>
      </header>
      {!eligible ? (
        <div role="status" className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
          <p className="font-medium">API access is on the API package</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">Upgrade your package from the Packages page to create keys.</p>
        </div>
      ) : (
        <>
          <KeyManager keys={keys} pinRequired={pinState.required} />
          <WebhookManager webhook={webhook} deliveries={deliveries} />
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="font-semibold">Quick start</h2>
            <p className="mt-2 text-gray-600 dark:text-[#9FB3B7]">
              Send your key as <span className="font-mono">Authorization: Bearer &lt;key&gt;</span>. Limit: {RATE_LIMIT} requests per minute.
              Every purchase needs a unique UUID <span className="font-mono">reference</span>. Retrying with the same reference never charges twice.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-white/10">{`GET  ${base}/api/v1/balance
GET  ${base}/api/v1/catalog/airtime | data | cable | electricity
POST ${base}/api/v1/verify/smartcard    {"operatorId","smartcard"}
POST ${base}/api/v1/verify/meter        {"discoId","meterType","meter"}
POST ${base}/api/v1/purchase/airtime    {"networkId","typeId","amount","phone","reference"}
POST ${base}/api/v1/purchase/data       {"planId","phone","reference"}
POST ${base}/api/v1/purchase/cable      {"planId","smartcard","phone","reference"}
POST ${base}/api/v1/purchase/electricity {"discoId","meterType","meter","amount","phone","reference"}
GET  ${base}/api/v1/transactions
GET  ${base}/api/v1/transactions/<reference>`}</pre>
          </section>
        </>
      )}
    </div>
  );
}
