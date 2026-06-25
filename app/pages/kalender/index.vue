<script setup lang="ts">
import type { Database, CalendarEvent, EventCategory } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()
const { data: profile, refresh: refreshProfile } = await useProfile()

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())
const todayKey = dayKey(today)

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const gridDays = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const offset = (first.getDay() + 6) % 7 // Montag = 0
  const start = new Date(viewYear.value, viewMonth.value, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}
function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}
function goToday() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
}

const { data: events, refresh: refreshEvents } = await useAsyncData('calendar-events', async () => {
  const days = gridDays.value
  const start = days[0]!
  const end = days[41]!
  const startISO = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString()
  const endISO = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString()
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_at', startISO)
    .lte('start_at', endISO)
    .order('start_at')
  if (error) throw error
  return (data ?? []) as CalendarEvent[]
}, { watch: [viewYear, viewMonth] })

const { data: upcoming, refresh: refreshUpcoming } = await useAsyncData('calendar-upcoming', async () => {
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_at', new Date().toISOString())
    .order('start_at')
    .limit(8)
  return (data ?? []) as CalendarEvent[]
})

function eventDayKey(e: CalendarEvent): string {
  if (e.all_day) return e.start_at.slice(0, 10)
  return dayKey(new Date(e.start_at))
}

const eventsByDay = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events.value ?? []) {
    const k = eventDayKey(e)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  }
  return map
})

async function refreshAll() {
  await Promise.all([refreshEvents(), refreshUpcoming()])
}

// --- CRUD ------------------------------------------------------------------
const { data: propertyOptions } = await useAsyncData('cal-properties', async () => {
  const { data } = await supabase.from('properties').select('id, name').order('name')
  return [{ value: 'none', label: 'Keine Zuordnung' }, ...(data ?? []).map(p => ({ value: p.id, label: p.name }))]
})

const categoryOptions = Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const editingEvent = ref<CalendarEvent | null>(null)
const blank = () => ({
  title: '',
  category: 'meeting' as EventCategory,
  all_day: false,
  start_dt: '',
  end_dt: '',
  start_date: '',
  end_date: '',
  location: '',
  property_id: 'none',
  description: ''
})
const form = reactive(blank())

function openCreate(key?: string) {
  editingId.value = null
  editingEvent.value = null
  Object.assign(form, blank())
  const base = key ?? todayKey
  form.start_date = base
  form.start_dt = `${base}T09:00`
  open.value = true
}
function openEdit(e: CalendarEvent) {
  editingId.value = e.id
  editingEvent.value = e
  Object.assign(form, blank(), {
    title: e.title,
    category: e.category,
    all_day: e.all_day,
    location: e.location ?? '',
    property_id: e.property_id ?? 'none',
    description: e.description ?? ''
  })
  if (e.all_day) {
    form.start_date = e.start_at.slice(0, 10)
    form.end_date = e.end_at ? e.end_at.slice(0, 10) : ''
  } else {
    form.start_dt = toLocalInput(e.start_at)
    form.end_dt = e.end_at ? toLocalInput(e.end_at) : ''
  }
  open.value = true
}

