// iCal-Feed: /calendar/<token>.ics
// Liefert die Termine des Haushalts zum geheimen Token als text/calendar aus,
// damit externe Kalender (Apple, Google, …) sie per URL abonnieren können.

interface FeedEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function icsEscape(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function utcStamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// All-Day: nur das Datum (start_at wird als UTC-Mitternacht gespeichert)
function dateStamp(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

function nextDayStamp(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}

function buildIcs(events: FeedEvent[]): string {
  const now = utcStamp(new Date().toISOString())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Immobilienverwaltung//Kalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Immobilienverwaltung',
    'X-WR-TIMEZONE:Europe/Berlin'
  ]

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.id}@immobilienverwaltung`)
    lines.push(`DTSTAMP:${now}`)

    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.start_at)}`)
      const endDate = e.end_at ? nextDayStamp(e.end_at) : nextDayStamp(e.start_at)
      lines.push(`DTEND;VALUE=DATE:${endDate}`)
    } else {
      lines.push(`DTSTART:${utcStamp(e.start_at)}`)
      if (e.end_at) lines.push(`DTEND:${utcStamp(e.end_at)}`)
    }

    lines.push(`SUMMARY:${icsEscape(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`)
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'token') ?? ''
  const token = raw.replace(/\.ics$/i, '')

  const config = useRuntimeConfig()
  // Von @nuxtjs/supabase bereitgestellt
  const supabase = (config.public as { supabase?: { url?: string, key?: string } }).supabase
  const url = supabase?.url
  const key = supabase?.key

  let events: FeedEvent[] = []
  if (url && key && token) {
    try {
      const res = await $fetch<FeedEvent[]>(`${url}/rest/v1/rpc/calendar_feed`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: { p_token: token }
      })
      if (Array.isArray(res)) events = res
    } catch {
      // Ungültiger Token o. Ä. → leerer Kalender
      events = []
    }
  }

  setResponseHeaders(event, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="immobilienverwaltung.ics"',
    'Cache-Control': 'no-cache'
  })
  return buildIcs(events)
})
