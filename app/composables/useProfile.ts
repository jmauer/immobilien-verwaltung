import type { Database, Profile, Household } from '~/types/database'

// Lädt das Profil (inkl. Haushalt) des angemeldeten Nutzers einmalig und cached es.
export function useProfile() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  return useAsyncData<(Profile & { household: Household | null }) | null>(
    'profile',
    async () => {
      const userId = await getAuthUserId()
      if (!userId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*, household:households(*)')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data as unknown as Profile & { household: Household | null }
    },
    { watch: [user] }
  )
}
