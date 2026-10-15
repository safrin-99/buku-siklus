# CLAUDE.md: Buku Siklus

Aplikasi pencatat utang-piutang pribadi berpusat pada siklus gajian (cair tanggal 1 tiap bulan). Android, PWA. Satu pengguna login (pemilik); data hidup dalam "buku" sehingga pemilik juga bisa mencatat buku terpisah untuk orang lain (mis. pacar), diinput manual oleh pemilik; tidak ada fitur berbagi. Data masuk otomatis dari notifikasi bank/e-wallet milik pengguna, **selalu dikonfirmasi manusia** sebelum masuk buku.

Sumber kebenaran desain: `DESIGN.md` (token, komponen, layar, data kanonik). Baca sebelum menyentuh UI.

## Stack (keputusan, jangan diganti tanpa diskusi)

- Frontend: Vite + React + TypeScript (strict), Tailwind v4 (compiled, **bukan CDN**; `@theme` mengosongkan palet bawaan sehingga hanya token DESIGN.md yang ada), TanStack Query, Zod, `lucide-react`, react-router-dom, `@supabase/supabase-js` (sesi + PostgREST; menulis sendiri alur sesi/refresh token berarti lebih banyak kode keamanan). Font Plus Jakarta Sans via Fontsource (self-host; wajib `tabular-nums` untuk angka karena digit bawaannya proporsional). Pengelola paket: **pnpm**. `react-hook-form` dan `vite-plugin-pwa` **belum dipasang**; tambahkan saat layar form dan PWA dibangun.
- Backend: Supabase (Postgres + RLS, Auth, Storage privat, Edge Functions TypeScript/Deno, `pg_cron` + `pg_net`).
- AI: Claude API, hanya dari Edge Function. Nama model dari env (`AI_MODEL_TEXT`, `AI_MODEL_VISION`), jangan di-hardcode.
- Penangkap notifikasi: MacroDroid/Tasker di HP, POST ke Edge Function `ingest-notification`.
- Pengingat: Telegram bot (utama), web push (cadangan).
- Python **tidak dipakai di v1**. Hitungan ada di SQL. Simulasi pelunasan (snowball/avalanche) ditunda.

## Struktur repo

```
supabase/
  config.toml            # konfigurasi LOKAL (supabase start); sign-up dimatikan. Bukan sumber kebenaran proyek asli
  migrations/            # SQL berurutan, jangan edit migrasi yang sudah diterapkan
  scripts/first-book.sql # dijalankan manual SEKALI di SQL Editor untuk membuat buku pertama (bukan migrasi)
  functions/
    ingest-notification/ # webhook dari MacroDroid
    parse-entry/         # teks/foto -> inbox_events (AI)
    send-reminders/      # dipanggil pg_cron
  seed.sql               # data kanonik dari DESIGN.md bagian 9 (hanya lokal)
tests/
  db.test.mjs            # uji skema + RLS dengan PGlite (node --test)
src/
  app/                   # routing, guard (RequireAuth), gerbang data (DataGate), galat konfigurasi
  auth/                  # AuthService (Supabase + fixture), pemetaan galat, AuthProvider
  lib/{money,dates,status,derive,cx,config,env,supabase}.ts
  data/                  # DataSource, konteks, skema Zod, fixture hasil SQL
  integration/           # uji terhadap Supabase LOKAL sungguhan (*.local.test.ts; pnpm test:local)
  pages/                 # layar (Beranda, Catatan, Detail, Masuk, Pengaturan, Placeholder)
  components/{ui,layout}/  # komponen sesuai DESIGN.md
scripts/                 # gen-fixtures.mjs, audit-ui.mjs, e2e-local.mjs, lib/browser.mjs (pembantu bersama)
```

## Perintah

