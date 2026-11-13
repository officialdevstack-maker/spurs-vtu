import { NextResponse } from "next/server";

const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GET() {
  const workspaceId = process.env.SPURS_BUSINESS_WORKSPACE_ID;
  const token = process.env.SPURS_BUSINESS_VERIFY_TOKEN;
  if (!workspaceId || !WORKSPACE_ID.test(workspaceId) || !token) {
    return NextResponse.json(
      { error: "VTU site verification is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { workspaceId, token },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
