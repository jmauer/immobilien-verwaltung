<script setup lang="ts">
import type { Database, Statement, StatementStatus } from '~/types/database'
import type { StatementDetails, StatementLine } from '~/types/statement'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 6 }, (_, i) => {
  const y = currentYear - i
  return { value: y, label: String(y) }
})

const tabItems = [
  { label: 'Erstellen', icon: 'i-lucide-calculator', slot: 'create' as const },
  { label: 'Verbrauch', icon: 'i-lucide-gauge', slot: 'consumption' as const },
  { label: 'Gespeichert', icon: 'i-lucide-archive', slot: 'saved' as const }
]

// ---------------------------------------------------------------------------
// Erstellen
// ---------------------------------------------------------------------------
const { data: properties } = await useAsyncData('stmt-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return (data ?? []).map(p => ({ value: p.id, label: p.name }))
})

const propertyId = ref<string>('')
const year = ref<number>(currentYear)
const computing = ref(false)
const saving = ref(false)

interface ResultRow {
  lease_id: string
  tenant_name: string
  unit_name: string
  months: number
  total_costs: number
  total_prepayments: number
  balance: number
  details: StatementDetails
}

interface Calculation {
  property_name: string
  total_billable: number
  total_area: number
  total_persons: number
  unit_count: number
  rows: ResultRow[]
  warnings: string[]
}
const calc = ref<Calculation | null>(null)

// Aktive Monate eines Mietvertrags innerhalb des Abrechnungsjahres (volle Monate, inklusiv).
function monthsActive(startDate: string, endDate: string | null, y: number): number {
  const periodStart = new Date(y, 0, 1)
  const periodEnd = new Date(y, 11, 31)
  const ls = new Date(startDate)
  const le = endDate ? new Date(endDate) : periodEnd
  const start = ls > periodStart ? ls : periodStart
  const end = le < periodEnd ? le : periodEnd
  if (start > end) return 0
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  return Math.max(0, Math.min(12, months))
}

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round(n * 1000) / 1000

