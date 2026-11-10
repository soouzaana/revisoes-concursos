import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { countBy, getAll, putOne, removeOne } from '../database/repository'
import { uid } from '../utils/id'
import { validateSubjectName } from '../utils/validators'

export const SUBJECT_COLORS = ['#2b4acb', '#0e8f7e', '#c2410c', '#9333ea', '#be123c', '#b45309', '#0369a1', '#4d7c0f', '#c026d3', '#475569']
export const SUGGESTED_SUBJECTS = ['Língua Portuguesa', 'Matemática', 'Raciocínio Lógico', 'Informática', 'Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Atualidades']

export const useSubjectsStore = defineStore('subjects', () => {
  const items = ref([])
  const byId = computed(() => Object.fromEntries(items.value.map((s) => [s.id, s])))
  const get = (id) => byId.value[id]
  const nameOf = (id) => byId.value[id]?.name ?? 'Matéria removida'
  const colorOf = (id) => byId.value[id]?.color ?? '#64748b'

  async function load() {
    items.value = (await getAll('subjects')).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }
  async function add(name, color) {
    const err = validateSubjectName(name, items.value)
    if (err) throw new Error(err)
    const s = { id: uid(), name: name.trim(), color: color || SUBJECT_COLORS[items.value.length % SUBJECT_COLORS.length], createdAt: new Date().toISOString() }
    await putOne('subjects', s)
    await load()
    return s
  }
  async function update(id, name, color) {
    const err = validateSubjectName(name, items.value, id)
    if (err) throw new Error(err)
    await putOne('subjects', { ...byId.value[id], name: name.trim(), color })
    await load()
  }
  async function usage(id) {
    const [studies, questions, flashcards, mocks] = await Promise.all([countBy('studies', 'subjectId', id), countBy('questions', 'subjectId', id), countBy('flashcards', 'subjectId', id), getAll('mockExams')])
    const mockExams = mocks.filter((m) => m.subjects.some((x) => x.subjectId === id)).length
    return { studies, questions, flashcards, mockExams, total: studies + questions + flashcards + mockExams }
  }
  /** Não exclui matéria com registros ligados (evita perder histórico e quebrar revisões). */
  async function remove(id) {
    const u = await usage(id)
    if (u.total > 0) return { ok: false, usage: u }
    await removeOne('subjects', id)
    await load()
    return { ok: true }
  }
  return { items, byId, get, nameOf, colorOf, load, add, update, remove, usage }
})
