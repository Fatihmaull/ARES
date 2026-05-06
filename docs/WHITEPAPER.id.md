# Assurance Run: Orkestrasi Keamanan yang Dapat Diulang untuk Pengembangan Solana

**Produk: ARES Solana Security Tool (ASST)** · **Versi 0.1** — April 2026 · [English](./WHITEPAPER.en.md)

---

## Ringkasan eksekutif

Dokumen ini mendeskripsikan **Assurance Run**, lapisan orkestrasi keamanan yang dibangun di atas **deepagentsjs** (agen kontrol berbasis LangGraph) untuk tim yang mengirimkan program **Solana / Anchor**. Tujuannya bukan “skor AI” sekali jalan, melainkan **paket bukti** yang terikat pada **commit Git**: perintah yang dijalankan, versi alat, log tersaring, dan temuan yang dapat diaudit ulang. Pendekatan ini menargetkan pola kegagalan umum pada integrasi AI dan blockchain—**solution jumping**, **misplaced technology**, dan **uninformed design**—dengan memisahkan peran (analisis vs eksekusi sandbox), menahan kunci penandatanganan di luar loop agen default, dan mengodekan kebijakan keamanan sebagai **skills** yang dapat versi.

---

## Abstrak

Tim Solana bergerak cepat; peralatan keamanan sering terpecah antara pemindai statis, fuzzer, asisten LLM, dan audit manual berkala. Tidak satu pun secara sendiri menghasilkan **jejak** yang cukup kuat untuk apa yang diperiksa **sebelum** perubahan digabungkan. Assurance Run mengusulkan **lapisan orkestrasi agen dalam**—diimplementasikan dengan **deepagentsjs**—yang menjalankan **pemeriksaan berlapis** pada setiap perubahan bermakna, menyimpan **artefak bukti** (manifest, log, kode keluar) terikat pada **SHA Git**, serta memakai **subagen**, **eksekusi ter-sandbox**, dan **human-in-the-loop** opsional untuk tindakan berisiko tinggi. Whitepaper ini menyatakan masalah, proposisi nilai, diferensiasi, konteks pasar, dan non-tujuan secara jujur.

---

## 1. Masalah

### 1.1 Fragmentasi dan ketidakmampuan reproduksi

Pekerjaan keamanan pada program Solana mencakup kebenaran Rust/Anchor, validasi akun, graf CPI, higienis dependensi dan CI, serta—bila AI terlibat—injeksi prompt dan penyalahgunaan alat. Tinjauan LLM sekali jalan jarang melampirkan **riwayat perintah**, **versi alat**, dan **reproduksi deterministik** ke commit tertentu. Tanpa paket itu, organisasi tidak dapat menjawab: **Apa yang dijalankan? Pada SHA apa? Apa yang gagal? Siapa yang mengesampingkan?**

### 1.2 Metafora dan kontrol yang salah tempat

Tiga tekanan yang saling berinteraksi—**AI safety** (alignment dan penyalahgunaan alat), **AI untuk keamanan** (deteksi dan triase), dan **keamanan untuk AI** (kunci, runtime, CI)—menciptakan ketegangan prioritas. Alat yang dibuat untuk satu lapisan sering **salah ditempatkan** di lapisan lain (misalnya analisis hanya bytecode tidak dapat menyelesaikan kegagalan tata kelola atau rekayasa sosial).

### 1.3 Kerumitan khas Solana

Throughput tinggi dan komposabilitas meningkatkan risiko operasional: semantik model akun, validasi PDA, pemeriksaan penandatangan, CPI dan *remaining accounts*, serta *transfer hook* Token-2022 membutuhkan pengujian **berbasis skenario** dan invariant eksplisit—bukan hanya aturan statis generik yang diimpor dari kebiasaan berpusat-EVM.

---

## 2. Solusi: Assurance Run

**Assurance Run** adalah pola produk, bukan satu model saja: alur kerja **agen dalam** yang:

