<script setup lang="ts">
import type { Database, OperatingCost, AllocationKey } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

type CostRow = OperatingCost & { property: { name: string } | null }

const year = ref(new Date().getFullYear())
const yearOptions = Array.from({ length: 6 }, (_, i) => {
  const y = new Date().getFullYear() - i
  return { value: y, label: String(y) }
})

const { data: costs, refresh, pending } = await useAsyncData('operating-costs', async () => {
  const { data, error } = await supabase
    .from('operating_costs')
    .select('*, property:properties(name)')
    .eq('period_year', year.value)
    .order('cost_date', { ascending: false })
  if (error) throw error
  return data as unknown as CostRow[]
}, { watch: [year] })

const { data: propertyOptions } = await useAsyncData('cost-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return (data ?? []).map(p => ({ value: p.id, label: p.name }))
})

const total = computed(() => (costs.value ?? []).reduce((s, c) => s + Number(c.amount), 0))
const billableTotal = computed(() =>
  (costs.value ?? []).filter(c => c.billable).reduce((s, c) => s + Number(c.amount), 0))

const allocationOptions = Object.entries(ALLOCATION_KEY_LABELS).map(([value, label]) => ({ value, label }))
const consumptionTypeOptions = Object.entries(CONSUMPTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const today = new Date().toISOString().slice(0, 10)
const blank = () => ({
  property_id: '',
  category: '',
  description: '',
  amount: 0,
  cost_date: today,
  period_year: year.value,
  billable: true,
  allocation_key: 'area' as AllocationKey,
  consumption_type: 'water_cold'
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank(), { period_year: year.value })
  open.value = true
}
function openEdit(c: OperatingCost) {
  editingId.value = c.id
  Object.assign(form, {
    property_id: c.property_id,
    category: c.category,
    description: c.description ?? '',
    amount: c.amount,
    cost_date: c.cost_date,
    period_year: c.period_year,
    billable: c.billable,
    allocation_key: c.allocation_key,
    consumption_type: c.consumption_type ?? 'water_cold'
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    // Verbrauchsart nur speichern, wenn der Schlüssel 'Verbrauch' ist.
    const payload = {
      ...form,
      consumption_type: form.allocation_key === 'consumption' ? form.consumption_type : null
    }
    if (editingId.value) {
      const { error } = await supabase.from('operating_costs').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('operating_costs').insert({ ...payload, household_id })
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

async function remove(c: OperatingCost) {
  const ok = await confirm({
    title: 'Kostenposition löschen?',
    description: `„${c.category}“ über ${formatEuro(c.amount)} wird dauerhaft entfernt.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('operating_costs').delete().eq('id', c.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Kostenposition gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          Nebenkosten
        </h1>
        <p class="text-muted">
          Abrechnungsjahr {{ year }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <USelect
          v-model="year"
          :items="yearOptions"
          class="w-28"
        />
        <UButton
          icon="i-lucide-plus"
          :disabled="!propertyOptions?.length"
          @click="openCreate"
        >
          Position
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="!propertyOptions?.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      title="Keine Immobilie vorhanden"
      description="Lege zuerst eine Immobilie an, um Nebenkosten zu erfassen."
    />

    <div class="grid grid-cols-2 gap-4">
      <UCard>
        <p class="text-sm text-muted">
          Gesamtkosten {{ year }}
        </p>
        <p class="font-semibold mt-1">
          {{ formatEuro(total) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          davon umlagefähig
        </p>
        <p class="font-semibold mt-1">
          {{ formatEuro(billableTotal) }}
        </p>
      </UCard>
    </div>

    <div
      v-if="pending"
      class="space-y-2"
    >
      <USkeleton
        v-for="i in 4"
        :key="i"
        class="h-12 w-full"
      />
    </div>

    <UCard
      v-else-if="!costs?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-receipt"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Keine Kostenpositionen für {{ year }}.
      </p>
    </UCard>

    <div
      v-else
      class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
    >
      <div
        v-for="c in costs"
        :key="c.id"
        class="flex items-center justify-between gap-3 p-3 bg-transparent"
      >
        <div class="min-w-0">
          <p class="font-medium truncate">
            {{ c.category }}
            <UBadge
              v-if="!c.billable"
              color="neutral"
              variant="subtle"
              size="sm"
              class="ml-1"
            >
              nicht umlagefähig
            </UBadge>
          </p>
          <p class="text-sm text-muted truncate">
            {{ c.property?.name }} · {{ formatDate(c.cost_date) }} · Umlage: {{ ALLOCATION_KEY_LABELS[c.allocation_key] }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="font-semibold">{{ formatEuro(c.amount) }}</span>
          <UDropdownMenu
            :items="[[
              { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(c) },
              { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(c) }
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
      :title="editingId ? 'Position bearbeiten' : 'Neue Kostenposition'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            label="Immobilie"
            name="property_id"
            required
          >
            <USelect
              v-model="form.property_id"
              :items="propertyOptions ?? []"
              class="w-full"
              placeholder="Immobilie wählen"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Kategorie"
              name="category"
              required
            >
              <UInput
                v-model="form.category"
                class="w-full"
                placeholder="z. B. Müll, Wasser"
              />
            </UFormField>
            <UFormField
              label="Betrag (€)"
              name="amount"
              required
            >
              <UInput
                v-model.number="form.amount"
                type="number"
                step="0.01"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Beschreibung"
            name="description"
          >
            <UInput
              v-model="form.description"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Datum"
              name="cost_date"
              required
            >
              <UInput
                v-model="form.cost_date"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Jahr"
              name="period_year"
              required
            >
              <UInput
                v-model.number="form.period_year"
                type="number"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Umlageschlüssel"
              name="allocation_key"
            >
              <USelect
                v-model="form.allocation_key"
                :items="allocationOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="form.allocation_key === 'consumption'"
              label="Verbrauchsart"
              name="consumption_type"
            >
              <USelect
                v-model="form.consumption_type"
                :items="consumptionTypeOptions"
                class="w-full"
              />
            </UFormField>
          </div>
          <UAlert
            v-if="form.allocation_key === 'consumption'"
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            description="Verbrauchswerte je Einheit werden unter „Abrechnungen → Verbrauch“ erfasst."
          />
          <UCheckbox
            v-model="form.billable"
            label="Umlagefähig (auf Mieter umlegbar)"
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
              :disabled="!form.property_id || !form.category"
            >
              Speichern
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
