import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, putOne, removeOne } from '../database/repository'
import { uid } from '../utils/id'
import { useClockStore } from './clock'
import { useSettingsStore } from './settings'
import { frequencyHistory, getSchedule, mockOverview, sortDesc, validateMockExam } from '../services/mockEngine'

/** Simulados: resultados registrados manualmente. Independente do sistema de revisões. */
export const useMocksStore = defineStore('mocks', () => {
  const items = ref([])
  const clock = useClockStore()
  const settings = useSettingsStore()

  const sorted = computed(() => sortDesc(items.value))
  const byId = computed(() => Object.fromEntries(items.value.map((e) => [e.id, e])))
  const overview = computed(() => mockOverview(items.value))
  // Previsão e histórico recalculados automaticamente ao cadastrar/editar/excluir ou mudar a frequência.
  const schedule = computed(() => getSchedule({ exams: items.value, frequencyDays: settings.mockFrequencyDays, today: clock.today }))
  const history = computed(() => frequencyHistory({ exams: items.value, frequencyDays: settings.mockFrequencyDays }))
  const reminderActive = computed(() => schedule.value.status === 'due' || schedule.value.status === 'overdue')

  async function load() { items.value = await getAll('mockExams') }

  /** Cria (sem id) ou atualiza (com id). Lança erro com `.errors` se inválido. */
  async function save(form, id = null) {
    const { errors, entries, valid } = validateMockExam(form, clock.today)
    if (!valid) throw Object.assign(new Error('Formulário inválido'), { errors })
    const now = new Date().toISOString()
    const prev = id ? byId.value[id] : null
    const exam = {
      id: prev?.id ?? uid(), name: form.name.trim(), date: form.date,
      contest: (form.contest || '').trim(), board: (form.board || '').trim(), notes: (form.notes || '').trim(),
      subjects: entries, createdAt: prev?.createdAt ?? now, updatedAt: now
    }
    await putOne('mockExams', exam)
    await load()
    return exam
  }
  async function remove(id) { await removeOne('mockExams', id); await load() }

  return { items, sorted, byId, overview, schedule, history, reminderActive, load, save, remove }
})
