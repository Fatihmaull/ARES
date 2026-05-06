# Official references — Helius & Solana (for Assurance Run)

**Version 0.1** — **Bahasa:** [← Hub](./REFERENCES.md) · [English](./REFERENCES.en.md)

Kurasi untuk menyelaraskan dokumentasi ASST dengan sumber **Helius** dan **Solana Foundation**. Bukan pengganti dokumentasi resmi; periksa URL untuk versi terbaru.

---

## Indeks mesin baca (llms)

| Sumber | URL |
|--------|-----|
| **Helius** (indeks dokumen untuk LLM / asisten) | [helius.dev/llms.txt](https://www.helius.dev/llms.txt) |
| **ProjectDiscovery** (indeks dokumentasi untuk LLM / asisten) | [docs.projectdiscovery.io/llms.txt](https://docs.projectdiscovery.io/llms.txt) |
| **LangChain** (indeks dokumentasi untuk LLM / asisten) | [docs.langchain.com/llms.txt](https://docs.langchain.com/llms.txt) |

---

## Helius — cocok untuk integrasi RPC, data, dan pola agen aman

| Topik | Artikel | Relevansi ke `deepagentsjs` / Assurance Run |
|-------|---------|---------------------------------------------|
| **RPC & node** | [How Solana RPCs Work](https://www.helius.dev/blog/how-solana-rpcs-work.md) | Memahami batas **read-only** vs operasi penuh saat membuat tool `solana_rpc_read`. |
| **Keamanan program** | [A Hitchhiker's Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security.md) | Materi untuk **skills** / checklist subagen **static-policy**. |
| **Aritmetika & DeFi** | [Solana Arithmetic: Best Practices for Building Financial Apps](https://www.helius.dev/blog/solana-arithmetic.md) | Properti/invarian yang bisa dijadikan aturan atau uji tambahan. |
| **Pengujian program** | [A Guide to Testing Solana Programs](https://www.helius.dev/blog/a-guide-to-testing-solana-programs.md) | Menyelaraskan lane **build-verify** dengan piramida uji (unit → integrasi). |
| **Agen AI + dompet** | [How to Build a Secure AI Agent on Solana](https://www.helius.dev/blog/how-to-build-a-secure-ai-agent-on-solana.md) | Pola **policy-controlled credentials** — relevan untuk **Security for AI**, bukan mengganti audit bytecode. |
| **Data & streaming** | [Listening to Onchain Events on Solana](https://www.helius.dev/blog/solana-data-streaming.md) | Jika fase berikutnya menambah **monitoring** pasca-deploy (pelengkap Assurance Run). |
| **DAS / aset** | [All You Need To Know About Solana's New DAS API](https://www.helius.dev/blog/all-you-need-to-know-about-solanas-new-das-api.md) | Hanya jika tool Anda perlu metadata aset; **bukan** inti MVP assurance repo. |

**Catatan API key:** Helius dan penyedia RPC lainnya memakai **kunci** di environment — jangan menaruhnya di prompt agen atau berkas yang ditulis model ke repositori publik.

---

## Solana Foundation — Agent Skills & kurikulum keamanan

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **Pasang semua skills resmi** | `npx skills add https://github.com/solana-foundation/solana-dev-skill` | Skill Foundation bisa dipaketkan bersama `createSkillsMiddleware` (lihat [Solana Agent Skills](https://solana.com/docs)). |
| **Security Checklist** (kategori Security) | Tersedia dalam bundel **solana-dev-skill** | Mapping langsung ke temuan **account validation**, **signer checks**, vektor serangan umum — cocok sebagai **`skills/solana-security-checklist`**. |
| **Testing Strategy** | LiteSVM, Mollusk, Surfpool (dalam skill) | Menjelaskan **testing pyramid** yang bisa direferensikan subagen **build-verify** (selaras dengan [Helius — Testing guide](https://www.helius.dev/blog/a-guide-to-testing-solana-programs.md)). |
| **Version Compatibility Matrix** | Skill Tooling | Menghindari **toolchain drift** yang memutus `cargo`/`anchor` di CI. |

Dokumen indeks skill publik: [solana.com — skills overview](https://solana.com/docs) (cari *Agent Skills* / *Skills* di dokumentasi terkini).

---

## LangChain — Deep Agents & human-in-the-loop

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **Indeks dokumentasi (LLM)** | [docs.langchain.com/llms.txt](https://docs.langchain.com/llms.txt) | Menemukan halaman resmi (Deep Agents, LangGraph, MCP, dll.) sebelum menggali topik spesifik. |
| **Human-in-the-loop (Deep Agents, JS)** | [Human-in-the-loop](https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop.md) | Konfigurasi **`interruptOn`** per nama tool (`true` / `false` / `{ allowedDecisions }`), **checkpointer wajib** untuk persistensi state, penanganan **`__interrupt__`**, **`Command({ resume: { decisions } })`** dengan **`thread_id` yang sama**, keputusan **approve / edit / reject**, batch beberapa tool, serta **override** `interruptOn` pada subagen. |

Versi Python Deep Agents memiliki halaman setara di indeks yang sama (prefiks `oss/python/deepagents/`). Implementasi Assurance Run di **`deepagentsjs`**: lihat [ARCHITECTURE.md § 2.5](./ARCHITECTURE.id.md).

---

## Trail of Bits — katalog skills ([skills.sh](https://skills.sh))

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **Katalog resmi ToB** | [skills.sh/trailofbits](https://skills.sh/trailofbits) | Puluhan skills untuk agen koding (mis. **trailmark-summary**, **fuzzing-dictionary**, **wycheproof**, **semgrep**, **codeql**, **secure-workflow-guide**) — melengkapi jalur **analisis statis, fuzzing, dan praktik audit**, tanpa menggantikan **solana-dev-skill** untuk domain Solana. |

Pasang per skill mengikuti instruksi di [skills.sh](https://skills.sh) (CLI / bundel), lalu arahkan `createSkillsMiddleware` ke direktori skills yang terpasang. Lihat juga [TOOLS.md § F.3](./TOOLS.id.md).

---

## Pemetaan cepat: dokumen ASST ↔ sumber di atas

| File di ASST | Gunakan Helius / Solana untuk … |
|--------------|----------------------------------|
| [TOOLS.md](./TOOLS.id.md) | **RPC** aman; skill Foundation + opsional **Trail of Bits**; **ProjectDiscovery** / **Wireshark** / **ExploitDB** hanya untuk jalur off-chain / jaringan / intel dengan izin — lihat § F.4–F.5. |
| [ARCHITECTURE.md](./ARCHITECTURE.id.md) | **Read-only RPC** vs **signing**; **HITL**; pemetaan fase recon / konteks / vuln ke subagen — § 2.6. |
| [WHITEPAPER.en.md](./WHITEPAPER.en.md) | Klaim **non-goals** dan **threat model** didukung referensi **program security** & **testing**. |
| [ARCHITECTURE.id.md § 3](./ARCHITECTURE.id.md#3-penjajaran-sdlc-dan-lean-six-sigma) | Penjajaran **SDLC** dan **Lean Six Sigma (DMAIC)** dengan Assurance Run. |
| [docs/DASHBOARD-UX.id.md](./docs/DASHBOARD-UX.id.md) | **UX dashboard**, palet CSS, bidang **digest on-chain** opsional. |
| [docs/OWASP-TOP10-2025-ASST.id.md](./docs/OWASP-TOP10-2025-ASST.id.md) | **OWASP Top 10:2025** (parsial) pemetaan ke ASST / `deepagentsjs` — bukan sertifikasi. |
| [docs/STRIDE-ASST.id.md](./docs/STRIDE-ASST.id.md) | Ringkasan ancaman **STRIDE** (parsial) — bukan model alur data penuh. |
| [docs/FALSE-POSITIVES-ASST.id.md](./docs/FALSE-POSITIVES-ASST.id.md) | **Positif palsu disaring** — daftar periksa triase pemindai (dokumen, tes, `eval` QuickJS). |

---

## Secure SDLC — standar (NIST SSDF, OWASP SAMM)

| Standar | URL | Selaras satu baris |
|---------|-----|---------------------|
| **NIST SSDF** | [NIST SP 800-218](https://csrc.nist.gov/publications/detail/sp/800-218/final) | Mengorganisir praktik pengembangan aman (Plan, Protect, Produce, Respond) — melengkapi **bundel bukti** dan **Control** di Assurance Run ([ARCHITECTURE.id.md § 3](./ARCHITECTURE.id.md#3-penjajaran-sdlc-dan-lean-six-sigma)). |
| **OWASP SAMM** | [owaspsamm.org](https://owaspsamm.org/) | Kematangan jaminan perangkat lunak (tata kelola, desain, implementasi, verifikasi, operasi) — petakan **Measure** ke praktik verifikasi dan operasi. |

---

## Opsional — analisis biner (bukan Solana RPC)

| Sumber | URL | Catatan |
|--------|-----|---------|
| **Ghidra** (SRE, headless) | [github.com/NationalSecurityAgency/ghidra](https://github.com/NationalSecurityAgency/ghidra) | Hanya untuk jalur forensik / biner tanpa sumber; lihat [Security Advisories](https://github.com/NationalSecurityAgency/ghidra) dan [TOOLS.md § F.1](./TOOLS.id.md). |

---

## Opsional — skill SAST untuk agen (web / app, bukan Rust on-chain)

| Sumber | URL | Catatan |
|--------|-----|---------|
| **llm-sast-scanner** (skill, 34 kelas) | [github.com/SunWeb3Sec/llm-sast-scanner](https://github.com/SunWeb3Sec/llm-sast-scanner) | Alur taint + Judge; utamakan **TS/JS/Python/Java** off-chain; lihat [TOOLS.md § F.2](./TOOLS.id.md). |

---

## Kurasi — ekosistem alat (Trident, APR, Semgrep, dll.)

Tabel lengkap dengan tautan dan batasan peran (fuzzing, registry, `unsafe`, pemindai komersial, risiko token): **[TOOLS.md § C.1](./TOOLS.id.md)**.

---

## Project Discovery — permukaan serangan & pemindaian (off-chain)

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **Situs & komunitas** | [projectdiscovery.io](https://projectdiscovery.io/) · [GitHub](https://github.com/projectdiscovery) | Rangkaian alat untuk **temuan aset**, **pemindaian kerentanan berbasis templat**, dan probing HTTP/DNS — untuk **API, web, infrastruktur** yang Anda **milik atau punya izin tertulis** untuk diuji. |
| **Indeks dokumentasi (LLM)** | [docs.projectdiscovery.io/llms.txt](https://docs.projectdiscovery.io/llms.txt) | Memetakan halaman docs (Nuclei, Subfinder, httpx, Naabu, Katana, dnsx, Interactsh, cvemap, PDTM, dll.). |
| **Ringkasan alat** | [Open Source Tools](https://docs.projectdiscovery.io/tools/index.md) | **Nuclei** (pemindaian dengan templat YAML), **httpx**, **Subfinder**, **Naabu**, **Katana**, dan lainnya — pelengkap jalur **AppSec / DevSecOps**, **bukan** pengganti audit **program Solana** di `programs/`. |

**Kebijakan:** gunakan hanya pada sasaran dalam **ruang lingkup bug bounty / pentest resmi / staging internal**. Jangan mengarahkan pemindaian massal atau agresif dari agen otomatis ke RPC publik pihak ketiga tanpa persetujuan — risiko hukum, ToS, dan gangguan layanan. Detail integrasi agen: [TOOLS.md § F.4](./TOOLS.id.md).

---

## Wireshark — analisis lalu lintas jaringan (opsional)

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **Wireshark** (penangkap & analisis paket) | [wireshark.org](https://www.wireshark.org/) | Debug **TLS/HTTP/WebSocket**, RPC JSON, atau protokol kustom pada **lingkungan yang Anda kendalikan**; membantu memahami integrasi klien ↔ backend / gateway. |
| **Panduan pengguna** | [Wireshark User’s Guide](https://www.wireshark.org/docs/) | Filter *display*, *follow stream*, ekspor — untuk insiden atau QA, bukan inti audit sumber Rust. |
| **Panduan pengembang** | [Wireshark Developer’s Guide](https://www.wireshark.org/docs/wsdg_html_chunked/) | Referensi jika tim menulis **dissector** / plugin; jarang dibutuhkan untuk Assurance Run default. |

**Kebijakan:** penangkapan paket dapat memuat **PII dan rahasia**; batasi ke host/interface yang sah, simpan artefak di penyimpanan **private**, dan jangan memasukkan dump jaringan ke repositori publik atau prompt agen tanpa redaksi.

---

## ExploitDB / SearchSploit (opsional — intel publik)

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **Paket Kali (dokumentasi)** | [kali.org — exploitdb](https://www.kali.org/tools/exploitdb/) | Menjelaskan paket **exploitdb** (arsip [Exploit Database](https://www.exploit-db.com/)) dan CLI **`searchsploit`** untuk mencari PoC publik berdasarkan kata kunci, CVE, atau keluaran **Nmap** (`--nmap`). |
| **SearchSploit (manual)** | [exploit-db.com — searchsploit](https://www.exploit-db.com/searchsploit) | Contoh penggunaan: pencarian lokal setelah `apt install exploitdb` / pembaruan arsip (`searchsploit -u`). |

**Relevansi Assurance Run:** berguna sebagai **intel CVE / versi produk** pada **dependensi off-chain** atau sistem yang berada dalam ruang lingkup uji — **bukan** alat audit **program Solana** di `programs/`, dan **bukan** otomatisasi eksploitasi.

**Kebijakan:** gunakan hanya dalam konteks **pentest berizin**, **respons insiden internal**, atau **laboratorium terisolasi**. Menjalankan PoC dari arsip terhadap sasaran tanpa otorisasi melanggar hukum dan kebijakan keamanan; jangan menghubungkan agen produksi ke `searchsploit` tanpa **HITL** dan batasan **policy**. Detail: [TOOLS.md § F.5](./TOOLS.id.md).

---

## CodeQL & format SARIF

| Sumber | URL | Relevansi |
|--------|-----|-----------|
| **CodeQL** (dokumentasi) | [codeql.github.com/docs](https://codeql.github.com/docs/) | Analisis semantik / data-flow; membutuhkan **database** berkualitas dari build yang terekstrak dengan baik. Cocok untuk **monorepo** (TS/Python/Go/Java, dll.); untuk **Rust/Solana** verifikasi ekstraksi dan paket kueri — jangan anggap “nol temuan” sebagai bukti aman tanpa penilaian kualitas DB. |
| **CodeQL CLI** | [GitHub — CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli) | Alur: `codeql database create` → `codeql database analyze` → keluaran **SARIF**. |
| **SARIF 2.1.0** (OASIS) | [SARIF v2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) | Format pertukaran temuan antar pemindai (Semgrep, CodeQL, Code Scanning); input untuk **`merge_findings`**, diff baseline, dan **audit-augmentation** (Trailmark). |
| **GitHub — SARIF untuk code scanning** | [SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Batasan unggah dan properti yang didukung di CI. |

**SARIF — praktik ringkas:** normalisasi path antar lingkungan; gunakan **fingerprint** untuk deduplikasi antar *run*; file besar → streaming. Alat bantu: `jq`, [sarif-tools](https://github.com/microsoft/sarif-tools) (Python). Detail integrasi agen: [TOOLS.md § C.2](./TOOLS.id.md).

**CodeQL — praktik ringkas:** simpan artefak di direktori keluaran terdedikasi; gunakan **suite kueri eksplisit** (hindari mengandalkan *default suite* paket tanpa verifikasi); evaluasi **data extensions** untuk API kustom; investigasi **nol temuan** (kualitas DB, cakupan, filter). Workflow mendalam mengikuti skill **codeql** (build → extensions → analyze).

---

## Metodologi audit & agent skills (kurasi)

Tabel berikut memetakan **alur kerja audit** (sering dipaketkan sebagai *skills* untuk agen koding) ke **Assurance Run**. Nama skill mengikuti konvensi umum (mis. **audit-augmentation**, **solana-vulnerability-scanner**); pasangkan isi skill ke `createSkillsMiddleware` / dokumen `skills/` proyek Anda — bukan dependensi wajib repositori ASST.

| Fokus skill / metodologi | Peran | Lane / subagen yang relevan | Catatan integrasi |
|--------------------------|--------|-------------------------------|-------------------|
| **CodeRecon** (*zz-code-recon*) | Recon piramida: overview → modul → fungsi → detail | Pra-*static-policy*; bahan untuk `write_todos` | Menyusun peta trust boundary dan entrypoint sebelum pemindaian. |
| **Audit context building** (*audit-context-building*) | Konteks mendalam per fungsi (bukan temuan CVE) | *Static-policy* (prompt atau skill) | Jalankan **sebelum** berburu bug; keluaran = asumsi & invarian, bukan severity. |
| **Audit prep assistant** (*audit-prep-assistant*) | Checklist persiapan audit (ToB-style): tujuan, SA bersih, cakupan, build | CI / manusia di luar loop agen otomatis | Menyegarkan artefak sebelum engagement formal; sejajar dengan §C *build-verify*. |
| **Solana vulnerability scanner** (*solana-vulnerability-scanner*) | Enam pola kritis SVM/Anchor (CPI, PDA, signer, owner, sysvar, introspeksi) | *Static-policy* | Melengkapi Semgrep/Trident; gunakan sebagai **checklist** atau skill bertarget `programs/`. |
| **VulnHunter** (*vulnhunter*) | *Sharp edges* + analisis varian | *Static-policy* + triase *merge-report* | Cocok untuk mengejar pola berulang setelah temuan pertama. |
| **Audit augmentation** (*audit-augmentation*) | Proyeksi SARIF / weAudit ke **graf Trailmark** | Pasca-Semgrep/**CodeQL**; analisis silang dengan *blast radius* / *taint* | Wajib **`engine.preanalysis()`** sebelum augment; bukan pengganti menjalankan pemindai. |
| **CodeQL** (*codeql* skill) | DB + kueri semantik → SARIF | *Static-policy* / CI berat | Utamakan kualitas DB & suite eksplisit; rincian di bagian **CodeQL & SARIF** di atas & [TOOLS.md § C.2](./TOOLS.id.md). |
| **SARIF parsing** (*sarif-parsing* skill) | Agregasi, dedupe, filter temuan | *Merge-report* / gateway ke augment | Bukan menjalankan pemindaian; format **2.1.0** — lihat [OASIS SARIF](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html). |
| **Diagramming code** (*diagramming-code*) | Diagram Mermaid dari graf Trailmark | Dokumentasi & review manusia; pelengkap *merge-report* | Membutuhkan **trailmark** terpasang; jangan menggambarkan dari tebak-tebakan sumber saja. |
| **Zeroize audit** (*zeroize-audit*) | Audit penyapuan rahasia (Rust/C++) dengan bukti IR/asm | Jalur khusus **kripto** / *key material* di `programs/` atau crate native | Berat secara toolchain; default **mati** kecuali ruang lingkup eksplisit. |
| **Deep agents orchestration** (*deep-agents-orchestration*) | Pola **task** / **write_todos** / **HITL** | Sesuai runtime **deepagents** | Selaras dengan [ARCHITECTURE.md § 2.5–2.6](./ARCHITECTURE.id.md) dan [LangChain — HITL](https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop.md). |
| **Code maturity assessor** (*code-maturity-assessor*) | Skor maturitas **9 kategori** (aritmetika, audit, akses, kompleksitas, desentralisasi, dokumentasi, risiko urutan tx, manipulasi low-level, pengujian) | *Merge-report* / gate pra-rilis; melengkapi *audit-prep* | Keluaran: scorecard berbukti + roadmap; bukan pengganti pemindaian otomatis. |
| **Spec-to-code compliance** (*spec-to-code-compliance*) | Perbandingan **korpus spesifikasi** (whitepaper, desain) ↔ **perilaku kode** (IR alignment, divergensi) | Subagen khusus atau *merge-report* | Membutuhkan dokumen spesifikasi dan kode dalam ruang lingkup; cocok dengan [WHITEPAPER.en.md](./WHITEPAPER.en.md) / proyek sebagai *spec*. |
| **Semgrep rule variant creator** (*semgrep-rule-variant-creator*) | Port aturan Semgrep ke **bahasa target** (siklus uji per bahasa) | Pengembangan aturan di *static-policy* / repositori `semgrep/` | Rujukan sintaks: [Semgrep — rule syntax](https://semgrep.dev/docs/writing-rules/rule-syntax), [testing rules](https://semgrep.dev/docs/writing-rules/testing-rules); bukan untuk menjalankan scan saja. |
| **Supply chain risk auditor** (*supply-chain-risk-auditor*) | Risiko **repo & maintainer** dependensi langsung (bukan scan CVE runtime) | *Static-policy* / pra-engagement; melengkapi `cargo audit` & `lockfile_parse` | Membutuhkan [GitHub CLI](https://cli.github.com/) (`gh`) untuk metrik repo; fokus **takeover / unmaintained / kontak keamanan** — lihat [TOOLS.md § I](./TOOLS.id.md). |
| **DevOps** (*devops*) | **CI/CD**, Kubernetes, Ansible, Bash, secret management | Pipeline yang menjalankan Assurance Run & artefak `assurance/` | Terpisah dari logika audit on-chain; least privilege, vault untuk rahasia. |
| **API development** (*api-development*) | Pola API **Go (stdlib)** / **NestJS**: validasi, middleware, modul | Layanan **off-chain** dalam monorepo (bersama §F.2) | Boundary HTTP/TLS; bukan substitusi review `programs/` Solana. |
| **YARA-X rule authoring** (*yara-rule-authoring*) | Aturan **YARA-X** untuk deteksi malware / pola berkas | Forensik artefak, korpus **npm**/binary — selaras jalur **non-MVP** | Bukan analisis sumber Rust Anchor; uji terhadap *goodware*; CLI `yr` — [VirusTotal YARA-X](https://github.com/VirusTotal/yara-x). |
| **Security threat model** (*security-threat-model*) | Model ancaman AppSec **berbasis bukti di repo**: batas kepercayaan, aset, jalur penyalahgunaan, mitigasi terprioritaskan (asumsi eksplisit) | *Merge-report* / engagement khusus; setelah recon & konteks | Bukan sekadar checklist generik OWASP; mengikuti kontrak keluaran skill; artefak opsional `*-threat-model.md`; validasi ruang lingkup dengan pemangku kepentingan. |
| **Security awareness** (*security-awareness*) | Keamanan **operasional**: analisis URL/domain sebelum navigasi; pola phishing/BEC; tandai kredensial dalam konten sebelum bagikan | Kebijakan orkestrator, operator manusia, higiene prompt — **bukan** SAST | Melengkapi **HITL**, §G, dan kebijakan sandbox; bukan pengganti pemindai atau skill Solana. |
| **Security best practices** (*security-best-practices*) | Panduan **desain** backend/API: validasi input, authn/authz, rahasia, rate limit, TLS, error aman | Layanan off-chain (bersama *api-development* / §F.2); default CI aman | Pelengkap desain waktu untuk Semgrep/CodeQL; bukan pengganti audit `programs/`. |

**Urutan disarankan (konseptual):** recon → konteks → (prep) → **rantai pasokan dependensi** (opsional) → **model ancaman berbasis repo** (opsional) → pemindaian statis / Solana patterns → (maturitas / spec compliance bila ada dokumen) → augmentasi graf → merge temuan → diagram / laporan.

Rincian pemetaan ke tool dan gate: **[TOOLS.md § I](./TOOLS.id.md)**. CodeQL & SARIF: **[TOOLS.md § C.2](./TOOLS.id.md)**.

---

*Helius dan Solana adalah merek masing-masing pemiliknya. ASST tidak berafiliasi; tautan hanya untuk edukasi.*
