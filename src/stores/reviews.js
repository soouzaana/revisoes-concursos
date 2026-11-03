import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll } from '../database/repository'
import { completeReview, recordQuestionAnswer, startReview, syncReviews } from '../services/reviewService'
import { buildReviewContent, isOverdue, reviewStatus, daysOverdue } from '../services/reviewEngine'
import { useClockStore } from './clock'
import { useStudiesStore } from './studies'
import { useQuestionsStore } from './questions'

export const useReviewsStore = defineStore('reviews', () => {
  const reviews = ref([])
  const logs = ref([])
  const cycles = ref([])
  const clock = useClockStore()
  const studies = useStudiesStore()
  const questions = useQuestionsStore()

  async function load() {
    const [r, l, c] = await Promise.all([getAll('reviews'), getAll('reviewLog'), getAll('cycles')])
    reviews.value = r; logs.value = l; cycles.value = c.sort((a, b) => a.number - b.number)
  }
  /** Recalcula ciclos/filas a partir dos registros e recarrega o estado. */
  async function sync() {
    await syncReviews(clock.today)
    await load()
  }

  /** Revisões enriquecidas (conteúdo, status, atraso), da mais antiga para a mais nova. */
  const enriched = computed(() =>
    reviews.value.map((r) => {
      const content = buildReviewContent(r, { studies: studies.items, questions: questions.items, logs: logs.value })
      return { ...r, content, status: reviewStatus(r, content), overdue: isOverdue(r, clock.today), lateDays: daysOverdue(r, clock.today) }
    })
  )
  const byType = (type, completed) => enriched.value
    .filter((r) => r.type === type && !!r.completedAt === completed)
    .sort((a, b) => (completed ? b.completedAt.localeCompare(a.completedAt) : (a.refDate || a.releasedDate).localeCompare(b.refDate || b.releasedDate)))
  const dailyPending = computed(() => byType('daily', false))
  const weeklyPending = computed(() => byType('weekly', false))
  const dailyDone = computed(() => byType('daily', true))
  const weeklyDone = computed(() => byType('weekly', true))
  const find = (id) => enriched.value.find((r) => r.id === id)
  const openCycle = computed(() => cycles.value.find((c) => c.status === 'open') || null)

  async function start(id) { await startReview(id); await load() }
  async function answer(reviewId, question, correct) {
    await recordQuestionAnswer({ reviewId, question, correct, today: clock.today })
    await load()
  }
  async function complete(id) { const r = await completeReview(id, clock.today); await load(); return r }

  return { reviews, logs, cycles, load, sync, enriched, dailyPending, weeklyPending, dailyDone, weeklyDone, find, openCycle, start, answer, complete }
})
