<script setup>
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const toast = useToast()

const state = reactive({ fullName: '', email: '', password: '' })
const loading = ref(false)
const done = ref(false)

async function onSubmit() {
  loading.value = true
  const { data, error } = await supabase.auth.signUp({
    email: state.email,
    password: state.password,
    options: { data: { full_name: state.fullName } }
  })
  loading.value = false

  if (error) {
    toast.add({ title: 'Registrierung fehlgeschlagen', description: error.message, color: 'error' })
    return
  }

  // Wenn E-Mail-Bestätigung deaktiviert ist, gibt es direkt eine Session.
  if (data.session) {
    await navigateTo('/onboarding')
  } else {
    done.value = true
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">
        Konto erstellen
      </h1>
      <p class="text-sm text-muted">
        Lege ein Konto für die Familien-Immobilienverwaltung an.
      </p>
    </template>

    <div
      v-if="done"
      class="space-y-3 text-center py-4"
    >
      <UIcon
        name="i-lucide-mail-check"
        class="size-10 text-primary mx-auto"
      />
      <p class="text-sm">
        Wir haben dir eine Bestätigungs-E-Mail an
        <strong>{{ state.email }}</strong> geschickt. Bitte bestätige deine Adresse.
      </p>
    </div>

    <UForm
      v-else
      :state="state"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        label="Name"
        name="fullName"
        required
      >
        <UInput
          v-model="state.fullName"
          autocomplete="name"
          class="w-full"
        />
      </UFormField>

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
        hint="Mind. 6 Zeichen"
      >
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        :loading="loading"
        block
      >
        Registrieren
      </UButton>
    </UForm>

    <template #footer>
      <p class="text-sm text-muted text-center">
        Bereits registriert?
        <ULink
          to="/login"
          class="text-primary font-medium"
        >
          Anmelden
        </ULink>
      </p>
    </template>
  </UCard>
</template>
