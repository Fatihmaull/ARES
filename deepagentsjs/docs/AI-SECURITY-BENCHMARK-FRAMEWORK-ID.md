# Kerangka Benchmark Keamanan Berbasis AI (Trident Arena–style)

**Ekosistem target (default):** Solana — program Rust / Anchor (Sealevel).  
Ganti `[Ekosistem]` di bawah dengan rantai atau VM Anda; struktur protokol evaluasi tetap sama.

Dokumen ini mendukung replikasi metodologi seperti [Trident Arena](https://tridentarena.xyz/#benchmarks) (multi-agent, penalaran khusus domain) dan menyelaraskan dengan eval internal repo: `evals/solana-vuln-rust`, dataset `libs/dataset/Solana_vulnerability_audit_dataset_V2/`, serta contoh auditor `examples/solana-elite-auditor/`.

---

## 1. Kurasi dataset (20–30 kerentanan kritis terverifikasi)

### Tier bukti (wajib pilih satu untuk laporan benchmark “real-world”)

Untuk entri yang masuk **set evaluasi resmi** (angka Precision/Recall yang dipublikasikan sebagai “verified / real-world”), berlaku **Tier A** di bawah. Tanpa Tier A, entri hanya boleh masuk set **pelatihan / ablation**, bukan set utama benchmark.

#### Tier A — *Real-world verified* (wajib untuk benchmark utama)

Setiap entri **harus** memiliki **minimal satu URL publik HTTPS** yang menjadi sumber primer, dari salah satu kategori:

| Kategori | Contoh yang diterima | Yang tidak cukup sendirian |
|----------|----------------------|------------------------------|
| **Post-mortem / incident write-up** | Blog tim keamanan, thread analisis dengan bukti on-chain, laporan insiden resmi protokol | Thread anon tanpa identitas sumber kode |
| **Temuan audit publik** | PDF/HTML laporan audit dengan ID temuan + rentang tanggal + nama protokol | Ringkasan paywalled tanpa URL publik |
| **Advisory resmi** | CVE + halaman vendor/foundation; bulletin pemerintah/lembaga dengan URL stabil | Hanya screenshot |
| **Perbaikan terdokumentasi publik** | PR atau commit di repo resmi dengan **pesan yang secara eksplisit** menjelaskan perbaikan keamanan, **dan** tautan ke issue/advisory/post-mortem terkait | Commit tanpa konteks + tanpa tautan penjelasan |

**Aturan tambahan:**

- URL harus **dapat diakses reviewer** (bukan localhost); preferensi: arsip stabil (commit hash, tanggal akses dicatat).
- Jika hanya punya **katalog exploit** (mis. repo skrip repro): izinkan sebagai **bukti sekunder** jika disertai **Tier A primer** (post-mortem atau advisory yang menjelaskan dampak yang sama).
- **Ground truth** tetap per *finding*: tautkan setiap `ground_truth_findings[]` ke kutipan atau bagian dokumen (opsional: `evidence_anchor` berupa string ringkas).

#### Tier B — *Pedagogik / sintetik* (PoC lokal sah, tanpa post-mortem)

Contoh: proyek latihan dengan `anchor test` (mis. `solana-common-attack-vectors`). Berguna untuk **regresi agen**, **pelatihan**, dan **uji PoC**, tetapi **tidak** menggantikan Tier A dalam klaim “insiden produksi terverifikasi” kecuali Anda menambahkan tautan write-up publik per kasus.

### Prinsip umum

- **Ground truth** didefinisikan per *finding* (bukan hanya per repo): satu program bisa punya beberapa insiden terpisah.
- Dataset besar tanpa URL per baris (`Solana.json`, CSV generik) **tidak** otomatis memenuhi Tier A — kurasi manual baris demi baris.

### Sumber yang disarankan (Solana)

| Sumber | Kegunaan |
|--------|----------|
| Post-mortem publik (Neodyme, OtterSec, Sec3, dll.) | Konteks akar masalah + patch |
| [sannykim/solsec](https://github.com/sannykim/solsec) | Indeks kasus & tooling |
| Dataset HF / korpus lokal (`FraChiacc99/solana-vuln-rust`, `Solana_vulnerability_audit_dataset_V2`) | Skala; **wajib kurasi manual** untuk verifikasi |
| [SCONE-bench](https://github.com/safety-research/SCONE-bench) (EVM) | Pola protokol evaluasi fork + profit threshold — adaptasi konsep ke Solana (LiteSVM / devnet) |

### Skema entri dataset (JSON/CSV)

```json
{
  "id": "SOL-BENCH-001",
  "ecosystem": "solana-anchor",
  "benchmark_tier": "A",
  "severity": "critical",
  "category": "account_validation",
  "primary_evidence_urls": [
    "https://example.org/security/postmortem-2025-04-incident"
  ],
  "evidence_types": ["post_mortem"],
  "secondary_evidence_urls": [
    "https://github.com/org/repo/pull/123"
  ],
  "program_id_or_scope": "optional",
  "ground_truth_findings": [
    {
      "cwe_like": "missing_signer",
      "location_hint": "instruction:X accounts:Y",
      "description": "Ringkas",
      "maps_to_evidence": "optional subsection or quote id"
    }
  ],
  "artifact": { "type": "source_tree", "ref": "commit_or_tarball" },
  "negative_controls": false
}
```

`evidence_types` disarankan: `post_mortem` | `audit_report` | `cve_advisory` | `official_incident` | `documented_security_fix` (commit/PR **plus** penjelasan publik, lihat Tier A).

**Target ukuran:** 20–30 entri **Tier A**, **critical/high**; sisipkan **5–10 negative control** (kode sehat atau sudah dipatch) untuk mengukur FP — negative control tidak wajib post-mortem, tetapi wajib **referensi versi / commit** yang menunjukkan tidak ada klaim insiden untuk snapshot tersebut.

---

## 2. Lingkungan sandbox (analisis statis + dinamis)

### Statis

- **Container** terisolasi (Docker/Podman): hanya repo target + toolchain (`rustc`, `anchor`, `cargo audit`).
- **Pin versi:** `Cargo.lock`, `anchor-cli`, `solana-cli` untuk reproduktibilitas.
- Alat opsional: Semgrep rules khusus Solana, `cargo geiger` (unsafe), pemindaian dependensi (supply chain).

### Dinamis

- **LiteSVM** / **Surfpool** / **validator lokal**: jalankan tes integrasi dan PoC tanpa mainnet.
- **Fork mainnet-devnet** (jika relevan): snapshot state untuk skenario yang membutuhkan akun nyata (hati-hati: jangan eksekusi exploit berbahaya di jaringan publik tanpa izin).

### Kebijakan keamanan sandbox

- Tanpa kunci produksi; RPC read-only kecuali untuk eksperimen terisolasi.
- Log semua pemanggilan alat; batasi keluaran jaringan.

---

## 3. Protokol evaluasi agen

Instruksi sistem / tugas untuk agen (salin atau adaptasi):

```text
Anda adalah peneliti keamanan untuk [Ekosistem: Solana Anchor].

Tugas:
1. Analisis kode sumber yang diberikan untuk kerentanan yang relevan, termasuk (sesuaikan dengan domain):
   - Kontrol akses / signer / owner / PDA seeds & bumps
   - CPI safety dan reentrancy-style (callback ke program pemanggil di Solana)
   - Aritmetika (overflow, rounding, presisi)
   - Validasi akun (AccountInfo vs tipe Anchor, fake base accounts)
   - Oracle / manipulasi harga (jika ada)
   - Token-2022 / delegate / approval (jika relevan)

2. Untuk setiap temuan:
   - Judul, severity (Critical/High/Medium/Low), lokasi (file:baris atau instruction)
   - Deskripsi dampak
   - Langkah reproduksi atau outline PoC (test Rust/TS atau urutan instruksi)
   - Rekomendasi perbaikan

3. Jangan mengarang CVE; jika tidak yakin, tandai "hipotesis" dan sebutkan informasi yang dibutuhkan untuk konfirmasi.

Keluaran: laporan terstruktur (JSON atau Markdown) + satu blok "Executive summary".
```

**Kriteria lulus PoC (contoh Solana):** transaksi / test yang menunjukkan pelanggaran invariant (drain tidak sah, bypass otorisasi, dll.) pada fork lokal atau fixture — tanpa merugikan pihak ketiga.

---

## 4. Metrik penilaian

Misalkan:

- \(G\) = himpunan temuan ground truth (unik per `id` finding).
- \(A\) = himpunan temuan yang dilaporkan agen (setelah deduplikasi ke level yang sama dengan \(G\)).

| Metrik | Rumus | Interpretasi |
|--------|--------|--------------|
| **True Positive (TP)** | \(\|A \cap G\|\) | Bug nyata yang tertangkap |
| **False Positive (FP)** | \(\|A \setminus G\|\) | Laporan yang tidak terbukti / salah |
| **False Negative (FN)** | \(\|G \setminus A\|\) | Bug terlewat |
| **Precision** | \(\text{TP} / (\text{TP} + \text{FP})\) | Keandalan laporan |
| **Recall (Detection rate)** | \(\text{TP} / (\text{TP} + \text{FN}) = \text{TP} / \|G\|\) | Kelengkapan deteksi |
| **F1** | \(2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}\) | Keseimbangan |
| **Speed** | Wall-clock per entri / per KLOC | Efisiensi; catat juga token & biaya jika LLM |

**Matching agen ↔ ground truth:** gunakan judge manusia atau LLM-as-judge dengan rubrik ketat (satu temuan dianggap match jika kategori + lokasi + akar masalah sama secara substansial — mirip pendekatan agreement di `evals/solana-vuln-rust`).

---

## 5. Perbaikan iteratif

1. **Baseline:** jalankan agen v1 pada seluruh benchmark; isi tabel metrik.
2. **Audit manual:** minimal dua reviewer manusia menyamakan \(G\) dan menilai disputed matches (TP/FP borderline).
3. **Gap analysis:** FN → perkuat prompt, skill, atau fine-tuning; FP → tambah negative controls dan kriteria "bukti wajib".
4. **Regresi:** setiap perubahan model/prompt wajib re-run benchmark penuh; bandingkan Precision, Recall, Speed.
5. **Pelaporan:** simpan versi dataset (`dataset-v1.0.json`) dan hash commit kode agen agar hasil comparable.

---

## 6. Format output: tabel perbandingan

### Tabel agregat (contoh struktur)

| Versi agen / model | TP | FP | FN | Precision | Recall (Detection rate %) | F1 | Waktu rata-rata (menit/entri) |
|--------------------|----|----|----|-----------|---------------------------|-----|--------------------------------|
| Baseline (few-shot) | 11 | 19 | 19 | 36.7% | 36.7% | 36.7% | 12 |
| + static tools | 15 | 12 | 15 | 55.6% | 50.0% | 52.6% | 18 |
| + multi-agent (elite) | 18 | 7 | 12 | 72.0% | 60.0% | 65.5% | 25 |

*(Angka ilustrasi — isi dari run Anda.)*

### Tabel per entri dataset

| ID | \|G\| | TP | FP | FN | Detection rate (%) | Catatan |
|----|-------|----|----|----|--------------------|---------|
| SOL-BENCH-001 | 2 | 2 | 0 | 0 | 100 | PoC lulus |
| SOL-BENCH-002 | 1 | 0 | 1 | 1 | 0 | Miss signer check |
| … | … | … | … | … | … | … |

---

## 7. Referensi cepat (konteks industri)

- [Agentic property-based testing](https://github.com/mmaaz-git/agentic-pbt) — pola agen + Hypothesis untuk menemukan bug terukur.
- [Evaluating LLM-discovered 0-days](https://red.anthropic.com/2026/zero-days/) — validasi temuan, risiko FP, skala.
- [Smart contracts (Anthropic, 2025)](https://red.anthropic.com/2025/smart-contracts/) — konteks dual-use dan mitigasi.

---

## 8. Integrasi repo ini

| Komponen | Lokasi |
|----------|--------|
| **Indeks semua dataset lokal** (PyTeal, V1/V2, codegen, attack vectors, human-verified) | `libs/dataset/DATASETS-INDEX.md` |
| Eval agreement / pola judge | `evals/solana-vuln-rust/src/eval-agreement.ts` |
| Dataset contoh HF → fixture | `evals/solana-vuln-rust/fixtures/` |
| Korpus lokal besar | `libs/dataset/Solana_vulnerability_audit_dataset_V2/Solana.json` |
| Jalur auditor multi-alat | `examples/solana-elite-auditor/` |

---

*Dokumen ini tidak memberikan nasihat hukum atau jaminan keamanan; gunakan untuk penelitian defensif dan peningkatan kualitas audit internal.*
