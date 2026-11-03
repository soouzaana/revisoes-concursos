import { defineStore } from 'pinia'
import { ref } from 'vue'
import { todayStr, addDays } from '../utils/date'

/** "Hoje" reativo: atualiza ao voltar para o app ou na virada do dia. */
export const useClockStore = defineStore('clock', () => {
  const today = ref(todayStr())
  const tomorrow = () => addDays(today.value, 1)
  /** retorna true se o dia mudou */
  function refresh() {
    const t = todayStr()
    if (t !== today.value) { today.value = t; return true }
    return false
  }
  return { today, tomorrow, refresh }
})
