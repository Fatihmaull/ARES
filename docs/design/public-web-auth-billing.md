# Design — Public web: auth, billing, rate limiting

> **Status:** DRAFT — implementation underway; locked product decisions live in [`decisions-auth-billing-v1.md`](./decisions-auth-billing-v1.md).
> **Target surface:** `apps/web` only. CLI and MCP are untouched.
> **One-liner:** anonymous preview → Solana wallet sign-in → free quota per
> wallet → on-chain USDC payment unlocks paid quota.

---

## 1. Scope + non-goals

### In scope

1. Let an anonymous visitor try a strictly-limited preview (1 chat, no scan).
2. Sign-in with a **Solana wallet** (SIWS — Sign-In With Solana, CAIP-122).
3. Per-wallet **free quota** (daily + monthly counters).
4. **Paid quota** purchasable by sending USDC (or SOL) to a treasury address;
   Helius webhook credits the wallet.
5. **Rate limiting** on every `/api/*` route (IP + wallet).
6. A small admin surface to inspect/adjust balances manually.

### Out of scope for v1

- Off-chain card payments (Stripe etc.). Can be added later behind the same
  billing interface.
- Multi-chain wallets (EVM). v1 is Solana-only.
- Per-org / team accounts. v1 treats each wallet as a single principal.
- Exposing mutating tools publicly. `ASST_WEB_ALLOW_WRITE` stays `0` in prod.

---

## 2. Principals + tiers

| Principal         | How we know them                          | What they get                              |
| ----------------- | ----------------------------------------- | ------------------------------------------ |
| **Anonymous**     | Cookie + IP only                          | 1 chat prompt / day, **no** scans          |
| **Wallet (free)** | SIWS session cookie                       | 10 chats / day, 2 scans / month            |
| **Wallet (paid)** | SIWS session + positive credit balance    | Consumes credits; higher burst limits      |
| **Admin**         | Wallet address in `ASST_ADMIN_WALLETS`    | Adjust balances, read billing history      |

Quotas live in config, not code, so we can tune without shipping a build.

---

## 3. Auth — Sign-In With Solana (SIWS)

### Flow

```
 1. Client calls POST /api/auth/challenge
     server returns { nonce, domain, statement, issuedAt, expiresAt }
     server stashes nonce in short-lived KV (5 min TTL)

 2. Client builds a SIWS message, user signs with wallet
     (wallet-adapter-react: useWallet().signMessage)

 3. Client POSTs { address, signature, signedMessage } to /api/auth/verify
     server:
       - parses SIWS message
       - checks domain, issuedAt, expiresAt, nonce (single-use)
       - verifies signature via @solana/web3.js PublicKey.verify()
       - upserts `wallets` row
       - signs a JWT (HS256, 30-day) and sets it as httpOnly `asst_session` cookie

 4. Subsequent requests pass through middleware.ts which verifies JWT
    and attaches `req.session = { wallet, tier }` to the route handler.

 5. POST /api/auth/logout — clears cookie.
```

### Why SIWS and not NextAuth Solana

- SIWS is a small, well-specified message format (CAIP-122). NextAuth's
  Solana providers are community plugins with churny APIs. Rolling ~80 LOC
  ourselves is less long-tail risk than importing a provider we can't audit.
- We already control the session; we don't need OAuth providers.

### Session storage

- **JWT in httpOnly cookie**, signed with `ASST_SESSION_SECRET` (HS256, 32
  bytes). `SameSite=Lax`, `Secure` in prod.
- JWT payload: `{ sub: walletAddress, tier, iat, exp }`.
- Nonce storage: in-process LRU for dev, **Upstash Redis** (free tier) in
  prod. Nonces are single-use and expire in 5 min.

### Libraries

| Purpose             | Choice                                                 |
| ------------------- | ------------------------------------------------------ |
| Wallet client       | `@solana/wallet-adapter-react` + `-wallets`            |
| SIWS parse/build    | `@solana/wallet-standard-features` (`solana:signIn`)   |
| Signature verify    | `@solana/web3.js` `PublicKey.verify()` + tweetnacl     |
| JWT sign/verify     | `jose` (Next-compatible, no node crypto import issues) |
| Nonce store (prod)  | `@upstash/redis`                                       |

