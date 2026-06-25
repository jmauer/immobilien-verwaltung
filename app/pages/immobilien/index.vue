<script setup lang="ts">
import type { Database, Property, PropertyType } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

const { data: properties, refresh, pending } = await useAsyncData('properties', async () => {
  const { data, error } = await supabase
    .from('properties')
    .select('*, units(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as (Property & { units: { count: number }[] })[]
})

const typeOptions = Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const blank = () => ({
  name: '',
  type: 'apartment_building' as PropertyType,
  street: '',
  zip: '',
  city: '',
  purchase_price: null as number | null,
  purchase_date: '',
  total_area: null as number | null,
  notes: ''
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}

function openEdit(p: Property) {
  editingId.value = p.id
  Object.assign(form, {
    name: p.name,
    type: p.type,
    street: p.street ?? '',
    zip: p.zip ?? '',
    city: p.city ?? '',
    purchase_price: p.purchase_price,
    purchase_date: p.purchase_date ?? '',
    total_area: p.total_area,
    notes: p.notes ?? ''
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form, purchase_date: form.purchase_date || null }
    if (editingId.value) {
      const { error } = await supabase.from('properties').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('properties').insert({ ...payload, household_id })
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

async function remove(p: Property) {
  const ok = await confirm({
    title: 'Immobilie löschen?',
    description: `„${p.name}“ wird mit allen zugehörigen Einheiten, Mietverträgen und Daten dauerhaft gelöscht.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('properties').delete().eq('id', p.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Immobilie gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold">
          Immobilien
        </h1>
        <p class="text-muted">
          {{ properties?.length ?? 0 }} Objekt(e)
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Neue Immobilie
      </UButton>
    </div>

    <div
      v-if="pending"
      class="space-y-2"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-20 w-full"
      />
    </div>

    <UCard
      v-else-if="!properties?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-building-2"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Noch keine Immobilien angelegt.
      </p>
      <UButton
        class="mt-4"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Erste Immobilie anlegen
      </UButton>
    </UCard>

    <div
      v-else
      class="grid sm:grid-cols-2 gap-4"
    >
      <UCard
        v-for="p in properties"
        :key="p.id"
        class="hover:ring-primary transition cursor-pointer"
        @click="navigateTo(`/immobilien/${p.id}`)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-semibold truncate">
              {{ p.name }}
            </h3>
            <p class="text-sm text-muted truncate">
              {{ [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Keine Adresse' }}
            </p>
            <div class="flex flex-wrap gap-2 mt-3">
              <UBadge
                color="neutral"
                variant="subtle"
              >
                {{ PROPERTY_TYPE_LABELS[p.type] }}
              </UBadge>
              <UBadge
                color="neutral"
                variant="subtle"
                icon="i-lucide-door-open"
              >
                {{ p.units?.[0]?.count ?? 0 }} Einheiten
              </UBadge>
            </div>
          </div>
          <UDropdownMenu
            :items="[[
              { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(p) },
              { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(p) }
            ]]"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Immobilie bearbeiten' : 'Neue Immobilie'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            label="Name"
            name="name"
            required
          >
            <UInput
              v-model="form.name"
              class="w-full"
              placeholder="z. B. Haus Hauptstraße 5"
            />
          </UFormField>

          <UFormField
            label="Typ"
            name="type"
          >
            <USelect
              v-model="form.type"
              :items="typeOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Straße & Nr."
            name="street"
          >
            <UInput
              v-model="form.street"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-3 gap-3">
            <UFormField
              label="PLZ"
              name="zip"
            >
              <UInput
                v-model="form.zip"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Ort"
              name="city"
              class="col-span-2"
            >
              <UInput
                v-model="form.city"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Kaufpreis (€)"
              name="purchase_price"
            >
              <UInput
                v-model.number="form.purchase_price"
                type="number"
                step="0.01"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Kaufdatum"
              name="purchase_date"
            >
              <UInput
                v-model="form.purchase_date"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            label="Gesamtfläche (m²)"
            name="total_area"
          >
            <UInput
              v-model.number="form.total_area"
              type="number"
              step="0.01"
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
