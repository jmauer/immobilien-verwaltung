<script setup lang="ts">
import type { Database, Tenant } from '~/types/database'

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const confirm = useConfirm()

const { data: tenants, refresh, pending } = await useAsyncData('tenants', async () => {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('last_name')
  if (error) throw error
  return data as Tenant[]
})

const open = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const blank = () => ({ first_name: '', last_name: '', email: '', phone: '', notes: '' })
const form = reactive(blank())

function openCreate() {
  editingId.value = null
  Object.assign(form, blank())
  open.value = true
}
function openEdit(t: Tenant) {
  editingId.value = t.id
  Object.assign(form, {
    first_name: t.first_name,
    last_name: t.last_name,
    email: t.email ?? '',
    phone: t.phone ?? '',
    notes: t.notes ?? ''
  })
  open.value = true
}

async function save() {
  saving.value = true
  try {
    if (editingId.value) {
      const { error } = await supabase.from('tenants').update({ ...form }).eq('id', editingId.value)
      if (error) throw error
    } else {
      const household_id = await useHouseholdId()
      const { error } = await supabase.from('tenants').insert({ ...form, household_id })
      if (error) throw error
    }
    open.value = false
    await refresh()
    toast.add({ title: 'Gespeichert', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Fehler', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(t: Tenant) {
  const ok = await confirm({
    title: 'Mieter löschen?',
    description: `„${t.first_name} ${t.last_name}“ und zugehörige Mietverträge werden dauerhaft gelöscht.`,
    confirmLabel: 'Löschen',
    color: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  const { error } = await supabase.from('tenants').delete().eq('id', t.id)
  if (error) {
    toast.add({ title: 'Fehler', description: error.message, color: 'error' })
    return
  }
  await refresh()
  toast.add({ title: 'Mieter gelöscht', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold">
          Mieter
        </h1>
        <p class="text-muted">
          {{ tenants?.length ?? 0 }} Person(en)
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Neuer Mieter
      </UButton>
    </div>

    <div
      v-if="pending"
      class="space-y-2"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-16 w-full"
      />
    </div>

    <UCard
      v-else-if="!tenants?.length"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-users"
        class="size-10 text-muted mx-auto mb-3"
      />
      <p class="text-muted">
        Noch keine Mieter erfasst.
      </p>
      <UButton
        class="mt-4"
        icon="i-lucide-plus"
        @click="openCreate"
      >
        Ersten Mieter anlegen
      </UButton>
    </UCard>

    <div
      v-else
      class="glass rounded-2xl overflow-hidden divide-y divide-white/15 dark:divide-white/5"
    >
      <div
        v-for="t in tenants"
        :key="t.id"
        class="flex items-center justify-between gap-3 p-4 bg-transparent"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UAvatar :alt="`${t.first_name} ${t.last_name}`" />
          <div class="min-w-0">
            <p class="font-medium truncate">
              {{ t.first_name }} {{ t.last_name }}
            </p>
            <p class="text-sm text-muted truncate">
              {{ [t.email, t.phone].filter(Boolean).join(' · ') || '–' }}
            </p>
          </div>
        </div>
        <UDropdownMenu
          :items="[[
            { label: 'Bearbeiten', icon: 'i-lucide-pencil', onSelect: () => openEdit(t) },
            { label: 'Löschen', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => remove(t) }
          ]]"
        >
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
          />
        </UDropdownMenu>
      </div>
    </div>

    <UModal
      v-model:open="open"
      :title="editingId ? 'Mieter bearbeiten' : 'Neuer Mieter'"
    >
      <template #body>
        <UForm
          :state="form"
          class="space-y-4"
          @submit="save"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Vorname"
              name="first_name"
              required
            >
              <UInput
                v-model="form.first_name"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Nachname"
              name="last_name"
              required
            >
              <UInput
                v-model="form.last_name"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="E-Mail"
            name="email"
          >
            <UInput
              v-model="form.email"
              type="email"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Telefon"
            name="phone"
          >
            <UInput
              v-model="form.phone"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Notizen"
            name="notes"
          >
            <UTextarea
              v-model="form.notes"
              class="w-full"
              :rows="2"
            />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="open = false"
            >
              Abbrechen
            </UButton>
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!form.first_name || !form.last_name"
            >
              Speichern
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
