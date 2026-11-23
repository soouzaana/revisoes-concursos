import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, putOne, removeOne } from '../database/repository'
import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { plain } from '../utils/plain'
import { useClockStore } from './clock'
import { consistency, habitStreak, isScheduled, weeklyEvolution } from '../services/habitEngine'

export const useHabitsStore = defineStore('habits', () => {
  const habits = ref([])
  const logs = ref([])
  const clock = useClockStore()

  async function load() {
    const [h, l] = await Promise.all([getAll('habits'), getAll('habitLogs')])
    habits.value = h.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); logs.value = l
  }
  const active = computed(() => habits.value.filter((h) => !h.archived))
  const doneSets = computed(() => {
    const m = {}
    for (const l of logs.value) (m[l.habitId] ||= new Set()).add(l.date)
    return m
  })
  const doneSet = (id) => doneSets.value[id] || new Set()
  const isDone = (id, date = clock.today) => doneSet(id).has(date)

  /** Resumo de cada hábito: sequência, consistência e evolução. */
  const summaries = computed(() => active.value.map((h) => ({
    habit: h, scheduledToday: isScheduled(h, clock.today), doneToday: isDone(h.id),
    ...habitStreak(h, doneSet(h.id), clock.today),
    consistency: consistency(h, doneSet(h.id), clock.today),
    evolution: weeklyEvolution(h, doneSet(h.id), clock.today),
    total: doneSet(h.id).size
  })))
  const todayList = computed(() => summaries.value.filter((s) => s.scheduledToday))
  const todayProgress = computed(() => ({ done: todayList.value.filter((s) => s.doneToday).length, total: todayList.value.length }))

  async function save(form, id = null) {
    const name = (form.name || '').trim()
    if (!name) throw Object.assign(new Error('Informe o nome do hábito.'), { errors: { name: 'Informe o nome do hábito.' } })
    const prev = id ? habits.value.find((h) => h.id === id) : null
    const now = new Date().toISOString()
    const habit = { ...(prev ? plain(prev) : {}), id: prev?.id ?? uid(), name, days: [...(form.days || [])].sort(), createdAt: prev?.createdAt ?? now, startDate: prev?.startDate ?? clock.today, archived: !!form.archived }
    await putOne('habits', habit); await load(); return habit
  }
  async function archive(id, archived = true) {
    const h = habits.value.find((x) => x.id === id); if (!h) return
    await putOne('habits', { ...plain(h), archived }); await load()
  }
  /** Remove o hábito E o histórico dele (ação explícita do usuário). */
  async function remove(id) {
    await withTx(['habits', 'habitLogs'], 'readwrite', async (s) => {
      await s.habits.delete(id)
      for (const k of await s.habitLogs.index('habitId').getAllKeys(id)) await s.habitLogs.delete(k)
    })
    await load()
  }
  /** Marca/desmarca a conclusão em um dia (id determinístico = nunca duplica). */
  async function toggle(habitId, date = clock.today) {
    if (date > clock.today) throw new Error('Não é possível concluir hábitos em datas futuras.')
    const id = `${habitId}:${date}`
    if (logs.value.some((l) => l.id === id)) await removeOne('habitLogs', id)
    else await putOne('habitLogs', { id, habitId, date, at: new Date().toISOString() })
    await load()
  }
  return { habits, logs, active, summaries, todayList, todayProgress, isDone, doneSet, load, save, archive, remove, toggle }
})
