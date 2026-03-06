export async function fetchBtcSpotUsd() {
  // Coinbase public endpoint
  const res = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`spot fetch failed: ${res.status}`);
  const j: any = await res.json();
  const price = Number(j?.data?.amount);
  if (!Number.isFinite(price) || price <= 0) throw new Error("bad spot price");
  return { ts: Date.now(), price };
}
