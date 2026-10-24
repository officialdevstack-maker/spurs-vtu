import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Check,
  Clock,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Tv,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AuthButton, AuthButtonFallback } from "@/components/landing/auth-button";

export const metadata: Metadata = {
  title: "Spur VTU | Airtime, data and bills in seconds",
  description:
    "Fund your wallet once, then buy airtime, data, cable TV and electricity in a few taps. Instant delivery and automatic refunds.",
};

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#packages", label: "Packages" },
  { href: "#faq", label: "FAQ" },
];

const SERVICES: { name: string; text: string; icon: LucideIcon }[] = [
  { name: "Airtime", text: "Top up any line on any network.", icon: Smartphone },
  { name: "Data bundles", text: "Plans for every network and budget.", icon: Wifi },
  { name: "Cable TV", text: "Renew your subscription without leaving home.", icon: Tv },
  { name: "Electricity", text: "Prepaid and postpaid meter tokens.", icon: Zap },
];

const STEPS = [
  { title: "Create your account", text: "Sign up with Spurs in a minute. Verify once to get your funding account number." },
  { title: "Fund your wallet", text: "Transfer to your account number and your balance updates automatically." },
  { title: "Buy what you need", text: "Pick a service, confirm, and it is delivered. Every purchase shows in your history." },
];

const BENEFITS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Fast delivery", text: "Most orders are delivered in seconds, and you can see the status of each one.", icon: Clock },
  { title: "Automatic refunds", text: "If a network can't deliver, the money goes straight back to your wallet.", icon: RotateCcw },
  { title: "One wallet", text: "Fund once and pay for airtime, data, TV and power from the same balance.", icon: Wallet },
  { title: "Secure sign-in", text: "Your account is protected by Spurs, so you never share your password with us.", icon: ShieldCheck },
];

const PACKAGES = [
  {
    name: "Basic",
    text: "Standard rates on every service. Everyone starts here.",
    perks: ["Airtime, data, TV and power", "Instant delivery", "Automatic refunds"],
    featured: false,
  },
  {
    name: "Agent",
    text: "Lower rates for people who sell to others.",
    perks: ["Everything in Basic", "Lower prices on data plans", "Built for resellers"],
    featured: true,
  },
  {
    name: "API",
    text: "For developers and resellers who buy through the API.",
    perks: ["Everything in Basic", "Buy from your own app", "Package pricing applies"],
    featured: false,
  },
];

