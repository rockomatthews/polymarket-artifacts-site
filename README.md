# polymarket-artifacts-site

Public purchase + fulfillment site for **$5 Base USDC** pay-per-download artifacts.

## Env vars (Vercel)
Required:
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Redis/KV integration)
- `BASE_RPC_URL`
- `MERCHANT_BASE_ADDRESS` (Base address that receives USDC)
- `ARTIFACTS_JWT_SECRET` (random string)

Optional:
- `USDC_BASE_ADDRESS` (defaults to 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

## Flow
- `GET /api/quote` → returns `{ reference, amount, recipient, expiresAt }`
- User pays USDC transfer on Base to `recipient` for `amount`
- `POST /api/verify` with `{ reference, txHash }` → verifies receipt, returns `downloadToken`
- `GET /api/download?reference=...` with `Authorization: Bearer <downloadToken>` → returns a ZIP

## Notes
- MVP artifact is a timestamped snapshot bundle (JSON + README) so delivery always works.
- We can upgrade the ZIP to include real Polymarket orderbook series + charts.
