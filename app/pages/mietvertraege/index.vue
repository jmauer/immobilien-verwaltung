<script setup lang="ts">
import type { Database, Lease } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

type LeaseRow = Lease & {
  tenant: { first_name: string, last_name: string } | null
  unit: { name: string, property: { name: string } | null } | null
}

const { data: leases, refresh, pending } = await useAsyncData('leases', async () => {
  const { data, error } = await supabase
    .from('leases')
    .select('*, tenant:tenants(first_name, last_name), unit:units(name, property:properties(name))')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data as unknown as LeaseRow[]
})

// Optionen für die Auswahlfelder
const { data: options } = await useAsyncData('lease-options', async () => {
  const [units, tenants] = await Promise.all([
    supabase.from('units').select('id, name, property:properties(name)').order('name'),
    supabase.from('tenants').select('id, first_name, last_name').order('last_name')
  ])
  return {
    units: (units.data ?? []).map(u => ({
      value: u.id,
      label: `${(u.property as unknown as { name: string } | null)?.name ?? '?'} – ${u.name}`
    })),
    tenants: (tenants.data ?? []).map(t => ({
      value: t.id,
      label: `${t.first_name} ${t.last_name}`
    }))
  }
})

const today = new Date().toISOString().slice(0, 10)
const isActive = (l: Lease) => !l.end_date || l.end_date >= today

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const blank = () => ({
  unit_id: '',
  tenant_id: '',
  start_date: today,
  end_date: '',
  rent_cold: 0,
  prepayment: 0,
  deposit: null as number | null,
  persons: 1
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(l: Lease) {
  editingId.value = l.id
  Object.assign(form, {
    unit_id: l.unit_id,
    tenant_id: l.tenant_id,
    start_date: l.start_date,
    end_date: l.end_date ?? '',
    rent_cold: l.rent_cold,
    prepayment: l.prepayment,
    deposit: l.deposit,
    persons: l.persons
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form, end_date: form.end_date || null }
    if (editingId.value) {
      const { error } = await supabase.from('leases').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('leases').insert({ ...payload, household_id })
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

async function remove(l: Lease) {
  const ok = await confirm({
    title: 'Mietvertrag löschen?',
    description: 'Der Mietvertrag wird dauerhaft entfernt. Bereits erfasste Buchungen bleiben erhalten.',
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('leases').delete().eq('id', l.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Mietvertrag gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold">
          Mietverträge
        </h1>
        <p class="text-muted">
          {{ leases?.length ?? 0 }} Vertrag/Verträge
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        :disabled="!options?.units.length || !options?.tenants.length"
        @click="openCreate"
      >
        Neuer Vertrag
      </UButton>
    </div>

    <UAlert
      v-if="!options?.units.length || !options?.tenants.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      title="Voraussetzungen fehlen"
      description="Lege zuerst mindestens eine Einheit (unter einer Immobilie) und einen Mieter an."
    />

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
      v-else-if="!leases?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-file-signature"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Noch keine Mietverträge.
      </p>
    </UCard>

    <div
      v-else
      class="grid sm:grid-cols-2 gap-4"
    >
      <UCard
        v-for="l in leases"
        :key="l.id"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold truncate">
                {{ l.tenant?.first_name }} {{ l.tenant?.last_name }}
              </h3>
              <UBadge
                :color="isActive(l) ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
              >
                {{ isActive(l) ? 'Aktiv' : 'Beendet' }}
              </UBadge>
            </div>
            <p class="text-sm text-muted truncate">
              {{ l.unit?.property?.name }} – {{ l.unit?.name }}
            </p>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
              <span class="text-muted">Kaltmiete</span>
              <span class="text-right font-medium">{{ formatEuro(l.rent_cold) }}</span>
              <span class="text-muted">NK-Vorauszahlung</span>
              <span class="text-right font-medium">{{ formatEuro(l.prepayment) }}</span>
              <span class="text-muted">Warmmiete</span>
              <span class="text-right font-medium">{{ formatEuro(Number(l.rent_cold) + Number(l.prepayment)) }}</span>
              <span class="text-muted">Beginn</span>
              <span class="text-right">{{ formatDate(l.start_date) }}</span>
            </div>
          </div>
          <UDropdownMenu
            :items="[[
              { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(l) },
              { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(l) }
            ]]"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
            />
          </UDropdownMenu>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Mietvertrag bearbeiten' : 'Neuer Mietvertrag'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            label="Einheit"
            name="unit_id"
            required
          >
            <USelect
              v-model="form.unit_id"
              :items="options?.units ?? []"
              class="w-full"
              placeholder="Einheit wählen"
            />
          </UFormField>
          <UFormField
            label="Mieter"
            name="tenant_id"
            required
          >
            <USelect
              v-model="form.tenant_id"
              :items="options?.tenants ?? []"
              class="w-full"
              placeholder="Mieter wählen"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Beginn"
              name="start_date"
              required
            >
              <UInput
                v-model="form.start_date"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Ende"
              name="end_date"
              hint="leer = unbefristet"
            >
              <UInput
                v-model="form.end_date"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Kaltmiete (€)"
              name="rent_cold"
            >
              <UInput
                v-model.number="form.rent_cold"
                type="number"
                step="0.01"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="NK-Vorauszahlung (€)"
              name="prepayment"
            >
              <UInput
                v-model.number="form.prepayment"
                type="number"
                step="0.01"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Kaution (€)"
              name="deposit"
            >
              <UInput
                v-model.number="form.deposit"
                type="number"
                step="0.01"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Personen"
              name="persons"
            >
              <UInput
                v-model.number="form.persons"
                type="number"
                min="1"
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
              :disabled="!form.unit_id || !form.tenant_id"
            >
              Speichern
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
