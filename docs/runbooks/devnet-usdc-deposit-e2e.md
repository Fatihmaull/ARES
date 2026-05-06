# Devnet USDC deposit E2E (§10 P4 gate)

End-to-end checklist: wallet session → prepare memo → on-chain transfer → chain-intake credits → balance/history update.

## Prerequisites

1. **Postgres** reachable from `apps/web` and `apps/chain-intake` (`DATABASE_URL`).
2. **Chain-intake** running with Helius (or equivalent) webhook hitting your ingest path; `ASST_TREASURY_WALLET`, `ASST_DEPOSIT_MINT_USDC` set for **devnet** USDC mint.
3. **Web** (`apps/web`): same env + `NEXT_PUBLIC_SOLANA_NETWORK=devnet`, `NEXT_PUBLIC_SOLANA_RPC_URL` optional.
4. **Treasury** has a devnet USDC ATA; **user wallet** holds devnet USDC (faucet / swap).

## Steps

1. Start web: `pnpm --filter @asst/web dev`.
2. Open `/dashboard/billing`, connect Phantom (devnet), **Sign in** (SIWS).
3. Click **Generate memo** on a bundle; confirm treasury + memo + mint match ops config.
4. Use **Pay with wallet** (if mint configured) or send USDC manually with the exact memo.
5. Wait for chain-intake to process the tx (Helius enhanced webhook includes transfers + memo).
6. Confirm:
   - `/api/billing/balance` shows increased units (or refresh Billing page).
   - `/api/billing/history` lists a **CREDIT** with `reason: deposit` and `relatedTxSig` set.
   - Postgres `credits_ledger` row exists with `status = SETTLED`.

## Failure hints

| Symptom | Check |
|---------|--------|
| No credit | Memo format `ASST:<wallet>:<bundleId>:<nonce>`; `from` on transfer matches memo wallet; treasury + mint in chain-intake env |
| 401/403 on APIs | Session cookie; wallet matches session |
| Webhook not firing | Helius dashboard, `WEBHOOK_SHARED_SECRET`, intake URL |

## Automating

This runbook is manual by design (real wallet + devnet). Record **tx signature** and **timestamp** when closing the gate for an environment.
