---
name: Buku Siklus
version: 2.0
description: Aplikasi pencatat utang-piutang pribadi berpusat pada siklus gajian (tanggal 1). Android, mobile-first, satu pengguna.
colors:
  canvas: '#FBF9F5'
  surface: '#FFFFFF'
  surface-inset: '#F4F1EA'
  border: '#E7E3DA'
  border-strong: '#CFC9BC'
  ink: '#1E1B4B'
  ink-2: '#4B5563'
  muted: '#6B7280'
  on-ink: '#FFFFFF'
  primary: '#1E1B4B'
  primary-pressed: '#2E2A72'
  focus-ring: 'rgba(46, 42, 114, 0.35)'
  status-due-text: '#92400E'
  status-due-bg: '#FFFBEB'
  status-due-mark: '#D97706'
  status-paid-text: '#047857'
  status-paid-bg: '#ECFDF5'
  status-paid-mark: '#10B981'
  status-overdue-text: '#B91C1C'
  status-overdue-bg: '#FEF2F2'
  status-overdue-mark: '#DC2626'
  status-neutral-text: '#4B5563'
  status-neutral-bg: '#F4F1EA'
typography:
  font-family: Plus Jakarta Sans
  money-hero:   {size: 32px, weight: 700, line: 38px, tracking: -0.02em, numeric: tabular}
  display:      {size: 32px, weight: 700, line: 38px, tracking: -0.02em}
  money-lg:     {size: 20px, weight: 700, line: 26px, tracking: -0.01em, numeric: tabular}
  money-md:     {size: 16px, weight: 600, line: 22px, numeric: tabular}
  title:        {size: 20px, weight: 700, line: 26px, tracking: -0.01em}
  section:      {size: 13px, weight: 700, line: 18px, tracking: 0.04em, transform: uppercase}
  body:         {size: 15px, weight: 400, line: 22px}
  body-strong:  {size: 15px, weight: 600, line: 22px}
  caption:      {size: 13px, weight: 400, line: 18px}
  label:        {size: 12px, weight: 600, line: 16px, tracking: 0.02em}
  min-text-size: 12px
rounded:
  chip: 9999px
  input: 12px
  card: 16px
  sheet: 24px
spacing:
  unit: 4px
  page-x: 16px
  section-gap: 24px
  row-y: 14px
  tap-min: 48px
elevation:
  none: 'none'
  sheet: '0 -8px 24px rgba(30, 27, 75, 0.10)'
  fab: '0 6px 16px rgba(30, 27, 75, 0.25)'
motion:
  duration: 150ms
  press-scale: 0.98
  reduced-motion: wajib dihormati (tanpa animasi selain perubahan opasitas)
---

# Buku Siklus: Sistem Desain v2

## 1. Tujuan dan sudut pandang

Satu pertanyaan harus terjawab dalam 3 detik setelah aplikasi dibuka: **"Bulan ini, setelah semua cicilan, uangku sisa berapa, dan apa yang harus kubayar duluan?"**

Gaji cair tanggal 1. Semua tampilan diatur berdasarkan **siklus** (1 sampai akhir bulan), bukan sekadar daftar jatuh tempo. Itulah yang membedakan aplikasi ini dari pencatat utang generik.

Nuansanya seperti buku kas yang rapi: tenang, faktual, padat informasi, tanpa dekorasi. Ketenangan datang dari kejelasan dan keteraturan, bukan dari warna pastel atau kalimat penghibur.

## 2. Aturan anti-slop (wajib, bisa diperiksa)

Setiap aturan di bawah dipakai sebagai kriteria lolos/gagal saat meninjau desain.

