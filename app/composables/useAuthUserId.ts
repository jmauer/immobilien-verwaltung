import type { Database } from '~/types/database'

// Zuverlässige User-ID aus der Supabase-Session. Direkt nach Login/Registrierung
// ist das reaktive useSupabaseUser()-Ref evtl. noch nicht befüllt – getUser()
// liest dagegen die tatsächliche Session und liefert die verifizierte ID.
export async function getAuthUserId(): Promise<string | null> {
  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
