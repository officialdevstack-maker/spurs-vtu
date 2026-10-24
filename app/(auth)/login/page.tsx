import type { Metadata } from "next";
import { SpursSignInButton } from "@spurs-cloud/accounts/react";

export const metadata: Metadata = {
  title: "Log in | Spur VTU",
  description: "Log in to Spur VTU with your Spurs account.",
};

/**
 * Palette
 *   petrol   #12343B  ink and the left panel
 *   mist     #EEF3F4  page background
 *   paper    #F7F8F3  receipt paper
 *   marigold #F2B632  the one warm accent: logo tile, primary button, status dot
 *   coral    #C8432B  errors only
 */

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-lg bg-[#F2B632] font-[family-name:var(--font-display)] text-lg font-bold text-[#12343B]"
      >
        S
      </span>
      <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">Spur VTU</span>
    </div>
  );
}

/** Decorative sample receipt. Hidden from assistive tech: it is not real data. */
function Receipt() {
  return (
    <div aria-hidden="true" className="w-full max-w-xs -rotate-2 text-[#12343B]">
      <div className="rounded-t-2xl bg-[#F7F8F3] px-7 pb-5 pt-7">
        <p className="text-sm text-[#5B7176]">Top-up receipt</p>
        <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums">₦1,000</p>
        <p className="mt-1 text-base font-medium">2GB data bundle</p>

        <dl className="mt-6 space-y-3 border-t border-dashed border-[#B9C8CB] pt-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#5B7176]">Sent to</dt>
            <dd className="font-medium tabular-nums">0803 000 0000</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#5B7176]">Paid from</dt>
            <dd className="font-medium">Wallet</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#5B7176]">Status</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span className="size-2 rounded-full bg-[#F2B632]" />
              Delivered in 4s
            </dd>
          </div>
        </dl>
      </div>
      {/* Torn bottom edge */}
      <svg width="100%" height="10" className="block">
        <defs>
          <pattern id="receipt-teeth" width="16" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 0H16L8 10Z" fill="#F7F8F3" />
          </pattern>
        </defs>
        <rect width="100%" height="10" fill="url(#receipt-teeth)" />
      </svg>
    </div>
  );
}

// Edit to match what Spur VTU sells. `returnTo` is where the person lands after logging in.
const SERVICES = [
  { name: "Airtime", text: "Top up any line", returnTo: "/airtime" },
  { name: "Data bundles", text: "Plans for every network", returnTo: "/data" },
  { name: "Electricity", text: "Prepaid and postpaid meters", returnTo: "/electricity" },
  { name: "Cable TV", text: "Renew a subscription", returnTo: "/cable-tv" },
];

const FOOTER_LINKS = [
  { href: "/help", label: "Help" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export default function LoginPage() {
  return (
    <main
      className="min-h-dvh bg-[#EEF3F4] text-[#12343B] lg:grid lg:grid-cols-[5fr_6fr]"
    >
      <aside className="hidden flex-col justify-between bg-[#12343B] p-12 text-[#EEF3F4] lg:flex">
        <Wordmark />

        <div>
          <h2 className="max-w-md font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight">
            Airtime, data and bills, paid before you look away.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-[#B9C8CB]">
            Fund your wallet once, then top up any line in a few taps.
          </p>
          <div className="mt-12">
            <Receipt />
          </div>
        </div>

        <p className="text-sm text-[#8FA5A9]">© {new Date().getFullYear()} Spur VTU</p>
      </aside>

      <section className="flex min-h-dvh flex-col px-6 py-8 sm:px-12 lg:px-16 lg:py-10">
        <Wordmark className="mb-12 lg:hidden" />
        <div className="hidden justify-end lg:flex">
          <a
            href="/help"
            className="rounded text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B]/40"
          >
            Need help?
          </a>
        </div>

        <div className="w-full max-w-md lg:mx-auto lg:my-auto lg:py-10">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-base leading-relaxed text-[#3C5257]">
            Log in to top up, pay bills and check your wallet.
          </p>

          {/* Style props win over the component's inline defaults. */}
          <div className="mt-8">
            <SpursSignInButton
                issuer={process.env.SPURS_ISSUER}
              returnTo="/dashboard"
              style={{
                width: "100%",
                justifyContent: "center",
                height: 52,
                padding: "0 16px",
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
                background: "#F2B632",
                color: "#12343B",
              }}
            >
              Log in with Spurs
            </SpursSignInButton>
          </div>

        
        </div>

        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#3C5257] lg:mt-0 lg:justify-center">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#12343B]/40"
            >
              {link.label}
            </a>
          ))}
        </footer>
      </section>
    </main>
  );
}