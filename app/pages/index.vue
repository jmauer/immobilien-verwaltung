<script setup lang="ts">
import type { Database, CalendarEvent } from '~/types/database'
import type { MonthPoint } from '~/types/charts'

const supabase = useSupabaseClient<Database>()
const { data: profile } = await useProfile()

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const currentYear = new Date().getFullYear()
const year = ref(currentYear)
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - i
  return { value: y, label: String(y) }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
})
const firstName = computed(() => profile.value?.full_name?.split(' ')[0] ?? '')

const { data: stats, pending } = await useAsyncData('dashboard', async () => {
  const [properties, units, leases, tx] = await Promise.all([
    supabase.from('properties').select('id, name'),
    supabase.from('units').select('id', { count: 'exact', head: true }),
    supabase.from('leases').select('rent_cold, prepayment, end_date'),
    supabase.from('transactions').select('type, amount, tx_date, category, property_id').gte('tx_date', `${year.value}-01-01`).lte('tx_date', `${year.value}-12-31`)
  ])

  const today = new Date().toISOString().slice(0, 10)
  const activeLeases = (leases.data ?? []).filter(l => !l.end_date || l.end_date >= today)
  const monthlyRent = activeLeases.reduce((s, l) => s + Number(l.rent_cold) + Number(l.prepayment), 0)

  const propertyById = new Map((properties.data ?? []).map(p => [p.id, p.name]))
  const txs = tx.data ?? []

  const monthly: MonthPoint[] = MONTHS.map((label, i) => ({ i, label, income: 0, expense: 0, net: 0 }))
  const byCategory = new Map<string, number>()
  const byProperty = new Map<string, number>()
  let income = 0
  let expense = 0

  for (const t of txs) {
    const m = new Date(t.tx_date).getMonth()
    const amount = Number(t.amount)
    if (t.type === 'income') {
      income += amount
      monthly[m]!.income += amount
      const key = t.property_id ? (propertyById.get(t.property_id) ?? 'Ohne Zuordnung') : 'Ohne Zuordnung'
      byProperty.set(key, (byProperty.get(key) ?? 0) + amount)
    } else {
      expense += amount
      monthly[m]!.expense += amount
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + amount)
    }
  }
  for (const p of monthly) p.net = p.income - p.expense

  const categories = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const incomeByProperty = [...byProperty.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return {
    properties: (properties.data ?? []).length,
    units: units.count ?? 0,
    activeLeases: activeLeases.length,
    monthlyRent,
    income,
    expense,
    cashflow: income - expense,
    monthly,
    categories,
    incomeByProperty,
    hasTx: txs.length > 0
  }
}, { watch: [year] })

const maxPropertyIncome = computed(() =>
  Math.max(1, ...(stats.value?.incomeByProperty ?? []).map(p => p.value)))

// Anstehende Termine
const { data: upcomingEvents } = await useAsyncData('dashboard-events', async () => {
  const { data } = await supabase
    .from('calendar_events')
    .select('id, title, category, start_at, all_day')
    .gte('start_at', new Date().toISOString())
    .order('start_at')
    .limit(5)
  return (data ?? []) as Pick<CalendarEvent, 'id' | 'title' | 'category' | 'start_at' | 'all_day'>[]
})

