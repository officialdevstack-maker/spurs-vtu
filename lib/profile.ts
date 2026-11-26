export const PROFILE_PATH = "/dashboard/profile";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export type ProfileSettings = {
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  notifyTransactions: boolean;
  notifyPromotions: boolean;
  loginAlerts: boolean;
  useCashbackDefault: boolean;
  confirmPurchases: boolean;
  theme: Theme;
};

export const DEFAULT_SETTINGS: ProfileSettings = {
  notifyEmail: true,
  notifySms: true,
  notifyPush: true,
  notifyTransactions: true,
  notifyPromotions: true,
  loginAlerts: true,
  useCashbackDefault: false,
  confirmPurchases: true,
  theme: "system",
};

export const isTheme = (value: unknown): value is Theme => THEMES.some((theme) => theme === value);

export function parseSettings(input: unknown): ProfileSettings | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ProfileSettings)[]) {
    if (key === "theme") {
      if (!isTheme(raw.theme)) return null;
      out.theme = raw.theme;
    } else if (typeof raw[key] !== "boolean") {
      return null;
    } else {
      out[key] = raw[key];
    }
  }
  return out;
}
