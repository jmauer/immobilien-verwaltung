<script setup lang="ts">
import type { Database, Property, Unit } from '~/types/database'

const route = useRoute()
const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()
const id = route.params.id as string

const { data: property } = await useAsyncData(`property-${id}`, async () => {
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).single()
  if (error) throw error
  return data as Property
})

const { data: units, refresh: refreshUnits } = await useAsyncData(`units-${id}`, async () => {
  const { data, error } = await supabase
    .from('units')
    .select('*, leases(id, end_date, tenant:tenants(first_name, last_name))')
    .eq('property_id', id)
    .order('name')
  if (error) throw error
  return data as unknown as (Unit & { leases: { id: string, end_date: string | null, tenant: { first_name: string, last_name: string } | null }[] })[]
})

const today = new Date().toISOString().slice(0, 10)
function activeTenant(u: { leases: { end_date: string | null, tenant: { first_name: string, last_name: string } | null }[] }) {
  const lease = u.leases?.find(l => !l.end_date || l.end_date >= today)
  return lease?.tenant ? `${lease.tenant.first_name} ${lease.tenant.last_name}` : null
}

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const blank = () => ({ name: '', floor: '', area: null as number | null, rooms: null as number | null })
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(u: Unit) {
  editingId.value = u.id
  Object.assign(form, { name: u.name, floor: u.floor ?? '', area: u.area, rooms: u.rooms })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    if (editingId.value) {
      const { error } = await supabase.from('units').update({ ...form }).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('units').insert({ ...form, property_id: id, household_id })
      if (error) throw error
    }
    open.value = false
    await refreshUnits()
    toast.add({ title: 'Gespeichert', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(u: Unit) {
  const ok = await confirm({
    title: 'Einheit löschen?',
    description: `Die Einheit „${u.name}“ und zugehörige Mietverträge werden dauerhaft gelöscht.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('units').delete().eq('id', u.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refreshUnits()
  toast.add({ title: 'Einheit gelöscht', color: 'success' })
}
</script>

<template>
  <div
    v-if="property"
    class="space-y-6"
  >
    <div>
      <UButton
        to="/immobilien"
        icon="i-lucide-arrow-left"
        variant="link"
        color="neutral"
        class="-ml-2 mb-1"
      >
        Immobilien
      </UButton>
      <div class="flex items-start justify-between gap-2">
        <div>
          <h1 class="text-2xl font-bold">
            {{ property.name }}
          </h1>
          <p class="text-muted">
            {{ [property.street, [property.zip, property.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Keine Adresse' }}
          </p>
        </div>
        <UBadge
          color="neutral"
          variant="subtle"
          size="lg"
        >
          {{ PROPERTY_TYPE_LABELS[property.type] }}
        </UBadge>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <UCard>
        <p class="text-sm text-muted">
          Kaufpreis
        </p>
        <p class="font-semibold mt-1">
          {{ formatEuro(property.purchase_price) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          Kaufdatum
        </p>
        <p class="font-semibold mt-1">
          {{ formatDate(property.purchase_date) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          Gesamtfläche
        </p>
        <p class="font-semibold mt-1">
          {{ formatNumber(property.total_area, 'm²') }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          Einheiten
        </p>
        <p class="font-semibold mt-1">
          {{ units?.length ?? 0 }}
        </p>
      </UCard>
    </div>

    <UCard v-if="property.notes">
      <template #header>
        <h2 class="font-semibold">
          Notizen
        </h2>
      </template>
      <p class="text-sm whitespace-pre-wrap">
        {{ property.notes }}
      </p>
    </UCard>

    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold">
          Einheiten
        </h2>
        <UButton
          icon="i-lucide-plus"
          size="sm"
          @click="openCreate"
        >
          Einheit
        </UButton>
      </div>

      <UCard
        v-if="!units?.length"
        class="text-center py-8"
      >
        <p class="text-muted text-sm">
          Noch keine Einheiten.
        </p>
      </UCard>

      <div
        v-else
        class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
      >
        <div
          v-for="u in units"
          :key="u.id"
          class="flex items-center justify-between gap-3 p-3 bg-transparent"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ u.name }}
            </p>
            <p class="text-sm text-muted">
              {{ [u.floor, formatNumber(u.area, 'm²'), u.rooms ? `${formatNumber(u.rooms)} Zi.` : null].filter(Boolean).join(' · ') || '–' }}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UBadge
              v-if="activeTenant(u)"
              color="success"
              variant="subtle"
            >
              {{ activeTenant(u) }}
            </UBadge>
            <UBadge
              v-else
              color="warning"
              variant="subtle"
            >
              Leerstand
            </UBadge>
            <UDropdownMenu
              :items="[[
                { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(u) },
                { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(u) }
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
    </div>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Einheit bearbeiten' : 'Neue Einheit'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            label="Bezeichnung"
            name="name"
            required
          >
            <UInput
              v-model="form.name"
              class="w-full"
              placeholder="z. B. Wohnung links"
            />
          </UFormField>
          <div class="grid grid-cols-3 gap-3">
            <UFormField
              label="Etage"
              name="floor"
            >
              <UInput
                v-model="form.floor"
                class="w-full"
                placeholder="EG"
              />
            </UFormField>
            <UFormField
              label="Fläche (m²)"
              name="area"
            >
              <UInput
                v-model.number="form.area"
                type="number"
                step="0.01"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Zimmer"
              name="rooms"
            >
              <UInput
                v-model.number="form.rooms"
                type="number"
                step="0.5"
                class="w-full"
              />
            </UFormField>
          </div>
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