1. **Satu fakta, satu tempat.** Angka yang sama tidak tampil di dua blok pada layar yang sama.
2. **Warna berarti status.** Merah hanya untuk terlambat. Amber hanya untuk jatuh tempo dekat (3 hari atau kurang). Hijau hanya untuk lunas/sudah diterima. Indigo untuk identitas dan aksi. Abu untuk selebihnya. Satu item tidak boleh memakai lebih dari satu penanda warna selain teks statusnya (tidak ada latar merah + ikon merah + pill merah sekaligus).
3. **Daftar adalah baris buku kas**, yaitu baris dengan garis pemisah tipis dalam satu permukaan putih. Bukan tumpukan kartu melayang. Kartu hanya untuk: kartu siklus (hero), form, dan bottom sheet.
4. **Tanpa gradient, glassmorphism, emoji, foto stok, atau ilustrasi dekoratif.** Empty state memakai teks dan satu aksi.
5. **Bayangan hanya pada bottom sheet dan FAB.** Kartu dan baris dipisahkan oleh border 1px `border`.
6. **AI tidak diberi panggung.** Tidak ada badge "AI", "OCR", "Realtime", atau persentase keyakinan global. Satu-satunya penanda AI adalah label kecil "Periksa" pada kolom yang keyakinannya rendah di layar konfirmasi.
7. **Copy faktual.** Kalimat pendek, kata kerja jelas, tanpa motivasi, moralisasi, atau klaim yang tidak bisa dibuktikan. Sapaan konsisten memakai "kamu". Tidak ada "Anda".
8. **Setiap angka punya satu sumber.** Semua layar memakai data kanonik di bagian 9.
9. **Setiap layar punya state lengkap**: normal, kosong, memuat (skeleton), galat/offline. Layar dengan data hanya dianggap selesai bila keempatnya ada.
10. **Klaim privasi hanya yang benar.** Data disimpan di server (Supabase), dienkripsi saat transit dan saat diam. Nomor rekening disamarkan sebelum diproses AI. Jangan menulis "enkripsi lokal", "tidak pernah di server", atau "100% aman".

## 3. Warna

| Peran | Token | Nilai | Catatan kontras |
|---|---|---|---|
| Latar halaman | `canvas` | #FBF9F5 | |
| Permukaan kartu/baris | `surface` | #FFFFFF | |
| Area cekung (input, segmented) | `surface-inset` | #F4F1EA | |
| Garis | `border` | #E7E3DA | dekoratif, bukan pembawa informasi |
| Teks utama, tombol | `ink` | #1E1B4B | 15,2:1 di atas `canvas` |
| Teks pendukung | `ink-2` | #4B5563 | di atas 7:1 pada `surface` |
| Teks sekunder terkecil | `muted` | #6B7280 | 4,83:1 pada `surface`, 4,60:1 pada `canvas`. **Gagal (4,29:1) pada `surface-inset`**, jadi di atas area cekung pakai `ink-2` |
| Status jatuh tempo dekat | `status-due-*` | #92400E di #FFFBEB | 6,84:1 |
| Status lunas | `status-paid-*` | #047857 di #ECFDF5 | 5,21:1 |
| Status terlambat | `status-overdue-*` | #B91C1C di #FEF2F2 | 5,91:1 |

Aturan: tidak ada teks yang lebih terang dari `muted`. Warna `#9CA3AF` dilarang untuk teks, termasuk placeholder. Warna `*-mark` (amber/hijau/merah terang) hanya untuk titik, garis progres, dan ikon, tidak pernah untuk teks.

Mode gelap tidak termasuk v1. Token memakai nama semantik agar mode gelap bisa ditambahkan tanpa mengubah komponen.

## 4. Tipografi

Font: Plus Jakarta Sans, dimuat mandiri (bukan CDN). **Verifikasi sebelum dikunci:** pastikan fitur `tnum` (tabular numerals) tersedia pada build font yang dipakai. Jika tidak, angka uang memakai Geist atau font lain yang mendukung `tnum`.

- Semua nominal Rupiah: `font-variant-numeric: tabular-nums`.
- Format: `Rp1.554.329` (tanpa spasi, titik pemisah ribuan, tanpa desimal). Nilai negatif memakai tanda minus sebenarnya (U+2212): `−Rp600.000`.
- Ukuran teks minimum 12px. Tidak ada 10px atau 11px.
- `section` (huruf kapital 13px) hanya untuk judul seksi. Jangan dipakai untuk badge.
- Tanggal: `Sab, 25 Okt`. Tahun hanya muncul jika bukan tahun berjalan. Relatif di samping: `10 hari lagi`, `lewat 4 hari`, `hari ini`.

## 5. Tata letak

