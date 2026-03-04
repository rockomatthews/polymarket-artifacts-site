import { NextResponse } from "next/server";
import { nowSec, randomRef, required, saveQuote, type Quote } from "../_lib";

export async function GET() {
  try {
    const recipient = required("MERCHANT_BASE_ADDRESS");

    // $5 USDC
    const amountUnits = "5000000";
    const amountUsdc = "5.00";

    const reference = randomRef();
    const expiresAt = nowSec() + 15 * 60;

    const q: Quote = {
      reference,
      amountUnits,
      amountUsdc,
      recipient,
      expiresAt,
      skuId: "polymarket_edge_snapshot_btc_5m",
      status: "issued",
    };

    await saveQuote(q);

    return NextResponse.json({
      reference,
      amountUnits,
      amountUsdc,
      recipient,
      expiresAt,
      chainId: 8453,
      token: {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
