-- ============================================================================
-- Betriebskostenabrechnung – eindeutige Abrechnung je Mietvertrag & Jahr
-- ----------------------------------------------------------------------------
-- Ermöglicht Upsert (Neuberechnung überschreibt die bestehende Abrechnung)
-- und verhindert Doppelerfassung.
-- ============================================================================

create unique index if not exists statements_lease_period_uniq
  on public.statements (lease_id, period_year);