- Lebar desain 360 sampai 412px, fluid. Margin sisi 16px. Pada layar lebar, konten dipusatkan dengan lebar maks 480px.
- Ritme: jarak antarseksi 24px, padding baris 14px vertikal, kelipatan 4px.
- Tap target minimum 48px. Jarak antar-target minimal 8px.
- Navigasi bawah, 5 slot: **Beranda, Catatan, [+], Kotak Masuk, Kalender.** Kotak Masuk menampilkan angka jumlah item menunggu. **Pengaturan** diakses dari ikon roda gigi di header kanan atas, bukan tab.
- Header layar: judul 20px di kiri, aksi di kanan. Tanpa avatar, tanpa foto.
- Hormati safe area bawah. FAB melayang 16px di atas bilah navigasi dan tidak menutupi baris terakhir (beri padding bawah daftar).

## 6. Komponen

**Kartu Siklus (hero Beranda).** Satu-satunya hero. Permukaan putih, border 1px, radius 16, tanpa bayangan dan tanpa gradient.
Isi, berurutan: baris kecil `Siklus 1 Okt – 31 Okt`; label `Sisa setelah cicilan`; nominal `money-hero`; bilah segmen tiga warna (terbayar = hijau, belum dibayar = amber, bebas = indigo) setinggi 8px dengan legenda di bawahnya; satu baris `Gajian Min, 1 Nov · 17 hari lagi`. Persentase pada legenda adalah pecahan dari gaji pokok.

**Baris Buku Kas.** Tinggi minimal 64px, dalam satu permukaan dengan pemisah 1px. Kiri: nama pihak (`body-strong`) dan satu baris keterangan (`caption`, `muted`). Kanan: nominal (`money-md`) dan di bawahnya Chip Status. Tidak ada avatar inisial berwarna (opsional lingkaran 36px netral `surface-inset` dengan inisial `ink-2`). Ketukan membuka detail. Tidak ada tombol "Bayar" di setiap baris, aksi bayar ada di detail.

**Chip Status.** Pill penuh, tinggi 24px, titik 6px berwarna `*-mark` di kiri, teks `label` berwarna `*-text` di atas `*-bg`. Varian: `Terlambat 4 hari`, `10 hari lagi`, `Hari ini`, `Lunas`, `Aktif` (netral).

**Bilah progres.** Tinggi 4px, radius penuh, trek `surface-inset`, isi `ink` (utang), `status-paid-mark` jika lunas, `status-overdue-mark` hanya bila terlambat.

**Segmented control** (Utang | Piutang): wadah `surface-inset`, segmen aktif putih dengan border, tinggi 44px. Label tidak boleh pecah dua baris. Jika sempit, gunakan label pendek.

**Tombol.** Primer: latar `primary`, teks putih, tinggi 52px, radius 12. Sekunder: `surface` + border `border-strong`, teks `ink`. Destruktif: teks `status-overdue-text` di atas `status-overdue-bg`. Tekan: skala 0,98 dan `primary-pressed`.

**Input.** Tinggi 52px, radius 12, border 1,5px `border-strong`, fokus `primary-pressed` + ring. Input nominal: awalan `Rp` terkunci, pemisah ribuan otomatis. Placeholder memakai `muted`.

**Kolom Konfirmasi (layar tambah cepat dan Kotak Masuk).** Label kecil di atas, nilai di bawah, bisa diedit. Hanya kolom dengan keyakinan rendah ditandai chip kecil netral `Periksa` dan border `status-due-mark`. Kolom yang yakin tampil biasa, tanpa lencana "Terverifikasi".

**Bottom sheet.** Radius atas 24, pegangan 36×4, bayangan `sheet`, latar gelap transparan 40% di belakang.

**Toggle.** 48×28, aktif `ink`, nonaktif `border-strong`.

**Empty state.** Satu kalimat faktual + satu tombol aksi. Contoh: `Belum ada catatan piutang.` + `Tambah piutang`.

**Skeleton.** Balok `surface-inset` dengan denyut opasitas 150ms-loop lambat, hormati `prefers-reduced-motion`.

**Banner offline.** Strip di bawah header, latar `status-due-bg`, teks `status-due-text`: `Offline. Perubahan akan dikirim saat tersambung.`

