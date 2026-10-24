/** Normalize Nigerian phone numbers pasted with spaces, punctuation, or a +234 prefix. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length > 3) digits = `0${digits.slice(3)}`;
  return digits.slice(0, 11);
}

export function groupPhone(digits: string): string {
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(" ");
}

export const PHONE_PATTERN = /^0[789][01]\d{8}$/;
