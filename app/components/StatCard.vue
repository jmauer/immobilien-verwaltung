<script setup lang="ts">
defineProps<{
  label: string
  value: string
  icon: string
  // Tailwind-Farbklassen-Basis, z. B. 'primary', 'success', 'info', 'warning'
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'neutral'
  to?: string
  hint?: string
  loading?: boolean
}>()
</script>

<template>
  <component
    :is="to ? 'NuxtLink' : 'div'"
    :to="to"
    class="glass group relative overflow-hidden rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
  >
    <!-- dezenter Farbverlauf im Hintergrund -->
    <div
      class="absolute -right-6 -top-6 size-24 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20"
      :class="{
        'bg-primary': color === 'primary' || !color,
        'bg-success': color === 'success',
        'bg-error': color === 'error',
        'bg-warning': color === 'warning',
        'bg-info': color === 'info',
        'bg-elevated': color === 'neutral'
      }"
    />

    <div class="relative flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm text-muted">
          {{ label }}
        </p>
        <p class="mt-1 text-2xl font-bold tracking-tight">
          <USkeleton
            v-if="loading"
            class="h-8 w-20"
          />
          <span v-else>{{ value }}</span>
        </p>
        <p
          v-if="hint && !loading"
          class="mt-0.5 text-xs text-muted"
        >
          {{ hint }}
        </p>
      </div>

      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
        :class="{
          'bg-primary/10 text-primary': color === 'primary' || !color,
          'bg-success/10 text-success': color === 'success',
          'bg-error/10 text-error': color === 'error',
          'bg-warning/10 text-warning': color === 'warning',
          'bg-info/10 text-info': color === 'info',
          'bg-elevated text-muted': color === 'neutral'
        }"
      >
        <UIcon
          :name="icon"
          class="size-5"
        />
      </div>
    </div>
  </component>
</template>
