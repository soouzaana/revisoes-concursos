import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getOne, putOne } from '../database/repository'
import { DEFAULT_FREQUENCY, isValidFrequency } from '../services/mockEngine'
import { DEFAULT_CYCLE_SIZE, MAX_CYCLE_SIZE, isValidCycleSize } from '../services/reviewEngine'
import { DEFAULT_STREAK_CATEGORIES, CATEGORY_KEYS } from '../services/activityEngine'
import { DEFAULT_SYNONYMS, stringifySynonyms } from '../services/editalMatcher'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('system') // 'system' | 'light' | 'dark'
  const lastBackupAt = ref(null)
  const mockFrequencyDays = ref(DEFAULT_FREQUENCY) // frequência sugerida de simulados (apenas lembrete)
  const weeklyCycleSize = ref(DEFAULT_CYCLE_SIZE) // dias estudados por ciclo da revisão semanal
  const inactiveTopics = ref([])                 // chaves `matéria|assunto` desativadas nas revisões automáticas
  const reviewsOnlyActive = ref(true)            // Central de revisões: mostrar só matérias ativas
  const streakCategories = ref([...DEFAULT_STREAK_CATEGORIES]) // categorias que contam para a ofensiva/heatmap
  const dashboardHidden = ref([])                // indicadores ocultos na Visão geral
  const currentContestId = ref('')
  const synonymsText = ref(stringifySynonyms(DEFAULT_SYNONYMS)) // dicionário local editável de termos equivalentes
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
    const w = await getOne('settings', 'weeklyCycleSize')
    weeklyCycleSize.value = isValidCycleSize(w?.value) ? w.value : DEFAULT_CYCLE_SIZE
    const it = await getOne('settings', 'inactiveTopics')
    inactiveTopics.value = Array.isArray(it?.value) ? it.value : []
    const oa = await getOne('settings', 'reviewsOnlyActive')
    reviewsOnlyActive.value = oa ? !!oa.value : true
    const sc = await getOne('settings', 'streakCategories')
    streakCategories.value = Array.isArray(sc?.value) ? sc.value.filter((k) => CATEGORY_KEYS.includes(k)) : [...DEFAULT_STREAK_CATEGORIES]
    const dh = await getOne('settings', 'dashboardHidden')
    dashboardHidden.value = Array.isArray(dh?.value) ? dh.value : []
    const sy = await getOne('settings', 'synonyms')
    synonymsText.value = typeof sy?.value === 'string' ? sy.value : stringifySynonyms(DEFAULT_SYNONYMS)
    const cc = await getOne('settings', 'currentContestId')
    currentContestId.value = cc?.value || ''
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
  async function setWeeklyCycleSize(days) {
    const n = Number(days)
    if (!isValidCycleSize(n)) throw new Error(`Informe um número inteiro de 1 a ${MAX_CYCLE_SIZE} dias estudados.`)
    weeklyCycleSize.value = n
    await putOne('settings', { key: 'weeklyCycleSize', value: n })
  }
  async function setInactiveTopics(keys) {
    const plain = [...new Set(keys)] // cópia simples: o IndexedDB não aceita proxies reativos do Vue
    inactiveTopics.value = plain
    await putOne('settings', { key: 'inactiveTopics', value: [...plain] })
  }
  async function setReviewsOnlyActive(v) {
    reviewsOnlyActive.value = !!v
    await putOne('settings', { key: 'reviewsOnlyActive', value: !!v })
  }
  async function setStreakCategories(keys) {
    const plain = [...new Set(keys)].filter((k) => CATEGORY_KEYS.includes(k))
    streakCategories.value = plain
    await putOne('settings', { key: 'streakCategories', value: [...plain] })
  }
  async function setDashboardHidden(keys) {
    const plain = [...new Set(keys)]
    dashboardHidden.value = plain
    await putOne('settings', { key: 'dashboardHidden', value: [...plain] })
  }
  async function setSynonyms(text) {
    synonymsText.value = String(text)
    await putOne('settings', { key: 'synonyms', value: String(text) })
  }
  async function setCurrentContest(id) {
    currentContestId.value = id || ''
    await putOne('settings', { key: 'currentContestId', value: id || '' })
  }
  return { synonymsText, setSynonyms, streakCategories, dashboardHidden, currentContestId, setStreakCategories, setDashboardHidden, setCurrentContest, theme, lastBackupAt, mockFrequencyDays, weeklyCycleSize, inactiveTopics, reviewsOnlyActive, setWeeklyCycleSize, setInactiveTopics, setReviewsOnlyActive, load, setTheme, markBackup, setMockFrequency }
})