async function compute() {
  if (!propertyId.value) return
  computing.value = true
  calc.value = null
  try {
    const y = year.value
    const periodStart = `${y}-01-01`
    const periodEnd = `${y}-12-31`

    const propName = properties.value?.find(p => p.value === propertyId.value)?.label ?? ''

    const [unitsRes, costsRes] = await Promise.all([
      supabase.from('units').select('id, name, area').eq('property_id', propertyId.value),
      supabase.from('operating_costs').select('*').eq('property_id', propertyId.value).eq('period_year', y).eq('billable', true)
    ])
    const units = unitsRes.data ?? []
    const costs = costsRes.data ?? []
    const unitIds = units.map(u => u.id)

    let leases: { id: string, persons: number, prepayment: number, start_date: string, end_date: string | null, unit_id: string, tenant: { first_name: string, last_name: string } | null }[] = []
    if (unitIds.length) {
      const { data } = await supabase
        .from('leases')
        .select('id, persons, prepayment, start_date, end_date, unit_id, tenant:tenants(first_name, last_name)')
        .in('unit_id', unitIds)
      leases = (data ?? []) as unknown as typeof leases
    }

    // Verbrauchswerte je Einheit & Art (für verbrauchsabhängige Umlage)
    let consumptions: { unit_id: string, type: string, amount: number, unit_label: string | null }[] = []
    if (unitIds.length) {
      const { data } = await supabase
        .from('consumptions')
        .select('unit_id, type, amount, unit_label')
        .eq('period_year', y)
        .in('unit_id', unitIds)
      consumptions = (data ?? []) as typeof consumptions
    }
    const consByUnitType = new Map<string, Map<string, number>>()
    const totalByType = new Map<string, number>()
    const unitLabelByType = new Map<string, string>()
    for (const c of consumptions) {
      if (!consByUnitType.has(c.unit_id)) consByUnitType.set(c.unit_id, new Map())
      consByUnitType.get(c.unit_id)!.set(c.type, Number(c.amount))
      totalByType.set(c.type, (totalByType.get(c.type) ?? 0) + Number(c.amount))
      if (c.unit_label) unitLabelByType.set(c.type, c.unit_label)
    }

    const unitById = new Map(units.map(u => [u.id, u]))
    const activeLeases = leases.filter(l => monthsActive(l.start_date, l.end_date, y) > 0)

    const totalArea = units.reduce((s, u) => s + Number(u.area ?? 0), 0)
    const totalPersons = activeLeases.reduce((s, l) => s + Number(l.persons ?? 0), 0)
    const unitCount = units.length
    const totalBillable = costs.reduce((s, c) => s + Number(c.amount), 0)

    const warnings: string[] = []
    if (!costs.length) warnings.push('Für dieses Jahr sind keine umlagefähigen Nebenkosten erfasst.')
    if (!activeLeases.length) warnings.push('Keine aktiven Mietverträge im Abrechnungszeitraum.')
    if (totalArea === 0 && costs.some(c => c.allocation_key === 'area' || c.allocation_key === 'consumption')) {
      warnings.push('Flächen der Einheiten fehlen – flächenbasierte Umlage kann nicht berechnet werden.')
    }
    if (totalPersons === 0 && costs.some(c => c.allocation_key === 'persons')) {
      warnings.push('Keine Personenzahl hinterlegt – personenbasierte Umlage wird übersprungen.')
    }
    const missingConsumption = costs.filter(c =>
      c.allocation_key === 'consumption'
      && !(c.consumption_type && (totalByType.get(c.consumption_type) ?? 0) > 0)
    )
    if (missingConsumption.length) {
      warnings.push(`Für ${missingConsumption.length} verbrauchsabhängige Position(en) fehlen Verbrauchswerte – ersatzweise nach Fläche verteilt. Verbrauch unter dem Reiter „Verbrauch“ erfassen.`)
    }

    const rows: ResultRow[] = activeLeases.map((l) => {
      const unit = unitById.get(l.unit_id)
      const unitArea = Number(unit?.area ?? 0)
      const persons = Number(l.persons ?? 0)

      const lines: StatementLine[] = costs.map((c) => {
        let denom = 0
        let metric = 0
        let metricUnit = ''
        let fallback = false
        switch (c.allocation_key) {
          case 'persons':
            denom = totalPersons
            metric = persons
            metricUnit = 'Pers.'
            break
          case 'units':
            denom = unitCount
            metric = 1
            metricUnit = 'Einh.'
            break
          case 'consumption': {
            // Nach tatsächlichem Verbrauch der passenden Verbrauchsart
            const ct = c.consumption_type
            const total = ct ? (totalByType.get(ct) ?? 0) : 0
            if (ct && total > 0) {
              denom = total
              metric = consByUnitType.get(l.unit_id)?.get(ct) ?? 0
              metricUnit = unitLabelByType.get(ct) ?? ''
            } else {
              // Fallback auf Fläche, wenn keine Verbrauchsdaten vorliegen
              denom = totalArea
              metric = unitArea
              metricUnit = 'm²'
              fallback = true
            }
            break
          }
          // 'area' und alles Übrige: flächenbasiert
          default:
            denom = totalArea
            metric = unitArea
            metricUnit = 'm²'
            break
        }
        const share = denom > 0 ? metric / denom : 0
        return {
          category: c.category,
          description: c.description,
          amount: Number(c.amount),
          allocation_key: c.allocation_key,
          share,
          allocated: round2(Number(c.amount) * share),
          metric: round3(metric),
          metric_total: round3(denom),
          metric_unit: metricUnit,
          fallback
        }
      })

      const total_costs = round2(lines.reduce((s, ln) => s + ln.allocated, 0))
      const months = monthsActive(l.start_date, l.end_date, y)
      const total_prepayments = round2(Number(l.prepayment) * months)
      const balance = round2(total_costs - total_prepayments)
      const tenant_name = l.tenant ? `${l.tenant.first_name} ${l.tenant.last_name}` : 'Unbekannt'

      return {
        lease_id: l.id,
        tenant_name,
        unit_name: unit?.name ?? '',
        months,
        total_costs,
        total_prepayments,
        balance,
        details: {
          property_name: propName,
          unit_name: unit?.name ?? '',
          tenant_name,
          period_start: periodStart,
          period_end: periodEnd,
          months,
          monthly_prepayment: Number(l.prepayment),
          bases: { total_area: totalArea, total_persons: totalPersons, unit_count: unitCount, unit_area: unitArea, persons },
          lines
        }
      }
    })

    calc.value = {
      property_name: propName,
      total_billable: round2(totalBillable),
      total_area: totalArea,
      total_persons: totalPersons,
      unit_count: unitCount,
      rows,
      warnings
    }
  } catch (e) {
    toast.add({ title: 'Fehler bei der Berechnung', description: (e as Error).message, color: 'error' })
  } finally {
    computing.value = false
  }
}

