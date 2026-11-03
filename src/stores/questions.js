import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll, getOne, putOne, removeOne } from '../database/repository'
import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { hasErrors, validateQuestion } from '../utils/validators'
import { useStudiesStore } from './studies'
import { useReviewsStore } from './reviews'

const clean = (f) => ({
  date: f.date, subjectId: f.subjectId, topic: f.topic.trim(), statement: f.statement.trim(),
  options: (f.options || []).map((o) => o.trim()), correctAnswer: f.correctAnswer.trim(),
  chosenAnswer: (f.chosenAnswer || '').trim(), explanation: (f.explanation || '').trim(), status: f.status || 'not_mastered'
})

export const useQuestionsStore = defineStore('questions', () => {
  const items = ref([])
  async function load() {
    items.value = (await getAll('questions')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }
  const get = (id) => items.value.find((q) => q.id === id)

  /**
   * Cadastro avulso. Se não houver estudo registrado naquele dia/matéria/assunto e `alsoRegisterStudy`,
   * cria o registro de estudo junto (para a questão entrar nas revisões).
   */
  async function save(form, { alsoRegisterStudy = false } = {}) {
    const errors = validateQuestion(form)
    if (hasErrors(errors)) throw Object.assign(new Error('Formulário inválido'), { errors })
    const data = clean(form)
    const now = new Date().toISOString()
    await withTx(['questions', 'studies'], 'readwrite', async (s) => {
      let studyId = form.studyId || null
      if (alsoRegisterStudy && !form.id) {
        studyId = uid()
        await s.studies.put({ id: studyId, date: data.date, subjectId: data.subjectId, topic: data.topic, notes: '', createdAt: now })
      }
      if (form.id) {
        const prev = await s.questions.get(form.id)
        await s.questions.put({ ...prev, ...data })
      } else {
        await s.questions.put({ id: uid(), studyId, ...data, createdAt: now })
      }
    })
    await load()
    if (alsoRegisterStudy) { await useStudiesStore().load(); await useReviewsStore().sync() }
  }

  async function setStatus(id, status) {
    const q = await getOne('questions', id)
    await putOne('questions', { ...q, status })
    await load()
  }
  async function remove(id) { await removeOne('questions', id); await load() }

  const topicsFor = (subjectId) => [...new Set(items.value.filter((q) => q.subjectId === subjectId).map((q) => q.topic))]
  return { items, load, get, save, setStatus, remove, topicsFor }
})
