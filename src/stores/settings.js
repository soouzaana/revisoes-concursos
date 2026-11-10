import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getOne, putOne } from '../database/repository'
import { DEFAULT_FREQUENCY, isValidFrequency } from '../services/mockEngine'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('system') // 'system' | 'light' | 'dark'
  const lastBackupAt = ref(null)
  const mockFrequencyDays = ref(DEFAULT_FREQUENCY) // frequência sugerida de simulados (apenas lembrete)
  let mq = null

  function apply() {
    const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c101c' : '#2b4acb')
  }
  async function load() {
    const t = await getOne('settings', 'theme')
    const b = await getOne('settings', 'lastBackupAt')
    const f = await getOne('settings', 'mockFrequencyDays')
    mockFrequencyDays.value = isValidFrequency(f?.value) ? f.value : DEFAULT_FREQUENCY
    theme.value = t?.value || 'system'
    lastBackupAt.value = b?.value || null
    apply()
    if (!mq) { mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', apply) }
  }
  async function setTheme(v) {
    theme.value = v
    await putOne('settings', { key: 'theme', value: v })
    try { localStorage.setItem('theme-mirror', v) } catch { /* só espelho anti-flash */ }
    apply()
  }
  async function markBackup() {
    lastBackupAt.value = new Date().toISOString()
    await putOne('settings', { key: 'lastBackupAt', value: lastBackupAt.value })
  }
  async function setMockFrequency(days) {
    const n = Number(days)
    if (!isValidFrequency(n)) throw new Error('Informe um número inteiro de 1 a 365 dias.')
    mockFrequencyDays.value = n
    await putOne('settings', { key: 'mockFrequencyDays', value: n })
  }
  return { theme, lastBackupAt, mockFrequencyDays, load, setTheme, markBackup, setMockFrequency }
})
