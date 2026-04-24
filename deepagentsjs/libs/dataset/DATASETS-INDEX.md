# Indeks dataset — `deepagentsjs/libs/dataset`

Peta cepat untuk koleksi yang Anda tag (`@dataset`, PyTeal, Solana audit, codegen, attack vectors, human-verified).  
**Base path:** `deepagentsjs/libs/dataset/<nama-folder>/`

> **Catatan:** Beberapa folder berisi **`.git` bersarang** (salinan mirip Hugging Face / LFS). Itu memperbesar checkout; untuk monorepo bersih, pertimbangkan submodule, sparse checkout, atau menghapus `.git` lokal di dalam folder dataset (jangan menghapus data `data/*.parquet` / `*.json`).

---

## Ringkasan per folder

| Folder | Isi utama | Format | Skala (indikatif) | Peran disarankan |
|--------|-----------|--------|-------------------|------------------|
| **`pyteal-rust-context`** | Teks konteks (satu kolom `text`) | Parquet `data/train-00000-of-00001.parquet` | ~309 baris (metadata HF di README) | Pretraining / retrieval context; **bukan** ground-truth exploit per baris |
| **`PyTeal-Rust-vulnerable`** | Teks (konteks rentan / pola) | Parquet, kolom `text` | ~309 baris | Fine-tuning atau klasifikasi teks; verifikasi per sampel sebelum benchmark resmi |
| **`Solana_vulnerability_audit_dataset`** | Pasangan instruksi–jawaban audit (Llama-style) | `train.csv`, kolom `text` (satu string panjang per baris) | ~244 sampel isi (+ header) | Eksperimen LLM / dataset generatif; label keamanan perlu kurasi |
| **`Solana_vulnerability_audit_dataset_V2`** | Kode Rust/Anchor + daftar string kerentanan | `Solana.json`: `{ code, vulnerabilities[] }` | **180** entri | Pelatihan / eval deteksi multi-label pada kode; kualitas label bervariasi — **wajib** sampling manual untuk benchmark “verified” |
| **`solana-codegen-new`** | Cuplikan repo: `repo_id`, `file_path`, `content` | Parquet | ~6094 baris | **Codegen / representasi kode** nyata dari banyak repo; bukan daftar CVE; gunakan untuk pembelajaran representasi atau RAG |
| **`solana-common-attack-vectors`** | Proyek Anchor terpisah per vektor serangan + **tes PoC** | Rust + TS tests per subfolder | 11 topik (account matching, CPI, PDA, dll.) | **Ground truth pedagogik** + reproduksi lokal (`anchor test`); sangat cocok untuk benchmark agen + PoC |
| **`benchmark-tier-a`** | **Tier A/B + kontrol negatif** — `benchmark-v1.jsonl`, skema, validasi, batch orchestrator, skor heuristik | `benchmark-entry.schema.json`, alat di `package.json` | 34 baris (v1) | **Benchmark “verified”** (URL bukti per baris) + alur `validate` → `batch` → `score` → `report` — lihat `README.md` |
| **`solana-train-context`** | Teks konteks | Parquet, `text` | ~205 baris | Mirip `pyteal-rust-context`, konteks pelatihan |
| **`solana-vulnerability-humanverified`** | Pasangan audit dalam CSV | `solana vulnerability.csv`, kolom `text` | ~5001 baris isi (+ header) | Nama menyiratkan verifikasi manusia; tetap **audit** konsistensi dan deduplikasi sebelum metrik Precision/Recall |

---

## Alur penggunaan yang disarankan

1. **Benchmark agen deteksi (Trident-style, recall/precision)** — **Tier A**  
   - Untuk angka yang diklaim *real-world verified*, setiap entri benchmark utama **wajib** punya **minimal satu URL publik** berupa post-mortem, advisory/CVE, laporan audit publik, atau kombinasi commit/PR resmi **plus** tautan penjelasan insiden (lihat `docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md` §1).  
   - **`solana-common-attack-vectors`**: sangat baik untuk PoC dan regresi (**Tier B** pedagogik); jika dipakai di laporan “produksi”, tambahkan write-up publik per kasus atau pisahkan metrik Tier A vs Tier B.
   - Subset dari `Solana_vulnerability_audit_dataset_V2` / `solana-vulnerability-humanverified` hanya masuk Tier A setelah **kurasi baris-per-baris** + kolom `primary_evidence_urls`.

2. **Pelatihan / LoRA pada kode**  
   - `Solana_vulnerability_audit_dataset_V2` + cuplikan dari `solana-codegen-new` (hati-hati: codegen tidak berlabel vuln).

3. **Instruksi-tanggapan (chat audit)**  
   - `Solana_vulnerability_audit_dataset`, `solana-vulnerability-humanverified`, dan dataset `text` parquet untuk format conversation.

4. **Algorand / PyTeal cross-stack**  
   - `pyteal-rust-context` dan `PyTeal-Rust-vulnerable` mendukung eksperimen lintas paradigma (PyTeal ↔ konteks Rust); **tidak mengganti** dataset Anchor murni untuk audit Solana produksi.

---

## Referensi silang

- Eval harness HF-style di monorepo: `deepagentsjs/evals/solana-vuln-rust/`
- Kerangka benchmark (metrik, protokol): `deepagentsjs/docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md`
- Dataset + tooling Tier A: `deepagentsjs/libs/dataset/benchmark-tier-a/`
- Auditor contoh: `deepagentsjs/examples/solana-elite-auditor/`

---

## Daftar vektor di `solana-common-attack-vectors`

Account data matching · Account reloading · Arbitrary CPI · Duplicate mutable accounts · Initialization frontrunning · Ownership check · PDA privileges · Re-initialization · Revival attack · Signer authorization · Type cosplay  

(Lihat `solana-common-attack-vectors/README.md` untuk penjelasan dan tautan ke program + tes.)
