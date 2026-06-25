-- ============================================================================
-- Verbrauchserfassung (Wasser, Heizung, Strom …) pro Einheit & Jahr
-- ----------------------------------------------------------------------------
-- Grundlage für die verbrauchsabhängige Umlage in der Nebenkostenabrechnung.
-- Eine Nebenkosten-Position mit Schlüssel 'consumption' verweist über
-- operating_costs.consumption_type auf die passende Verbrauchsart.
-- ============================================================================

-- Verbrauchsart an der Kostenposition (nur relevant bei allocation_key = 'consumption')
alter table public.operating_costs
  add column if not exists consumption_type text;

create table public.consumptions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  unit_id      uuid not null references public.units (id) on delete cascade,
  period_year  integer not null,
  type         text not null,                 -- 'water_cold' | 'water_hot' | 'heating' | 'electricity' | 'gas' | 'other'
  amount       numeric(12, 3) not null,       -- verbrauchte Menge (z. B. m³, kWh)
  unit_label   text,                          -- Einheit der Menge, z. B. 'm³'
  created_at   timestamptz not null default now()
);

create index on public.consumptions (household_id, period_year);
-- Pro Einheit, Jahr und Art genau ein Wert (ermöglicht Upsert)
create unique index consumptions_unit_year_type_uniq
  on public.consumptions (unit_id, period_year, type);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.consumptions enable row level security;

create policy "consumptions_household_access" on public.consumptions
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