## 7. Layar (v1)

1. **Beranda**: header `Beranda` + roda gigi; Kartu Siklus; seksi `Perlu dibayar` (baris buku kas, dikelompokkan `Terlambat`, `Siklus ini`); seksi `Perlu ditagih` (piutang yang jatuh tempo hari ini/lewat); strip dua angka `Total utang` dan `Total piutang` (satu baris, pemisah vertikal, tanpa kartu). Tanpa kartu saran AI dan tanpa kartu "kesehatan keuangan". Bila ada item terlambat, satu baris teks faktual di atas daftar: `1 tagihan terlambat. Bayar dulu: dr. Hendra.` Teks ini dihitung dengan aturan, bukan dihasilkan AI.
2. **Catatan**: segmented `Utang | Piutang`, pencarian, chip filter (`Semua`, `Aktif`, `Terlambat`, `Lunas`), ringkasan satu baris (`Sisa utang Rp7.600.000 · 3 aktif`), baris buku kas dengan bilah progres tipis.
3. **Detail catatan**: nama + chip status; `Sisa` besar; `dari total`; cincin/bilah progres; riwayat pembayaran (timeline ledger, tiap entri: cicilan ke-, tanggal, nominal, tautan `Lihat bukti` bila ada); memo (bisa diedit); tombol primer `Catat pembayaran`. Khusus piutang ada tombol sekunder `Ingatkan lewat WhatsApp` yang membuka tautan `wa.me` dengan pesan terisi (tidak ada pengiriman otomatis).
4. **Tambah cepat** (bottom sheet dari FAB): kotak teks dengan placeholder `Contoh: Budi pinjam 500rb, bayar tanggal 1`; tombol `Lampirkan foto struk`; setelah kirim, kartu konfirmasi dengan kolom Jenis, Pihak, Nominal, Jatuh tempo, Kategori. Tombol `Simpan` dan `Ubah manual`. Tanpa dikte suara di v1.
5. **Kotak Masuk**: daftar notifikasi yang ditangkap dan menunggu konfirmasi. Tiap item: sumber + waktu (`BCA Mobile · hari ini 08:47`), teks notifikasi tersamar, saran pencocokan, tombol `Konfirmasi`, `Ubah`, `Bukan utang`. Item tanpa kecocokan: `Catat sebagai baru` dan `Abaikan`. Layar ini adalah tempat satu-satunya data otomatis masuk ke buku.
6. **Kalender**: satu bulan (`Oktober 2026`), titik status pada tanggal (terlambat, jatuh tempo, lunas), tanggal gajian ditandai cincin indigo, agenda untuk tanggal terpilih di bawahnya. Empty state hanya muncul bila agenda kosong, tidak pernah bersamaan dengan agenda berisi.
7. **Pengaturan**: Akun (email pemilik yang masuk, `Keluar`, `Keluar dari semua perangkat` dengan konfirmasi); Gajian (tanggal cair, gaji pokok bulanan opsional, opsi `Geser ke hari kerja sebelumnya bila jatuh di akhir pekan`); Pengingat (H-3, H-1, Hari H pukul 07:00 WITA, ringkasan gajian); Saluran (Telegram terhubung/belum, push web); Sumber notifikasi (status penerima: `Terakhir menerima 08:47`, daftar aplikasi yang diizinkan, catatan privasi yang benar); Data (ekspor CSV).

## 8. Perilaku dan copy

- Status dihitung dari data (`jatuh tempo < hari ini` = terlambat; selisih 0 sampai 3 hari = dekat). Zona waktu acuan: **Asia/Makassar (WITA)**.
- Konfirmasi sebelum menyimpan hasil AI, selalu. Tidak ada simpan otomatis ke buku.
- Pesan galat menyebut apa yang gagal dan apa yang bisa dilakukan: `Foto tidak terbaca. Coba foto ulang dengan cahaya lebih terang, atau isi manual.`
- Tombol memakai kata kerja: `Catat pembayaran`, `Simpan`, `Tambah piutang`. Hindari `OK`, `Submit`.
- Dilarang: `Tenang`, `Nikmati`, `Aman`, `Prima`, `Pintar`, `Magic`, dan sejenisnya sebagai klaim atau sapaan.

