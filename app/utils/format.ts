const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR'
})

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})

const numberFmt = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2
})

export function formatEuro(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return euro.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  return dateFmt.format(new Date(value))
}

export function formatNumber(value: number | null | undefined, unit = ''): string {
  if (value === null || value === undefined) return '–'
  return numberFmt.format(value) + (unit ? ' ' + unit : '')
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '–'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment_building: 'Mehrfamilienhaus',
  single_family: 'Einfamilienhaus',
  condo: 'Eigentumswohnung',
  commercial: 'Gewerbe',
  land: 'Grundstück'
}

export const ALLOCATION_KEY_LABELS: Record<string, string> = {
  area: 'Wohnfläche',
  persons: 'Personen',
  units: 'Einheiten',
  consumption: 'Verbrauch'
}

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  yearly: 'Jährlich'
}

export const CONTACT_CATEGORY_LABELS: Record<string, string> = {
  craftsman: 'Handwerker',
  plumbing: 'Sanitär',
  electrical: 'Elektrik',
  heating: 'Heizung',
  roofing: 'Dachdecker',
  painting: 'Maler',
  gardening: 'Garten / Hausmeister',
  cleaning: 'Reinigung',
  management: 'Hausverwaltung',
  insurance: 'Versicherung',
  tax: 'Steuer / Notar',
  authority: 'Behörde',
  emergency: 'Notdienst',
  utility: 'Energie / Versorger',
  other: 'Sonstige'
}

export const CONSUMPTION_TYPE_LABELS: Record<string, string> = {
  water_cold: 'Kaltwasser',
  water_hot: 'Warmwasser',
  heating: 'Heizung',
  electricity: 'Strom',
  gas: 'Gas',
  other: 'Sonstige'
}

// Standard-Mengeneinheit je Verbrauchsart
export const CONSUMPTION_UNIT_DEFAULTS: Record<string, string> = {
  water_cold: 'm³',
  water_hot: 'm³',
  heating: 'kWh',
  electricity: 'kWh',
  gas: 'm³',
  other: ''
}

export const STATEMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  sent: 'Versendet',
  settled: 'Abgeschlossen'
}

export const EVENT_CATEGORY_LABELS: Record<string, string> = {
  inspection: 'Besichtigung',
  maintenance: 'Wartung',
  meeting: 'Termin',
  payment: 'Zahlung',
  deadline: 'Frist',
  other: 'Sonstige'
}

// Tailwind-Hintergrundklassen für Termin-Chips
export const EVENT_CATEGORY_COLORS: Record<string, string> = {
  inspection: 'bg-info',
  maintenance: 'bg-warning',
  meeting: 'bg-primary',
  payment: 'bg-success',
  deadline: 'bg-error',
  other: 'bg-neutral-400'
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  contract: 'Vertrag',
  invoice: 'Rechnung',
  insurance: 'Versicherung',
  statement: 'Abrechnung',
  correspondence: 'Korrespondenz',
  photo: 'Foto',
  tax: 'Steuer',
  other: 'Sonstige'
}

export const DOCUMENT_CATEGORY_ICONS: Record<string, string> = {
  contract: 'i-lucide-file-signature',
  invoice: 'i-lucide-receipt',
  insurance: 'i-lucide-shield',
  statement: 'i-lucide-file-text',
  correspondence: 'i-lucide-mail',
  photo: 'i-lucide-image',
  tax: 'i-lucide-calculator',
  other: 'i-lucide-file'
}

export const CONTACT_CATEGORY_ICONS: Record<string, string> = {
  craftsman: 'i-lucide-hammer',
  plumbing: 'i-lucide-wrench',
  electrical: 'i-lucide-zap',
  heating: 'i-lucide-flame',
  roofing: 'i-lucide-home',
  painting: 'i-lucide-paint-roller',
  gardening: 'i-lucide-trees',
  cleaning: 'i-lucide-sparkles',
  management: 'i-lucide-briefcase',
  insurance: 'i-lucide-shield',
  tax: 'i-lucide-calculator',
  authority: 'i-lucide-landmark',
  emergency: 'i-lucide-siren',
  utility: 'i-lucide-plug',
  other: 'i-lucide-user'
}
