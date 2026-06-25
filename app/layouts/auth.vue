<script setup>
const colorMode = useColorMode()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="flex items-center justify-center gap-2 mb-8">
        <div class="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <UIcon
            name="i-lucide-building-2"
            class="size-6"
          />
        </div>
        <span class="text-xl font-bold">Immobilienverwaltung</span>
      </div>

      <slot />
    </div>

    <UButton
      class="mt-6"
      color="neutral"
      variant="ghost"
      size="sm"
      :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
      :label="colorMode.value === 'dark' ? 'Hell' : 'Dunkel'"
      @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
    />
  </div>
</template>