1. **Merencanakan** jalanan terbatas (*diff-aware*, bertingkat risiko).
2. **Mendelegasikan** ke **subagen** dengan mandat sempit (misalnya analisis diff dependensi, pemeriksaan kebijakan, build dan uji di sandbox).
3. **Menyimpan** keluaran sebagai artefak terlampir repositori (`assurance-run.json`, `findings.md`, log ter-hash).
4. **Mengunci** operasi berbahaya dengan **human-in-the-loop** bila perlu (deployment, penandatanganan, pergerakan dana).
5. Mengeluarkan **satu Laporan Assurance** yang cocok untuk tinjauan internal atau persiapan audit eksternal.

Penekanannya **bukti dulu**: pesaing mengoptimalkan skor atau obrolan; Assurance Run mengoptimalkan **reproduktivitas** dan **ruang lingkup sadar-diff**.

### 2.1 Keunggulan operasional: DMAIC dan akuntabilitas rilis

Risiko rantai pasokan perangkat lunak dan insiden besar menunjukkan bahwa jaminan bukan hanya “bug dalam program”—meliputi **dependensi**, **kunci**, dan **tata kelola**. Tim masih sulit menghasilkan **satu catatan terpadu yang dapat diulang dan digabung** bahwa pemeriksaan statis dan uji berjalan sebelum rilis, serta menunjukkan **akuntabilitas** kepada pemangku kepentingan.

