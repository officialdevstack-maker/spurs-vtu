"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { DATA_TYPES, NETWORK_IDS, type DataType, type NetworkId } from "@/lib/admin/airtime-data";

export type ActionResult = { ok: true } | { ok: false; error: string };

const BAD_INPUT: ActionResult = { ok: false, error: "That change isn't valid. Refresh the page and try again." };

const validNetwork = (id: string): id is NetworkId => (NETWORK_IDS as readonly string[]).includes(id);
const validType = (id: string): id is DataType => DATA_TYPES.some((t) => t.id === id);

/* Stubs: each one checks admin access and validates input, then returns ok.
   Replace the TODO with your real database update (lib/db). */

export async function setNetworkEnabled(network: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  void enabled;
  if (!validNetwork(network)) return BAD_INPUT;
  // TODO: update the network's enabled flag
  return { ok: true };
}

export async function setNetworkTypeEnabled(network: string, type: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  void enabled;
  if (!validNetwork(network) || !validType(type)) return BAD_INPUT;
  // TODO: enable or disable this network type for the network
  return { ok: true };
}

export async function saveAirtimeDiscount(network: string, percent: number): Promise<ActionResult> {
  await requireAdmin();
  if (!validNetwork(network) || !Number.isFinite(percent) || percent < 0 || percent > 100) return BAD_INPUT;
  // TODO: save the airtime discount percent
  return { ok: true };
}

export async function setPlanActive(network: string, planId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  void active;
  if (!validNetwork(network) || !planId) return BAD_INPUT;
  // TODO: activate or deactivate the data plan
  return { ok: true };
}
