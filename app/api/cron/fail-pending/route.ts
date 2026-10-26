import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAutoFailMinutes } from "@/lib/db/webhooks";
import { failPending } from "@/lib/settlement";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "CRON_SECRET is missing or too short" }, { status: 503 });
  }

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const minutes = await getAutoFailMinutes();
    if (minutes === 0) {
      return NextResponse.json(
        { skipped: true, reason: "Auto-fail is off." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const report = await failPending(minutes, "No confirmation from the provider in time.");
    return NextResponse.json(
      { skipped: false, minutes, ...report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[cron] Could not fail pending transactions", error);
    return NextResponse.json({ error: "Could not process pending transactions" }, { status: 500 });
  }
}
