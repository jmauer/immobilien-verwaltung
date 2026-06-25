-- ============================================================================
-- Wiederkehrende Umsätze (Daueraufträge)
-- ----------------------------------------------------------------------------
-- Vorlagen für regelmäßige Buchungen (z. B. Mieteinnahmen, Darlehensraten).
-- Aus jeder Regel werden über generate_due_transactions() echte Einträge in
-- public.transactions erzeugt – auch rückwirkend für verpasste Perioden.
-- ============================================================================

create table public.recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id  uuid references public.properties (id) on delete set null,
  unit_id      uuid references public.units (id) on delete set null,
  lease_id     uuid references public.leases (id) on delete set null,
  type         text not null,                 -- 'income' | 'expense'
  category     text not null,
  description  text,
  amount       numeric(12, 2) not null,
  frequency    text not null default 'monthly', -- 'monthly' | 'quarterly' | 'yearly'
  start_date   date not null,
  end_date     date,
  next_run     date not null,                 -- nächstes fälliges Datum
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index on public.recurring_transactions (household_id, active, next_run);

-- next_run beim Anlegen automatisch auf start_date setzen, falls nicht gesetzt.
create or replace function public.recurring_set_next_run()
returns trigger
language plpgsql
as $$
begin
  if new.next_run is null then
    new.next_run := new.start_date;
  end if;
  return new;
end;
$$;

create trigger trg_recurring_set_next_run
  before insert on public.recurring_transactions
  for each row execute function public.recurring_set_next_run();

-- ----------------------------------------------------------------------------
-- Fällige Umsätze verbuchen: erzeugt für jede aktive, fällige Regel die noch
-- ausstehenden Buchungen (bis heute) und schiebt next_run nach vorne.
-- Gibt die Anzahl der erzeugten Buchungen zurück.
-- ----------------------------------------------------------------------------
create or replace function public.generate_due_transactions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r        public.recurring_transactions;
  v_count  integer := 0;
  v_next   date;
  v_hh     uuid := public.current_household_id();
begin
  if v_hh is null then
    return 0;
  end if;

  for r in
    select * from public.recurring_transactions
    where household_id = v_hh
      and active = true
      and next_run <= current_date
  loop
    v_next := r.next_run;

    while v_next <= current_date and (r.end_date is null or v_next <= r.end_date) loop
      insert into public.transactions
        (household_id, property_id, unit_id, lease_id, type, category, description, amount, tx_date)
      values
        (r.household_id, r.property_id, r.unit_id, r.lease_id, r.type, r.category, r.description, r.amount, v_next);

      v_count := v_count + 1;

      v_next := (case r.frequency
        when 'monthly'   then v_next + interval '1 month'
        when 'quarterly' then v_next + interval '3 months'
        when 'yearly'    then v_next + interval '1 year'
        else v_next + interval '1 month'
      end)::date;
    end loop;

    update public.recurring_transactions
      set next_run = v_next,
          active = case
            when end_date is not null and v_next > end_date then false
            else active
          end
      where id = r.id;
  end loop;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.recurring_transactions enable row level security;

create policy "recurring_transactions_household_access" on public.recurring_transactions
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

grant execute on function public.generate_due_transactions() to authenticated;
