<script setup>
const supabase = useSupabaseClient()
const colorMode = useColorMode()
const { data: profile } = await useProfile()

const open = ref(false)

const sections = [
  {
    label: null,
    items: [
      { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' }
    ]
  },
  {
    label: 'Verwaltung',
    items: [
      { label: 'Immobilien', icon: 'i-lucide-building-2', to: '/immobilien' },
      { label: 'Mieter', icon: 'i-lucide-users', to: '/mieter' },
      { label: 'Mietverträge', icon: 'i-lucide-file-signature', to: '/mietvertraege' }
    ]
  },
  {
    label: 'Finanzen',
    items: [
      { label: 'Nebenkosten', icon: 'i-lucide-receipt', to: '/nebenkosten' },
      { label: 'Abrechnungen', icon: 'i-lucide-file-text', to: '/abrechnungen' },
      { label: 'Buchungen', icon: 'i-lucide-arrow-left-right', to: '/buchungen' }
    ]
  },
  {
    label: 'Organisation',
    items: [
      { label: 'Kalender', icon: 'i-lucide-calendar-days', to: '/kalender' },
      { label: 'Dokumente', icon: 'i-lucide-folder', to: '/dokumente' },
      { label: 'Kontakte', icon: 'i-lucide-contact', to: '/kontakte' }
    ]
  }
]

const userMenu = computed(() => [
  [{
    label: profile.value?.household?.name ?? 'Haushalt',
    avatar: { icon: 'i-lucide-home' },
    type: 'label'
  }],
  [{
    label: 'Einstellungen',
    icon: 'i-lucide-settings',
    to: '/einstellungen'
  }, {
    label: colorMode.value === 'dark' ? 'Hell' : 'Dunkel',
    icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
    onSelect: () => {
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    }
  }],
  [{
    label: 'Abmelden',
    icon: 'i-lucide-log-out',
    onSelect: async () => {
      await supabase.auth.signOut()
      await navigateTo('/login')
    }
  }]
])
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Sidebar (Glas) -->
    <aside
      class="glass fixed inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-300 ease-out lg:sticky lg:top-3 lg:z-auto lg:m-3 lg:h-[calc(100dvh-1.5rem)] lg:rounded-3xl lg:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <div class="h-16 flex items-center gap-2 px-4 border-b border-white/20 dark:border-white/5">
        <div class="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <UIcon
            name="i-lucide-building-2"
            class="size-5"
          />
        </div>
        <span class="font-bold truncate">Immobilien</span>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-2">
        <div
          v-for="(section, i) in sections"
          :key="i"
        >
          <p
            v-if="section.label"
            class="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted"
          >
            {{ section.label }}
          </p>
          <UNavigationMenu
            orientation="vertical"
            :items="section.items"
            :ui="{ link: 'rounded-xl' }"
            @select="open = false"
          />
        </div>
      </div>

      <div class="p-2 border-t border-white/20 dark:border-white/5">
        <UDropdownMenu
          :items="userMenu"
          :content="{ side: 'top', align: 'start' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            class="w-full"
            :label="profile?.full_name ?? 'Mein Konto'"
            icon="i-lucide-user"
            trailing-icon="i-lucide-chevrons-up-down"
            block
          />
        </UDropdownMenu>
      </div>
    </aside>

    <!-- Backdrop (mobil) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
        @click="open = false"
      />
    </Transition>

    <!-- Inhalt -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="glass sticky top-0 z-20 h-16 flex items-center gap-2 px-4 lg:hidden">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          @click="open = true"
        />
        <span class="font-bold">Immobilien</span>
      </header>

      <main class="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
