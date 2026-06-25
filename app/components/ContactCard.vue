<script setup lang="ts">
import type { Contact } from '~/types/database'

type ContactRow = Contact & { property: { name: string } | null }

const props = defineProps<{ contact: ContactRow }>()
defineEmits<{
  edit: [c: ContactRow]
  remove: [c: ContactRow]
  toggleImportant: [c: ContactRow]
}>()

const icon = computed(() => CONTACT_CATEGORY_ICONS[props.contact.category] ?? 'i-lucide-user')
const categoryLabel = computed(() => CONTACT_CATEGORY_LABELS[props.contact.category] ?? 'Sonstige')
const website = computed(() => {
  const w = props.contact.website
  if (!w) return null
  return w.startsWith('http') ? w : `https://${w}`
})
</script>

<template>
  <UCard class="flex flex-col">
    <div class="flex items-start gap-3">
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-xl"
        :class="contact.category === 'emergency' ? 'bg-error/15 text-error' : 'bg-primary/15 text-primary'"
      >
        <UIcon
          :name="icon"
          class="size-5"
        />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <h3 class="font-semibold truncate">
            {{ contact.name }}
          </h3>
          <UIcon
            v-if="contact.important"
            name="i-lucide-star"
            class="size-4 text-warning shrink-0"
          />
        </div>
        <p
          v-if="contact.company"
          class="text-sm text-muted truncate"
        >
          {{ contact.company }}
        </p>
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          class="mt-1.5"
        >
          {{ categoryLabel }}
        </UBadge>
      </div>

      <UDropdownMenu
        :items="[[
          { label: contact.important ? 'Pin entfernen' : 'Anpinnen', icon: 'i-lucide-star', onSelect: () => $emit('toggleImportant', contact) },
          { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => $emit('edit', contact) },
          { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => $emit('remove', contact) }
        ]]"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </UDropdownMenu>
    </div>

    <div class="mt-3 space-y-1.5">
      <UButton
        v-if="contact.phone"
        :to="`tel:${contact.phone}`"
        icon="i-lucide-phone"
        color="neutral"
        variant="soft"
        size="sm"
        class="w-full justify-start"
        :label="contact.phone"
      />
      <UButton
        v-if="contact.email"
        :to="`mailto:${contact.email}`"
        icon="i-lucide-mail"
        color="neutral"
        variant="soft"
        size="sm"
        class="w-full justify-start"
        :label="contact.email"
      />
      <UButton
        v-if="website"
        :to="website"
        target="_blank"
        icon="i-lucide-globe"
        color="neutral"
        variant="soft"
        size="sm"
        class="w-full justify-start"
        label="Website"
      />
    </div>

    <div
      v-if="contact.address || contact.property || contact.notes"
      class="mt-3 pt-3 border-t border-white/15 dark:border-white/5 space-y-1 text-sm text-muted"
    >
      <p
        v-if="contact.address"
        class="flex items-start gap-1.5"
      >
        <UIcon
          name="i-lucide-map-pin"
          class="size-4 mt-0.5 shrink-0"
        />
        <span>{{ contact.address }}</span>
      </p>
      <p
        v-if="contact.property"
        class="flex items-center gap-1.5"
      >
        <UIcon
          name="i-lucide-building-2"
          class="size-4 shrink-0"
        />
        <span>{{ contact.property.name }}</span>
      </p>
      <p
        v-if="contact.notes"
        class="flex items-start gap-1.5"
      >
        <UIcon
          name="i-lucide-sticky-note"
          class="size-4 mt-0.5 shrink-0"
        />
        <span class="whitespace-pre-wrap">{{ contact.notes }}</span>
      </p>
    </div>
  </UCard>
</template>
