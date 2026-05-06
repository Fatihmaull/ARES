# Security Alliance–style controls ↔ ARES assurance mapping

This is a **high-level** mapping for operators who use Security Alliance (SFC) printable checklists (DevOps, DNS, Multisig, Treasury, Workspace, Incident Response). It does **not** reproduce checklist text; pair this with your official SFC PDFs.

| Control theme | What elite audit / ASST touches | Typical artifacts |
|---------------|----------------------------------|-------------------|
| **DevOps & CI** | Secret scanning, env hygiene, supply-chain lane, optional Semgrep/SARIF merge | `secret_scanner`, `env_hygiene_check`, `write_assurance_manifest`, merged SARIF |
| **DNS / naming** | Indirect: phishing of operators, fake RPC or API endpoints in docs/scripts | Manual review of README, client configs; flag suspicious URLs in repo |
| **Multisig operations** | Upgrade authority, admin roles, governance centralization | `program_upgrade_monitor`, DeFi auditor agent, CPI graph |
| **Treasury** | Token concentration, rug-pattern heuristics, oracle/LP logic | `token_concentration`, `rug_pull_detector`, DeFi agent |
| **Workspace** | Leaked keys, bad `.gitignore`, committed `.env` | `secret_scanner`, `env_hygiene_check` |
| **Incident response** | Posture report exports, PDF for disclosure packs | `unified_posture_report`, `generate_pdf_report`, run manifests |

**Usage:** During a client engagement, tag findings with the SFC domain they reinforce so non-technical stakeholders see alignment with organizational controls—not just “smart contract bugs.”
