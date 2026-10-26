export const NETWORK_NAMES: Record<string, string> = {
  mtn: "MTN",
  glo: "Glo",
  airtel: "Airtel",
  "9mobile": "9mobile",
};

const PREFIXES: Record<string, string[]> = {
  mtn: [
    "0703",
    "0704",
    "0706",
    "0803",
    "0806",
    "0810",
    "0813",
    "0814",
    "0816",
    "0903",
    "0906",
    "0913",
    "0916",
    "07025",
    "07026",
  ],
  glo: ["0705", "0805", "0807", "0811", "0815", "0905", "0915"],
  airtel: ["0701", "0708", "0802", "0808", "0812", "0901", "0902", "0904", "0907", "0912"],
  "9mobile": ["0809", "0817", "0818", "0908", "0909"],
};

const LOOKUP = new Map<string, string>();
for (const [network, prefixes] of Object.entries(PREFIXES)) {
  for (const prefix of prefixes) LOOKUP.set(prefix, network);
}

export function detectNetwork(phone: string): string | null {
  if (phone.length < 4) return null;
  return LOOKUP.get(phone.slice(0, 5)) ?? LOOKUP.get(phone.slice(0, 4)) ?? null;
}

export type NetworkCheckResult =
  | { status: "incomplete" }
  | { status: "unknown" }
  | { status: "match"; detected: string }
  | { status: "mismatch"; detected: string };

export function checkNetwork(phone: string, selectedNetworkId: string): NetworkCheckResult {
  if (!(selectedNetworkId in PREFIXES)) return { status: "unknown" };
  if (phone.length !== 11) return { status: "incomplete" };
  const detected = detectNetwork(phone);
  if (!detected) return { status: "unknown" };
  return { status: detected === selectedNetworkId ? "match" : "mismatch", detected };
}

export function networkMismatchMessage(phone: string, networkId: string, networkName: string): string | null {
  const check = checkNetwork(phone, networkId);
  if (check.status !== "mismatch") return null;
  return `That number looks like ${NETWORK_NAMES[check.detected] ?? check.detected}, not ${networkName}. Check the number, or tick the box to buy anyway.`;
}
