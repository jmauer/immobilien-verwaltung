<script setup lang="ts">
import type { Database, Consumption, ConsumptionType } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 6 }, (_, i) => {
  const y = currentYear - i
  return { value: y, label: String(y) }
})

const { data: properties } = await useAsyncData('consumption-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return (data ?? []).map(p => ({ value: p.id, label: p.name }))
})

const propertyId = ref<string>('')
const year = ref<number>(currentYear)

// Einheiten der gewählten Immobilie
const { data: units } = await useAsyncData('consumption-units', async () => {
  if (!propertyId.value) return []
  const { data } = await supabase.from('units').select('id, name').eq('property_id', propertyId.value).order('name')
  return data ?? []
}, { watch: [propertyId] })

const unitOptions = computed(() => (units.value ?? []).map(u => ({ value: u.id, label: u.name })))
const unitName = (id: string) => units.value?.find(u => u.id === id)?.name ?? '–'

type ConsumptionRow = Consumption

const { data: rows, refresh, pending } = await useAsyncData('consumptions', async () => {
  if (!propertyId.value) return []
  const unitIds = (units.value ?? []).map(u => u.id)
  if (!unitIds.length) return []
  const { data, error } = await supabase
    .from('consumptions')
    .select('*')
    .eq('period_year', year.value)
    .in('unit_id', unitIds)
  if (error) throw error
  return data as ConsumptionRow[]
}, { watch: [propertyId, year, units] })

const typeOptions = Object.entries(CONSUMPTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const blank = () => ({
  unit_id: '',
  type: 'water_cold' as ConsumptionType,
  amount: 0,
  unit_label: CONSUMPTION_UNIT_DEFAULTS.water_cold ?? ''
})
const form = reactive(blank())

// Mengeneinheit automatisch zur Verbrauchsart vorschlagen.
watch(() => form.type, (t) => {
  form.unit_label = CONSUMPTION_UNIT_DEFAULTS[t] ?? ''
})

function openCreate() {
  if (!unitOptions.value.length) {
    toast.add({ title: 'Keine Einheiten', description: 'Lege zuerst Einheiten in dieser Immobilie an.', color: 'warning' })
    return
  }
  editingId.value = null
  Object.assign(form, blank(), { unit_id: unitOptions.value[0]?.value ?? '' })
  open.value = true
}
function openEdit(r: Consumption) {
  editingId.value = r.id
  Object.assign(form, {
    unit_id: r.unit_id,
    type: r.type,
    amount: r.amount,
    unit_label: r.unit_label ?? ''
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    const household_id = await useHouseholdId()
    const payload = {
      household_id,
      unit_id: form.unit_id,
      period_year: year.value,
      type: form.type,
      amount: form.amount,
      unit_label: form.unit_label || null
    }
    // Upsert: ein Wert je Einheit/Jahr/Art
    const { error } = await supabase
      .from('consumptions')
      .upsert(payload, { onConflict: 'unit_id,period_year,type' })
    if (error) throw error
    open.value = false
    await refresh()
    toast.add({ title: 'Gespeichert', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(r: Consumption) {
  const ok = await confirm({
    title: 'Verbrauchswert löschen?',
    description: 'Der erfasste Verbrauchswert wird dauerhaft entfernt.',
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('consumptions').delete().eq('id', r.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Verbrauchswert gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
        <UFormField
          label="Immobilie"
          class="flex-1"
        >
          <USelect
            v-model="propertyId"
            :items="properties ?? []"
            placeholder="Immobilie wählen"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jahr">
          <USelect
            v-model="year"
            :items="yearOptions"
            class="w-full sm:w-32"
          />
        </UFormField>
        <UButton
          icon="i-lucide-plus"
          :disabled="!propertyId"
          @click="openCreate"
        >
          Verbrauch
        </UButton>
      </div>
    </UCard>

    <p
      v-if="!propertyId"
      class="text-center py-8 text-muted text-sm"
    >
      Wähle eine Immobilie, um Verbrauchswerte zu erfassen.
    </p>

    <template v-else>
      <div
        v-if="pending"
        class="space-y-2"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-12 w-full"
        />
      </div>

      <UCard
        v-else-if="!rows?.length"
        class="text-center py-10"
      >
        <UIcon
          name="i-lucide-gauge"
          class="size-10 text-muted mx-auto mb-3"
        />
        <p class="text-muted">
          Keine Verbrauchswerte für {{ year }}.
        </p>
        <UButton
          class="mt-4"
          icon="i-lucide-plus"
          @click="openCreate"
        >
          Verbrauch erfassen
        </UButton>
      </UCard>

      <div
        v-else
        class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
      >
        <div
          v-for="r in rows"
          :key="r.id"
          class="flex items-center justify-between gap-3 p-3"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ unitName(r.unit_id) }}
              <UBadge
                color="neutral"
                variant="subtle"
                size="sm"
                class="ml-1"
              >
                {{ CONSUMPTION_TYPE_LABELS[r.type] }}
              </UBadge>
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-semibold tabular-nums">{{ formatNumber(r.amount) }} {{ r.unit_label }}</span>
            <UDropdownMenu
              :items="[[
                { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(r) },
                { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(r) }
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
    </template>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Verbrauch bearbeiten' : 'Verbrauch erfassen'"
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
              :items="unitOptions"
              class="w-full"
              placeholder="Einheit wählen"
            />
          </UFormField>
          <UFormField
            label="Verbrauchsart"
            name="type"
          >
            <USelect
              v-model="form.type"
              :items="typeOptions"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Verbrauch"
              name="amount"
              required
            >
              <UInput
                v-model.number="form.amount"
                type="number"
                step="0.001"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Einheit"
              name="unit_label"
            >
              <UInput
                v-model="form.unit_label"
                class="w-full"
                placeholder="m³"
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
              :disabled="!form.unit_id || !form.amount"
            >
              Speichern
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
