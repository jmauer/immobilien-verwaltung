<script setup lang="ts">
const { isOpen, state, settle } = useConfirmState()
</script>

<template>
  <UModal
    :open="isOpen"
    :title="state.title"
    :ui="{ content: 'max-w-md' }"
    @update:open="(v) => { if (!v) settle(false) }"
  >
    <template #body>
      <div class="flex gap-3">
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-full"
          :class="state.color === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
        >
          <UIcon
            :name="state.icon"
            class="size-5"
          />
        </div>
        <p
          v-if="state.description"
          class="text-muted pt-2"
        >
          {{ state.description }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          @click="settle(false)"
        >
          {{ state.cancelLabel }}
        </UButton>
        <UButton
          :color="state.color"
          @click="settle(true)"
        >
          {{ state.confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
