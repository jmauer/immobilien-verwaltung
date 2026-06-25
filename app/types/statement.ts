// Struktur der in statements.details (jsonb) gespeicherten Abrechnungs-Aufschlüsselung.

export interface StatementLine {
  category: string
  description: string | null
  amount: number // Gesamtkosten der Position für die Immobilie
  allocation_key: string
  share: number // Anteil dieses Mietvertrags (0–1)
  allocated: number // auf den Mietvertrag entfallender Betrag
  // Transparenz der Umlagebasis (z. B. Verbrauch: 12 m³ von 120 m³)
  metric?: number
  metric_total?: number
  metric_unit?: string
  fallback?: boolean // true, wenn statt Verbrauch ersatzweise Fläche genutzt wurde
}

export interface StatementDetails {
  property_name: string
  unit_name: string
  tenant_name: string
  period_start: string
  period_end: string
  months: number
  monthly_prepayment: number
  bases: {
    total_area: number
    total_persons: number
    unit_count: number
    unit_area: number
    persons: number
  }
  lines: StatementLine[]
}
