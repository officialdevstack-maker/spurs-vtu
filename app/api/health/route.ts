import { checkDatabaseConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await checkDatabaseConnection();
    return NextResponse.json({ ok: true, status: "healthy" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] Database unavailable", error);
    return NextResponse.json({ ok: false, status: "unhealthy" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
