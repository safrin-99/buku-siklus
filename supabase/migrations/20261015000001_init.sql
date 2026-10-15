-- Buku Siklus: skema awal.
-- Model: semua data hidup di dalam sebuah "buku" (books). Satu pengguna bisa punya beberapa buku
-- (mis. "Buku Saya", "Buku Pacar") dan buku bisa dibagikan lewat book_members.
-- Semua hak akses diputuskan oleh keanggotaan buku (RLS). Uang = bigint rupiah, tanpa desimal.
-- Pembayaran = ledger append-only. Status & sisa dihitung, tidak disimpan.

-- ---------------------------------------------------------------------------
-- Tipe
-- ---------------------------------------------------------------------------
create type public.debt_direction as enum ('owe', 'owed');          -- owe = utang saya, owed = piutang ke saya
create type public.book_role      as enum ('owner', 'editor', 'viewer');
create type public.inbox_status   as enum ('pending', 'confirmed', 'rejected');

-- ---------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------
create table public.books (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (length(btrim(name)) > 0),
  owner_id                 uuid not null default auth.uid() references auth.users (id) on delete restrict,
  payday_day               smallint not null default 1 check (payday_day between 1 and 28),
  base_salary_idr          bigint check (base_salary_idr is null or base_salary_idr >= 0),
  shift_payday_to_workday  boolean not null default false,          -- hanya memengaruhi tampilan/pengingat, bukan batas siklus
  timezone                 text not null default 'Asia/Makassar',
  archived_at              timestamptz,
  created_at               timestamptz not null default now()
);

create table public.book_members (
  book_id    uuid not null references public.books (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.book_role not null,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);
create index book_members_user_idx on public.book_members (user_id);

create table public.debts (
  id             uuid primary key default gen_random_uuid(),
  book_id        uuid not null references public.books (id) on delete restrict,
  direction      public.debt_direction not null,
  name           text not null check (length(btrim(name)) > 0),     -- judul baris, mis. "dr. Hendra"
  description    text,                                              -- keterangan, mis. "Talangan rawat inap"
  match_aliases  text[] not null default '{}',                      -- nama di notifikasi bank, huruf besar
  total_idr      bigint not null check (total_idr > 0),
  category       text,
  memo           text,
  created_by     uuid not null default auth.uid() references auth.users (id),
  created_at     timestamptz not null default now(),
  unique (id, book_id)                                              -- target FK komposit anak-anaknya
);
create index debts_book_idx on public.debts (book_id);

create table public.installments (
  id          uuid primary key default gen_random_uuid(),
  debt_id     uuid not null,
  book_id     uuid not null,
  seq         integer not null check (seq > 0),
  due_date    date not null,
  amount_idr  bigint not null check (amount_idr > 0),
  unique (debt_id, seq),
  unique (id, book_id),
  foreign key (debt_id, book_id) references public.debts (id, book_id) on delete cascade
);
create index installments_book_due_idx on public.installments (book_id, due_date);

-- Ledger pembayaran. Positif = pembayaran. Negatif = entri pembalik (wajib menunjuk pembayaran yang dibalik).
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  debt_id               uuid not null,
  book_id               uuid not null,
  paid_on               date not null,
  amount_idr            bigint not null check (amount_idr <> 0),
  reference             text,
  proof_path            text,                                       -- path di Storage privat
  note                  text,
  reverses_payment_id   uuid references public.payments (id),
  inbox_event_id        uuid,
  created_by            uuid not null default auth.uid() references auth.users (id),
  created_at            timestamptz not null default now(),
  check ((amount_idr < 0) = (reverses_payment_id is not null)),
  foreign key (debt_id, book_id) references public.debts (id, book_id) on delete restrict
);
create index payments_debt_idx on public.payments (debt_id);
create unique index payments_one_reversal_idx on public.payments (reverses_payment_id) where reverses_payment_id is not null;

-- Notifikasi/entri yang menunggu konfirmasi manusia. Hanya service_role (Edge Function) yang boleh menulis.
create table public.inbox_events (
  id               uuid primary key default gen_random_uuid(),
  book_id          uuid not null references public.books (id) on delete cascade,
  source           text not null,                                   -- mis. "BCA Mobile"
  received_at      timestamptz not null,
  masked_text      text not null,                                   -- sudah disamarkan sebelum disimpan
  idempotency_key  text not null,
  suggestion       jsonb,                                           -- keluaran AI terstruktur (divalidasi di aplikasi)
  status           public.inbox_status not null default 'pending',
  resolved_at      timestamptz,
  resolved_by      uuid references auth.users (id),
  created_at       timestamptz not null default now(),
  unique (book_id, idempotency_key)
);
create index inbox_pending_idx on public.inbox_events (book_id) where status = 'pending';