## 9. Data kanonik (dipakai di SEMUA layar dan prompt)

Hari ini: **Kamis, 15 Okt 2026**. Siklus: 1 Okt – 31 Okt 2026. Gajian berikutnya: **Minggu, 1 Nov 2026** (17 hari lagi). Gaji pokok: **Rp9.500.000** (angka contoh).

| Pihak | Jenis | Total | Terbayar | Sisa | Jatuh tempo berikut | Status |
|---|---|---|---|---|---|---|
| dr. Hendra (talangan rawat inap) | Utang | Rp1.500.000 | Rp900.000 (2 × Rp450.000: 15 Sep, 2 Okt) | Rp600.000 | Min, 11 Okt | Terlambat 4 hari |
| Cicilan Laptop, Home Credit | Utang | Rp7.200.000 (12 × Rp600.000) | Rp1.800.000 (3 cicilan) | Rp5.400.000 | Min, 25 Okt: Rp600.000 | 10 hari lagi |
| Pinjaman Koperasi Pegawai | Utang | Rp2.400.000 (3 × Rp800.000) | Rp800.000 (1 cicilan) | Rp1.600.000 | Rab, 28 Okt: Rp800.000 | 13 hari lagi |
| Arisan Bulanan RT 04 | Utang | Rp500.000 | Rp500.000 (dibayar 12 Okt) | Rp0 | , | Lunas |
| Reza Firdaus (tiket kereta) | Piutang | Rp350.000 | Rp0 | Rp350.000 | Kam, 15 Okt, 17:00 | Hari ini |
| Budi Santo (modal jualan pulsa) | Piutang | Rp500.000 | Rp0 | Rp500.000 | Min, 1 Nov | 17 hari lagi |

Turunan (sudah diverifikasi):
- Total sisa utang: **Rp7.600.000** (3 aktif). Total piutang: **Rp850.000** (2 aktif).
- Kewajiban siklus (semua cicilan yang jatuh tempo 1–31 Okt, termasuk yang sudah dibayar): 600.000 + 800.000 + 600.000 + 500.000 = **Rp2.500.000** (26% dari gaji).
- **Sisa setelah cicilan = 9.500.000 − 2.500.000 = Rp7.000.000.**
- Bilah segmen: terbayar Rp500.000 (5%), belum dibayar Rp2.000.000 (21%), bebas Rp7.000.000 (74%).

Kotak Masuk (3 item, `Hari ini 09:34`):
1. BCA Mobile · hari ini 08:47: `Transfer keluar Rp600.000 ke HOME CREDIT INDONESIA (rek ••• 4821)`. Saran: Cicilan Laptop ke-4. Keyakinan tinggi, tanpa tanda `Periksa`.
2. DANA · kemarin 19:12: `Uang masuk Rp300.000 dari REZA FIRDAUS`. Saran: pembayaran sebagian untuk Reza Firdaus (sisa Rp50.000). Nominal diberi tanda `Periksa`.
3. BRImo · Selasa 13 Okt: `Transfer keluar Rp1.200.000 ke AGUS S (rek ••• 7730)`. Tidak ada kecocokan: `Catat sebagai baru` / `Abaikan`.

## 10. Definisi desain selesai

- Semua 7 layar ada, masing-masing dengan state normal, kosong, memuat, galat/offline (minimal satu layar menampilkan tiap state sebagai contoh).
- Semua angka cocok dengan bagian 9. Tidak ada pelanggaran bagian 2.
- Kontras semua teks ≥ 4,5:1, teks besar (≥ 20px tebal) ≥ 3:1. Tidak ada teks < 12px.
- Uji di lebar 360px dan 412px: tidak ada label yang pecah canggung, tidak ada teks bertabrakan, tidak ada scroll horizontal pada halaman.
- Tidak ada pustaka atau aset yang dimuat dari CDN pada versi produksi.

## 11. Keputusan final desain (hasil tinjauan 4 putaran Stitch)

