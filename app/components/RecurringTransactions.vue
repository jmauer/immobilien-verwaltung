<script setup lang="ts">
import type { Database, RecurringTransaction, TransactionType, RecurrenceFrequency } from '~/types/database'

const emit = defineEmits<{ (e: 'generated'): void }>()

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

type RuleRow = RecurringTransaction & { property: { name: string } | null }

const { data: rules, refresh, pending } = await useAsyncData('recurring', async () => {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*, property:properties(name)')
    .order('active', { ascending: false })
    .order('next_run')
  if (error) throw error
  return data as unknown as RuleRow[]
})

const { data: propertyOptions } = await useAsyncData('recurring-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return [{ value: 'none', label: 'Keine Zuordnung' }, ...(data ?? []).map(p => ({ value: p.id, label: p.name }))]
})

const typeOptions = [
  { value: 'income', label: 'Einnahme' },
  { value: 'expense', label: 'Ausgabe' }
]
const frequencyOptions = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))

const open = ref(false)
const saving = ref(false)
const generating = ref(false)
const editingId = ref<string | null>(null)
const today = new Date().toISOString().slice(0, 10)

const blank = () => ({
  type: 'income' as TransactionType,
  category: '',
  description: '',
  amount: 0,
  frequency: 'monthly' as RecurrenceFrequency,
  start_date: today,
  end_date: '',
  property_id: 'none',
  active: true
})
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(r: RecurringTransaction) {
  editingId.value = r.id
  Object.assign(form, {
    type: r.type,
    category: r.category,
    description: r.description ?? '',
    amount: r.amount,
    frequency: r.frequency,
    start_date: r.start_date,
    end_date: r.end_date ?? '',
    property_id: r.property_id ?? 'none',
    active: r.active
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = {
      type: form.type,
      category: form.category,
      description: form.description,
      amount: form.amount,
      frequency: form.frequency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      property_id: form.property_id === 'none' ? null : form.property_id,
      active: form.active
    }
    if (editingId.value) {
      const { error } = await supabase.from('recurring_transactions').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      // next_run wird per DB-Trigger auf start_date gesetzt
      const { error } = await supabase.from('recurring_transactions').insert({ ...payload, household_id })
      if (error) throw error
    }
    open.value = false
    await refresh()
    toast.add({ title: 'Gespeichert', color: 'success' })
    await generateDue(true)
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function toggleActive(r: RecurringTransaction) {
  const { error } = await supabase
    .from('recurring_transactions')
    .update({ active: !r.active })
    .eq('id', r.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
}

async function remove(r: RecurringTransaction) {
  const ok = await confirm({
    title: 'Dauerauftrag löschen?',
    description: `„${r.category}“ wird gelöscht. Bereits erzeugte Buchungen bleiben erhalten.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', r.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Dauerauftrag gelöscht', color: 'success' })
}

// Fällige Umsätze verbuchen (per RPC). silent = ohne „nichts fällig"-Hinweis.
async function generateDue(silent = false) {
  generating.value = true
  try {
    const { data, error } = await supabase.rpc('generate_due_transactions')
    if (error) throw error
    const count = data ?? 0
    if (count > 0) {
      toast.add({ title: `${count} Buchung(en) verbucht`, color: 'success', icon: 'i-lucide-check' })
      await refresh()
      emit('generated')
    } else if (!silent) {
      toast.add({ title: 'Keine fälligen Umsätze', color: 'neutral' })
    }
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <p class="text-sm text-muted">
        Daueraufträge für regelmäßige Umsätze – fällige Buchungen werden automatisch erzeugt.
      </p>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          :loading="generating"
          @click="generateDue(false)"
        >
          Fällige verbuchen
        </UButton>
        <UButton
          icon="i-lucide-plus"
          @click="openCreate"
        >
          Dauerauftrag
        </UButton>
      </div>
    </div>

    <div
      v-if="pending"
      class="space-y-2"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-16 w-full"
      />
    </div>

    <UCard
      v-else-if="!rules?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-repeat"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Noch keine Daueraufträge.
      </p>
      <UButton
        class="mt-4"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Ersten Dauerauftrag anlegen
      </UButton>
    </UCard>

    <div
      v-else
      class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
    >
      <div
        v-for="r in rules"
        :key="r.id"
        class="flex items-center justify-between gap-3 p-3 bg-transparent"
        :class="{ 'opacity-55': !r.active }"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UIcon
            :name="r.type === 'income' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
            :class="r.type === 'income' ? 'text-success' : 'text-error'"
            class="size-5 shrink-0"
          />
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ r.category }}<span
                v-if="r.description"
                class="text-muted font-normal"
              > · {{ r.description }}</span>
            </p>
            <p class="text-sm text-muted">
              {{ FREQUENCY_LABELS[r.frequency] }}
              <span v-if="r.property"> · {{ r.property.name }}</span>
              <span v-if="r.active"> · nächste: {{ formatDate(r.next_run) }}</span>
              <span v-else> · beendet</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span
            class="font-semibold"
            :class="r.type === 'income' ? 'text-success' : 'text-error'"
          >
            {{ r.type === 'income' ? '+' : '−' }}{{ formatEuro(r.amount) }}
          </span>
          <USwitch
            :model-value="r.active"
            size="sm"
            @update:model-value="toggleActive(r)"
          />
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

    <UModal
      v-model:open="open"
      :title="editingId ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Art"
              name="type"
            >
              <USelect
                v-model="form.type"
                :items="typeOptions"
                class="w-full"
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
            label="Kategorie"
            name="category"
            required
          >
            <UInput
              v-model="form.category"
              class="w-full"
              placeholder="z. B. Miete, Darlehensrate"
            />
          </UFormField>
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
              label="Intervall"
              name="frequency"
            >
              <USelect
                v-model="form.frequency"
                :items="frequencyOptions"
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
              label="Erste Fälligkeit"
              name="start_date"
              required
              hint="bestimmt den Tag"
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
              :disabled="!form.category || !form.amount"
            >
              Speichern
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
