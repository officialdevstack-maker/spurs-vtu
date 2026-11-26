import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CODE } from "@/lib/admin/referrals";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.toUpperCase();
  const response = NextResponse.redirect(new URL("/login", process.env.APP_URL ?? request.url));
  if (REFERRAL_CODE.test(normalized)) {
    response.cookies.set("ref", normalized, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
