"use client";

import { useMemo, useState } from "react";

export default function HomePage() {
  const [reference, setReference] = useState<string>("");
  const [quote, setQuote] = useState<any>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [downloadToken, setDownloadToken] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const payAmount = useMemo(() => quote?.amountUsdc || null, [quote]);
  const payTo = useMemo(() => quote?.recipient || null, [quote]);

  async function getQuote() {
    setStatus("Generating quote...");
    const res = await fetch("/api/quote");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(json.error || "Quote failed");
      return;
    }
    setQuote(json);
    setReference(json.reference);
    setStatus("Quote ready. Pay, then paste txHash.");
  }

  async function verify() {
    setStatus("Verifying payment...");
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference, txHash }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(json.error || "Verify failed");
      return;
    }
    setDownloadToken(json.downloadToken);
    setStatus("Payment verified. Download ready.");
  }

  async function download() {
    setStatus("Downloading...");
    const res = await fetch(`/api/download?reference=${encodeURIComponent(reference)}`, {
      headers: { authorization: `Bearer ${downloadToken}` },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setStatus(json.error || `Download failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polymarket-artifact-${reference}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Downloaded.");
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Polymarket Edge Snapshot (BTC 5m)</h1>
      <p style={{ opacity: 0.8 }}>
        Pay <b>$5 USDC</b> on <b>Base</b>, paste your txHash, and download a timestamped artifact bundle.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={getQuote} style={{ padding: "10px 14px" }}>
          Get quote
        </button>
        {status ? <span style={{ opacity: 0.85 }}>{status}</span> : null}
      </div>

      {quote ? (
        <div style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}>Payment details</h3>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular", fontSize: 13 }}>
            <div>Reference: {reference}</div>
            <div>Amount: {payAmount} USDC</div>
            <div>To: {payTo}</div>
            <div>Chain: Base (8453)</div>
            <div>Expires: {new Date(quote.expiresAt * 1000).toLocaleString()}</div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>Verify</h3>
        <input
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="Paste txHash (0x...)"
          style={{ width: "100%", padding: 10, fontFamily: "ui-monospace, SFMono-Regular" }}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={verify} style={{ padding: "10px 14px" }} disabled={!reference || !txHash}>
            Verify payment
          </button>
          <button
            onClick={download}
            style={{ padding: "10px 14px" }}
            disabled={!downloadToken || !reference}
          >
            Download ZIP
          </button>
        </div>
      </div>

      <p style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
        No refunds for wrong-chain/wrong-token payments. If you paid correctly and verification fails, contact support with your
        txHash.
      </p>
    </main>
  );
}
