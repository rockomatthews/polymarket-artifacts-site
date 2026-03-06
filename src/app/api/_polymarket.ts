export type Market = {
  question: string;
  market_slug: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  enable_order_book: boolean;
  end_date_iso?: string;
  maker_base_fee: number;
  taker_base_fee: number;
  tokens: Array<{ token_id: string; outcome: string; price: number }>;
};

export type MarketsResponse = { data: Market[]; next_cursor?: string };

export type BookLevel = { price: string; size: string };
export type Book = { bids: BookLevel[]; asks: BookLevel[] };

export function clobHost() {
  return process.env.CLOB_HOST || "https://clob.polymarket.com";
}

export async function fetchMarkets(limit = 200, cursor?: string): Promise<MarketsResponse> {
  const url = new URL("/markets", clobHost());
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("next_cursor", cursor);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`markets fetch failed: ${res.status}`);
  return (await res.json()) as MarketsResponse;
}

export async function fetchBook(tokenId: string): Promise<Book> {
  const url = new URL("/book", clobHost());
  url.searchParams.set("token_id", tokenId);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`book fetch failed: ${res.status}`);
  return (await res.json()) as Book;
}

export function bestAsk(book: Book): { price: number; size: number } | null {
  const top = book.asks?.[0];
  if (!top) return null;
  return { price: Number(top.price), size: Number(top.size) };
}

export function bestBid(book: Book): { price: number; size: number } | null {
  const top = book.bids?.[0];
  if (!top) return null;
  return { price: Number(top.price), size: Number(top.size) };
}

export function isLikelyBtc5MinQuestion(question: string) {
  const q = (question || "").toLowerCase();
  if (!q.includes("btc") && !q.includes("bitcoin")) return false;
  // 5-min markets usually mention a time and a strike
  if (!q.includes(" at ")) return false;
  if (!q.includes("$") && !q.match(/\b\d{2,3},\d{3}\b/)) return false;
  if (!(q.includes("above") || q.includes("below") || q.includes("over") || q.includes("under"))) return false;
  return true;
}

export async function autoPickBtcMarkets(targetCount = 25) {
  const picked: Market[] = [];
  let cursor: string | undefined;

  for (let i = 0; i < 25 && picked.length < targetCount; i++) {
    const page = await fetchMarkets(200, cursor);
    cursor = page.next_cursor;

    for (const m of page.data) {
      if (picked.length >= targetCount) break;
      if (!m.active || m.closed || m.archived) continue;
      if (!m.accepting_orders || !m.enable_order_book) continue;
      if (!m.tokens || m.tokens.length !== 2) continue;
      if (!isLikelyBtc5MinQuestion(m.question)) continue;
      picked.push(m);
    }

    if (!cursor) break;
  }

  return picked;
}
