-- ============================================================================
-- Kalender / Termine + abonnierbarer iCal-Feed
-- ----------------------------------------------------------------------------
-- Termine sind haushaltsgebunden (RLS). Ein geheimer calendar_token je
-- Haushalt erlaubt den Abruf als iCal-Feed ohne Login – die SECURITY-DEFINER
-- Funktion calendar_feed(token) gibt nur die Termine des passenden Haushalts
-- zurück.
-- ============================================================================

-- Geheimer Token je Haushalt (bestehende Zeilen erhalten automatisch einen Wert)
alter table public.households
  add column if not exists calendar_token uuid not null default gen_random_uuid();

create table public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id  uuid references public.properties (id) on delete set null,
  title        text not null,
  description  text,
  location     text,
  category     text not null default 'other',
  start_at     timestamptz not null,
  end_at       timestamptz,
  all_day      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index on public.calendar_events (household_id, start_at);

alter table public.calendar_events enable row level security;

create policy "calendar_events_household_access" on public.calendar_events
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ----------------------------------------------------------------------------
-- iCal-Feed: gibt die Termine zum geheimen Token zurück (für externe Kalender)
-- ----------------------------------------------------------------------------
create or replace function public.calendar_feed(p_token uuid)
returns setof public.calendar_events
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.calendar_events e
  join public.households h on h.id = e.household_id
  where h.calendar_token = p_token
  order by e.start_at;
$$;

-- Feed darf von anonymen Clients (externer Kalender) abgerufen werden – nur mit
-- gültigem Token, der wie ein Passwort wirkt.
grant execute on function public.calendar_feed(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Token neu erzeugen (macht alte Abo-Links ungültig)
-- ----------------------------------------------------------------------------
create or replace function public.reset_calendar_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare t uuid;
begin
  update public.households
    set calendar_token = gen_random_uuid()
    where id = public.current_household_id()
    returning calendar_token into t;
  return t;
end;
$$;

grant execute on function public.reset_calendar_token() to authenticated;
