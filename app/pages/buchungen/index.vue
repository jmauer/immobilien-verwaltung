<script setup lang="ts">
import type { Database, Transaction, TransactionType } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

type TxRow = Transaction & { property: { name: string } | null }

const { data: txs, refresh, pending } = await useAsyncData('transactions', async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, property:properties(name)')
    .order('tx_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return data as unknown as TxRow[]
})

const { data: propertyOptions } = await useAsyncData('tx-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return [{ value: 'none', label: 'Keine Zuordnung' }, ...(data ?? []).map(p => ({ value: p.id, label: p.name }))]
})

const summary = computed(() => {
  const income = (txs.value ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = (txs.value ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  return { income, expense, balance: income - expense }
})

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const today = new Date().toISOString().slice(0, 10)
const blank = () => ({
  type: 'income' as TransactionType,
  category: '',
  description: '',
  amount: 0,
  tx_date: today,
  property_id: 'none'
})
const form = reactive(blank())

const typeOptions = [
  { value: 'income', label: 'Einnahme' },
  { value: 'expense', label: 'Ausgabe' }
]

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(t: Transaction) {
  editingId.value = t.id
  Object.assign(form, {
    type: t.type,
    category: t.category,
    description: t.description ?? '',
    amount: t.amount,
    tx_date: t.tx_date,
    property_id: t.property_id ?? 'none'
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { ...form, property_id: form.property_id === 'none' ? null : form.property_id }
    if (editingId.value) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('transactions').insert({ ...payload, household_id })
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

async function remove(t: Transaction) {
  const ok = await confirm({
    title: 'Buchung löschen?',
    description: `„${t.category}“ über ${formatEuro(t.amount)} wird dauerhaft entfernt.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('transactions').delete().eq('id', t.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Buchung gelöscht', color: 'success' })
}

const tabItems = [
  { label: 'Buchungen', icon: 'i-lucide-list', slot: 'tx' as const },
  { label: 'Wiederkehrend', icon: 'i-lucide-repeat', slot: 'recurring' as const }
]

// Beim Öffnen fällige Daueraufträge automatisch verbuchen.
onMounted(async () => {
  const { data } = await supabase.rpc('generate_due_transactions')
  if ((data ?? 0) > 0) {
    toast.add({ title: `${data} fällige Buchung(en) automatisch verbucht`, color: 'success', icon: 'i-lucide-repeat' })
    await refresh()
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        Buchungen
      </h1>
      <p class="text-muted">
        Einnahmen, Ausgaben & Daueraufträge
      </p>
    </div>

    <UTabs
      :items="tabItems"
      class="w-full"
    >
      <template #tx>
        <div class="space-y-6 pt-4">
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-plus"
              @click="openCreate"
            >
              Neue Buchung
            </UButton>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <UCard>
              <p class="text-sm text-muted">
                Einnahmen
              </p>
              <p class="font-semibold mt-1 text-success">
                {{ formatEuro(summary.income) }}
              </p>
            </UCard>
            <UCard>
              <p class="text-sm text-muted">
                Ausgaben
              </p>
              <p class="font-semibold mt-1 text-error">
                {{ formatEuro(summary.expense) }}
              </p>
            </UCard>
            <UCard>
              <p class="text-sm text-muted">
                Saldo
              </p>
              <p
                class="font-semibold mt-1"
                :class="summary.balance >= 0 ? 'text-success' : 'text-error'"
              >
                {{ formatEuro(summary.balance) }}
              </p>
            </UCard>
          </div>

          <div
            v-if="pending"
            class="space-y-2"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-12 w-full"
            />
          </div>

          <UCard
            v-else-if="!txs?.length"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-arrow-left-right"
              class="size-10 text-muted mx-auto mb-3"
            />
            <p class="text-muted">
              Noch keine Buchungen.
            </p>
          </UCard>

          <div
            v-else
            class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
          >
            <div
              v-for="t in txs"
              :key="t.id"
              class="flex items-center justify-between gap-3 p-3 bg-transparent"
            >
              <div class="flex items-center gap-3 min-w-0">
                <UIcon
                  :name="t.type === 'income' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
                  :class="t.type === 'income' ? 'text-success' : 'text-error'"
                  class="size-5 shrink-0"
                />
                <div class="min-w-0">
                  <p class="font-medium truncate">
                    {{ t.category }}<span
                      v-if="t.description"
                      class="text-muted font-normal"
                    > · {{ t.description }}</span>
                  </p>
                  <p class="text-sm text-muted">
                    {{ formatDate(t.tx_date) }}<span v-if="t.property"> · {{ t.property.name }}</span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="font-semibold"
                  :class="t.type === 'income' ? 'text-success' : 'text-error'"
                >
                  {{ t.type === 'income' ? '+' : '−' }}{{ formatEuro(t.amount) }}
                </span>
                <UDropdownMenu
                  :items="[[
                    { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(t) },
                    { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(t) }
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
      </template>

      <template #recurring>
        <div class="pt-4">
          <RecurringTransactions @generated="refresh" />
        </div>
      </template>
    </UTabs>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Buchung bearbeiten' : 'Neue Buchung'"
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
              placeholder="z. B. Miete, Reparatur, Grundsteuer"
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
              label="Datum"
              name="tx_date"
              required
            >
              <UInput
                v-model="form.tx_date"
                type="date"
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
