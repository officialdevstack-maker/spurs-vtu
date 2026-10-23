"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { SpursSignInButton } from "@spurs-cloud/accounts/react";
import { loginAction } from "./actions";

type Errors = { phone?: string; password?: string; form?: string };

/** Keep digits only, turn a pasted +234 / 234 number into 0XXXXXXXXXX, cap at 11 digits. */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length > 3) digits = "0" + digits.slice(3);
  return digits.slice(0, 11);
}

/** 08031234567 -> 0803 123 4567 */
function groupPhone(digits: string): string {
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(" ");
}

const PHONE_PATTERN = /^0[789][01]\d{8}$/;

const inputBase =
  "h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-colors placeholder:text-[#7C9195] focus-visible:border-[#12343B] focus-visible:ring-2 focus-visible:ring-[#12343B]/25";
const inputOk = "border-[#BFCFD2]";
const inputBad = "border-[#C8432B]";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [phone, setPhone] = useState(""); // digits only
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const phoneRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const phoneErrId = `${ids}-phone-err`;
  const passwordErrId = `${ids}-password-err`;

  function validate(): Errors {
    const next: Errors = {};
    if (!PHONE_PATTERN.test(phone)) next.phone = "Enter your 11-digit phone number, like 0803 123 4567.";
    if (!password) next.password = "Enter your password.";
    return next;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    const found = validate();
    setErrors(found);
    if (found.phone) return phoneRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    startTransition(async () => {
      const result = await loginAction({ phone, password });
      if (result.ok) {
        router.replace(result.redirectTo);
        return;
      }
      setErrors({ [result.field ?? "form"]: result.error });
      (result.field === "password" ? passwordRef : phoneRef).current?.focus();
    });
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Log in</h1>
      <p className="mt-2 text-base text-[#3C5257]">Use your phone number and password to open your wallet.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {errors.form && (
          <p role="alert" className="rounded-xl border border-[#C8432B] bg-white px-4 py-3 text-sm text-[#C8432B]">
            {errors.form}
          </p>
        )}

        <div>
          <label htmlFor={`${ids}-phone`} className="mb-2 block text-sm font-medium">
            Phone number
          </label>
          <input
            ref={phoneRef}
            id={`${ids}-phone`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="username"
            placeholder="0803 123 4567"
            value={groupPhone(phone)}
            onChange={(e) => {
              setPhone(normalizePhone(e.target.value));
              if (errors.phone) setErrors((p) => ({ ...p, phone: undefined }));
            }}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? phoneErrId : undefined}
            className={`${inputBase} tabular-nums ${errors.phone ? inputBad : inputOk}`}
          />
          {errors.phone && (
            <p id={phoneErrId} role="alert" className="mt-2 text-sm text-[#C8432B]">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor={`${ids}-password`} className="text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="rounded text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B]/40"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              ref={passwordRef}
              id={`${ids}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? passwordErrId : undefined}
              className={`${inputBase} pr-16 ${errors.password ? inputBad : inputOk}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 rounded-r-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#12343B]/40"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p id={passwordErrId} role="alert" className="mt-2 text-sm text-[#C8432B]">
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-xl bg-[#F2B632] text-base font-semibold text-[#12343B] outline-none transition-colors hover:bg-[#E5A720] focus-visible:ring-2 focus-visible:ring-[#12343B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EEF3F4] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4 text-sm text-[#5B7176]">
        <span className="h-px flex-1 bg-[#CBD8DA]" />
        or
        <span className="h-px flex-1 bg-[#CBD8DA]" />
      </div>

      {/* Style props win over the component's inline defaults. */}
      <SpursSignInButton
        returnTo="/dashboard"
        style={{
          width: "100%",
          justifyContent: "center",
          height: 48,
          padding: "0 16px",
          fontSize: 16,
          borderRadius: 12,
          background: "#ffffff",
          color: "#12343B",
          border: "1px solid #BFCFD2",
        }}
      >
        Continue with Spurs
      </SpursSignInButton>

      <p className="mt-8 text-sm text-[#3C5257]">
        New to Spur VTU?{" "}
        <Link
          href="/register"
          className="rounded font-semibold text-[#12343B] underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#12343B]/40"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}