---

## 4. Billing — credits backed by on-chain deposits

### Mental model

Every wallet has a **credit balance** in a unit called `ASST_UNITS`. Actions
cost units:

| Action                         | Cost         |
| ------------------------------ | ------------ |
| Free-tier chat prompt          | 0 (counter)  |
| Paid chat prompt               | 1 unit       |
| Free-tier full scan            | 0 (counter)  |
| Paid full scan                 | 10 units     |
| Skill-heavy agent (e.g. rug)   | 2 units      |

Costs live in `apps/web/lib/billing/pricing.ts` (constants) so we can iterate.

### Purchase flow

```
 1. User clicks "Top up" → /app/billing → picks a bundle
       100 units for 1 USDC,  1100 units for 10 USDC (10% bonus), etc.

 2. Client shows a SOL/USDC transfer to ASST_TREASURY_WALLET with an
    instruction memo containing the user's wallet address:
       memo = "ASST:<userWallet>:<bundleId>:<clientNonce>"

 3. User signs + broadcasts the transfer from their wallet.

 4. chain-intake (Helius webhook) receives the tx. A new handler
    `credits-on-deposit.ts` reads the memo, looks up the bundle,
    and INSERTs into `credits_ledger` with direction=CREDIT.

 5. The UI polls /api/billing/balance until the new deposit appears.
```

### Why memo-based attribution

- Zero coupling between auth and Helius. Auth proves the wallet owns the
  session; the memo proves the deposit is *for* that session's wallet.
- If a user forgets the memo, the treasury ops job can credit manually.
- Avoids an on-chain escrow program in v1. We can upgrade later if needed.

### Consumption

Every `/api/chat` and `/api/scan` call:

1. Reads session (anonymous / free / paid).
2. Checks rate limit (§5).
3. Reads `wallet_balance(wallet)` if paid-tier.
4. Inserts a provisional `DEBIT` row with status `PENDING`.
5. Calls engine.
6. On success → mark row `SETTLED`. On failure → mark `REFUNDED`.

This makes the ledger append-only and auditable.

### Data model (Postgres, shared with chain-intake)

```
wallets
  address          TEXT PRIMARY KEY       -- base58 pubkey
  tier             TEXT NOT NULL          -- 'free' | 'paid'
  created_at       TIMESTAMPTZ NOT NULL

credits_ledger
  id               BIGSERIAL PRIMARY KEY
  wallet           TEXT NOT NULL REFERENCES wallets(address)
  direction        TEXT NOT NULL          -- 'CREDIT' | 'DEBIT'
  units            BIGINT NOT NULL
  reason           TEXT NOT NULL          -- 'deposit' | 'chat' | 'scan' | 'refund' | 'admin_adjust'
  status           TEXT NOT NULL          -- 'PENDING' | 'SETTLED' | 'REFUNDED'
  related_tx_sig   TEXT                   -- deposit tx signature, if any
  related_run_id   TEXT                   -- orchestrator run id, if any
  meta             JSONB
  created_at       TIMESTAMPTZ NOT NULL
  settled_at       TIMESTAMPTZ

quota_counters                            -- free-tier counters
  wallet           TEXT NOT NULL          -- '' for anon buckets keyed by ip
  ip               INET
  window_start     TIMESTAMPTZ NOT NULL
  window_kind      TEXT NOT NULL          -- 'chat_daily' | 'scan_monthly' | ...
  count            INT NOT NULL DEFAULT 0
  PRIMARY KEY (wallet, ip, window_kind, window_start)
```

Balance = `SUM(units * sign(direction))` where settled, materialized into a
view `wallet_balance` for cheap reads.

---

## 5. Rate limiting

Two layers, both sliding-window:

1. **IP bucket** (anonymous + all wallets): `60 req/min` burst,
   `1000 req/day` sustained. Prevents abuse from one IP.
