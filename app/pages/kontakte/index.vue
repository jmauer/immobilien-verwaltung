<script setup lang="ts">
import type { Database, Contact, ContactCategory } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

type ContactRow = Contact & { property: { name: string } | null }

const { data: contacts, refresh, pending } = await useAsyncData('contacts', async () => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, property:properties(name)')
    .order('important', { ascending: false })
    .order('name')
  if (error) throw error
  return data as unknown as ContactRow[]
})

const { data: propertyOptions } = await useAsyncData('contact-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return [{ value: 'none', label: 'Keine Zuordnung' }, ...(data ?? []).map(p => ({ value: p.id, label: p.name }))]
})

const categoryOptions = Object.entries(CONTACT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const filterOptions = [{ value: 'all', label: 'Alle Kategorien' }, ...categoryOptions]

const search = ref('')
const categoryFilter = ref<'all' | ContactCategory>('all')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (contacts.value ?? []).filter((c) => {
    if (categoryFilter.value !== 'all' && c.category !== categoryFilter.value) return false
    if (!q) return true
    const haystack = [
      c.name, c.company, c.phone, c.email, c.address,
      CONTACT_CATEGORY_LABELS[c.category], c.property?.name
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  })
})

const importantContacts = computed(() => filtered.value.filter(c => c.important))
const otherContacts = computed(() => filtered.value.filter(c => !c.important))

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const blank = () => ({
  name: '',
  company: '',
  category: 'craftsman' as ContactCategory,
  phone: '',
  email: '',
  website: '',
  address: '',
  notes: '',
  property_id: 'none',
  important: false
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(c: Contact) {
  editingId.value = c.id
  Object.assign(form, {
    name: c.name,
    company: c.company ?? '',
    category: c.category,
    phone: c.phone ?? '',
    email: c.email ?? '',
    website: c.website ?? '',
    address: c.address ?? '',
    notes: c.notes ?? '',
    property_id: c.property_id ?? 'none',
    important: c.important
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form, property_id: form.property_id === 'none' ? null : form.property_id }
    if (editingId.value) {
      const { error } = await supabase.from('contacts').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('contacts').insert({ ...payload, household_id })
      if (error) throw error
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

async function toggleImportant(c: Contact) {
  const { error } = await supabase.from('contacts').update({ important: !c.important }).eq('id', c.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
}

async function remove(c: Contact) {
  const ok = await confirm({
    title: 'Kontakt löschen?',
    description: `„${c.name}“ wird dauerhaft aus den Kontakten entfernt.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('contacts').delete().eq('id', c.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Kontakt gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          Kontakte
        </h1>
        <p class="text-muted">
          Dienstleister, Handwerker & wichtige Ansprechpartner
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Neuer Kontakt
      </UButton>
    </div>

    <!-- Suche + Filter -->
    <div class="flex flex-col sm:flex-row gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Suchen (Name, Firma, Telefon …)"
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
      class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <USkeleton
        v-for="i in 6"
        :key="i"
        class="h-40 w-full rounded-2xl"
      />
    </div>

    <UCard
      v-else-if="!contacts?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-contact"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Noch keine Kontakte angelegt.
      </p>
      <UButton
        class="mt-4"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Ersten Kontakt anlegen
      </UButton>
    </UCard>

    <div
      v-else-if="!filtered.length"
      class="text-center py-12 text-muted"
    >
      Keine Treffer für deine Suche.
    </div>

    <template v-else>
      <!-- Wichtige Kontakte -->
      <section
        v-if="importantContacts.length"
        class="space-y-3"
      >
        <h2 class="flex items-center gap-1.5 text-sm font-semibold text-muted uppercase tracking-wide">
          <UIcon
            name="i-lucide-star"
            class="size-4 text-warning"
          />
          Wichtige Kontakte
        </h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ContactCard
            v-for="c in importantContacts"
            :key="c.id"
            :contact="c"
            @edit="openEdit"
            @remove="remove"
            @toggle-important="toggleImportant"
          />
        </div>
      </section>

      <!-- Alle übrigen -->
      <section
        v-if="otherContacts.length"
        class="space-y-3"
      >
        <h2
          v-if="importantContacts.length"
          class="text-sm font-semibold text-muted uppercase tracking-wide"
        >
          Weitere Kontakte
        </h2>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ContactCard
            v-for="c in otherContacts"
            :key="c.id"
            :contact="c"
            @edit="openEdit"
            @remove="remove"
            @toggle-important="toggleImportant"
          />
        </div>
      </section>
    </template>

    <!-- Formular -->
    <UModal
      v-model:open="open"
      :title="editingId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Name"
              name="name"
              required
            >
              <UInput
                v-model="form.name"
                class="w-full"
                placeholder="Max Mustermann"
              />
            </UFormField>
            <UFormField
              label="Firma"
              name="company"
            >
              <UInput
                v-model="form.company"
                class="w-full"
              />
            </UFormField>
          </div>

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

          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Telefon"
              name="phone"
            >
              <UInput
                v-model="form.phone"
                type="tel"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="E-Mail"
              name="email"
            >
              <UInput
                v-model="form.email"
                type="email"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            label="Website"
            name="website"
          >
            <UInput
              v-model="form.website"
              class="w-full"
              placeholder="https://…"
            />
          </UFormField>

          <UFormField
            label="Adresse"
            name="address"
          >
            <UInput
              v-model="form.address"
              class="w-full"
            />
          </UFormField>

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

          <UCheckbox
            v-model="form.important"
            label="Als wichtigen Kontakt markieren (oben anpinnen)"
          />

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
              Speichern
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
