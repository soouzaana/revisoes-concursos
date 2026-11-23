import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, putOne, removeOne } from '../database/repository'
import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { plain } from '../utils/plain'
import { isValidDateStr } from '../utils/date'
import { cycleProgress, syllabusProgress, TOPIC_STATUS } from '../services/concursoEngine'
import { useClockStore } from './clock'
import { useSettingsStore } from './settings'

/** Meu Concurso: concursos, edital (assuntos), ciclo de estudos e sessões. */
export const useConcursoStore = defineStore('concurso', () => {
  const contests = ref([])
  const syllabus = ref([])
  const cycle = ref(null)
  const sessions = ref([])
  const clock = useClockStore()
  const settings = useSettingsStore()

  async function load() {
    const [c, s, cy, ss] = await Promise.all([getAll('contests'), getAll('syllabus'), getAll('studyCycle'), getAll('cycleSessions')])
    contests.value = c.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    syllabus.value = s; cycle.value = cy.find((x) => x.id === 'main') || null
    sessions.value = ss.sort((a, b) => b.date.localeCompare(a.date) || (b.at || '').localeCompare(a.at || ''))
  }
  const current = computed(() => contests.value.find((c) => c.id === settings.currentContestId) || contests.value[0] || null)
  const topics = computed(() => (current.value ? syllabus.value.filter((t) => t.contestId === current.value.id) : []))
  const subjectIds = computed(() => current.value?.subjectIds || [])
  const progress = computed(() => syllabusProgress(topics.value))
  const progressFor = (subjectId) => syllabusProgress(topics.value.filter((t) => t.subjectId === subjectId))
  const cycleInfo = computed(() => cycleProgress(cycle.value, sessions.value))
  const daysToExam = computed(() => {
    const d = current.value?.examDate; if (!d) return null
    return Math.round((new Date(d + 'T00:00:00') - new Date(clock.today + 'T00:00:00')) / 86400000)
  })

  async function saveContest(form, id = null) {
    const errors = {}
    if (!(form.name || '').trim()) errors.name = 'Informe o nome do concurso.'
    if (form.examDate && !isValidDateStr(form.examDate)) errors.examDate = 'Data inválida.'
    if (Object.keys(errors).length) throw Object.assign(new Error('Formulário inválido'), { errors })
    const prev = id ? contests.value.find((c) => c.id === id) : null
    const c = { ...(prev ? plain(prev) : { subjectIds: [] }), id: prev?.id ?? uid(), name: form.name.trim(), role: (form.role || '').trim(), board: (form.board || '').trim(), examDate: form.examDate || '', status: form.status || 'studying', createdAt: prev?.createdAt ?? new Date().toISOString() }
    await putOne('contests', c); await load()
    if (!prev) await settings.setCurrentContest(c.id)
    return c
  }
  async function removeContest(id) {
    await withTx(['contests', 'syllabus'], 'readwrite', async (s) => {
      await s.contests.delete(id)
      for (const k of await s.syllabus.index('contestId').getAllKeys(id)) await s.syllabus.delete(k) // só o edital; matérias/estudos permanecem
    })
    await load()
    if (settings.currentContestId === id) await settings.setCurrentContest(contests.value[0]?.id || '')
  }
  async function addSubject(subjectId) {
    const c = current.value; if (!c || c.subjectIds?.includes(subjectId)) return
    await putOne('contests', { ...plain(c), subjectIds: [...(c.subjectIds || []), subjectId] }); await load()
  }
  async function removeSubject(subjectId) {
    const c = current.value; if (!c) return
    await withTx(['contests', 'syllabus'], 'readwrite', async (s) => {
      await s.contests.put({ ...plain(c), subjectIds: (c.subjectIds || []).filter((x) => x !== subjectId) })
      for (const t of topics.value.filter((x) => x.subjectId === subjectId)) await s.syllabus.delete(t.id)
    })
    await load()
  }
  async function addTopic({ subjectId, name, parentId = null }) {
    const c = current.value; const n = (name || '').trim()
    if (!c || !n) throw new Error('Informe o nome do assunto.')
    const siblings = topics.value.filter((t) => t.subjectId === subjectId && (t.parentId || null) === parentId)
    const t = { id: uid(), contestId: c.id, subjectId, parentId, name: n, status: 'not_started', order: siblings.length, reviews: [], lastReviewedAt: '', createdAt: new Date().toISOString() }
    await putOne('syllabus', t); await load(); return t
  }
  async function updateTopic(id, patch) {
    const t = syllabus.value.find((x) => x.id === id); if (!t) return
    if (patch.status && !TOPIC_STATUS[patch.status]) throw new Error('Status inválido.')
    await putOne('syllabus', { ...plain(t), ...plain(patch) }); await load()
  }
  async function removeTopic(id) {
    const ids = new Set([id])
    for (let grew = true; grew;) { grew = false; for (const t of syllabus.value) if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); grew = true } }
    await withTx(['syllabus'], 'readwrite', async (s) => { for (const k of ids) await s.syllabus.delete(k) })
    await load()
  }
  /** Registra revisão do assunto (data + observação). Id estável por data e assunto: revisar de novo no mesmo dia atualiza a observação. */
  async function reviewTopic(id, { date = clock.today, note = '' } = {}) {
    const t = syllabus.value.find((x) => x.id === id); if (!t) return
    if (!isValidDateStr(date) || date > clock.today) throw new Error('Informe uma data válida (não futura).')
    const rv = { id: `${id}:${date}`, date, note: note.trim(), at: new Date().toISOString() }
    const reviews = [...plain(t.reviews || []).filter((r) => r.id !== rv.id), rv].sort((a, b) => b.date.localeCompare(a.date))
    await putOne('syllabus', { ...plain(t), reviews, lastReviewedAt: reviews[0].date, status: t.status === 'not_started' || t.status === 'studying' ? 'reviewing' : t.status }); await load()
  }
  async function removeTopicReview(id, reviewId) {
    const t = syllabus.value.find((x) => x.id === id); if (!t) return
    const reviews = plain(t.reviews || []).filter((r) => r.id !== reviewId)
    await putOne('syllabus', { ...plain(t), reviews, lastReviewedAt: reviews[0]?.date || '' }); await load()
  }

  // --- Ciclo de estudos (opcional, sem dias fixos) ---
  async function saveCycle(next) { const c = { id: 'main', roundStart: '', createdAt: new Date().toISOString(), ...plain(cycle.value || {}), ...plain(next) }; await putOne('studyCycle', c); await load() }
  async function addCycleItem({ subjectId, priority = 'medium', targetMinutes = 60 }) {
    const items = plain(cycle.value?.items || [])
    if (items.some((i) => i.subjectId === subjectId)) throw new Error('Esta matéria já está no ciclo.')
    items.push({ id: uid(), subjectId, priority, targetMinutes: Number(targetMinutes) || 0, order: items.length })
    await saveCycle({ items, roundStart: cycle.value?.roundStart || clock.today })
  }
  async function updateCycleItem(id, patch) { await saveCycle({ items: plain(cycle.value.items).map((i) => (i.id === id ? { ...i, ...plain(patch) } : i)) }) }
  async function removeCycleItem(id) { await saveCycle({ items: plain(cycle.value.items).filter((i) => i.id !== id).map((i, k) => ({ ...i, order: k })) }) }
  async function moveCycleItem(id, dir) {
    const items = plain(cycle.value.items).sort((a, b) => a.order - b.order); const i = items.findIndex((x) => x.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
    await saveCycle({ items: items.map((x, k) => ({ ...x, order: k })) })
  }
  async function startNewRound() { await saveCycle({ roundStart: clock.today }) }
  async function addSession({ subjectId, minutes, date = clock.today, notes = '' }) {
    const m = Number(minutes)
    if (!subjectId) throw new Error('Escolha a matéria.')
    if (!Number.isFinite(m) || m <= 0 || m > 1440) throw new Error('Informe os minutos (1 a 1440).')
    if (!isValidDateStr(date) || date > clock.today) throw new Error('Informe uma data válida (não futura).')
    await putOne('cycleSessions', { id: uid(), subjectId, minutes: Math.round(m), date, notes: notes.trim(), at: new Date().toISOString() }); await load()
  }
  async function removeSession(id) { await removeOne('cycleSessions', id); await load() }

  return { contests, syllabus, cycle, sessions, current, topics, subjectIds, progress, progressFor, cycleInfo, daysToExam, load, saveContest, removeContest, addSubject, removeSubject, addTopic, updateTopic, removeTopic, reviewTopic, removeTopicReview, saveCycle, addCycleItem, updateCycleItem, removeCycleItem, moveCycleItem, startNewRound, addSession, removeSession }
})
