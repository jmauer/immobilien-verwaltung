<script setup lang="ts">
import type { Database, DocumentRecord, DocumentCategory } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

type DocRow = DocumentRecord & { property: { name: string } | null }

const { data: documents, refresh, pending } = await useAsyncData('documents', async () => {
  const { data, error } = await supabase
    .from('documents')
    .select('*, property:properties(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as DocRow[]
})

const { data: propertyOptions } = await useAsyncData('doc-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return [{ value: 'none', label: 'Keine Zuordnung' }, ...(data ?? []).map(p => ({ value: p.id, label: p.name }))]
})

const categoryOptions = Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const filterOptions = [{ value: 'all', label: 'Alle Kategorien' }, ...categoryOptions]

const search = ref('')
const categoryFilter = ref<'all' | DocumentCategory>('all')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (documents.value ?? []).filter((d) => {
    if (categoryFilter.value !== 'all' && d.category !== categoryFilter.value) return false
    if (!q) return true
    const haystack = [d.name, d.notes, DOCUMENT_CATEGORY_LABELS[d.category], d.property?.name]
      .filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  })
})

const docIcon = (d: DocumentRecord) => {
  if (d.mime_type?.startsWith('image/')) return 'i-lucide-image'
  if (d.mime_type === 'application/pdf') return 'i-lucide-file-text'
  return DOCUMENT_CATEGORY_ICONS[d.category] ?? 'i-lucide-file'
}

// --- Upload / Bearbeiten ---------------------------------------------------
const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

const blank = () => ({
  name: '',
  category: 'other' as DocumentCategory,
  property_id: 'none',
  notes: ''
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  selectedFile.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(d: DocumentRecord) {
  editingId.value = d.id
  selectedFile.value = null
  Object.assign(form, {
    name: d.name,
    category: d.category,
    property_id: d.property_id ?? 'none',
    notes: d.notes ?? ''
  })
  open.value = true
}

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  selectedFile.value = f
  if (f && !form.name) form.name = f.name
}

async function save() {
  if (!editingId.value && !selectedFile.value) {
    toast.add({ title: 'Bitte eine Datei wählen', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const property_id = form.property_id === 'none' ? null : form.property_id

    if (editingId.value) {
      // Nur Metadaten ändern
      const { error } = await supabase
        .from('documents')
        .update({ name: form.name, category: form.category, property_id, notes: form.notes })
        .eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const file = selectedFile.value!
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${household_id}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || undefined })
      if (upErr) throw upErr

      const { error } = await supabase.from('documents').insert({
        household_id,
        property_id,
        name: form.name || file.name,
        file_path: path,
        mime_type: file.type || null,
        size: file.size,
        category: form.category,
        notes: form.notes
      })
      if (error) {
        // Verwaiste Datei wieder entfernen, falls der Metadaten-Insert fehlschlägt
        await supabase.storage.from('documents').remove([path])
        throw error
      }
    }
    open.value = false
    await refresh()
    toast.add({ title: 'Gespeichert', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function download(d: DocumentRecord) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.file_path, 60)
  if (error || !data) {
    toast.add({ title: 'Fehler', description: error?.message, color: 'error' })
    return
  }
  window.open(data.signedUrl, '_blank')
}

async function remove(d: DocumentRecord) {
  const ok = await confirm({
    title: 'Dokument löschen?',
    description: `„${d.name}“ wird dauerhaft gelöscht – auch die Datei.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  await supabase.storage.from('documents').remove([d.file_path])
  const { error } = await supabase.from('documents').delete().eq('id', d.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          Dokumente
        </h1>
        <p class="text-muted">
          Verträge, Rechnungen, Abrechnungen & mehr
        </p>
      </div>
      <UButton
        icon="i-lucide-upload"
        @click="openCreate"
      >
        Hochladen
      </UButton>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Suchen (Name, Notiz …)"
        class="flex-1"
      />
      <USelect
        v-model="categoryFilter"
        :items="filterOptions"
        class="sm:w-56"
      />
    </div>

    <div
      v-if="pending"
      class="space-y-2"
    >
      <USkeleton
        v-for="i in 4"
        :key="i"
        class="h-14 w-full rounded-2xl"
      />
    </div>

    <UCard
      v-else-if="!documents?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-folder-open"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Noch keine Dokumente.
      </p>
      <UButton
        class="mt-4"
        icon="i-lucide-upload"
        @click="openCreate"
      >
        Erstes Dokument hochladen
      </UButton>
    </UCard>

    <div
      v-else-if="!filtered.length"
      class="text-center py-12 text-muted"
    >
      Keine Treffer.
    </div>

    <div
      v-else
      class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
    >
      <div
        v-for="d in filtered"
        :key="d.id"
        class="flex items-center justify-between gap-3 p-3"
      >
        <button
          type="button"
          class="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80"
          @click="download(d)"
        >
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <UIcon
              :name="docIcon(d)"
              class="size-5"
            />
          </div>
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ d.name }}
            </p>
            <p class="text-sm text-muted truncate">
              {{ DOCUMENT_CATEGORY_LABELS[d.category] }}
              <span v-if="d.property"> · {{ d.property.name }}</span>
              · {{ formatBytes(d.size) }} · {{ formatDate(d.created_at) }}
            </p>
          </div>
        </button>
        <div class="flex items-center gap-1 shrink-0">
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="download(d)"
          />
          <UDropdownMenu
            :items="[[
              { label: 'Herunterladen', icon: 'i-lucide-download', onSelect: () => download(d) },
              { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(d) },
              { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(d) }
            ]]"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </UDropdownMenu>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Dokument bearbeiten' : 'Dokument hochladen'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            v-if="!editingId"
            label="Datei"
            name="file"
            required
          >
            <input
              type="file"
              class="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-primary file:font-medium hover:file:bg-primary/25 file:cursor-pointer"
              @change="onFileChange"
            >
          </UFormField>

          <UFormField
            label="Name"
            name="name"
            required
          >
            <UInput
              v-model="form.name"
              class="w-full"
              placeholder="Bezeichnung des Dokuments"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Kategorie"
              name="category"
            >
              <USelect
                v-model="form.category"
                :items="categoryOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Immobilie"
              name="property_id"
            >
              <USelect
                v-model="form.property_id"
                :items="propertyOptions ?? []"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            label="Notizen"
            name="notes"
          >
            <UTextarea
              v-model="form.notes"
              class="w-full"
              :rows="2"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="open = false"
            >
              Abbrechen
            </UButton>
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!form.name"
            >
              {{ editingId ? 'Speichern' : 'Hochladen' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
