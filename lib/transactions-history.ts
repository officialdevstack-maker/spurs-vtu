import type { TxService, TxStatus } from "@/lib/dashboard-data";

export const HISTORY_PAGE_SIZE = 20;

export const STATUS_OPTIONS: { id: TxStatus | "all"; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "success", label: "Successful" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
];

export const SERVICE_OPTIONS: { id: TxService | "all"; label: string }[] = [
  { id: "all", label: "All services" },
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "electricity", label: "Electricity" },
  { id: "wallet", label: "Wallet" },
];

export type HistoryParams = {
  q?: string | string[];
  status?: string | string[];
  service?: string | string[];
  page?: string | string[];
};

export type HistoryQuery = {
  query: string;
  status: TxStatus | "all";
  service: TxService | "all";
  page: number;
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export function parseHistoryParams(params: HistoryParams): HistoryQuery {
  const status = single(params.status);
  const service = single(params.service);
  const page = Number.parseInt(single(params.page), 10);
  return {
    query: single(params.q).trim().slice(0, 100),
    status: STATUS_OPTIONS.some((o) => o.id === status) ? (status as HistoryQuery["status"]) : "all",
    service: SERVICE_OPTIONS.some((o) => o.id === service) ? (service as HistoryQuery["service"]) : "all",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function historyHref(basePath: string, q: HistoryQuery, page: number): string {
  const params = new URLSearchParams();
  if (q.query) params.set("q", q.query);
  if (q.status !== "all") params.set("status", q.status);
  if (q.service !== "all") params.set("service", q.service);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
