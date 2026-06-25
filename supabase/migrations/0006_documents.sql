-- ============================================================================
-- Dokumentenablage (Supabase Storage + Metadaten)
-- ----------------------------------------------------------------------------
-- Dateien liegen im privaten Bucket 'documents' unter dem Pfad
--   <household_id>/<uuid>.<ext>
-- Der Zugriff ist per Storage-RLS auf den eigenen Haushalt beschränkt
-- (erster Pfadteil = current_household_id). Metadaten in public.documents.
-- ============================================================================

-- Privater Bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Metadaten-Tabelle
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id  uuid references public.properties (id) on delete set null,
  name         text not null,
  file_path    text not null,                 -- Pfad im Bucket
  mime_type    text,
  size         bigint,
  category     text not null default 'other',
  notes        text,
  created_at   timestamptz not null default now()
);

create index on public.documents (household_id, category);
create index on public.documents (household_id, property_id);

alter table public.documents enable row level security;

create policy "documents_household_access" on public.documents
  for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ----------------------------------------------------------------------------
-- Storage-RLS: Zugriff nur auf Dateien im eigenen Haushalts-Ordner
-- ----------------------------------------------------------------------------
create policy "documents_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "documents_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "documents_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );

create policy "documents_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_household_id()::text
  );
