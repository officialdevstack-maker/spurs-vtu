const TZ = "Africa/Lagos";
const MAX_DAYS = 366;
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD

export type ReportParams = { from?: string | string[]; to?: string | string[] };
export type ReportRange = { from: string; to: string };

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

const valid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const todayInLagos = () => dayFormat.format(new Date());

/** Defaults to the start of this month through today. Swaps a reversed range and caps it at a year. */
export function parseReportRange(params: ReportParams): ReportRange {
  const today = todayInLagos();
  const rawFrom = single(params.from);
  const rawTo = single(params.to);
  let from = valid(rawFrom) ? rawFrom : `${today.slice(0, 8)}01`;
  let to = valid(rawTo) ? rawTo : today;
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -(MAX_DAYS - 1))) from = addDays(to, -(MAX_DAYS - 1));
  return { from, to };
}

export function presetRanges(): { label: string; from: string; to: string }[] {
  const today = todayInLagos();
  return [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "This month", from: `${today.slice(0, 8)}01`, to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
  ];
}

export const reportHref = (basePath: string, range: ReportRange) =>
  `${basePath}?from=${range.from}&to=${range.to}`;

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}
