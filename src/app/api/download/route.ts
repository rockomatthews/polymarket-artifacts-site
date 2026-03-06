import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { loadQuote, verifyToken } from "../_lib";
import { autoPickBtcMarkets, bestAsk, fetchBook } from "../_polymarket";
import { fetchBtcSpotUsd } from "../_spot";
import { evaluateMarket } from "../_sieve";

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

    // Generate a real snapshot bundle at download time.
    const zip = new JSZip();

    const spot = await fetchBtcSpotUsd();
    const sigmaAnn = Number(process.env.SIGMA_FALLBACK || "0.8");

    const markets = await autoPickBtcMarkets(Number(process.env.MARKET_COUNT || "40"));

    const opps: any[] = [];
    for (const m of markets) {
      const yes = m.tokens.find((t) => t.outcome.toUpperCase() === "YES");
      const no = m.tokens.find((t) => t.outcome.toUpperCase() === "NO");
      if (!yes || !no) continue;

      const [yesBook, noBook] = await Promise.all([fetchBook(yes.token_id), fetchBook(no.token_id)]);
      const yesAsk = bestAsk(yesBook)?.price ?? null;
      const noAsk = bestAsk(noBook)?.price ?? null;

      const opp = evaluateMarket({
        market: m,
        yesAsk,
        noAsk,
        spot: spot.price,
        sigmaAnn,
        nowMs: Date.now(),
      });
      if (opp) {
        opps.push({
          ...opp,
          yesAsk,
          noAsk,
          marketSlug: m.market_slug,
        });
      }
    }

    opps.sort((a, b) => b.edgeNet - a.edgeNet);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      skuId: q.skuId,
      reference: q.reference,
      spot,
      sigmaAnn,
      top: opps.slice(0, 10),
      note:
        "This is a snapshot derived from current Polymarket books + a simple fair-prob model (vol fallback). Treat as informational, not financial advice.",
    };

    const receipt = {
      reference: q.reference,
      amountUsdc: q.amountUsdc,
      recipient: q.recipient,
      buyer: q.buyer,
      txHash: q.txHash,
      fulfilledAt: new Date().toISOString(),
    };

    zip.file(
      "README.txt",
      [
        "Polymarket Edge Snapshot Pack",
        "",
        "Files:",
        "- receipt.json  (payment receipt)",
        "- snapshot.json (ranked opportunities + model inputs)",
        "",
        "Notes:",
        "- Uses current orderbooks + BTC spot.",
        "- Sigma is a fallback constant until we add rolling realized vol inside the service.",
      ].join("\n")
    );
    zip.file("receipt.json", JSON.stringify(receipt, null, 2));
    zip.file("snapshot.json", JSON.stringify(snapshot, null, 2));

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
