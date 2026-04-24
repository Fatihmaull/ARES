# benchmark-tier-a — Solana / Anchor AI security benchmark (Tier A + B, negative controls)

- **`benchmark-v1.jsonl`** — one JSON object per line; see **`benchmark-entry.schema.json`**.
- **`src/validate-benchmark.ts`** — JSON Schema (AJV) + HTTPS checks on `primary_evidence_urls`.
- **`src/batch-run.ts`** — for rows with `local_project_path`, runs `examples/solana-elite-auditor` orchestrator; logs under `results/<runId>/`.
- **`src/score-benchmark.ts`** + **`src/report-metrics.ts`** — heuristic match of agent `orchestrator.log` to `ground_truth_findings`; see framework §5 in `docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md` for human adjudication of disputes.
- **`Dockerfile.benchmark`** + **`SANDBOX.md`** — pinned Rust / Solana / Anchor for local PoC / `anchor test`.

## Commands (from this directory, after `pnpm install` in `deepagentsjs` root)

```bash
pnpm validate
pnpm batch -- --list
pnpm batch -- --dry-run
# Real run (needs engine keys per solana-elite-auditor):
# pnpm batch

pnpm score -- --run results/<runId>
pnpm report -- --run results/<runId> --version "agent-0" --commit "$(git rev-parse HEAD)"
```

## Dataset size (v1)

- Tier A: 25 rows (non-pedagogic, evidence URLs).
- Tier B: 1 row (points at `solana-common-attack-vectors/account-data-matching`).
- Negative controls: 8 rows (`negative_controls: true`).

## Pure-Solana filter

`SOL-BENCH-015` is a cross-VM rekt.com row; exclude with `--id` filters or a prefix allowlist in your own runner if you want Solana-only scoring.

## Smoke test (heuristic score + report, no API keys)

```bash
pnpm score -- --run fixtures/sample-run
pnpm report -- --run fixtures/sample-run --version local-smoke
```

`fixtures/sample-run` contains a minimal `orchestrator.log` for `SOL-BENCH-B-001`. Generated `score-detail.json` and `RESULTS.md` are gitignored under `fixtures/`.

## Related

- `docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md` — full methodology.
- `libs/dataset/DATASETS-INDEX.md` — where this folder is indexed.
- `examples/solana-elite-auditor` — `elite:orchestrator` / `elite:deep` entry points.
