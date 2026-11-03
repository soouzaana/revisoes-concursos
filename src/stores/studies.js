import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, getOne, putOne, removeOne } from '../database/repository'
import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { getStudyDates } from '../services/reviewEngine'
import { hasErrors, validateStudy } from '../utils/validators'
import { useReviewsStore } from './reviews'
import { useQuestionsStore } from './questions'

export const useStudiesStore = defineStore('studies', () => {
  const items = ref([])
  const studyDates = computed(() => getStudyDates(items.value))
  const byDate = computed(() => {
    const m = {}
    for (const s of items.value) (m[s.date] ||= []).push(s)
    return m
  })

  async function load() {
    items.value = (await getAll('studies')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }

  /** Salva o estudo e, opcionalmente, questões do caderno de erros, na mesma transação. */
  async function add(form, questionDrafts = []) {
    const errors = validateStudy(form)
    if (hasErrors(errors)) throw Object.assign(new Error('Formulário inválido'), { errors })
    const now = new Date().toISOString()
    const study = { id: uid(), date: form.date, subjectId: form.subjectId, topic: form.topic.trim(), notes: (form.notes || '').trim(), createdAt: now }
    await withTx(['studies', 'questions'], 'readwrite', async (s) => {
      await s.studies.put(study)
      for (const d of questionDrafts) {
        await s.questions.put({
          id: uid(), studyId: study.id, date: study.date, subjectId: study.subjectId, topic: study.topic,
          statement: d.statement.trim(), options: (d.options || []).map((o) => o.trim()), correctAnswer: d.correctAnswer.trim(),
          chosenAnswer: (d.chosenAnswer || '').trim(), explanation: (d.explanation || '').trim(), status: 'not_mastered', createdAt: now
        })
      }
    })
    await Promise.all([load(), useQuestionsStore().load()])
    await useReviewsStore().sync()
    return study
  }

  async function update(id, form) {
    const errors = validateStudy(form)
    if (hasErrors(errors)) throw Object.assign(new Error('Formulário inválido'), { errors })
    const prev = await getOne('studies', id)
    await putOne('studies', { ...prev, date: form.date, subjectId: form.subjectId, topic: form.topic.trim(), notes: (form.notes || '').trim() })
    await load()
    await useReviewsStore().sync()
  }

  async function remove(id) {
    await removeOne('studies', id)
    await load()
    await useReviewsStore().sync()
  }

  const topicsFor = (subjectId) => [...new Set(items.value.filter((s) => s.subjectId === subjectId).map((s) => s.topic))]
  return { items, studyDates, byDate, load, add, update, remove, topicsFor }
})
