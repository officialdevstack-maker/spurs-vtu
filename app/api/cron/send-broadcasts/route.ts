import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processBroadcast } from "@/lib/broadcast";
import { listSendingBroadcastIds } from "@/lib/db/announcements";

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
    const ids = await listSendingBroadcastIds();
    for (const id of ids) await processBroadcast(id, 20_000);
    return NextResponse.json({ checked: ids.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron] Could not process broadcasts", error);
    return NextResponse.json({ error: "Could not process broadcasts" }, { status: 500 });
  }
}