alter table public.payments
  add constraint payments_inbox_fk foreign key (inbox_event_id) references public.inbox_events (id);

-- ---------------------------------------------------------------------------
-- Pembantu hak akses (security definer agar tidak rekursif lewat RLS)
-- ---------------------------------------------------------------------------
create function public.book_role_of(p_book uuid)
returns public.book_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.book_members m where m.book_id = p_book and m.user_id = auth.uid()
$$;

create function public.can_read(p_book uuid)  returns boolean language sql stable security definer set search_path = ''
as $$ select public.book_role_of(p_book) is not null $$;

create function public.can_write(p_book uuid) returns boolean language sql stable security definer set search_path = ''
as $$ select public.book_role_of(p_book) in ('owner', 'editor') $$;

create function public.is_owner(p_book uuid)  returns boolean language sql stable security definer set search_path = ''
as $$ select public.book_role_of(p_book) = 'owner' $$;

-- Pembuat buku otomatis menjadi owner.
create function public.books_add_owner_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.book_members (book_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger books_add_owner_member after insert on public.books
  for each row execute function public.books_add_owner_member();

-- ---------------------------------------------------------------------------
-- Integritas ledger
-- ---------------------------------------------------------------------------
create function public.payments_immutable()
returns trigger language plpgsql
as $$
begin
  raise exception 'payments bersifat append-only; koreksi dengan entri pembalik (amount negatif + reverses_payment_id)';
end $$;
create trigger payments_no_update before update on public.payments
  for each row execute function public.payments_immutable();
create trigger payments_no_delete before delete on public.payments
  for each row execute function public.payments_immutable();

-- Cegah pembayaran melebihi total, pembalik yang tidak cocok, dan pembayaran tanpa hak tulis.
create function public.payments_validate()
returns trigger language plpgsql
as $$
declare
  v_total bigint;
  v_sum   bigint;
  v_orig  public.payments%rowtype;
begin
  select d.total_idr into v_total from public.debts d where d.id = new.debt_id for update;

  if new.reverses_payment_id is not null then
    select * into v_orig from public.payments p where p.id = new.reverses_payment_id;
    if not found or v_orig.debt_id <> new.debt_id then
      raise exception 'pembalik harus menunjuk pembayaran pada catatan yang sama';
    end if;
    if v_orig.amount_idr <= 0 or new.amount_idr <> -v_orig.amount_idr then
      raise exception 'pembalik harus bernilai persis negatif dari pembayaran asal';
    end if;
  end if;

  select coalesce(sum(p.amount_idr), 0) into v_sum from public.payments p where p.debt_id = new.debt_id;
  if v_sum + new.amount_idr > v_total then
    raise exception 'pembayaran melebihi total catatan (sisa % )', v_total - v_sum;
  end if;
  if v_sum + new.amount_idr < 0 then
    raise exception 'total pembayaran tidak boleh negatif';
  end if;
  return new;
end $$;
create trigger payments_validate before insert on public.payments
  for each row execute function public.payments_validate();

-- ---------------------------------------------------------------------------
-- View (security_invoker: RLS pemanggil tetap berlaku)
-- ---------------------------------------------------------------------------
create view public.debt_balances with (security_invoker = true) as
select d.id as debt_id,
       d.book_id,
       d.direction,
       d.total_idr,
       coalesce(sum(p.amount_idr), 0)::bigint                  as paid_idr,
       (d.total_idr - coalesce(sum(p.amount_idr), 0))::bigint  as remaining_idr
from public.debts d
left join public.payments p on p.debt_id = d.id
group by d.id;

-- Cicilan dianggap lunas bila total pembayaran >= jumlah kumulatif cicilan sampai urutan itu.
create view public.installment_status with (security_invoker = true) as
with cum as (
  select i.id, i.debt_id, i.book_id, i.seq, i.due_date, i.amount_idr,
         sum(i.amount_idr) over (partition by i.debt_id order by i.seq) as cum_due
  from public.installments i
), paid as (
  select p.debt_id, sum(p.amount_idr) as paid_total from public.payments p group by p.debt_id
)
select c.id as installment_id, c.debt_id, c.book_id, c.seq, c.due_date, c.amount_idr,
       (coalesce(pd.paid_total, 0) >= c.cum_due) as is_paid,
       least(c.amount_idr, greatest(c.cum_due - coalesce(pd.paid_total, 0), 0))::bigint as due_remaining_idr
from cum c
left join paid pd on pd.debt_id = c.debt_id;

-- Catatan yang jumlah cicilannya tidak sama dengan totalnya (harus kosong).
create view public.debt_integrity_issues with (security_invoker = true) as
select d.id as debt_id, d.book_id, d.total_idr, sum(i.amount_idr)::bigint as installments_idr
from public.debts d
join public.installments i on i.debt_id = d.id
group by d.id
having sum(i.amount_idr) <> d.total_idr;

-- ---------------------------------------------------------------------------
-- Fungsi hitung (STABLE, security invoker). p_today kosong = hari ini menurut zona waktu buku.
-- ---------------------------------------------------------------------------
create function public.cycle_bounds(p_payday int, p_today date)
returns table (cycle_start date, cycle_end date, next_payday date)
language sql immutable
as $$
  with s as (
    select case
             when extract(day from p_today)::int >= p_payday
               then make_date(extract(year from p_today)::int, extract(month from p_today)::int, p_payday)
             else (make_date(extract(year from p_today)::int, extract(month from p_today)::int, p_payday) - interval '1 month')::date
           end as start_d
  )
  select start_d,
         ((start_d + interval '1 month')::date - 1),
         (start_d + interval '1 month')::date
  from s
$$;

create function public.debt_list(p_book uuid, p_today date default null)
returns table (
  debt_id uuid, direction public.debt_direction, name text, description text,
  total_idr bigint, paid_idr bigint, remaining_idr bigint,
  next_due_date date, next_due_amount_idr bigint, next_due_seq int, installment_count int,
  days_to_due int, status text
)
language sql stable
set search_path = public
as $$
  with t as (
    select coalesce(p_today, (now() at time zone b.timezone)::date) as today
    from public.books b where b.id = p_book
  ), nxt as (
    select distinct on (s.debt_id) s.debt_id, s.due_date, s.due_remaining_idr, s.seq
    from public.installment_status s
    where s.book_id = p_book and not s.is_paid
    order by s.debt_id, s.seq
  ), cnt as (
    select i.debt_id, count(*)::int as n from public.installments i where i.book_id = p_book group by i.debt_id
  )
  select d.id, d.direction, d.name, d.description,
         bal.total_idr, bal.paid_idr, bal.remaining_idr,
         nxt.due_date, nxt.due_remaining_idr, nxt.seq, coalesce(cnt.n, 0),
         (nxt.due_date - t.today)::int,
         case
           when bal.remaining_idr <= 0 then 'paid'
           when nxt.due_date is null then 'active'
           when nxt.due_date < t.today then 'overdue'
           when nxt.due_date - t.today <= 3 then 'due_soon'
           else 'active'
         end
  from public.debts d
  join public.debt_balances bal on bal.debt_id = d.id
  cross join t
  left join nxt on nxt.debt_id = d.id
  left join cnt on cnt.debt_id = d.id
  where d.book_id = p_book
  order by (bal.remaining_idr <= 0), nxt.due_date nulls last, d.name
$$;

create function public.cycle_summary(p_book uuid, p_today date default null)
returns table (
  cycle_start date, cycle_end date, next_payday date, days_to_payday int,
  base_salary_idr bigint,
  obligations_idr bigint, paid_idr bigint, unpaid_idr bigint, free_idr bigint,
  carryover_overdue_idr bigint,
  total_owe_remaining_idr bigint, total_owed_remaining_idr bigint, overdue_count int
)
language sql stable
set search_path = public
as $$
  with b as (
    select * from public.books where id = p_book
  ), t as (
    select coalesce(p_today, (now() at time zone b.timezone)::date) as today, b.payday_day, b.base_salary_idr
    from b
  ), cb as (
    select c.cycle_start, c.cycle_end, c.next_payday from t, public.cycle_bounds(t.payday_day, t.today) c
  ), inst as (
    select s.* from public.installment_status s
    join public.debts d on d.id = s.debt_id
    where s.book_id = p_book and d.direction = 'owe'
  ), agg as (
    select
      coalesce(sum(i.amount_idr) filter (where i.due_date between cb.cycle_start and cb.cycle_end), 0)::bigint            as obligations,
      coalesce(sum(i.amount_idr) filter (where i.due_date between cb.cycle_start and cb.cycle_end and i.is_paid), 0)::bigint as paid,
      coalesce(sum(i.due_remaining_idr) filter (where i.due_date < cb.cycle_start and not i.is_paid), 0)::bigint           as carry
    from cb left join inst i on true
  ), bal as (
    select coalesce(sum(x.remaining_idr) filter (where x.direction = 'owe'), 0)::bigint  as owe,
           coalesce(sum(x.remaining_idr) filter (where x.direction = 'owed'), 0)::bigint as owed
    from public.debt_balances x where x.book_id = p_book
  )
  select cb.cycle_start, cb.cycle_end, cb.next_payday, (cb.next_payday - t.today)::int,
         t.base_salary_idr,
         agg.obligations, agg.paid, agg.obligations - agg.paid,
         case when t.base_salary_idr is null then null else t.base_salary_idr - agg.obligations end,
         agg.carry,
         bal.owe, bal.owed,
         (select count(*)::int from public.debt_list(p_book, t.today) l where l.status = 'overdue')
  from t, cb, agg, bal
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.books         enable row level security;
alter table public.book_members  enable row level security;
alter table public.debts         enable row level security;
alter table public.installments  enable row level security;
alter table public.payments      enable row level security;
alter table public.inbox_events  enable row level security;

-- books: pembuat melihat bukunya sendiri walau baris anggota baru dibuat oleh trigger setelahnya.
create policy books_select on public.books for select to authenticated
  using (owner_id = auth.uid() or public.can_read(id));
create policy books_insert on public.books for insert to authenticated
  with check (owner_id = auth.uid());
create policy books_update on public.books for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
-- tanpa policy delete: buku diarsipkan (archived_at), bukan dihapus.

create policy members_select on public.book_members for select to authenticated
  using (public.can_read(book_id));
create policy members_insert on public.book_members for insert to authenticated
  with check (public.is_owner(book_id));
create policy members_update on public.book_members for update to authenticated
  using (public.is_owner(book_id)) with check (public.is_owner(book_id));
create policy members_delete on public.book_members for delete to authenticated
  using (public.is_owner(book_id) and user_id <> auth.uid());

create policy debts_select on public.debts for select to authenticated using (public.can_read(book_id));
create policy debts_insert on public.debts for insert to authenticated with check (public.can_write(book_id) and created_by = auth.uid());
create policy debts_update on public.debts for update to authenticated using (public.can_write(book_id)) with check (public.can_write(book_id));
create policy debts_delete on public.debts for delete to authenticated using (public.can_write(book_id));

create policy inst_select on public.installments for select to authenticated using (public.can_read(book_id));
create policy inst_insert on public.installments for insert to authenticated with check (public.can_write(book_id));
create policy inst_update on public.installments for update to authenticated using (public.can_write(book_id)) with check (public.can_write(book_id));
create policy inst_delete on public.installments for delete to authenticated using (public.can_write(book_id));

create policy pay_select on public.payments for select to authenticated using (public.can_read(book_id));
create policy pay_insert on public.payments for insert to authenticated with check (public.can_write(book_id) and created_by = auth.uid());
-- tanpa policy update/delete: ledger append-only.

create policy inbox_select on public.inbox_events for select to authenticated using (public.can_read(book_id));
create policy inbox_update on public.inbox_events for update to authenticated using (public.can_write(book_id)) with check (public.can_write(book_id));
-- tanpa policy insert: hanya service_role (Edge Function ingest-notification) yang menulis.

-- ---------------------------------------------------------------------------
-- Hak akses eksplisit (jangan bergantung pada default Supabase)
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

grant usage on schema public to authenticated;
grant select, insert, update          on public.books         to authenticated;
grant select, insert, update, delete  on public.book_members  to authenticated;
grant select, insert, update, delete  on public.debts         to authenticated;
grant select, insert, update, delete  on public.installments  to authenticated;
grant select, insert                  on public.payments      to authenticated;   -- tanpa update/delete
grant select, update                  on public.inbox_events  to authenticated;
grant select on public.debt_balances, public.installment_status, public.debt_integrity_issues to authenticated;

grant execute on function
  public.book_role_of(uuid), public.can_read(uuid), public.can_write(uuid), public.is_owner(uuid),
  public.cycle_bounds(int, date), public.debt_list(uuid, date), public.cycle_summary(uuid, date)
  to authenticated;
