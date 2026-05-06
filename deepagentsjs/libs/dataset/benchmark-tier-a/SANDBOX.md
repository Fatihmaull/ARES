# Sandbox: benchmark toolchain (Docker)

Use `Dockerfile.benchmark` for reproducible `anchor test` / `cargo` builds when evaluating PoC rows (e.g. `solana-common-attack-vectors`).

## Build and smoke-test

```bash
cd deepagentsjs/libs/dataset/benchmark-tier-a
docker build -f Dockerfile.benchmark -t ares-benchmark-solana .
docker run --rm ares-benchmark-solana
```

## Run tests on a mounted project

```bash
export PROJ=../../solana-common-attack-vectors/account-data-matching
docker run --rm -v "$(pwd)/$PROJ:/work" -w /work ares-benchmark-solana \
  anchor test
```

**Do not** run exploits or attacks against mainnet or third-party systems from this image without authorization.

Record in your run log: `docker image inspect ares-benchmark-solana --format '{{.Id}}'`, `anchor --version`, `solana --version`, and the **git ref** of the project under test.

## Static analysis (host or container)

- `cargo audit` (install `cargo-audit` or use prebuilt in CI)
- Project-specific Semgrep / engine rules as invoked by `@ares/engine` / orchestrator (see `examples/solana-elite-auditor`).
