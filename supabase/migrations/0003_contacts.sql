-- ============================================================================
-- Kontakte / Dienstleister
-- ----------------------------------------------------------------------------
-- Adressbuch für Handwerker, Hausverwaltung, Versicherungen, Notdienste etc.
-- Optional einer Immobilie zugeordnet, „wichtige" Kontakte können angepinnt
-- werden (z. B. Notfallnummern).
-- ============================================================================

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id  uuid references public.properties (id) on delete set null,
  name         text not null,
  company      text,
  category     text not null default 'other',
  phone        text,
  email        text,
  website      text,
  address      text,
  notes        text,
  important    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index on public.contacts (household_id, category);
create index on public.contacts (household_id, important);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.contacts enable row level security;

create policy "contacts_household_access" on public.contacts
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
