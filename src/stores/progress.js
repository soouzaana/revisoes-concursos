import { defineStore } from 'pinia'
import { computed } from 'vue'
import { buildDayMap, collectEvents, computeStreaks, monthActive } from '../services/activityEngine'
import { monthKey } from '../utils/date'
import { useClockStore } from './clock'
import { useSettingsStore } from './settings'
import { useStudiesStore } from './studies'
import { useReviewsStore } from './reviews'
import { useHabitsStore } from './habits'
import { useTasksStore } from './tasks'
import { useNotesStore } from './notes'
import { useMocksStore } from './mocks'
import { useConcursoStore } from './concurso'
import { useSubjectsStore } from './subjects'

/** Atividades, ofensiva e histórico — tudo derivado dos registros reais (sem duplicar dados). */
export const useProgressStore = defineStore('progress', () => {
  const clock = useClockStore(), settings = useSettingsStore(), studies = useStudiesStore(), reviews = useReviewsStore()
  const habits = useHabitsStore(), tasks = useTasksStore(), notes = useNotesStore(), mocks = useMocksStore(), concurso = useConcursoStore(), subjects = useSubjectsStore()

  const events = computed(() => collectEvents({
    studies: studies.items, reviews: reviews.reviews, logs: reviews.logs, habits: habits.habits, habitLogs: habits.logs,
    tasks: tasks.items, mockExams: mocks.items, notes: notes.items, cycleSessions: concurso.sessions, syllabus: concurso.syllabus,
    nameOf: (id) => subjects.nameOf(id)
  }, clock.today))
  const dayMap = computed(() => buildDayMap(events.value, settings.streakCategories))
  const streak = computed(() => computeStreaks(dayMap.value, clock.today))
  const month = computed(() => monthActive(dayMap.value, monthKey(clock.today), clock.today))
  const todayMinutes = computed(() => dayMap.value.get(clock.today)?.minutes || 0)
  const monthMinutes = computed(() => events.value.filter((e) => monthKey(e.date) === monthKey(clock.today)).reduce((a, e) => a + e.minutes, 0))
  const monthEvents = computed(() => events.value.filter((e) => monthKey(e.date) === monthKey(clock.today)).length)
  return { events, dayMap, streak, month, todayMinutes, monthMinutes, monthEvents }
})
