import { ref } from 'vue'

const deferred = ref(null)
const installed = ref(false)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred.value = e })
  window.addEventListener('appinstalled', () => { installed.value = true; deferred.value = null })
}
export function useInstallPrompt() {
  const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches
  async function install() {
    if (!deferred.value) return false
    deferred.value.prompt()
    const { outcome } = await deferred.value.userChoice
    deferred.value = null
    return outcome === 'accepted'
  }
  return { canInstall: deferred, installed, standalone, install }
}
