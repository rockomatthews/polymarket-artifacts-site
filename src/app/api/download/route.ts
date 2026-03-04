import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { loadQuote, verifyToken } from "../_lib";

export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get("reference") || "";
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = verifyToken(token);
    if (payload.reference !== reference) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = await loadQuote(reference);
    if (!q || q.status !== "consumed") {
      return NextResponse.json({ error: "Not paid" }, { status: 402 });
    }

    // MVP: always-deliverable artifact bundle.
    const zip = new JSZip();
    const meta = {
      skuId: q.skuId,
      reference: q.reference,
      amountUsdc: q.amountUsdc,
      recipient: q.recipient,
      buyer: q.buyer,
      txHash: q.txHash,
      generatedAt: new Date().toISOString(),
      note: "MVP bundle. Next iteration will include Polymarket orderbook series + charts + edge window table.",
    };

    zip.file("README.txt", "Polymarket Edge Snapshot Pack (MVP)\n\nThis is a timestamped purchase receipt + bundle container.\n\nNext: include real orderbook snapshots and derived metrics.\n");
    zip.file("meta.json", JSON.stringify(meta, null, 2));

    const bytes = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename=polymarket-artifact-${reference}.zip`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
