-- ============================================================================
-- Immobilienverwaltung – Initiales Schema
-- ----------------------------------------------------------------------------
-- Mehrere Familienmitglieder teilen sich einen "Haushalt" (household).
-- Alle Daten sind per Row Level Security an den Haushalt des angemeldeten
-- Nutzers gebunden. Beitritt erfolgt über einen Einladungscode.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists pgcrypto;

-- ============================================================================
-- Haushalte & Profile
-- ============================================================================
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  household_id uuid references public.households (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Helper: Haushalt des aktuellen Nutzers (SECURITY DEFINER vermeidet RLS-Rekursion)
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- Profil bei Registrierung automatisch anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Haushalt erstellen / beitreten (als RPC, SECURITY DEFINER)
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare h public.households;
begin
  insert into public.households (name) values (p_name) returning * into h;
  update public.profiles set household_id = h.id where id = auth.uid();
  return h;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare h public.households;
begin
  select * into h from public.households where invite_code = lower(trim(p_code));
  if not found then
    raise exception 'Ungültiger Einladungscode';
  end if;
  update public.profiles set household_id = h.id where id = auth.uid();
  return h;
end;
$$;

-- ============================================================================
-- Immobilien & Einheiten
-- ============================================================================
create table public.properties (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  street       text,
  zip          text,
  city         text,
  type         text not null default 'apartment_building',
  purchase_price numeric(14, 2),
  purchase_date  date,
  total_area     numeric(10, 2),
  notes          text,
  created_at     timestamptz not null default now()
);

create table public.units (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id  uuid not null references public.properties (id) on delete cascade,
  name         text not null,
  floor        text,
  area         numeric(10, 2),
  rooms        numeric(4, 1),
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- Mieter & Mietverhältnisse
-- ============================================================================
create table public.tenants (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  first_name   text not null,
  last_name    text not null,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table public.leases (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  unit_id      uuid not null references public.units (id) on delete cascade,
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  start_date   date not null,
  end_date     date,
  rent_cold    numeric(10, 2) not null default 0,
  prepayment   numeric(10, 2) not null default 0,
  deposit      numeric(10, 2),
  persons      integer not null default 1,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- Nebenkosten
-- ============================================================================
create table public.operating_costs (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  property_id    uuid not null references public.properties (id) on delete cascade,
  category       text not null,
  description    text,
  amount         numeric(12, 2) not null,
  cost_date      date not null,
  period_year    integer not null,
  billable       boolean not null default true,
  allocation_key text not null default 'area',
  created_at     timestamptz not null default now()
);

-- ============================================================================
-- Cashflow / Transaktionen
-- ============================================================================
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id  uuid references public.properties (id) on delete set null,
  unit_id      uuid references public.units (id) on delete set null,
  lease_id     uuid references public.leases (id) on delete set null,
  type         text not null,
  category     text not null,
  description  text,
  amount       numeric(12, 2) not null,
  tx_date      date not null,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- Abrechnungen (Betriebskostenabrechnung)
-- ============================================================================
create table public.statements (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  lease_id          uuid not null references public.leases (id) on delete cascade,
  period_year       integer not null,
  total_costs       numeric(12, 2) not null default 0,
  total_prepayments numeric(12, 2) not null default 0,
  balance           numeric(12, 2) not null default 0,
  details           jsonb,
  status            text not null default 'draft',
  created_at        timestamptz not null default now()
);

-- Hilfreiche Indizes
create index on public.units (property_id);
create index on public.leases (unit_id);
create index on public.leases (tenant_id);
create index on public.operating_costs (property_id, period_year);
create index on public.transactions (household_id, tx_date);
create index on public.statements (lease_id, period_year);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.households      enable row level security;
alter table public.profiles        enable row level security;
alter table public.properties      enable row level security;
alter table public.units           enable row level security;
alter table public.tenants         enable row level security;
alter table public.leases          enable row level security;
alter table public.operating_costs enable row level security;
alter table public.transactions    enable row level security;
alter table public.statements      enable row level security;

-- Profile: eigenes Profil + Profile im selben Haushalt lesen, eigenes ändern
create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid() or household_id = public.current_household_id());
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Haushalt: nur eigener Haushalt sichtbar
create policy "households_select_own" on public.households
  for select using (id = public.current_household_id());
create policy "households_update_own" on public.households
  for update using (id = public.current_household_id());

-- Generische Policy je Domänentabelle: voller Zugriff innerhalb des Haushalts
do $$
declare t text;
begin
  foreach t in array array[
    'properties', 'units', 'tenants', 'leases',
    'operating_costs', 'transactions', 'statements'
  ]
  loop
    execute format($f$
      create policy "%1$s_household_access" on public.%1$s
        for all
        using (household_id = public.current_household_id())
        with check (household_id = public.current_household_id());
    $f$, t);
  end loop;
end;
$$;

-- Rechte für RPC-Funktionen
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text)  to authenticated;
grant execute on function public.current_household_id() to authenticated;