2. **Wallet bucket** (wallets only): `30 req/min`, quota counters per §4.

Storage:

- **Dev:** in-process Map. Fine for single-node.
- **Prod:** Upstash Redis. Same provider as nonce store — one dep, one env.

Library: `@upstash/ratelimit` (sliding window, Redis-backed, Next-friendly).

Rate-limit responses use HTTP 429 + `Retry-After` + JSON body
`{ error: "rate_limited", retryAt }`.

---

## 6. Next.js wiring

### Middleware

```
apps/web/middleware.ts
  ├─ parse JWT from cookie (if any)
  ├─ attach `x-asst-session` header for downstream routes
  └─ run IP rate limit (cheap, fail-closed on error)
```

Middleware does **not** hit Postgres — that would block every request.
Auth parsing is pure JWT verify; rate-limit hits Redis only.

### Route handlers

```
app/
├── api/
│   ├── auth/
│   │   ├── challenge/route.ts     POST  → { nonce, ... }
│   │   ├── verify/route.ts        POST  → sets cookie, returns session
│   │   └── logout/route.ts        POST
│   ├── billing/
│   │   ├── bundles/route.ts       GET   → list of top-up bundles
│   │   ├── balance/route.ts       GET   → { units, tier }
│   │   ├── history/route.ts       GET   → paginated ledger
│   │   └── prepare/route.ts       POST  → returns memo + treasury addr
│   ├── admin/
│   │   ├── adjust/route.ts        POST  (admin wallets only)
│   │   └── wallet/[addr]/route.ts GET   (inspect any wallet)
│   ├── chat/route.ts              POST  → guarded by requireSession() + quota
│   ├── scan/route.ts              POST  → same
│   └── console/stream/route.ts    GET   (SSE, cheap so session-only)
```

### `lib/` layout

```
apps/web/lib/
├── auth/
│   ├── siws.ts               build + parse SIWS messages
│   ├── session.ts            JWT sign/verify, cookie helpers
│   ├── require-session.ts    route helper: "give me the caller or 401"
│   └── nonce-store.ts        Redis-backed nonce table
├── billing/
│   ├── pricing.ts            bundle definitions, action costs
│   ├── ledger.ts             typed reads/writes to credits_ledger
│   ├── quota.ts              free-tier counter logic
│   └── deposits.ts           called from chain-intake to apply credits
├── db/
│   ├── pool.ts               shared pg Pool (chain-intake + web)
│   └── migrations/           node-pg-migrate scripts
├── ratelimit/
│   ├── shared.ts             Upstash limiters (Redis via `@upstash/redis/cloudflare` — Edge-safe with middleware)
│   ├── ip.ts                 60/min IP bucket (middleware)
│   └── wallet.ts             30/min wallet bucket (`/api/chat`, `/api/scan`)
└── engine-factory.ts         (exists) createPublicOrchestrator()
```

### Guard helper

Every guarded route is ~3 lines:

```ts
export async function POST(req: Request) {
  const guard = await requireSession(req, { allowAnonymous: false });
  if (!guard.ok) return guard.response;

  const charge = await quota.charge(guard.session, "chat");
  if (!charge.ok) return charge.response;

  // ...call engine, settle/refund the charge...
}
```

`requireSession` + `quota.charge` encapsulate auth + billing + rate-limit.

---

## 7. Engine stays agnostic

Auth and billing live **entirely** in `apps/web`. `@ares/engine` doesn't
know a wallet exists. This preserves:

- CLI + MCP = unchanged.
- Engine is still reusable for private self-hosted deployments where
  billing doesn't apply.
- Upgrading billing (Stripe, x402, on-chain escrow program) means editing
  one package.

The only engine change we might introduce: accept a `runId` + a cheap
`onTokenSpend(tokens)` callback so the web can show live cost as agents run.
That's additive and doesn't leak web concerns.

---

## 8. Security + abuse considerations

