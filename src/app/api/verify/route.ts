import { NextRequest, NextResponse } from "next/server";
import { consumeQuote, loadQuote, required, signToken, verifyUsdcTransfer } from "../_lib";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Bad JSON" }, { status: 400 });

    const reference = String(body.reference || "").trim();
    const txHash = String(body.txHash || "").trim();
    if (!reference || !txHash) {
      return NextResponse.json({ error: "Missing reference/txHash" }, { status: 400 });
    }

    const q = await loadQuote(reference);
    if (!q) return NextResponse.json({ error: "Unknown reference" }, { status: 404 });

    const merchant = required("MERCHANT_BASE_ADDRESS").toLowerCase();
    if (q.recipient.toLowerCase() !== merchant) {
      return NextResponse.json({ error: "Recipient mismatch" }, { status: 400 });
    }

    if (q.status === "consumed" && q.txHash === txHash) {
      const downloadToken = signToken({ reference }, 60 * 20);
      return NextResponse.json({ ok: true, alreadyVerified: true, downloadToken });
    }
    if (q.status === "consumed") {
      return NextResponse.json({ error: "Reference already used" }, { status: 409 });
    }

    const v = await verifyUsdcTransfer({
      txHash: txHash as any,
      expectedTo: q.recipient as any,
      expectedAmountUnits: BigInt(q.amountUnits),
    });

    if (!v.ok) {
      return NextResponse.json({ error: "Payment not found (check chain/token/amount)" }, { status: 400 });
    }

    await consumeQuote(reference, { status: "consumed", txHash, buyer: v.buyer });

    const downloadToken = signToken({ reference }, 60 * 20);
    return NextResponse.json({ ok: true, downloadToken });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
