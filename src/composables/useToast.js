import { reactive } from 'vue'

export const toasts = reactive([])
let n = 0
export function useToast() {
  const push = (message, type = 'ok', ms = 3200) => {
    const id = ++n
    toasts.push({ id, message, type })
    setTimeout(() => { const i = toasts.findIndex((t) => t.id === id); if (i >= 0) toasts.splice(i, 1) }, ms)
  }
  return { ok: (m) => push(m, 'ok'), error: (m) => push(m, 'error', 5000), info: (m) => push(m, 'info') }
}