Status: **terkunci.** Acuan visual: enam layar pada putaran ke-3 (Beranda, Catatan, Detail, Kalender, Kotak Masuk, Pengaturan) dan dua frame Tambah catatan (State A, State B) pada putaran ke-4. HTML Stitch hanya referensi visual, bukan basis build (Tailwind CDN, `user-scalable=no`, hex arbitrer). Jika ekspor Stitch bertentangan dengan dokumen ini, dokumen ini yang berlaku.

Frame **Kalender (hari kosong)** dan **Kotak Masuk (kosong)** hanya dipakai sebagai acuan komponen empty state (kartu dengan ikon netral, satu kalimat, satu aksi). Elemen tambahan Stitch di dua frame itu **dibuang** dengan alasan berikut:

1. Header semua layar: judul + ikon gerigi saja. Tanpa ikon orang/avatar.
2. Kalender: tanpa strip "Siklus berjalan" dan tanpa "Tahun Buku 2026/IV" (angka siklusnya salah dan tidak ada gunanya). Empty state hanya `Tidak ada tagihan di tanggal ini.` + `Tambah catatan`, tanpa kalimat penghibur ("Buku kas rapi…"; lagipula salah, karena kewajiban lain tetap ada). Baris `Jatuh tempo terdekat` boleh ada, dihitung dari **hari ini**, bukan dari tanggal terpilih (15 Okt → 25 Okt = `10 hari lagi`). Tanggal hari ini diberi penanda di grid.
3. Kotak Masuk kosong: hapus tombol `Periksa ulang SMS` (aplikasi tidak memindai SMS; data datang lewat webhook), hapus `Sinkronisasi aktif`, dan hapus panel `Sumber terhubung` bawaan Stitch (BCA & Mandiri, GoPay & OVO, Kartu Kredit tidak sesuai Pengaturan). Bila panel sumber dipakai, isinya mengikuti daftar Pengaturan: BCA Mobile, Livin' by Mandiri, BRImo, DANA. Badge navigasi menampilkan jumlah item `pending` dan **disembunyikan bila 0**. Subjudul `0 menunggu konfirmasi` harus konsisten dengan badge.
4. Catatan: hapus label `AKTIF` di kanan ringkasan. Beranda: pill `Hari ke-15 / 31` opsional, tidak wajib.
5. Label hero Beranda memakai `Sisa kas setelah cicilan`. Beranda hanya menampilkan piutang yang jatuh tempo hari ini atau terlambat di `Perlu ditagih` (Budi Santo tampil di Catatan dan Kalender, bukan di Beranda).
6. Tipografi: semua teks 12px atau lebih, termasuk label navigasi, angka badge, huruf `G` di legenda Kalender, dan keterangan `Siklus 1 Okt – 31 Okt` pada sheet Tambah catatan.
7. Kontras: teks hijau selalu `#047857` (bukan `#3A9976`, hanya 3,16–3,50:1). Teks sekunder di atas `surface-inset` selalu `#4B5563`.
8. Toggle 48×28 hanya ukuran visual. Seluruh baris pengaturan yang memuatnya harus bisa diketuk (≥ 48px).
9. State yang tidak digambar Stitch (memuat/skeleton, galat, offline) dibangun langsung dari komponen di bagian 6, tanpa putaran desain tambahan.

Penyesuaian saat implementasi (15 Okt 2026, diverifikasi di 360px dan 412px):

10. Kontrol segmen Utang | Piutang: segmen 44px dalam wadah 52px (bukan 48px per segmen), agar wadah tetap ≤ 52px.
11. Beranda: kalimat ringkasan "terlambat" dibuang. Status terlambat sudah dinyatakan oleh grup `Terlambat`, chip merah, dan hitungan hari; kalimat ketiga hanya mengulang.
12. Ikon filter pada Catatan tidak dibuat: chip `Semua / Aktif / Terlambat / Lunas` sudah memenuhi fungsinya.
13. Banner offline: `Kamu sedang offline. Data terakhir ditampilkan.` Tidak ada tombol; banner hilang sendiri saat koneksi kembali.
14. Baris cicilan terakhir di Detail: judul `Cicilan ke-N`, keterangan `Cicilan terakhir`. Kata `Pelunasan` hanya untuk catatan sekali bayar.

Penambahan saat membangun login (15 Okt 2026, diverifikasi di 360px dan 412px):

