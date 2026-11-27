"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { saveProfileAction } from "@/app/dashboard/profile/actions";
import { THEMES, type ProfileSettings, type Theme } from "@/lib/profile";
import { applyTheme } from "@/lib/theme";

const card = "rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5";
const input =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] disabled:opacity-60 dark:border-white/15 dark:bg-[#10262B] dark:focus-visible:ring-[#F2B632]";
const muted = "text-gray-600 dark:text-[#9FB3B7]";
const profilePrimary =
  "h-11 rounded-xl bg-[#F2B632] px-6 text-sm font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-[#F2B632] dark:focus-visible:ring-offset-[#0B1B1F]";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className={`mt-1 text-sm ${muted}`}>{hint}</p>}
      <div className="mt-3 divide-y divide-gray-200 dark:divide-white/10">{children}</div>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className={`block text-xs ${muted}`}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[#12343B] dark:accent-[#F2B632]"
      />
    </label>
  );
}

export function ProfileForm(props: {
  name: string;
  username: string | null;
  email: string;
  phone: string;
  verified: boolean | null;
  account: { bankName: string; accountNumber: string } | null;
  settings: ProfileSettings;
}) {
  const [phone, setPhone] = useState(props.phone);
  const [s, setS] = useState(props.settings);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) =>
    setS((previous) => ({ ...previous, [key]: value }));

  useEffect(() => applyTheme(props.settings.theme), [props.settings.theme]);

  function pickTheme(theme: Theme) {
    set("theme", theme);
    applyTheme(theme);
  }

  function save() {
    start(async () => {
      try {
        const result = await saveProfileAction({ phone, settings: s });
        if (result.ok) toast.success("Profile saved");
        else toast.error(result.error);
      } catch {
        toast.error("Could not save your profile. Try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="font-semibold">Your details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={`mb-1 block ${muted}`}>Name</span>
            <input className={input} value={props.name} disabled readOnly />
          </label>
          <label className="block text-sm">
            <span className={`mb-1 block ${muted}`}>Email</span>
            <input className={input} value={props.email} disabled readOnly />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className={`mb-1 block ${muted}`}>Phone number</span>
            <input
              className={input}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <span className={`mt-1 block text-xs ${muted}`}>Pre-filled when you buy airtime, data, cable TV or electricity.</span>
          </label>
        </div>
        <p className={`mt-3 text-xs ${muted}`}>
          Name and email come from your Spurs account{props.username ? ` (@${props.username})` : ""}. Change them there.
        </p>
      </section>

      <Section title="Identity and funding" hint="Your BVN is securely sent to our payment provider to create your permanent account. We never store it.">
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <span>Verification</span>
          <span className="font-medium">{props.verified === null ? "Not available" : props.verified ? "Verified" : "Not verified"}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <span>Permanent account</span>
          <span className="font-medium">{props.account ? `${props.account.bankName} · ${props.account.accountNumber}` : "Not created"}</span>
        </div>
        {!props.account && (
          <p className="py-3 text-sm">
            <a href="/fund-wallet" className="font-medium underline underline-offset-4">Set one up from Fund wallet</a>
          </p>
        )}
      </Section>

      <Section title="Notifications" hint="In-app notifications and security alerts are always on.">
        <Toggle label="Email" checked={s.notifyEmail} onChange={(value) => set("notifyEmail", value)} />
        <Toggle label="SMS" checked={s.notifySms} onChange={(value) => set("notifySms", value)} />
        <Toggle label="Push" checked={s.notifyPush} onChange={(value) => set("notifyPush", value)} />
        <Toggle label="Transaction updates" hint="Receipts and status changes." checked={s.notifyTransactions} onChange={(value) => set("notifyTransactions", value)} />
        <Toggle label="Offers and announcements" hint="Promotions and news from Spur VTU." checked={s.notifyPromotions} onChange={(value) => set("notifyPromotions", value)} />
      </Section>

      <Section title="Transactions">
        <Toggle label="Use cashback by default" hint="Ticks “Use cashback” for you at checkout." checked={s.useCashbackDefault} onChange={(value) => set("useCashbackDefault", value)} />
        <Toggle label="Confirm before buying" hint="Show a summary to confirm before payment." checked={s.confirmPurchases} onChange={(value) => set("confirmPurchases", value)} />
      </Section>

      <Section title="Login" hint="Your password and two-step verification are managed in your Spurs account.">
        <Toggle label="Login alerts" hint="Tell me when my account signs in." checked={s.loginAlerts} onChange={(value) => set("loginAlerts", value)} />
      </Section>

      <section className={card}>
        <h2 className="font-semibold">Theme</h2>
        <div role="radiogroup" aria-label="Theme" className="mt-3 flex gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={s.theme === theme}
              onClick={() => pickTheme(theme)}
              className={`h-10 rounded-xl border px-4 text-sm font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632] ${
                s.theme === theme
                  ? "border-[#F2B632] bg-[#F2B632] text-[#12343B] hover:bg-[#E5A720]"
                  : "border-gray-300 dark:border-white/15"
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className={profilePrimary}
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
