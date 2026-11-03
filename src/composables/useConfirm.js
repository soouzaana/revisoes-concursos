import { reactive } from 'vue'

export const confirmState = reactive({ open: false, title: '', message: '', confirmLabel: 'Confirmar', danger: false, resolve: null })
/** const ok = await confirm({ title, message, confirmLabel, danger }) */
export function useConfirm() {
  return (opts) => new Promise((resolve) => {
    Object.assign(confirmState, { open: true, title: '', message: '', confirmLabel: 'Confirmar', danger: false, ...opts, resolve })
  })
}
