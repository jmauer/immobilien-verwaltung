<script setup lang="ts">
import type { Database } from '~/types/database'

definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient<Database>()
const toast = useToast()

// Falls bereits ein Haushalt existiert, direkt weiterleiten.
onMounted(async () => {
  const userId = await getAuthUserId()
  if (!userId) return
  const { data } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single()
  if (data?.household_id) await navigateTo('/')
})

const mode = ref<'create' | 'join'>('create')
const createName = ref('')
const joinCode = ref('')
const loading = ref(false)

async function createHousehold() {
  loading.value = true
  const { error } = await supabase.rpc('create_household', { p_name: createName.value })
  loading.value = false
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await navigateTo('/')
}

async function joinHousehold() {
  loading.value = true
  const { error } = await supabase.rpc('join_household', { p_code: joinCode.value })
  loading.value = false
  if (error) {
    toast.add({ title: 'Beitritt fehlgeschlagen', description: error.message, color: 'error' })
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">
        Haushalt einrichten
      </h1>
      <p class="text-sm text-muted">
        Erstelle einen neuen Haushalt oder tritt dem deiner Familie bei.
      </p>
    </template>

    <UTabs
      v-model="mode"
      :items="[
        { label: 'Neu erstellen', value: 'create', slot: 'create' },
        { label: 'Beitreten', value: 'join', slot: 'join' }
      ]"
      class="w-full"
    >
      <template #create>
        <div class="space-y-4 pt-4">
          <UFormField
            label="Name des Haushalts"
            hint="z. B. „Familie Jordan“"
          >
            <UInput
              v-model="createName"
              class="w-full"
              placeholder="Familie Jordan"
            />
          </UFormField>
          <UButton
            :loading="loading"
            :disabled="!createName"
            block
            @click="createHousehold"
          >
            Haushalt erstellen
          </UButton>
        </div>
      </template>

      <template #join>
        <div class="space-y-4 pt-4">
          <UFormField
            label="Einladungscode"
            hint="Erhältst du von einem Familienmitglied"
          >
            <UInput
              v-model="joinCode"
              class="w-full"
              placeholder="z. B. a1b2c3d4e5f6"
            />
          </UFormField>
          <UButton
            :loading="loading"
            :disabled="!joinCode"
            block
            @click="joinHousehold"
          >
            Beitreten
          </UButton>
        </div>
      </template>
    </UTabs>
  </UCard>
</template>
