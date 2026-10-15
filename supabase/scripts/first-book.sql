-- Membuat BUKU PERTAMA untuk akun pemilik. Jalankan SEKALI di Supabase Dashboard > SQL Editor (proyek asli),
-- setelah akun pemilik dibuat di Authentication > Users. Ini BUKAN migrasi: `supabase db push` tidak menjalankannya.
--
-- Kenapa lewat SQL: SQL Editor berjalan sebagai `postgres` (auth.uid() = null), jadi pemilik harus disebut eksplisit.
-- Aman dijalankan ulang: tidak membuat buku kedua bila akun itu sudah punya buku.
--
-- Ganti nilai berikut sebelum menjalankan:
--   'GANTI-DENGAN-EMAILMU'  email akun pemilik (persis seperti di Authentication > Users)
--   payday_day (1)          tanggal gajian cair, 1 sampai 28
--   base_salary_idr (null)  gaji pokok bulanan, bilangan bulat Rupiah tanpa titik (mis. 9500000), atau null bila tidak dipakai
-- Hasilnya satu baris (id buku). Nol baris berarti email tidak ditemukan atau akun itu sudah punya buku.

insert into public.books (name, owner_id, payday_day, base_salary_idr, timezone)
select 'Buku Saya', u.id, 1, null, 'Asia/Makassar'
from auth.users u
where lower(u.email) = lower('GANTI-DENGAN-EMAILMU')
  and not exists (select 1 from public.books b where b.owner_id = u.id)
returning id, name, owner_id, payday_day, base_salary_idr;
