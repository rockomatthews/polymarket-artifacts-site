import { kv } from "@vercel/kv";
import { createPublicClient, http, decodeEventLog, type Hex } from "viem";

export const USDC_BASE =
  (process.env.USDC_BASE_ADDRESS as Hex | undefined) ||
  ("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Hex);

export const USDC_DECIMALS = 6;
export const CHAIN_ID_BASE = 8453;

export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function randomRef() {
  return (
    "ref_" +
    crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")
  );
}

export function quoteKey(reference: string) {
  return `pm_quote:${reference}`;
}

export type Quote = {
  reference: string;
  amountUnits: string; // USDC base units
  amountUsdc: string; // human
  recipient: string;
  expiresAt: number;
  skuId: string;
  status: "issued" | "consumed";
  txHash?: string;
  buyer?: string;
};

export async function saveQuote(q: Quote) {
  await kv.set(quoteKey(q.reference), q);
  await kv.expire(quoteKey(q.reference), 60 * 60); // 1h TTL
}

export async function loadQuote(reference: string): Promise<Quote | null> {
  return ((await kv.get(quoteKey(reference))) as Quote | null) || null;
}

export async function consumeQuote(reference: string, patch: Partial<Quote>) {
  const q = await loadQuote(reference);
  if (!q) return null;
  const next = { ...q, ...patch } as Quote;
  await saveQuote(next);
  return next;
}

const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

export async function verifyUsdcTransfer(opts: {
  txHash: Hex;
  expectedTo: Hex;
  expectedAmountUnits: bigint;
}) {
  const rpc = required("BASE_RPC_URL");
  const client = createPublicClient({ transport: http(rpc) });

  const receipt = await client.getTransactionReceipt({ hash: opts.txHash });
  if (!receipt) throw new Error("Transaction not found");

  // Find Transfer logs
  for (const log of receipt.logs) {
    if ((log.address as string).toLowerCase() !== USDC_BASE.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName !== "Transfer") continue;
      const from = String((decoded.args as any).from).toLowerCase();
      const to = String((decoded.args as any).to).toLowerCase();
      const value = BigInt((decoded.args as any).value);

      if (to === opts.expectedTo.toLowerCase() && value === opts.expectedAmountUnits) {
        return { ok: true, buyer: from, blockNumber: Number(receipt.blockNumber) };
      }
    } catch {
      // ignore
    }
  }

  return { ok: false };
}

export function signToken(payload: object, ttlSec: number) {
  const secret = required("ARTIFACTS_JWT_SECRET");
  const header = { alg: "HS256", typ: "JWT" };
  const exp = nowSec() + ttlSec;
  const body = { ...payload, exp };

  const enc = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(body)}`;
  const { createHmac } = require("node:crypto");
  const sig = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${sig}`;
}

export function verifyToken(token: string) {
  const secret = required("ARTIFACTS_JWT_SECRET");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Bad token");
  const [h, p, s] = parts;
  const unsigned = `${h}.${p}`;
  const { createHmac } = require("node:crypto");
  const sig = createHmac("sha256", secret).update(unsigned).digest("base64url");
  if (sig !== s) throw new Error("Bad signature");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  if (payload.exp && nowSec() > payload.exp) throw new Error("Expired");
  return payload;
}
