-- Buku Siklus: membuat catatan secara atomik dan menjaga integritasnya di server.
--
-- 1. create_debt: catatan + seluruh jadwal cicilannya dalam SATU transaksi (CLAUDE.md: jangan menyisipkan dari klien
--    dalam dua langkah terpisah). Memvalidasi ulang semua yang divalidasi klien: nama, panjang teks, nominal > 0,
--    jumlah cicilan = total, tanggal masuk akal. SECURITY INVOKER: RLS dan hak tabel pemanggil tetap berlaku, jadi hanya
--    pemilik/penyunting buku yang bisa membuat catatan di buku itu. Idempoten terhadap id buatan klien: kirim ulang setelah
--    respons hilang mengembalikan id yang sama, bukan catatan ganda.
-- 2. UPDATE pada debts dibatasi ke kolom teks. Total, jenis, dan buku tidak bisa diubah lewat API (sebelumnya bisa), karena
--    mengubah total tanpa jadwal cicilan dan ledger merusak sisa dan status. Koreksi nominal = hapus lalu buat ulang
--    (hanya bila belum ada pembayaran; FK payments → debts sudah ON DELETE RESTRICT).
-- 3. Batas panjang teks di tabel, supaya penyuntingan langsung lewat API juga tervalidasi.

alter table public.debts
  add constraint debts_name_len        check (char_length(name) <= 80),
  add constraint debts_description_len check (description is null or char_length(description) <= 200),
  add constraint debts_category_len    check (category is null or char_length(category) <= 40),
  add constraint debts_memo_len        check (memo is null or char_length(memo) <= 2000);

create function public.create_debt(
  p_id           uuid,
  p_book         uuid,
  p_direction    public.debt_direction,
  p_name         text,
  p_total_idr    bigint,
  p_installments jsonb,              -- [{"due_date": "2026-10-25", "amount_idr": 600000}, ...]
  p_description  text default null,
  p_category     text default null,
  p_memo         text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name        text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_category    text := nullif(btrim(coalesce(p_category, '')), '');
  v_memo        text := nullif(btrim(coalesce(p_memo, '')), '');
  v_count       int;
  v_sum         numeric;
  v_bad         int;
begin
  if p_id is null or p_book is null or p_direction is null then
    raise exception using errcode = '22023', message = 'create_debt: id, buku, dan jenis wajib diisi';
  end if;

  -- Idempoten: catatan dengan id ini sudah ada di buku ini (kirim ulang setelah respons hilang).
  if exists (select 1 from public.debts d where d.id = p_id and d.book_id = p_book) then
    return p_id;
  end if;

  if char_length(v_name) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'create_debt: nama wajib, paling banyak 80 karakter';
  end if;
  if p_total_idr is null or p_total_idr <= 0 then
    raise exception using errcode = '22023', message = 'create_debt: total harus lebih dari 0';
  end if;
  if jsonb_typeof(p_installments) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'create_debt: jadwal cicilan harus berupa daftar';
  end if;

  v_count := jsonb_array_length(p_installments);
  if v_count not between 1 and 120 then
    raise exception using errcode = '22023', message = 'create_debt: jadwal harus berisi 1 sampai 120 cicilan';
  end if;

  -- Tiap cicilan: tanggal valid dalam rentang wajar, nominal bilangan bulat > 0. Cast yang gagal (teks, pecahan,
  -- tanggal yang tidak ada) melempar galat sendiri sebelum apa pun disimpan.
  select count(*) filter (
           where e->>'due_date' is null or e->>'amount_idr' is null
              or (e->>'due_date')::date not between date '2000-01-01' and date '2100-12-31'
              or (e->>'amount_idr')::bigint <= 0),
         sum((e->>'amount_idr')::bigint)
    into v_bad, v_sum
    from jsonb_array_elements(p_installments) e;
  if v_bad > 0 then
    raise exception using errcode = '22023', message = 'create_debt: tanggal atau nominal cicilan tidak valid';
  end if;
  if v_sum <> p_total_idr then
    raise exception using errcode = '22023', message = 'create_debt: jumlah cicilan harus sama dengan total';
  end if;

  insert into public.debts (id, book_id, direction, name, description, total_idr, category, memo)
  values (p_id, p_book, p_direction, v_name, v_description, p_total_idr, v_category, v_memo);

  -- Urutan cicilan mengikuti tanggal jatuh tempo (lalu urutan kiriman bila tanggalnya sama).
  insert into public.installments (debt_id, book_id, seq, due_date, amount_idr)
  select p_id, p_book,
         row_number() over (order by (e.value->>'due_date')::date, e.ordinality)::int,
         (e.value->>'due_date')::date,
         (e.value->>'amount_idr')::bigint
    from jsonb_array_elements(p_installments) with ordinality as e(value, ordinality);

  return p_id;
end $$;

-- CREATE FUNCTION memberi EXECUTE ke PUBLIC secara bawaan; hanya pengguna terautentikasi yang boleh memanggilnya.
revoke all on function public.create_debt(uuid, uuid, public.debt_direction, text, bigint, jsonb, text, text, text) from public, anon;
grant execute on function public.create_debt(uuid, uuid, public.debt_direction, text, bigint, jsonb, text, text, text) to authenticated;

-- Hanya kolom teks yang boleh diubah. RLS (debts_update: can_write) tetap menentukan baris mana.
revoke update on public.debts from authenticated;
grant update (name, description, category, memo, match_aliases) on public.debts to authenticated;