const quickLinks = [
  { label: 'Immobilie', to: '/immobilien', icon: 'i-lucide-building-2' },
  { label: 'Mieter', to: '/mieter', icon: 'i-lucide-users' },
  { label: 'Mietvertrag', to: '/mietvertraege', icon: 'i-lucide-file-signature' },
  { label: 'Buchung', to: '/buchungen', icon: 'i-lucide-arrow-left-right' },
  { label: 'Termin', to: '/kalender', icon: 'i-lucide-calendar-plus' },
  { label: 'Dokument', to: '/dokumente', icon: 'i-lucide-upload' }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Hero -->
    <div class="relative overflow-hidden rounded-2xl border border-default bg-gradient-to-br from-primary/10 via-elevated/30 to-transparent p-6">
      <div class="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl" />
      <div class="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">
            {{ greeting }}<span v-if="firstName">, {{ firstName }}</span> 👋
          </h1>
          <p class="text-muted">
            Hier ist der Überblick über {{ profile?.household?.name ?? 'deinen Haushalt' }}.
          </p>
        </div>
        <USelect
          v-model="year"
          :items="yearOptions"
          class="w-28"
          icon="i-lucide-calendar"
        />
      </div>
    </div>

    <!-- Kennzahlen -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Immobilien"
        :value="String(stats?.properties ?? 0)"
        icon="i-lucide-building-2"
        color="primary"
        to="/immobilien"
        :loading="pending"
      />
      <StatCard
        label="Einheiten"
        :value="String(stats?.units ?? 0)"
        icon="i-lucide-door-open"
        color="info"
        :loading="pending"
      />
      <StatCard
        label="Aktive Verträge"
        :value="String(stats?.activeLeases ?? 0)"
        icon="i-lucide-file-signature"
        color="warning"
        to="/mietvertraege"
        :loading="pending"
      />
      <StatCard
        label="Warmmiete / Monat"
        :value="formatEuro(stats?.monthlyRent)"
        icon="i-lucide-banknote"
        color="success"
        :loading="pending"
      />
    </div>

    <!-- Schnellzugriff -->
    <UCard>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="q in quickLinks"
          :key="q.to"
          :to="q.to"
          :icon="q.icon"
          variant="soft"
        >
          {{ q.label }}
        </UButton>
      </div>
    </UCard>

    <!-- Cashflow-Chart -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-baseline gap-3">
            <h2 class="font-semibold">
              Cashflow {{ year }}
            </h2>
            <span
              class="text-sm font-semibold tabular-nums"
              :class="(stats?.cashflow ?? 0) >= 0 ? 'text-success' : 'text-error'"
            >
              {{ formatEuro(stats?.cashflow) }}
            </span>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-success" />Einnahmen</span>
            <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-error" />Ausgaben</span>
            <span class="flex items-center gap-1.5"><span
              class="size-2.5 rounded-full"
              style="background:#8b5cf6"
            />Netto</span>
          </div>
        </div>
      </template>

      <div
        v-if="pending"
        class="h-[300px] flex items-center justify-center"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-muted"
        />
      </div>
      <div
        v-else-if="!stats?.hasTx"
        class="h-[300px] flex flex-col items-center justify-center text-center"
      >
        <UIcon
          name="i-lucide-chart-column"
          class="size-10 text-muted mb-2"
        />
        <p class="text-muted">
          Noch keine Buchungen für {{ year }}.
        </p>
        <UButton
          to="/buchungen"
          variant="soft"
          size="sm"
          class="mt-3"
          icon="i-lucide-plus"
        >
          Buchung erfassen
        </UButton>
      </div>
      <ClientOnly v-else>
        <CashflowChart :data="stats.monthly" />
        <template #fallback>
          <div class="h-[300px]" />
        </template>
      </ClientOnly>
    </UCard>

    <!-- Anstehende Termine + Ausgaben nach Kategorie -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">
              Anstehende Termine
            </h2>
            <UButton
              to="/kalender"
              variant="link"
              color="neutral"
              size="sm"
              trailing-icon="i-lucide-arrow-right"
            >
              Kalender
            </UButton>
          </div>
        </template>
        <div
          v-if="!upcomingEvents?.length"
          class="py-8 text-center text-muted text-sm"
        >
          Keine anstehenden Termine.
        </div>
        <div
          v-else
          class="divide-y divide-default"
        >
          <NuxtLink
            v-for="ev in upcomingEvents"
            :key="ev.id"
            to="/kalender"
            class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
          >
            <span
              class="size-2.5 rounded-full shrink-0"
              :class="EVENT_CATEGORY_COLORS[ev.category]"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">
                {{ ev.title }}
              </p>
              <p class="text-sm text-muted">
                {{ formatDate(ev.start_at) }}<span v-if="!ev.all_day"> · {{ formatTime(ev.start_at) }}</span>
              </p>
            </div>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ EVENT_CATEGORY_LABELS[ev.category] }}
            </UBadge>
          </NuxtLink>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Ausgaben nach Kategorie
          </h2>
        </template>
        <div
          v-if="!stats?.categories.length"
          class="py-10 text-center text-muted text-sm"
        >
          Keine Ausgaben erfasst.
        </div>
        <ClientOnly v-else>
          <CategoryDonut
            :data="stats.categories"
            :central-label="formatEuro(stats.expense)"
            central-sub-label="Gesamt"
          />
          <template #fallback>
            <div class="h-[200px]" />
          </template>
        </ClientOnly>
      </UCard>
    </div>

    <!-- Einnahmen nach Immobilie -->
    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Einnahmen nach Immobilie
        </h2>
      </template>
      <div
        v-if="!stats?.incomeByProperty.length"
        class="py-10 text-center text-muted text-sm"
      >
        Keine Einnahmen erfasst.
      </div>
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="p in stats.incomeByProperty"
          :key="p.name"
        >
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="truncate">{{ p.name }}</span>
            <span class="font-medium tabular-nums">{{ formatEuro(p.value) }}</span>
          </div>
          <div class="h-2 rounded-full bg-elevated overflow-hidden">
            <div
              class="h-full rounded-full bg-primary transition-all duration-500"
              :style="{ width: `${(p.value / maxPropertyIncome) * 100}%` }"
            />
          </div>
        </li>
      </ul>
    </UCard>
  </div>
</template>
