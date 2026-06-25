<script setup lang="ts">
import type { Database, Statement } from '~/types/database'
import type { StatementDetails } from '~/types/statement'

const route = useRoute()
const supabase = useSupabaseClient<Database>()
const id = route.params.id as string

const { data: statement } = await useAsyncData(`statement-${id}`, async () => {
  const { data, error } = await supabase
    .from('statements')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Statement
})

const details = computed(() => (statement.value?.details ?? null) as StatementDetails | null)

const isNachzahlung = computed(() => (statement.value?.balance ?? 0) > 0)

function print() {
  window.print()
}
</script>

<template>
  <div
    v-if="statement && details"
    class="space-y-6"
  >
    <!-- Kopfzeile (nicht gedruckt) -->
    <div class="flex items-center justify-between gap-2 no-print">
      <UButton
        to="/abrechnungen"
        icon="i-lucide-arrow-left"
        variant="link"
        color="neutral"
        class="-ml-2"
      >
        Abrechnungen
      </UButton>
      <UButton
        icon="i-lucide-printer"
        @click="print"
      >
        Drucken / PDF
      </UButton>
    </div>

    <!-- Druckbares Dokument -->
    <div class="print-sheet glass rounded-2xl p-6 sm:p-8 space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold">
            Betriebskostenabrechnung {{ statement.period_year }}
          </h1>
          <p class="text-muted text-sm">
            Abrechnungszeitraum {{ formatDate(details.period_start) }} – {{ formatDate(details.period_end) }}
          </p>
        </div>
        <UBadge
          color="neutral"
          variant="subtle"
        >
          {{ STATEMENT_STATUS_LABELS[statement.status] ?? statement.status }}
        </UBadge>
      </div>

      <div class="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-muted">
            Mieter
          </p>
          <p class="font-medium">
            {{ details.tenant_name }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Objekt / Einheit
          </p>
          <p class="font-medium">
            {{ details.property_name }} – {{ details.unit_name }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Abgerechnete Monate
          </p>
          <p class="font-medium">
            {{ details.months }} von 12
          </p>
        </div>
        <div>
          <p class="text-muted">
            Umlagebasis
          </p>
          <p class="font-medium">
            {{ formatNumber(details.bases.unit_area, 'm²') }} ·
            {{ details.bases.persons }} Pers. (Gesamt: {{ formatNumber(details.bases.total_area, 'm²') }},
            {{ details.bases.total_persons }} Pers., {{ details.bases.unit_count }} Einh.)
          </p>
        </div>
      </div>

      <!-- Kostenaufstellung -->
      <div>
        <h2 class="font-semibold mb-2">
          Aufstellung der umlagefähigen Kosten
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-muted border-b border-default">
                <th class="py-2 pr-3 font-medium">
                  Position
                </th>
                <th class="py-2 px-3 font-medium">
                  Schlüssel
                </th>
                <th class="py-2 px-3 font-medium text-right">
                  Gesamtkosten
                </th>
                <th class="py-2 px-3 font-medium text-right">
                  Anteil
                </th>
                <th class="py-2 pl-3 font-medium text-right">
                  Ihr Anteil
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(ln, i) in details.lines"
                :key="i"
                class="border-b border-default/50"
              >
                <td class="py-2 pr-3">
                  {{ ln.category }}<span
                    v-if="ln.description"
                    class="text-muted"
                  > · {{ ln.description }}</span>
                </td>
                <td class="py-2 px-3 text-muted">
                  {{ ALLOCATION_KEY_LABELS[ln.allocation_key] ?? ln.allocation_key }}
                  <span
                    v-if="ln.fallback"
                    class="text-warning"
                  > (ersatzw. Fläche)</span>
                  <span
                    v-if="ln.metric_total"
                    class="block text-xs"
                  >
                    {{ formatNumber(ln.metric) }}{{ ln.metric_unit ? ' ' + ln.metric_unit : '' }}
                    / {{ formatNumber(ln.metric_total) }}{{ ln.metric_unit ? ' ' + ln.metric_unit : '' }}
                  </span>
                </td>
                <td class="py-2 px-3 text-right tabular-nums">
                  {{ formatEuro(ln.amount) }}
                </td>
                <td class="py-2 px-3 text-right tabular-nums text-muted">
                  {{ (ln.share * 100).toFixed(1) }}%
                </td>
                <td class="py-2 pl-3 text-right tabular-nums font-medium">
                  {{ formatEuro(ln.allocated) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-default font-semibold">
                <td
                  class="py-2 pr-3"
                  colspan="4"
                >
                  Summe Ihrer Kostenanteile
                </td>
                <td class="py-2 pl-3 text-right tabular-nums">
                  {{ formatEuro(statement.total_costs) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Abrechnung -->
      <div class="border-t border-default pt-4 space-y-2 text-sm max-w-sm ml-auto">
        <div class="flex justify-between">
          <span class="text-muted">Ihr Kostenanteil</span>
          <span class="tabular-nums">{{ formatEuro(statement.total_costs) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">
            Geleistete Vorauszahlungen ({{ details.months }} × {{ formatEuro(details.monthly_prepayment) }})
          </span>
          <span class="tabular-nums">− {{ formatEuro(statement.total_prepayments) }}</span>
        </div>
        <div class="flex justify-between border-t border-default pt-2 text-base font-bold">
          <span>{{ isNachzahlung ? 'Nachzahlung' : 'Guthaben' }}</span>
          <span
            class="tabular-nums"
            :class="isNachzahlung ? 'text-error' : 'text-success'"
          >
            {{ formatEuro(Math.abs(statement.balance)) }}
          </span>
        </div>
      </div>

      <p class="text-xs text-muted border-t border-default pt-4">
        Diese Abrechnung wurde automatisch erstellt. Vorbehaltlich Rechen- und Übertragungsfehler.
        Umlage anteilig nach dem jeweils angegebenen Verteilerschlüssel.
      </p>
    </div>
  </div>

  <div
    v-else
    class="py-20 text-center text-muted"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-6 animate-spin mx-auto"
    />
  </div>
</template>