- `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (vitest, 84 tes termasuk uji kontrak SQL → Zod)
- Env (`.env.local`, lihat `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (hanya kunci publishable/anon). Build produksi **gagal** bila env kosong atau berisi kunci rahasia (`sb_secret_`/`service_role`). Data contoh hanya lewat `pnpm dev:fixture` (`--mode fixture`); build biasa tidak memuatnya.
- `pnpm test:db` (14 tes skema + RLS + fixture tidak basi, PGlite, ±40 detik)
- `pnpm test:local` (17 tes integrasi ke Supabase lokal sungguhan: GoTrue + PostgREST + RLS lewat HTTP; butuh Docker dan `supabase start`; menolak URL non-lokal karena ledger tidak bisa dihapus)
- `pnpm e2e:local` (7 langkah di Chromium asli terhadap stack lokal: login salah/benar, data tampil, sesi bertahan setelah reload, Detail, Keluar, Keluar dari semua perangkat; membangun sendiri ke `dist-e2e/`)
- `pnpm gen:fixtures` membangkitkan ulang `src/data/fixtures.generated.json` dari SQL asli. Wajib dijalankan setelah migrasi atau `seed.sql` berubah; `test:db` gagal bila lupa.
- `pnpm audit:ui` (membangun sendiri dalam mode fixture ke `dist-fixture/`): membuka build di Chromium 360px dan 412px, memeriksa overflow, teks < 12px, kontras, target < 44px, nama aksesibel, emoji, angka tabular, termasuk keadaan setelah interaksi; tangkapan layar ke `audit-out/`. Simulasi state: `?fixture=loading|slow|error|empty|signedout`.
- `supabase start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit` (hanya db, gateway, auth, REST; cukup untuk `test:local`), `supabase db reset`. Migrasi + seed sudah terbukti lolos di Postgres Supabase lokal; `supabase functions serve` belum dijalankan.
- Sebelum menyatakan tugas selesai: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` harus lulus. Bila menyentuh auth, data, atau tulis: jalankan juga `pnpm test:local` dan `pnpm e2e:local` (butuh Supabase lokal menyala); bila menyentuh UI: `pnpm audit:ui`.

## Status implementasi

Sudah: skema + RLS + seed (teruji di PGlite dan Postgres Supabase lokal), lapisan data (DataSource: fixture dari SQL dan Supabase), komponen UI, layar Beranda, Catatan, Detail (baca saja), login pemilik (email + kata sandi), layar Masuk, Pengaturan bagian Akun (Keluar, Keluar dari semua perangkat). Jalur baca Supabase teruji end-to-end di browser terhadap stack lokal (belum terhadap proyek asli).
Belum: Catatan baru (Tambah catatan), Catat pembayaran, Kotak Masuk, Kalender, Pengaturan (selain Akun), RPC `create_debt`, Edge Function, PWA, pemilih buku. Rute belum dibangun menampilkan `Placeholder` yang jujur.

## Model data: buku (keputusan)

- Semua data hidup di dalam sebuah **buku** (`books`). Tabel anak (`debts`, `installments`, `payments`, `inbox_events`) membawa `book_id`; relasi anak memakai FK komposit `(id, book_id)` agar tidak ada data lintas buku.
- Hak akses = keanggotaan buku (`book_members`: `owner` / `editor` / `viewer`), dicek lewat `can_read(book_id)` dan `can_write(book_id)` di RLS. Jangan menulis kebijakan berbasis `user_id` langsung pada tabel anak.
- Hari gajian, gaji pokok, dan zona waktu adalah kolom **per buku**. Ringkasan siklus ("sisa setelah cicilan") dihitung per buku dan **tidak pernah dicampur antar-buku**.
- Buku tidak dihapus, hanya diarsipkan (`archived_at`). Pembayaran append-only; koreksi lewat entri pembalik.
- **Keputusan (15 Okt 2026): aplikasi hanya dipegang pemilik.** Tidak ada pengguna kedua. Buku untuk orang lain (mis. pacar) adalah buku terpisah milik akun pemilik, diinput manual oleh pemilik. Tabel `book_members` tetap ada (pemilik otomatis jadi `owner`), tapi **UI undangan/berbagi tidak dibangun**. Jangan membangunnya tanpa keputusan baru.
- Catatan dan notifikasi yang masuk otomatis hanya milik perangkat pengguna. Buku orang lain **tidak punya penangkap otomatis**; isinya diinput manual/teks bebas.
- Membuat catatan beserta jadwal cicilan harus atomik: buat RPC `create_debt` (catatan + cicilan dalam satu transaksi) dan cek `debt_integrity_issues` kosong. Jangan menyisipkan dari klien dalam dua langkah terpisah.
- Perhitungan (status, siklus, sisa) ada di fungsi SQL `debt_list` dan `cycle_summary`; frontend hanya menampilkan. `p_today` bisa diisi untuk tes.

## Privasi data orang lain

- Buku yang berisi data keuangan orang lain hanya dibuat dengan sepengetahuan orang itu. Aplikasi tidak menyimpan data pihak ketiga lebih dari yang perlu (nama, nominal, jatuh tempo).
- Jangan menambahkan fitur yang memberi tahu atau menagih pihak ketiga secara otomatis. Pengingat ke orang lain hanya lewat tautan `wa.me` yang dikirim manual oleh pengguna.

## Aturan inti

### Uang
- Rupiah disimpan sebagai `bigint` (tanpa desimal) di DB. Di JS memakai `number` bilangan bulat; semua operasi lewat `src/lib/money.ts` dan wajib `Number.isSafeInteger`. **Dilarang float untuk uang.**
- Format tampilan hanya lewat `formatRupiah()`: `Rp1.554.329`, negatif `−Rp600.000` (U+2212).
- Pembayaran adalah **ledger append-only** (`payments`). Sisa utang = total − jumlah pembayaran, dihitung lewat view SQL. Jangan menyimpan "sisa" sebagai kolom yang diedit. Koreksi dilakukan dengan entri baru (pembalik), bukan UPDATE/DELETE.

### Tanggal dan zona waktu
- Zona acuan bisnis: **Asia/Makassar (WITA, UTC+8)**. Tanggal jatuh tempo bertipe `date`; waktu kejadian `timestamptz` (UTC).
- Hari gajian = `books.payday_day` (default 1, batas 1–28). Siklus = dari gajian ke hari sebelum gajian berikutnya. Logika siklus ada di satu tempat: `src/lib/dates.ts` dan padanannya di SQL; keduanya diuji dengan kasus yang sama.
- `pg_cron` berjalan UTC: pengingat 07:00 WITA = `0 23 * * *`.
- Status dihitung, bukan disimpan: terlambat bila jatuh tempo < hari ini (WITA); dekat bila selisih 0–3 hari; lunas bila sisa = 0.

### AI
- AI hanya **mengekstrak dan menyarankan**. AI tidak menghitung uang, tidak menulis ke `debts`/`payments`, dan tidak pernah menyimpan otomatis.
- Alur: input → Edge Function → output JSON terstruktur divalidasi Zod → baris `inbox_events` berstatus `pending` → pengguna konfirmasi di Kotak Masuk → baru tulis ke `payments`/`debts`.
- Skema keluaran: `{ kind: 'debt'|'receivable'|'payment', counterparty, amount_idr, due_date, fields_confidence: {...}, matched_debt_id? }`. Kolom dengan keyakinan rendah ditandai `Periksa` di UI. Tidak ada persentase global.
- Samarkan sebelum dikirim ke API AI dan sebelum disimpan: urutan ≥ 6 digit diganti `•••` + 4 digit terakhir; hapus saldo rekening bila terdeteksi.
- Kunci API hanya di secret Edge Function. Tidak pernah di bundle frontend.

### Keamanan
- RLS aktif di **semua** tabel sejak migrasi pertama. Kebijakan berbasis keanggotaan buku (`can_read`/`can_write`). Tes RLS ada di `tests/db.test.mjs` (orang asing, `anon`, `viewer`, `editor`) dan harus tetap lulus.
- Service role key hanya di Edge Function, tidak pernah di klien.
- **Satu pemilik = matikan pendaftaran publik.** Di Supabase Auth nonaktifkan sign-up setelah akun pemilik dibuat (atau batasi ke satu email). RLS tetap mengisolasi data, tapi pendaftaran terbuka memberi orang asing akun dan beban pada kuota proyek.
- HP hilang = data keuangan terbuka. Sesi PWA harus bisa dicabut (Supabase: sign out semua sesi) dan layar kunci perangkat aktif. Pertimbangkan kunci aplikasi (PIN/biometrik) setelah v1. **Batas yang terbukti (uji lokal):** "Keluar dari semua perangkat" mencabut refresh token dan ditolak GoTrue, tetapi token akses yang sudah terbit tetap diterima PostgREST sampai kedaluwarsa. Persingkat `JWT expiry` di dashboard (Authentication > Sessions/JWT) untuk mempersempit jendela itu.
- Hanya kunci publishable/anon yang boleh ada di env klien (`VITE_*` ditanam ke bundle). `config.ts` menolak `sb_secret_` dan JWT `service_role`, dan `vite build` gagal bila terdeteksi. Cache TanStack dikosongkan saat keluar; sesi tidak dibaca dari URL (`detectSessionInUrl: false`).
- Webhook `ingest-notification`: verifikasi HMAC-SHA256 (header tanda tangan + timestamp, toleransi ±5 menit), allowlist nama paket aplikasi, kunci idempotensi (hash paket+waktu+teks), batasi laju. Tolak selain itu dengan 401/429, tanpa detail.
- Bucket Storage untuk foto struk privat; akses lewat signed URL berumur pendek.
- Jangan mencatat (log) isi notifikasi, nominal, atau nama pihak ke log fungsi.

### UI
- Ikuti `DESIGN.md`. Warna, radius, ukuran font **hanya lewat token** Tailwind (`@theme`). Dilarang hex atau `text-[11px]` di komponen.
- Dilarang: CDN untuk script/font/ikon, gradient, emoji di UI, teks < 12px, `user-scalable=no`, badge AI.
- Setiap layar punya state: normal, kosong, memuat, galat/offline.
- Teks UI Bahasa Indonesia, sapaan "kamu". Identifier kode dan komentar dalam bahasa Inggris.
- Semua elemen interaktif punya label aksesibel dan target ≥ 48px.

## Cara bekerja

- Perubahan skema: tulis migrasi baru (jangan edit yang sudah diterapkan), perbarui `seed.sql` dan `tests/db.test.mjs`, jelaskan dampak pada view/fungsi. Minta persetujuan sebelum migrasi yang menghapus atau mengubah tipe kolom.
- Tugas besar (> 3 file atau menyentuh skema/keamanan): tulis rencana singkat dulu, tunggu persetujuan.
- Perubahan kecil dan bedah. Jangan refaktor di luar tugas. Jangan menambah dependensi tanpa alasan tertulis.
- Tes wajib untuk: `money.ts`, perhitungan siklus dan status, parser hasil AI (kasus rusak/ambigu), RLS, verifikasi HMAC webhook.
- Data contoh = `DESIGN.md` bagian 9. Jangan membuat angka baru yang bertentangan.

## Definisi selesai

Typecheck, lint, dan tes lulus; tidak ada hex/ukuran font di luar token; keempat state layar ada; RLS diuji; tidak ada rahasia di klien atau di log; perilaku diverifikasi di viewport 360px dan 412px.

## Pertanyaan terbuka (jangan putuskan sendiri)

1. ~~Apakah pacar punya akun sendiri?~~ **Sudah diputuskan: tidak.** Hanya pemilik. Jika nanti berubah, mulai dari `book_members` (skema sudah siap) dan desain ulang auth + pengingat per pengguna.
2. Gaji yang jatuh di hari Minggu/libur (mis. 1 Nov 2026): apakah cair lebih awal? Menentukan arti opsi `shift_payday_to_workday`. Saat ini opsi itu hanya memengaruhi tampilan/pengingat, bukan batas siklus.
3. Supabase gratis vs berbayar: proyek gratis bisa dijeda saat tidak aktif, dan pengingat ikut berhenti.
4. Jika MacroDroid tidak andal, bangun app Kotlin tipis berbasis `NotificationListenerService` (di luar v1).
5. Desain belum memuat pemilih buku dan layar kelola buku (lihat DESIGN.md bagian 12).
