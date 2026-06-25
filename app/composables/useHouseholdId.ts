import type { Database } from '~/types/database'

// Liefert die household_id des aktuellen Nutzers – nötig als Pflichtfeld bei Inserts
// (RLS verlangt household_id = current_household_id()).
export async function useHouseholdId(): Promise<string> {
  const supabase = useSupabaseClient<Database>()
  const userId = await getAuthUserId()
  if (!userId) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single()

  if (error || !data?.household_id) throw new Error('Kein Haushalt zugeordnet')
  return data.household_id
}
