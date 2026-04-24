# Elite Solana Auditor rubric

Use this as **human and agent** guidance. It aligns with common auditor practice (OtterSec/Osec “auditor’s introduction”, Neodyme pitfalls, Coral **sealevel-attacks** patterns) and with internal tooling (Anchor source scanner, CPI graph, upgrade monitor).

## 1. Account discipline (Sealevel-specific)

- **Owner / program ID** — Expected program owners on accounts; no confused-delegate reads across instructions.
- **Signer** — Every privileged mutation must enforce `Signer` or equivalent; watch optional signer paths.
- **PDA seeds & bumps** — Canonical bump; no seed ambiguity across instructions; `invoke_signed` seeds match account list.
- **Account type / discriminator** — Account data matching (type cosplay) and layout; Anchor `Account` vs `UncheckedAccount` discipline.
- **Duplicate accounts** — Same account passed twice for mutable misuse (duplicate mutable accounts pattern).

## 2. CPI and trust boundaries

- **CPI target** — No arbitrary program IDs for CPI unless explicitly intended; document trust assumptions.
- **Reentrancy / ordering** — Write-after-CPI and state consistency; Solana is not EVM-reentrant but instruction ordering still bites.
- **Sysvar** — No spoofed sysvars; validate sysvar accounts when used.

## 3. Arithmetic and economic logic

- Prefer **checked** math for token amounts, shares, and prices; flag `unwrap()` on `Option`/`Result` in hot paths.
- Oracle / TWAP / LP pricing — Manipulation surfaces; compare to known incidents (e.g. oracle guardrail patterns).

## 4. Token surfaces

- **SPL vs Token-2022** — Extensions, hooks, transfer fees; dataset coverage may lag (see whitepaper limitations).
- **Concentration / rug signals** — When scope includes token metadata, use holder concentration tools as **signals**, not verdicts.

## 5. Operations and supply chain

- **Secrets** — No keys in repo or history; `.env` hygiene.
- **Dependencies** — `pnpm audit` / `cargo audit` lanes where enabled; supply-chain manifest in assurance runs.
- **Upgrade authority** — Program upgradability and timelock/multisig expectations.

## 6. Spec and code

- When a spec or whitepaper exists, track **spec-to-code** gaps explicitly (missing checks, divergent formulas, unstated trust assumptions).

## 7. Verification mindset (QEDGen / PBT)

- For **pure** or deterministic helpers, suggest **properties** or oracles an engineer could encode (e.g. round-trip, monotonicity, conservation of mass). Point to Hypothesis/agentic-PBT workflows for Python off-chain tests; do not claim on-chain formal proofs unless tooling produced them.

## 8. Severity and reporting

- Map findings to **Critical / High / Medium / Low / Informational** with **impact**, **likelihood**, **evidence**, **remediation**, and **retest** notes.
- PDF output should mirror that structure when `generate_pdf_report` is invoked with structured rows.

## Limitations (always disclose)

- Heuristic scanners and LLMs **miss** logic bugs and can **hallucinate**; human audit remains authoritative for high-stakes deployments.
- Agentic systems risk **MAS hijacking** (untrusted content, malicious tools); scope tools and sandbox execution in production.