| Risk                                           | Mitigation                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Replay of SIWS signature                       | Single-use nonce, 5 min TTL, `expiresAt` in message body                          |
| Cookie theft                                   | httpOnly, Secure, SameSite=Lax, short session lifetime, rotating secret           |
| Free-tier farming (many wallets)               | IP bucket caps aggregate; treasury telemetry flags suspicious deposit patterns    |
| Deposit credited to wrong wallet (bad memo)    | Transactions without valid memos go to a `unallocated_deposits` queue for review  |
| Engine cost spike crashes the node             | `onTokenSpend` hard cap per request; orchestrator gets an `AbortSignal`           |
| Admin cookie compromise                        | Admin list is env-driven + requires a fresh signature every action                |
| Rate-limit bypass via header spoofing          | Read IP from `x-forwarded-for` **only** behind known proxy; fall back to socket IP|
| Scam memo tricking chain-intake                | Verify the `source` of the tx equals the `memo wallet` before crediting           |

---

## 9. Env surface (adds to `.env.example`)

```
# Auth
ASST_SESSION_SECRET=          # 32-byte hex, used to sign session JWTs
ASST_SESSION_TTL_DAYS=30

# Admin wallets (comma-separated base58 pubkeys)
ASST_ADMIN_WALLETS=

# Treasury + billing
ASST_TREASURY_WALLET=         # base58 pubkey receiving USDC / SOL deposits
ASST_DEPOSIT_MINT_USDC=       # USDC mint on target cluster
ASST_DEPOSIT_MINT_SOL=native  # or leave unset to disable SOL deposits

# Rate limit / nonce store
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Postgres (shared with chain-intake)
DATABASE_URL=
```

---

## 10. Rollout plan

| Phase | What                                                                  | Gates                                          |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------- |
| P1    | Auth: SIWS challenge/verify, cookie session, `requireSession`         | Unit tests for SIWS parse + signature verify   |
| P2    | Rate limit: IP + wallet, plugged into middleware                      | Load test on `/api/chat`                       |
| P3    | Billing read path: `wallets`, `credits_ledger`, balance + history API | Migrations applied; admin can `credit` manually|
| P4    | Billing write path: memo-based deposits via chain-intake handler      | End-to-end devnet test with a real USDC tx     |
| P5    | Per-action quota charges wired into `/api/chat` + `/api/scan`         | `quota.charge` unit tests                      |
| P6    | Admin surface + telemetry (wallet/ledger inspection)                  | Behind admin-wallet middleware                 |
| P7    | Public beta on devnet with throwaway treasury                         | Observability + alerts live                    |

Each phase is ~1–2 days of focused work; they're ordered so every phase
leaves the app in a deployable state.

---

## 11. Open questions for review

**Resolved — see [`decisions-auth-billing-v1.md`](./decisions-auth-billing-v1.md).** The numbered prompts below are kept for historical context only.

1. **Treasury custody.** Simple wallet for now, multisig (Squads v4) before
   mainnet — agreed?
2. **Pricing unit.** USDC-denominated bundles, or credits pegged to fiat?
   I lean toward explicit USDC prices — easier to reason about.
3. **Anonymous preview scope.** Do we want preview at all, or force wallet
   connect from byte one? Preview widens top-of-funnel but costs inference.
4. **Quotas.** The numbers in §2 are placeholders. Do you have target
   free-tier generosity in mind (e.g. "1 full scan / month" feels right)?
5. **Chain.** Devnet for the whole P1–P7 sequence, then flip to mainnet?
   Or dual-deploy?
6. **Refunds.** On engine failure we auto-refund. Do we also want a manual
   admin-refund action, or only automated?
7. **Session recovery.** If a user rotates wallets (new signer), do we offer
   a way to merge balances, or treat them as separate principals?

---

## 12. What I need from you to start coding

**Done:** §3–§4 approach and §11 answers are recorded in [`decisions-auth-billing-v1.md`](./decisions-auth-billing-v1.md). Implementation proceeds at §10 **P1** onward.

---

## Related specs

- [Architecture Contract Spec v1](./architecture-contract-spec-v1.md)
- [Billing & Metering Spec v1](./billing-metering-spec-v1.md)
