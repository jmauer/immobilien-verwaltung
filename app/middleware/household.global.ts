import type { Database } from '~/types/database'

// Angemeldete Nutzer ohne Haushalt werden zum Onboarding geleitet.
// (Die Login-Umleitung übernimmt bereits das @nuxtjs/supabase-Modul.)
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  if (!user.value) return

  // Seiten, die ohne Haushalt erreichbar bleiben müssen.
  const allowList = ['/login', '/registrieren', '/onboarding', '/confirm']
  if (allowList.includes(to.path)) return

  // Direkt nach dem Login ist die ID im reaktiven Ref evtl. noch nicht da –
  // dann lieber diese Navigation überspringen (läuft beim nächsten Mal erneut).
  const userId = user.value.id
  if (!userId) return

  const supabase = useSupabaseClient<Database>()
  const { data } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single()

  if (!data?.household_id) {
    return navigateTo('/onboarding')
  }
})
