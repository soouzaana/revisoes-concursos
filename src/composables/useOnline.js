import { onMounted, onUnmounted, ref } from 'vue'

export function useOnline() {
  const online = ref(navigator.onLine)
  const set = () => (online.value = navigator.onLine)
  onMounted(() => { addEventListener('online', set); addEventListener('offline', set) })
  onUnmounted(() => { removeEventListener('online', set); removeEventListener('offline', set) })
  return online
}