15. **Akun di Pengaturan.** Satu-satunya mitigasi "HP hilang" yang disebut CLAUDE.md adalah sesi yang bisa dicabut, jadi `Keluar` dan `Keluar dari semua perangkat` ada di Pengaturan, bagian `Akun`. Yang kedua bertombol destruktif dan meminta konfirmasi satu langkah yang menjelaskan akibatnya. Bagian Pengaturan yang belum dibangun dinyatakan jujur di layar (`Pengaturan lain belum dibangun.`).
16. **Layar Masuk** (di luar tujuh layar utama): tipografis dan rata kiri, tanpa kartu, tanpa logo dalam kotak, tanpa tagline. Dari atas: garis `ink` setebal 2px (seperti garis judul buku kas), label `BUKU SIKLUS` (token `section`), judul `Masuk` (token `display`), lalu `Email` dan `Kata sandi` (dengan tombol tampilkan/sembunyikan berukuran ketuk 48px) langsung di atas kanvas, dan tombol primer `Masuk` tepat di bawah kolom. Tombol **tidak** ditempel ke dasar layar: Chrome di Android tidak mengecilkan layout saat keyboard muncul, sehingga tombol di dasar akan tertutup keyboard. Tanpa pendaftaran dan tanpa "lupa kata sandi": akun dikelola lewat dashboard Supabase, dan hal itu tidak dijelaskan di layar. Keyboard: `Email` memakai tombol `next`, `Kata sandi` memakai `go` (Enter mengirim form).
17. **Kolom isian dan galat formulir.** Galat per kolom memakai garis tepi `ink`, ikon, dan teks tebal, bukan warna merah, supaya aturan "warna berarti status" tetap utuh.

Penambahan saat membangun Catat pembayaran (15 Okt 2026, diverifikasi di 360px dan 412px):

18. **Catat pembayaran** adalah layar (rute `/catatan/:id/bayar`), bukan bottom sheet, supaya tombol Kembali Android bekerja. Isi: nama catatan + `Sisa …` (satu kali), `Nominal dibayar`/`Nominal diterima` (awalan `Rp` terkunci, pemisah ribuan otomatis, terisi sebesar tagihan berikutnya), `Tanggal bayar`/`Tanggal terima` (bawaan hari ini, tidak boleh setelah hari ini), `Referensi (opsional)`, `Catatan (opsional)`, tombol `Simpan`. Tanpa pratinjau "sisa setelah ini" karena sisa dihitung SQL. State: normal, menyimpan, galat (per kolom dan per formulir), memuat, tidak ditemukan, sudah lunas.
19. **Riwayat pembayaran di Detail**: tiap baris pembayaran bisa diketuk (ikon panah netral di kanan) dan membuka layar `Pembayaran`. Baris yang sudah dibatalkan berlabel `Dibatalkan` dengan nominal netral (bukan hijau); entri pembalik berlabel `Dikoreksi`. Tombol primer `Catat pembayaran` di bawah Memo, hanya bila sisa > 0.
20. **Layar Pembayaran** (rute `/catatan/:id/pembayaran/:pid`): rincian entri; bila bisa dibatalkan, kolom `Alasan (opsional)` dan tombol destruktif `Batalkan pembayaran` dengan konfirmasi yang menyebut entri pembalik (`Dicatat entri pembalik −Rp450.000 bertanggal 15 Okt. Pembayaran asli tetap tampil di riwayat.`) dan tombol `Batal`. Tidak ada edit atau hapus. Koreksi nominal = batalkan lalu catat baru.
21. **Hasil "belum pasti tersimpan"** (koneksi putus dan pemeriksaan gagal): kolom dikunci, tombol menjadi `Kirim ulang` (id yang sama, aman) dan muncul `Lihat riwayat`. Offline: penulisan ditolak dengan pesan, tidak diantre.

Penambahan saat membangun Pengaturan Gajian (15 Okt 2026, diverifikasi di 360px dan 412px):