async function save() {
  let start_at: string
  let end_at: string | null = null
  if (form.all_day) {
    if (!form.start_date) {
      toast.add({ title: 'Bitte Datum wählen', color: 'warning' })
      return
    }
    start_at = `${form.start_date}T00:00:00.000Z`
    end_at = form.end_date ? `${form.end_date}T00:00:00.000Z` : null
  } else {
    if (!form.start_dt) {
      toast.add({ title: 'Bitte Start wählen', color: 'warning' })
      return
    }
    start_at = new Date(form.start_dt).toISOString()
    end_at = form.end_dt ? new Date(form.end_dt).toISOString() : null
  }

  saving.value = true
  try {
    const payload = {
      title: form.title,
      category: form.category,
      all_day: form.all_day,
      start_at,
      end_at,
      location: form.location || null,
      property_id: form.property_id === 'none' ? null : form.property_id,
      description: form.description || null
    }
    if (editingId.value) {
      const { error } = await supabase.from('calendar_events').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('calendar_events').insert({ ...payload, household_id })
      if (error) throw error
    }
    open.value = false
    await refreshAll()
    toast.add({ title: 'Gespeichert', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(e: CalendarEvent) {
  const ok = await confirm({
    title: 'Termin löschen?',
    description: `„${e.title}“ wird dauerhaft aus dem Kalender entfernt.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('calendar_events').delete().eq('id', e.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refreshAll()
  toast.add({ title: 'Termin gelöscht', color: 'success' })
}

// --- iCal-Abo --------------------------------------------------------------
const origin = ref('')
onMounted(() => {
  origin.value = window.location.origin
})
const feedUrl = computed(() => {
  const token = profile.value?.household?.calendar_token
  if (!token || !origin.value) return ''
  return `${origin.value}/calendar/${token}.ics`
})
const webcalUrl = computed(() => feedUrl.value.replace(/^https?/, 'webcal'))

async function copyFeed() {
  if (!feedUrl.value) return
  await navigator.clipboard.writeText(feedUrl.value)
  toast.add({ title: 'Abo-Link kopiert', color: 'success' })
}
async function resetToken() {
  const ok = await confirm({
    title: 'Abo-Link zurücksetzen?',
    description: 'Es wird ein neuer Link erzeugt. Bestehende Kalender-Abonnements werden ungültig.',
    confirmLabel: 'Zurücksetzen',
    color: 'error',
    icon: 'i-lucide-refresh-cw'
  })
  if (!ok) return
  const { error } = await supabase.rpc('reset_calendar_token')
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refreshProfile()
  toast.add({ title: 'Neuer Abo-Link erzeugt', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          Kalender
        </h1>
        <p class="text-muted">
          Termine, Fristen & Wartungen
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate()"
      >
        Neuer Termin
      </UButton>
    </div>

    <!-- Monatsnavigation -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          @click="prevMonth"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          @click="nextMonth"
        />
        <UButton
          color="neutral"
          variant="subtle"
          size="sm"
          class="ml-1"
          @click="goToday"
        >
          Heute
        </UButton>
      </div>
      <h2 class="font-semibold capitalize">
        {{ monthLabel }}
      </h2>
    </div>

    <!-- Monatsraster -->
    <div class="glass rounded-2xl overflow-hidden">
      <div class="grid grid-cols-7 border-b border-white/15 dark:border-white/5">
        <div
          v-for="w in weekdays"
          :key="w"
          class="py-2 text-center text-xs font-medium text-muted"
        >
          {{ w }}
        </div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="d in gridDays"
          :key="d.toISOString()"
          class="min-h-24 border-b border-r border-white/10 dark:border-white/5 p-1 cursor-pointer hover:bg-primary/5 transition-colors"
          :class="d.getMonth() !== viewMonth ? 'opacity-40' : ''"
          @click="openCreate(dayKey(d))"
        >
          <div class="flex justify-end">
            <span
              class="inline-flex size-6 items-center justify-center rounded-full text-xs"
              :class="dayKey(d) === todayKey ? 'bg-primary text-inverted font-semibold' : 'text-muted'"
            >
              {{ d.getDate() }}
            </span>
          </div>
          <div class="space-y-0.5 mt-0.5">
            <button
              v-for="ev in (eventsByDay.get(dayKey(d)) ?? []).slice(0, 3)"
              :key="ev.id"
              type="button"
              class="w-full text-left truncate rounded px-1 py-0.5 text-xs text-white"
              :class="EVENT_CATEGORY_COLORS[ev.category] ?? 'bg-neutral-400'"
              @click.stop="openEdit(ev)"
            >
              <span
                v-if="!ev.all_day"
                class="opacity-90"
              >{{ formatTime(ev.start_at) }} </span>{{ ev.title }}
            </button>
            <p
              v-if="(eventsByDay.get(dayKey(d)) ?? []).length > 3"
              class="px-1 text-xs text-muted"
            >
              +{{ (eventsByDay.get(dayKey(d)) ?? []).length - 3 }} mehr
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <!-- Demnächst -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Demnächst
          </h2>
        </template>
        <div
          v-if="!upcoming?.length"
          class="py-6 text-center text-muted text-sm"
        >
          Keine anstehenden Termine.
        </div>
        <div
          v-else
          class="divide-y divide-default"
        >
          <button
            v-for="ev in upcoming"
            :key="ev.id"
            type="button"
            class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 w-full text-left hover:opacity-80"
            @click="openEdit(ev)"
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
          </button>
        </div>
      </UCard>

      <!-- iCal-Abo -->
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Kalender abonnieren (iCal)
          </h2>
        </template>
        <div class="space-y-3">
          <p class="text-sm text-muted">
            Mit dieser Adresse kannst du die Termine in Apple Kalender, Google Kalender o. Ä. abonnieren –
            neue Termine erscheinen dann automatisch.
          </p>
          <div class="flex gap-2">
            <UInput
              :model-value="feedUrl"
              readonly
              class="flex-1 font-mono text-xs"
            />
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              @click="copyFeed"
            >
              Kopieren
            </UButton>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              :to="webcalUrl || undefined"
              icon="i-lucide-calendar-plus"
              variant="soft"
              :disabled="!webcalUrl"
            >
              In Kalender öffnen
            </UButton>
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              @click="resetToken"
            >
              Link zurücksetzen
            </UButton>
          </div>
          <p class="text-xs text-muted">
            Der Link enthält ein geheimes Token – nur teilen, wem du Zugriff geben willst.
            Externer Zugriff funktioniert erst nach Deployment (nicht über localhost).
          </p>
        </div>
      </UCard>
    </div>

    <!-- Termin-Formular -->
    <UModal
      v-model:open="open"
      :title="editingId ? 'Termin bearbeiten' : 'Neuer Termin'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <UFormField
            label="Titel"
            name="title"
            required
          >
            <UInput
              v-model="form.title"
              class="w-full"
              placeholder="z. B. Wohnungsübergabe"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Kategorie"
              name="category"
            >
              <USelect
                v-model="form.category"
                :items="categoryOptions"
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

          <UCheckbox
            v-model="form.all_day"
            label="Ganztägig"
          />

          <div
            v-if="form.all_day"
            class="grid grid-cols-2 gap-3"
          >
            <UFormField
              label="Von"
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
              label="Bis"
              name="end_date"
              hint="optional"
            >
              <UInput
                v-model="form.end_date"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            v-else
            class="grid grid-cols-2 gap-3"
          >
            <UFormField
              label="Beginn"
              name="start_dt"
              required
            >
              <UInput
                v-model="form.start_dt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Ende"
              name="end_dt"
              hint="optional"
            >
              <UInput
                v-model="form.end_dt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            label="Ort"
            name="location"
          >
            <UInput
              v-model="form.location"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Notizen"
            name="description"
          >
            <UTextarea
              v-model="form.description"
              class="w-full"
              :rows="2"
            />
          </UFormField>

          <div class="flex justify-between gap-2 pt-2">
            <UButton
              v-if="editingEvent"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="() => { const ev = editingEvent; open = false; if (ev) remove(ev) }"
            >
              Löschen
            </UButton>
            <div class="flex gap-2 ml-auto">
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
                :disabled="!form.title"
              >
                Speichern
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
