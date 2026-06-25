<script setup lang="ts">
import type { Database, Profile } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()
const { data: profile, refresh } = await useProfile()

const { data: members } = await useAsyncData('household-members', async () => {
  if (!profile.value?.household_id) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('household_id', profile.value.household_id)
  return (data ?? []) as Pick<Profile, 'id' | 'full_name'>[]
})

const householdName = ref(profile.value?.household?.name ?? '')
const savingName = ref(false)

async function saveName() {
  if (!profile.value?.household_id) return
  savingName.value = true
  const { error } = await supabase
    .from('households')
    .update({ name: householdName.value })
    .eq('id', profile.value.household_id)
  savingName.value = false
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Gespeichert', color: 'success' })
}

async function copyCode() {
  const code = profile.value?.household?.invite_code
  if (!code) return
  await navigator.clipboard.writeText(code)
  toast.add({ title: 'Einladungscode kopiert', color: 'success' })
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <h1 class="text-2xl font-bold">
      Einstellungen
    </h1>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Haushalt
        </h2>
      </template>
      <div class="space-y-4">
        <UFormField label="Name des Haushalts">
          <div class="flex gap-2">
            <UInput
              v-model="householdName"
              class="flex-1"
            />
            <UButton
              :loading="savingName"
              :disabled="!householdName"
              @click="saveName"
            >
              Speichern
            </UButton>
          </div>
        </UFormField>

        <UFormField
          label="Einladungscode"
          hint="Teile ihn mit Familienmitgliedern"
        >
          <div class="flex gap-2">
            <UInput
              :model-value="profile?.household?.invite_code"
              readonly
              class="flex-1 font-mono"
            />
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="subtle"
              @click="copyCode"
            >
              Kopieren
            </UButton>
          </div>
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Mitglieder
        </h2>
      </template>
      <div class="divide-y divide-default">
        <div
          v-for="m in members"
          :key="m.id"
          class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <UAvatar :alt="m.full_name ?? 'Mitglied'" />
          <div>
            <p class="font-medium">
              {{ m.full_name ?? 'Ohne Namen' }}
              <span
                v-if="m.id === user?.id"
                class="text-muted font-normal"
              >(du)</span>
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Konto
        </h2>
      </template>
      <div class="flex items-center justify-between">
        <p class="text-sm text-muted">
          Angemeldet als {{ user?.email }}
        </p>
        <UButton
          color="error"
          variant="subtle"
          icon="i-lucide-log-out"
          @click="async () => { await supabase.auth.signOut(); await navigateTo('/login') }"
        >
          Abmelden
        </UButton>
      </div>
    </UCard>
  </div>
</template>