22. **Baris pengaturan.** Bagian Pengaturan selain Akun memakai daftar buku kas (satu permukaan, baris dipisah garis 1px): label tebal di kiri, nilai saat ini (`ink-2`, angka tabular) dan ikon panah di kanan, tinggi minimal 56px. Ketukan membuka layar isian sendiri (bukan sunting di tempat), supaya tombol Kembali Android bekerja dan galat punya ruang.
23. **Gajian** (bagian Pengaturan + layar `/pengaturan/gajian`): baris `Tanggal gajian` (`Tanggal 1`) dan `Gaji pokok bulanan` (`Rp9.500.000` atau `Belum diisi`). Layar isian: `Tanggal gajian` (keyboard angka, 1–28, karena setiap bulan punya tanggal 28) dan `Gaji pokok bulanan (opsional)` (awalan `Rp`, kosong berarti tidak dipakai; kartu siklus Beranda lalu menampilkan `Kewajiban siklus`, bukan `Sisa kas setelah cicilan`), tombol `Simpan`. Opsi `Geser ke hari kerja sebelumnya` **belum dibangun**: artinya bergantung pada pertanyaan terbuka CLAUDE.md nomor 2. Menyimpan bersifat idempoten (mengisi nilai, bukan menambah baris), jadi galat apa pun aman diulang dengan `Simpan` lagi.
24. **Ganti kata sandi** (baris `Kata sandi` → `Ganti` di bagian Akun; layar `/pengaturan/kata-sandi`): `Kata sandi saat ini`, `Kata sandi baru` (petunjuk `Minimal 10 karakter.`), `Ulangi kata sandi baru`, masing-masing dengan tombol tampilkan/sembunyikan sendiri; tombol primer `Ganti kata sandi`. Kata sandi saat ini selalu diminta (Supabase sendiri tidak memintanya, jadi HP yang terbuka bisa dipakai orang lain untuk menggantinya). Sandi lama salah ditandai di kolomnya sendiri (`Kata sandi saat ini salah.`); ini tidak membocorkan apa pun karena pengguna sudah masuk. Sesudah berhasil, formulir diganti panel status: `Kata sandi sudah diganti.` + `Perangkat ini tetap masuk. Perangkat lain yang masuk dengan akun ini akan diminta masuk lagi, paling lama setelah 1 jam.` + tombol sekunder `Kembali ke Pengaturan`. Tidak ada keluar otomatis.

## 12. Buku (celah desain, belum divisualkan Stitch)

Aplikasi mendukung lebih dari satu **buku** (mis. "Buku Saya", "Buku Pacar"). Enam layar terkunci hanya menggambar satu buku, jadi dua elemen berikut ditambahkan dan dibangun dari komponen di bagian 6, bukan dari Stitch:

1. **Pemilih buku.** Chip netral (tinggi 32px, area ketuk 48px) tepat di bawah judul header pada Beranda, Catatan, Kalender, dan Kotak Masuk: nama buku + ikon panah. Hanya muncul bila pemilik punya lebih dari satu buku (mis. `Buku Saya` dan `Buku Pacar`, dua-duanya milik akun pemilik). Ketukan membuka bottom sheet `Pilih buku`: satu baris per buku (nama, `Sisa utang Rp…`), penanda buku aktif, dan tombol sekunder `Kelola buku`.
2. **Kelola buku** (dibuka dari Pengaturan dan dari sheet): nama buku, hari gajian, gaji pokok bulanan (opsional), zona waktu, daftar anggota dengan peran (`Pemilik`, `Penyunting`, `Pembaca`), `Arsipkan buku`. Tidak ada undangan atau berbagi: aplikasi hanya dipegang pemilik (keputusan 15 Okt 2026), jadi daftar anggota hanya menampilkan pemilik dan tidak dibangun di v1.

Aturan perilaku:
- Semua angka pada satu layar berasal dari **satu** buku. Tidak ada total gabungan antar-buku.
- Bila `base_salary_idr` buku kosong (mis. Buku Pacar), Kartu Siklus menampilkan `Kewajiban siklus Rp…` tanpa baris `Sisa setelah cicilan`.
- Kotak Masuk otomatis hanya untuk buku pemilik perangkat. Buku lain menampilkan empty state biasa dan input manual lewat Tambah catatan.
- Sheet Tambah catatan menampilkan nama buku tujuan di bawah judul (`Disimpan di: Buku Saya`) dan bisa diganti.

