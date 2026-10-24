const TZ = "Africa/Lagos";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 });

export const formatNaira = (amount: number) => naira.format(amount);

export function greetingFor(date: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(date));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Saturday, 24 October" */
export function formatLongDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(date);
}

/** "October" */
export function monthName(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: TZ }).format(date);
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD

const count = new Intl.NumberFormat("en-NG");

/** 12840 -> "12,840" */
export const formatNumber = (n: number) => count.format(n);

/** "Today, 2:14 pm" / "Yesterday, 9:03 am" / "12 Oct, 4:40 pm" */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(d);
  if (dayKey(d) === dayKey(now)) return `Today, ${time}`;
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return `Yesterday, ${time}`;
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(d);
  return `${date}, ${time}`;
}