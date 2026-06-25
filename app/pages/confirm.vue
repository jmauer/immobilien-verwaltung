<script setup>
definePageMeta({ layout: 'auth' })

const user = useSupabaseUser()

// Nach erfolgreicher E-Mail-Bestätigung steht die Session bereit -> weiter zum Onboarding.
watch(user, (value) => {
  if (value) navigateTo('/onboarding')
}, { immediate: true })
</script>

<template>
  <UCard>
    <div class="flex flex-col items-center gap-3 py-6 text-center">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 text-primary animate-spin"
      />
      <p class="text-sm text-muted">
        Anmeldung wird abgeschlossen …
      </p>
    </div>
  </UCard>
</template>