// Neu berechnen, wenn Immobilie/Jahr wechselt und schon ein Ergebnis da war.
watch([propertyId, year], () => {
  if (calc.value) calc.value = null
})

async function saveAll() {
  if (!calc.value?.rows.length) return
  saving.value = true
  try {
    const household_id = await useHouseholdId()
    const rows = calc.value.rows.map(r => ({
      household_id,
      lease_id: r.lease_id,
      period_year: year.value,
      total_costs: r.total_costs,
      total_prepayments: r.total_prepayments,
      balance: r.balance,
      status: 'draft' as StatementStatus,
      details: r.details as unknown as Record<string, unknown>
    }))
    const { error } = await supabase
      .from('statements')
      .upsert(rows, { onConflict: 'lease_id,period_year' })
    if (error) throw error
    toast.add({ title: `${rows.length} Abrechnung(en) gespeichert`, color: 'success', icon: 'i-lucide-check' })
    await refreshSaved()
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// Gespeicherte Abrechnungen
// ---------------------------------------------------------------------------
type SavedRow = Statement & {
  lease: {
    tenant: { first_name: string, last_name: string } | null
    unit: { name: string, property: { name: string } | null } | null
  } | null
}

const { data: saved, refresh: refreshSaved } = await useAsyncData('statements', async () => {
  const { data, error } = await supabase
    .from('statements')
    .select('*, lease:leases(tenant:tenants(first_name, last_name), unit:units(name, property:properties(name)))')
    .order('period_year', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as SavedRow[]
})

const statusColor: Record<string, 'neutral' | 'info' | 'success'> = {
  draft: 'neutral',
  sent: 'info',
  settled: 'success'
}

async function setStatus(s: Statement, status: StatementStatus) {
  const { error } = await supabase.from('statements').update({ status }).eq('id', s.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refreshSaved()
}

async function removeStatement(s: Statement) {
  const ok = await confirm({
    title: 'Abrechnung löschen?',
    description: `Die Abrechnung ${s.period_year} wird dauerhaft entfernt.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('statements').delete().eq('id', s.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refreshSaved()
  toast.add({ title: 'Abrechnung gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        Nebenkostenabrechnung
      </h1>
      <p class="text-muted">
        Umlagefähige Kosten verteilen und mit den Vorauszahlungen verrechnen.
      </p>
    </div>

    <UTabs
      :items="tabItems"
      class="w-full"
    >
      <!-- Erstellen -->
      <template #create>
        <div class="space-y-6 pt-4">
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
              <UFormField label="Abrechnungsjahr">
                <USelect
                  v-model="year"
                  :items="yearOptions"
                  class="w-full sm:w-32"
                />
              </UFormField>
              <UButton
                icon="i-lucide-calculator"
                :loading="computing"
                :disabled="!propertyId"
                @click="compute"
              >
                Berechnen
              </UButton>
            </div>
          </UCard>

          <template v-if="calc">
            <UAlert
              v-for="(w, i) in calc.warnings"
              :key="i"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :description="w"
            />

            <!-- Eckdaten -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Umlagefähige Kosten"
                :value="formatEuro(calc.total_billable)"
                icon="i-lucide-receipt"
                color="primary"
              />
              <StatCard
                label="Gesamtfläche"
                :value="formatNumber(calc.total_area, 'm²')"
                icon="i-lucide-ruler"
                color="info"
              />
              <StatCard
                label="Personen"
                :value="String(calc.total_persons)"
                icon="i-lucide-users"
                color="warning"
              />
              <StatCard
                label="Einheiten"
                :value="String(calc.unit_count)"
                icon="i-lucide-door-open"
                color="neutral"
              />
            </div>

            <!-- Ergebnis je Mietvertrag -->
            <UCard v-if="calc.rows.length">
              <template #header>
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <h2 class="font-semibold">
                    Ergebnis je Mietvertrag
                  </h2>
                  <UButton
                    icon="i-lucide-save"
                    :loading="saving"
                    @click="saveAll"
                  >
                    Alle speichern
                  </UButton>
                </div>
              </template>

              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-muted border-b border-default">
                      <th class="py-2 pr-3 font-medium">
                        Mieter
                      </th>
                      <th class="py-2 px-3 font-medium">
                        Einheit
                      </th>
                      <th class="py-2 px-3 font-medium text-center">
                        Monate
                      </th>
                      <th class="py-2 px-3 font-medium text-right">
                        Umlage
                      </th>
                      <th class="py-2 px-3 font-medium text-right">
                        Vorauszahlung
                      </th>
                      <th class="py-2 pl-3 font-medium text-right">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in calc.rows"
                      :key="r.lease_id"
                      class="border-b border-default/50 last:border-0"
                    >
                      <td class="py-2 pr-3 font-medium">
                        {{ r.tenant_name }}
                      </td>
                      <td class="py-2 px-3 text-muted">
                        {{ r.unit_name }}
                      </td>
                      <td class="py-2 px-3 text-center tabular-nums">
                        {{ r.months }}
                      </td>
                      <td class="py-2 px-3 text-right tabular-nums">
                        {{ formatEuro(r.total_costs) }}
                      </td>
                      <td class="py-2 px-3 text-right tabular-nums">
                        {{ formatEuro(r.total_prepayments) }}
                      </td>
                      <td
                        class="py-2 pl-3 text-right tabular-nums font-semibold"
                        :class="r.balance > 0 ? 'text-error' : 'text-success'"
                      >
                        {{ r.balance > 0 ? '+' : '' }}{{ formatEuro(r.balance) }}
                        <span class="block text-xs font-normal text-muted">
                          {{ r.balance > 0 ? 'Nachzahlung' : 'Guthaben' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="text-xs text-muted mt-3">
                Saldo positiv = Nachzahlung des Mieters, negativ = Guthaben. Volle Monate, anteilige Umlage nach Schlüssel.
              </p>
            </UCard>
          </template>
        </div>
      </template>

      <!-- Verbrauch -->
      <template #consumption>
        <div class="pt-4">
          <ConsumptionManager />
        </div>
      </template>

      <!-- Gespeichert -->
      <template #saved>
        <div class="space-y-4 pt-4">
          <UCard
            v-if="!saved?.length"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-file-text"
              class="size-10 text-muted mx-auto mb-3"
            />
            <p class="text-muted">
              Noch keine gespeicherten Abrechnungen.
            </p>
          </UCard>

          <div
            v-else
            class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
          >
            <div
              v-for="s in saved"
              :key="s.id"
              class="flex items-center justify-between gap-3 p-3"
            >
              <NuxtLink
                :to="`/abrechnungen/${s.id}`"
                class="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80"
              >
                <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <UIcon
                    name="i-lucide-file-text"
                    class="size-5"
                  />
                </div>
                <div class="min-w-0">
                  <p class="font-medium truncate">
                    {{ s.lease?.tenant?.first_name }} {{ s.lease?.tenant?.last_name }}
                    <span class="text-muted font-normal">· {{ s.period_year }}</span>
                  </p>
                  <p class="text-sm text-muted truncate">
                    {{ s.lease?.unit?.property?.name }} – {{ s.lease?.unit?.name }}
                  </p>
                </div>
              </NuxtLink>

              <div class="flex items-center gap-3 shrink-0">
                <span
                  class="text-right tabular-nums font-semibold hidden sm:block"
                  :class="s.balance > 0 ? 'text-error' : 'text-success'"
                >
                  {{ s.balance > 0 ? '+' : '' }}{{ formatEuro(s.balance) }}
                </span>
                <UBadge
                  :color="statusColor[s.status] ?? 'neutral'"
                  variant="subtle"
                >
                  {{ STATEMENT_STATUS_LABELS[s.status] ?? s.status }}
                </UBadge>
                <UDropdownMenu
                  :items="[[
                    { label: 'Öffnen / Drucken', icon: 'i-lucide-external-link', onSelect: () => navigateTo(`/abrechnungen/${s.id}`) }
                  ], [
                    { label: 'Als Entwurf', icon: 'i-lucide-pencil', onSelect: () => setStatus(s, 'draft') },
                    { label: 'Als versendet', icon: 'i-lucide-send', onSelect: () => setStatus(s, 'sent') },
                    { label: 'Als abgeschlossen', icon: 'i-lucide-check', onSelect: () => setStatus(s, 'settled') }
                  ], [
                    { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeStatement(s) }
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
    </UTabs>
  </div>
</template>
