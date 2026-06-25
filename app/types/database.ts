// Handgepflegte Typen passend zum Schema in supabase/migrations/0001_init.sql.
// Wenn das Schema wächst, hier nachziehen (oder via `supabase gen types` ersetzen).

export type Household = {
  id: string
  name: string
  invite_code: string
  calendar_token: string
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  household_id: string | null
  created_at: string
}

export type PropertyType = 'apartment_building' | 'single_family' | 'condo' | 'commercial' | 'land'

export type Property = {
  id: string
  household_id: string
  name: string
  street: string | null
  zip: string | null
  city: string | null
  type: PropertyType
  purchase_price: number | null
  purchase_date: string | null
  total_area: number | null
  notes: string | null
  created_at: string
}

export type Unit = {
  id: string
  household_id: string
  property_id: string
  name: string
  floor: string | null
  area: number | null
  rooms: number | null
  created_at: string
}

export type Tenant = {
  id: string
  household_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export type Lease = {
  id: string
  household_id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date: string | null
  rent_cold: number
  prepayment: number
  deposit: number | null
  persons: number
  created_at: string
}

export type AllocationKey = 'area' | 'persons' | 'units' | 'consumption'

export type OperatingCost = {
  id: string
  household_id: string
  property_id: string
  category: string
  description: string | null
  amount: number
  cost_date: string
  period_year: number
  billable: boolean
  allocation_key: AllocationKey
  consumption_type: string | null
  created_at: string
}

export type ConsumptionType = 'water_cold' | 'water_hot' | 'heating' | 'electricity' | 'gas' | 'other'

export type Consumption = {
  id: string
  household_id: string
  unit_id: string
  period_year: number
  type: ConsumptionType
  amount: number
  unit_label: string | null
  created_at: string
}

export type TransactionType = 'income' | 'expense'

export type Transaction = {
  id: string
  household_id: string
  property_id: string | null
  unit_id: string | null
  lease_id: string | null
  type: TransactionType
  category: string
  description: string | null
  amount: number
  tx_date: string
  created_at: string
}

export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly'

export type RecurringTransaction = {
  id: string
  household_id: string
  property_id: string | null
  unit_id: string | null
  lease_id: string | null
  type: TransactionType
  category: string
  description: string | null
  amount: number
  frequency: RecurrenceFrequency
  start_date: string
  end_date: string | null
  next_run: string
  active: boolean
  created_at: string
}

export type ContactCategory
  = | 'craftsman' | 'plumbing' | 'electrical' | 'heating' | 'roofing'
    | 'painting' | 'gardening' | 'cleaning' | 'management' | 'insurance'
    | 'tax' | 'authority' | 'emergency' | 'utility' | 'other'

export type Contact = {
  id: string
  household_id: string
  property_id: string | null
  name: string
  company: string | null
  category: ContactCategory
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  notes: string | null
  important: boolean
  created_at: string
}

export type DocumentCategory
  = | 'contract' | 'invoice' | 'insurance' | 'statement'
    | 'correspondence' | 'photo' | 'tax' | 'other'

// Achtung: nicht "Document" nennen (kollidiert mit dem globalen DOM-Typ).
export type DocumentRecord = {
  id: string
  household_id: string
  property_id: string | null
  name: string
  file_path: string
  mime_type: string | null
  size: number | null
  category: DocumentCategory
  notes: string | null
  created_at: string
}

export type EventCategory
  = | 'inspection' | 'maintenance' | 'meeting' | 'payment' | 'deadline' | 'other'

export type CalendarEvent = {
  id: string
  household_id: string
  property_id: string | null
  title: string
  description: string | null
  location: string | null
  category: EventCategory
  start_at: string
  end_at: string | null
  all_day: boolean
  created_at: string
}

export type StatementStatus = 'draft' | 'sent' | 'settled'

export type Statement = {
  id: string
  household_id: string
  lease_id: string
  period_year: number
  total_costs: number
  total_prepayments: number
  balance: number
  details: Record<string, unknown> | null
  status: StatementStatus
  created_at: string
}

// Database-Typ für den typisierten Supabase-Client. Die Struktur (Tables mit
// Row/Insert/Update/Relationships sowie Views/Functions/Enums/CompositeTypes)
// entspricht der von supabase-js erwarteten GenericSchema-Form.
type Table<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      households: Table<Household>
      profiles: Table<Profile>
      properties: Table<Property>
      units: Table<Unit>
      tenants: Table<Tenant>
      leases: Table<Lease>
      operating_costs: Table<OperatingCost>
      consumptions: Table<Consumption>
      documents: Table<DocumentRecord>
      calendar_events: Table<CalendarEvent>
      transactions: Table<Transaction>
      recurring_transactions: Table<RecurringTransaction>
      contacts: Table<Contact>
      statements: Table<Statement>
    }
    Views: Record<string, never>
    Functions: {
      create_household: { Args: { p_name: string }, Returns: Household }
      join_household: { Args: { p_code: string }, Returns: Household }
      current_household_id: { Args: Record<string, never>, Returns: string }
      generate_due_transactions: { Args: Record<string, never>, Returns: number }
      reset_calendar_token: { Args: Record<string, never>, Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
