import { ImageResponse } from "next/og";
import { formatNaira } from "@/lib/format";
import { getReceipt } from "@/lib/db/receipts";
import { maskDetail, verifyReceiptToken } from "@/lib/receipt";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = verifyReceiptToken(token);
  const receipt = id ? await getReceipt(id, null) : null;
  if (!receipt || receipt.status !== "success" || receipt.direction !== "debit") {
    return new Response("Not found", { status: 404 });
  }

  const date = new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(receipt.at));
  const rows: [string, string][] = [
    ["Date", date],
    ["Sent to", maskDetail(receipt.detail)],
    ["Reference", receipt.id],
  ];
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#EEF3F4", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 520, background: "#fff", borderRadius: 24, padding: 40, color: "#12343B" }}>
          <div style={{ display: "flex", fontSize: 22, color: "#5B7176" }}>Spur VTU receipt</div>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 20 }}>{formatNaira(receipt.amount)}</div>
          <div style={{ display: "flex", fontSize: 26, marginTop: 6 }}>{receipt.title}</div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 14, color: "#1E8E4F" }}>Successful</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28, paddingTop: 24, borderTop: "2px dashed #B9C8CB" }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 20 }}>
                <div style={{ display: "flex", color: "#5B7176" }}>{label}</div>
                <div style={{ display: "flex", marginLeft: 24, textAlign: "right", fontSize: label === "Reference" ? 14 : 20 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 900,
      headers: {
        "Cache-Control": "private, max-age=3600",
        ...(download ? { "Content-Disposition": `attachment; filename="receipt-${receipt.id.slice(0, 8)}.png"` } : {}),
      },
    },
  );
}