const FAQS = [
  {
    q: "How do I fund my wallet?",
    a: "Verify your account, then transfer to the funding account number shown in your dashboard. Your balance updates once the transfer lands.",
  },
  {
    q: "What happens if a purchase fails?",
    a: "If the network rejects the order, we return the money to your wallet automatically. If the network is still confirming, your payment is held and the status updates in your history.",
  },
  {
    q: "Which networks do you support?",
    a: "You can see the networks and plans that are available right now when you open the buy page. They can change as networks switch services on or off.",
  },
  {
    q: "Do I pay different prices on different packages?",
    a: "Yes. Each package can have its own price on a plan. You always see the price for your package before you pay.",
  },
  {
    q: "Is there a fee to sign up?",
    a: "No. Creating an account is free, and the Basic package has no upgrade fee.",
  },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#12343B] dark:focus-visible:ring-[#F2B632]";

function Wordmark() {
  return (
    <Link href="/" className={`flex items-center gap-3 rounded-lg ${focusRing}`} aria-label="Spur VTU home">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-lg bg-[#F2B632] font-[family-name:var(--font-display)] text-lg font-bold text-[#12343B]"
      >
        S
      </span>
      <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">Spur VTU</span>
    </Link>
  );
}

function Receipt() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-xs rotate-2 text-[#12343B]">
      <div className="rounded-t-2xl bg-[#F7F8F3] px-7 pb-5 pt-7 shadow-xl">
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
      <svg width="100%" height="10" className="block">
        <defs>
          <pattern id="landing-receipt-teeth" width="16" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 0H16L8 10Z" fill="#F7F8F3" />
          </pattern>
        </defs>
        <rect width="100%" height="10" fill="url(#landing-receipt-teeth)" />
      </svg>
    </div>
  );
}

function SectionHeading({ id, title, text }: { id: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {text && <p className="mt-3 text-base leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{text}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-white text-[#12343B] dark:bg-[#0B1B1F] dark:text-[#EEF3F4]">
      <a
        href="#main"
        className="sr-only rounded-lg bg-[#F2B632] px-4 py-2 font-semibold text-[#12343B] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#0B1B1F]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Wordmark />

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-[15px] font-medium text-gray-600 transition-colors hover:text-[#12343B] dark:text-[#9FB3B7] dark:hover:text-white ${focusRing}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={`hidden rounded-lg px-3 py-2 text-sm font-semibold underline-offset-4 hover:underline sm:inline-block ${focusRing}`}
            >
              Log in
            </Link>
            <Suspense fallback={<AuthButtonFallback compact />}>
              <AuthButton compact label="Get started" />
            </Suspense>
          </div>
        </div>
      </header>

      <main id="main">
        <section aria-labelledby="hero-heading" className="bg-[#12343B] text-[#EEF3F4]">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:px-8 lg:py-28">
            <div>
              <h1
                id="hero-heading"
                className="font-[family-name:var(--font-display)] text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
              >
                Airtime, data and bills, paid before you look away.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#B9C8CB]">
                Fund your wallet once, then top up any line, renew your TV and buy electricity in a few taps.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Suspense fallback={<AuthButtonFallback label="Create free account" />}>
                  <AuthButton label="Create free account" />
                </Suspense>
                <a
                  href="#how-it-works"
                  className="inline-flex h-[52px] items-center justify-center rounded-xl border border-white/25 px-6 text-base font-semibold text-[#EEF3F4] outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#F2B632]"
                >
                  See how it works
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#B9C8CB]">
                {[
                  "Free to join",
                  "Instant delivery",
                  "Automatic refunds",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="size-4 text-[#4CC38A]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Receipt />
          </div>
        </section>

        <section id="services" aria-labelledby="services-heading" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              id="services-heading"
              title="Everything you top up, in one place"
              text="Pay for the things you buy every week from a single wallet."
            />
            <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map(({ name, text, icon: Icon }) => (
                <li key={name} className="bg-white p-6 dark:bg-[#0B1B1F]">
                  <span className="grid size-11 place-items-center rounded-full bg-gray-100 text-[#12343B] dark:bg-white/10 dark:text-[#EEF3F4]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold">{name}</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-[#9FB3B7]">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="scroll-mt-16 border-y border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-[#10262B]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading id="how-heading" title="Up and running in three steps" />
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F2B632] font-[family-name:var(--font-display)] font-bold text-[#12343B]"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="why-heading">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading id="why-heading" title="Built so you can trust every purchase" />
            <ul className="mt-10 grid gap-8 sm:grid-cols-2">
              {BENEFITS.map(({ title, text, icon: Icon }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gray-100 text-[#1E8E4F] dark:bg-white/10 dark:text-[#4CC38A]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="packages"
          aria-labelledby="packages-heading"
          className="scroll-mt-16 border-y border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-[#10262B]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              id="packages-heading"
              title="Pay less as you grow"
              text="Start on Basic. Upgrade from your dashboard when you want lower rates."
            />
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {PACKAGES.map((pkg) => (
                <li
                  key={pkg.name}
                  className={`flex flex-col rounded-2xl border p-6 ${
                    pkg.featured
                      ? "border-[#12343B] bg-white ring-1 ring-[#12343B] dark:border-[#F2B632] dark:bg-white/5 dark:ring-[#F2B632]"
                      : "border-gray-200 bg-white dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-[family-name:var(--font-display)] text-xl font-bold">{pkg.name}</h3>
                    {pkg.featured && (
                      <span className="rounded-md bg-[#F2B632] px-2 py-0.5 text-xs font-semibold text-[#12343B]">
                        Lower rates
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-[#9FB3B7]">{pkg.text}</p>
                  <ul className="mt-5 space-y-2.5">
                    {pkg.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#1E8E4F] dark:text-[#4CC38A]" aria-hidden="true" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading id="faq-heading" title="Questions, answered" />
            <div className="mt-8 divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
              {FAQS.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary
                    className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}
                  >
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-xl leading-none text-gray-500 transition-transform group-open:rotate-45 motion-reduce:transition-none dark:text-[#9FB3B7]"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-[#9FB3B7]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="bg-[#12343B] text-[#EEF3F4]">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div>
              <h2
                id="cta-heading"
                className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight"
              >
                Ready for your first top-up?
              </h2>
              <p className="mt-2 text-base text-[#B9C8CB]">Create your account in a minute. It's free.</p>
            </div>
            <Suspense fallback={<AuthButtonFallback label="Create free account" />}>
              <AuthButton label="Create free account" />
            </Suspense>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-gray-600 dark:text-[#9FB3B7] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© Spur VTU</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { href: "/help", label: "Help" },
              { href: "/terms", label: "Terms" },
              { href: "/privacy", label: "Privacy" },
              { href: "/login", label: "Log in" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded underline-offset-4 hover:underline ${focusRing}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
