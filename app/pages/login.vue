<script setup>
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const toast = useToast()

const state = reactive({ email: '', password: '' })
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  const { error } = await supabase.auth.signInWithPassword({
    email: state.email,
    password: state.password
  })
  loading.value = false

  if (error) {
    toast.add({ title: 'Anmeldung fehlgeschlagen', description: error.message, color: 'error' })
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">
        Anmelden
      </h1>
      <p class="text-sm text-muted">
        Willkommen zurück.
      </p>
    </template>

    <UForm
      :state="state"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        label="E-Mail"
        name="email"
        required
      >
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Passwort"
        name="password"
        required
      >
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        :loading="loading"
        block
      >
        Anmelden
      </UButton>
    </UForm>

    <template #footer>
      <p class="text-sm text-muted text-center">
        Noch kein Konto?
        <ULink
          to="/registrieren"
          class="text-primary font-medium"
        >
          Registrieren
        </ULink>
      </p>
    </template>
  </UCard>
</template>
