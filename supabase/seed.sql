-- Seed pengembangan = data kanonik DESIGN.md bagian 9 (hari ini dianggap Kamis 15 Okt 2026).
-- HANYA untuk lingkungan lokal. Jangan dijalankan di produksi.
-- Tanggal jatuh tempo dipilih agar kewajiban siklus 1-31 Okt = Rp2.500.000:
--   dr. Hendra ke-3 Rp600.000 (11 Okt, belum dibayar), Cicilan Laptop ke-4 Rp600.000 (25 Okt),
--   Koperasi ke-2 Rp800.000 (28 Okt), Arisan Rp500.000 (12 Okt, sudah dibayar).
-- Cicilan Hendra ke-2 jatuh tempo 30 Sep (dibayar telat 2 Okt), jadi di luar siklus Oktober.

begin;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-0000000000a1', 'dev@buku-siklus.local', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.books (id, name, owner_id, payday_day, base_salary_idr, shift_payday_to_workday, timezone)
values ('10000000-0000-4000-8000-000000000001', 'Buku Saya', '00000000-0000-4000-8000-0000000000a1', 1, 9500000, true, 'Asia/Makassar');
-- trigger books_add_owner_member membuat baris book_members (owner) otomatis.

insert into public.debts (id, book_id, direction, name, description, match_aliases, total_idr, category, memo, created_by) values
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owe',  'dr. Hendra',
  'Talangan rawat inap', array['DR HENDRA', 'HENDRA'], 1500000, 'Pribadi',
  'Pinjaman talangan rawat inap. Ditransfer via BCA. Disepakati cicil 3× tanpa bunga.', '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'owe',  'Cicilan Laptop',
  'Home Credit', array['HOME CREDIT INDONESIA', 'HOME CREDIT'], 7200000, 'Elektronik', null, '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'owe',  'Pinjaman Koperasi',
  'Potong gaji', array['KOPERASI PEGAWAI'], 2400000, 'Kantor', null, '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'owe',  'Arisan Bulanan RT 04',
  'Siklus Oktober', array['ARISAN RT 04'], 500000, 'Lingkungan', null, '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'owed', 'Reza Firdaus',
  'Tiket kereta', array['REZA FIRDAUS'], 350000, 'Teman', null, '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'owed', 'Budi Santo',
  'Modal jualan pulsa', array['BUDI SANTO'], 500000, 'Pinjaman teman', null, '00000000-0000-4000-8000-0000000000a1');

-- Jadwal cicilan
insert into public.installments (debt_id, book_id, seq, due_date, amount_idr) values
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, '2026-09-15', 450000),
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 2, '2026-09-30', 450000),
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 3, '2026-10-11', 600000),
 ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 1, '2026-09-28', 800000),
 ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 2, '2026-10-28', 800000),
 ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 3, '2026-11-28', 800000),
 ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 1, '2026-10-12', 500000),
 ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 1, '2026-10-15', 350000),
 ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 1, '2026-11-01', 500000);

-- Cicilan laptop: 12 × Rp600.000, tiap tanggal 25 mulai 25 Jul 2026
insert into public.installments (debt_id, book_id, seq, due_date, amount_idr)
select '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', g,
       (date '2026-07-25' + make_interval(months => g - 1))::date, 600000
from generate_series(1, 12) g;

-- Ledger pembayaran
insert into public.payments (debt_id, book_id, paid_on, amount_idr, reference, created_by) values
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-15', 450000, null,            '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-10-02', 450000, 'MBCA-829103991', '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '2026-07-25', 600000, null,            '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '2026-08-25', 600000, null,            '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '2026-09-25', 600000, null,            '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '2026-09-28', 800000, null,            '00000000-0000-4000-8000-0000000000a1'),
 ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '2026-10-12', 500000, null,            '00000000-0000-4000-8000-0000000000a1');

-- Kotak Masuk: 3 item menunggu (waktu dalam UTC; 08:47 WITA = 00:47 UTC)
insert into public.inbox_events (book_id, source, received_at, masked_text, idempotency_key, suggestion, status) values
 ('10000000-0000-4000-8000-000000000001', 'BCA Mobile', '2026-10-15T00:47:00Z',
  'Transfer keluar Rp600.000 ke HOME CREDIT INDONESIA (rek •••4821)', 'seed-bca-0847',
  '{"kind":"payment","counterparty":"HOME CREDIT INDONESIA","amount_idr":600000,"matched_debt_id":"20000000-0000-4000-8000-000000000002","fields_confidence":{"amount_idr":"high","matched_debt_id":"high"}}', 'pending'),
 ('10000000-0000-4000-8000-000000000001', 'DANA', '2026-10-14T11:12:00Z',
  'Uang masuk Rp300.000 dari REZA FIRDAUS', 'seed-dana-1912',
  '{"kind":"payment","counterparty":"REZA FIRDAUS","amount_idr":300000,"matched_debt_id":"20000000-0000-4000-8000-000000000005","fields_confidence":{"amount_idr":"low","matched_debt_id":"high"}}', 'pending'),
 ('10000000-0000-4000-8000-000000000001', 'BRImo', '2026-10-13T03:20:00Z',
  'Transfer keluar Rp1.200.000 ke AGUS S (rek •••7730)', 'seed-bri-1320',
  '{"kind":"debt","counterparty":"AGUS S","amount_idr":1200000,"matched_debt_id":null,"fields_confidence":{"amount_idr":"high","matched_debt_id":"none"}}', 'pending');

commit;
