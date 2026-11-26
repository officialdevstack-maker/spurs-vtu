export const API_SCOPES = [
  { id: "balance", label: "Read wallet balance" },
  { id: "catalog", label: "Read plans and prices" },
  { id: "purchase", label: "Buy airtime, data, cable and electricity" },
  { id: "transactions", label: "Read order status" },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["id"];
export const isApiScope = (value: unknown): value is ApiScope =>
  API_SCOPES.some((scope) => scope.id === value);

export const API_KEY_PATTERN = /^vtu_live_[A-Za-z0-9_-]{43}$/;
export const MAX_ACTIVE_KEYS = 5;
export const API_PACKAGE_ID = "api";
export const RATE_LIMIT = 60;
export const RATE_WINDOW_SECONDS = 60;
export const API_PATH = "/dashboard/api";

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  ipAllowlist: string[];
  lastUsedAt: string | null;
  createdAt: string;
};
