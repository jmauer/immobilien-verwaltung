// Einheitlicher Bestätigungsdialog (Ersatz für das native window.confirm).
// Aufruf: const confirm = useConfirm(); if (!(await confirm({...}))) return

interface ConfirmOptions {
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  color?: 'error' | 'primary'
  icon?: string
}

const defaults: Required<ConfirmOptions> = {
  title: 'Bist du sicher?',
  description: '',
  confirmLabel: 'Bestätigen',
  cancelLabel: 'Abbrechen',
  color: 'primary',
  icon: 'i-lucide-circle-help'
}

const isOpen = ref(false)
const state = reactive<Required<ConfirmOptions>>({ ...defaults })
let resolver: ((value: boolean) => void) | null = null

export function useConfirm() {
  return function confirm(opts: ConfirmOptions = {}): Promise<boolean> {
    Object.assign(state, defaults, opts)
    isOpen.value = true
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }
}

// Wird nur von der ConfirmDialog-Komponente genutzt.
export function useConfirmState() {
  function settle(value: boolean) {
    isOpen.value = false
    resolver?.(value)
    resolver = null
  }
  return { isOpen, state, settle }
}
