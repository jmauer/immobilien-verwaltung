<script setup>
useHead({
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})

useSeoMeta({
  title: 'Immobilienverwaltung',
  description: 'Immobilien, Mieter und Nebenkosten für die Familie verwalten.'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConfirmDialog />
  </UApp>
</template>
