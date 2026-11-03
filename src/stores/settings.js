import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getOne, putOne } from '../database/repository'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('system') // 'system' | 'light' | 'dark'
  const lastBackupAt = ref(null)
  let mq = null

  function apply() {
    const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c101c' : '#2b4acb')
  }
  async function load() {
    const t = await getOne('settings', 'theme')
    const b = await getOne('settings', 'lastBackupAt')
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
  return { theme, lastBackupAt, load, setTheme, markBackup }
})