**DMAIC** Lean Six Sigma (Define, Measure, Analyze, Improve, Control) memberi sikap disiplin untuk pipeline itu: **Define** CTQ (manifest terikat commit, versi alat); **Measure** lewat exit code, SARIF, dan hasil uji di `assurance/`; **Analyze** dengan skills yang dipetakan ke subagen ([ARCHITECTURE.id.md § 2.6](./ARCHITECTURE.id.md#26-metodologi-audit-skills--subagen)); **Improve** aturan, sandbox, dan keluaran tergabung; **Control** dengan skills terversi, HITL, dan kebijakan CI. Fase **SDLC** (rencana → operasi) selaras dengan artefak yang sama—lihat [ARCHITECTURE.id.md § 3](./ARCHITECTURE.id.md#3-penjajaran-sdlc-dan-lean-six-sigma).

Opsional **digest on-chain** dari hash bukti tergabung (mis. MVP devnet) dapat mengikat tindakan bertanda dompet ke satu run—menaikkan **lantai transparansi** tanpa mengganti audit profesional. Bidang muatan yang disarankan dan prinsip UI: [docs/DASHBOARD-UX.id.md](./docs/DASHBOARD-UX.id.md).

---

## 3. Mengapa deepagentsjs

Ruang kerja **ASST** memaketkan **deepagentsjs**, harness TypeScript berbasis **LangGraph** yang menyediakan:

- **Perencanaan dan dekomposisi tugas** untuk pipa jangka panjang.
- **Arsitektur subagen** untuk memisahkan tugas yang tidak kompatibel (penalaran vs eksekusi sandbox).
- **Middleware filesystem dan skills** agar kebijakan keamanan hidup sebagai artefak **terversi**, bukan prompt sistem sementara.
- **Backend sandbox** (misalnya Deno, Modal, QuickJS, VFS—lihat `deepagentsjs/examples/sandbox/`) agar build dan skrip tidak harus jalan mentah di mesin pengembang.
- **Middleware keseimbangan pemanggilan alat** dan pola ketahanan terkait untuk integrasi CI yang andal.

Logika khusus Solana (build Anchor, alat baca RPC, linter kustom) diberikan sebagai **alat dan skills** di atas harness ini—bukan di dalam inti pustaka.

---

## 4. Proposisi nilai dan pembeda

| Dimensi | Posisi Assurance Run |
|---------|----------------------|
| **Hasil** | **Paket bukti** yang dapat diulang per perubahan bermakna, bukan putusan AI sekali jalan. |
| **Arsitektur** | **Orkestrasi** lintas sinyal statis, eksekusi ter-sandbox, dan kebijakan; bukan satu pemindai generik. |
| **Model kepercayaan** | **Non-tujuan** eksplisit dan **pengesampingan** dengan jejak audit; HITL opsional untuk tindakan tidak dapat dibatalkan. |
| **Pembeda** | Lapisan **pereduksi noise** yang mengelompokkan duplikat dan menurunkan peringkat keluaran LLM kecuali terikat temuan alat atau repro. |

---

## 5. Lanskap pasar dan matriks kompetitor

Pasar mencakup banyak kotak; Assurance Run **mengorkestrasi** lintas kotak alih-alih mengganti setiap alat spesialis.

| Kategori | Fokus tipikal | Kekuatan tipikal | Kontras vs Assurance Run |
|----------|---------------|------------------|---------------------------|
| Obrolan audit AI | Saran cepat | Gesekan rendah | Bukti terikat **commit** lemah; tata kelola **multi-langkah** lemah |
| Pemindai statis / pola | Kelas kerentanan dikenal | Cepat dalam skala | Butuh **orkestrasi** dan kebijakan **sadar Solana** |
| Fuzzer / kerangka harness | Bug logika, kasus ujung | Repro kuat | Butuh **penulisan harness**; agen membantu, tidak mengganti oracle |
| Firma audit manual | Kedalaman, reputasi | Jaminan tinggi | Berbasis **snapshot**; tidak **kontinu** per PR |
| Pemantauan on-chain | Penyalahgunaan runtime | Visibilitas hidup | Melengkapi tetapi tidak memperbaiki cacat kode **pra-deploy** |
| Kebijakan dompet / penandatanganan | Perlindungan kunci | Mengurangi pencurian | Lapisan lain dari jaminan **program** |
| SAST / rahasia CI generik | Repo luas | Cakupan lebar | Tanpa skills kustom, kurang semantik **Anchor/SVM** default |

---

## 6. Non-tujuan

- **Verifikasi formal** tidak diklaim kecuali pembuktinya nyata berjalan dengan **asumsi** dan **cakupan** eksplisit.
- **Tata kelola, rekayasa sosial, dan kompromi kunci** tidak “diselesaikan” oleh analisis program saja; memerlukan kontrol **proses** dan **operasional**.
- **Deployment otonom** atau kunci **kustodial** untuk agen **di luar cakupan** postur default.

---

## 7. Risiko

- **Perubahan toolchain** (Anchor/Rust) membutuhkan **skills** dan **matriks uji** yang terawat.
- **Positif palsu** dari langkah berbantu LLM dapat melatih tim mengabaikan temuan kecuali **triase** dan **kalibrasi severitas** menjadi utama.
- **Dual-use**: orkestrasi yang menjalankan alat kuat harus default ke **hak istimewa minimal** dan eksekusi **ter-sandbox**.

---

## 8. Catatan implementasi (ASST)

Repositori ini berisi **deepagentsjs** sebagai **harness agen** (lihat `deepagentsjs/libs/deepagents`, `deepagentsjs/examples/`). Vertikal keamanan Solana produksi menambahkan **alat kustom** (misalnya RPC hanya-baca, `cargo`/`anchor` di sandbox, integrasi MCP) dan **kebijakan organisasi** sebagai skills. Whitepaper ini mendeskripsikan produk **konseptual**; nama alat konkret dan diagram deployment diserahkan pada tonggak implementasi.

---

## 9. Elevator pitch

Kami membangun lapisan Assurance Run untuk tim Solana: orkestrator agen dalam yang merencanakan dan menjalankan pemeriksaan keamanan berlapis—sinyal statis, build ter-sandbox, kebijakan sadar Anchor—pada setiap perubahan bermakna, dan mengirimkan satu paket bukti yang dapat diulang terikat pada commit Git, bukan skor AI sekali jalan—sehingga Anda mendapat jejak setara audit tanpa memperlambat pengiriman.

---

## 10. Riwayat dokumen

| Versi | Tanggal | Catatan |
|-------|---------|---------|
| 0.1 | 2026-04-12 | Draf awal |

---

*Dokumen ini untuk komunikasi internal dan mitra. Bukan merupakan audit keamanan atau nasihat hukum.*
