import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CODE } from "@/lib/admin/referrals";
import { spurs } from "@/lib/spurs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const origin = process.env.APP_URL?.trim() || request.nextUrl.origin;
  const response = NextResponse.redirect(new URL(spurs.signInUrl("/dashboard"), origin));
  if (REFERRAL_CODE.test(code)) {
    response.cookies.set("ref", code, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https:"),
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
  }
  return response;
}
