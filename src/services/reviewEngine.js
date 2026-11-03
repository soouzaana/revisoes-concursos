/**
 * Motor de revisões — lógica PURA (sem Vue, sem IndexedDB).
 * Regras:
 *  - Diária (D+1): todo dia com registro de estudo D gera UMA revisão `daily:D`, liberada quando hoje > D.
 *  - Semanal: cada 5 dias estudados (dias distintos com registro) fecham um ciclo e liberam `weekly:N`.
 *  - Revisões nunca expiram: ficam pendentes até serem concluídas. Chaves determinísticas evitam duplicatas.
 */
import { addDays, diffDays } from '../utils/date'
import { topicKey } from '../utils/text'

export const CYCLE_SIZE = 5
export const dailyKey = (date) => `daily:${date}`
export const weeklyKey = (n) => `weekly:${n}`

/** Dias distintos (ordenados) com ao menos um registro de estudo. */
export const getStudyDates = (studies) => [...new Set(studies.map((s) => s.date))].sort()

/**
 * Distribui os dias estudados em ciclos de 5. Ciclos fechados são imutáveis (histórico estável);
 * apenas o ciclo aberto recebe/perde dias. Retorna a nova lista de ciclos.
 */
export function reconcileCycles(cycles, studyDates, nowIso, todayDate) {
  const studied = new Set(studyDates)
  let list = cycles.map((c) => ({ ...c, days: [...c.days] })).sort((a, b) => a.number - b.number)
  for (const c of list) if (c.status === 'open') c.days = c.days.filter((d) => studied.has(d))
  list = list.filter((c) => c.status === 'closed' || c.days.length > 0)

  const assigned = new Set(list.flatMap((c) => c.days))
  let open = list.find((c) => c.status === 'open') || null
  for (const day of studyDates) {
    if (assigned.has(day)) continue
    if (!open) {
      const number = list.reduce((m, c) => Math.max(m, c.number), 0) + 1
      open = { id: number, number, days: [], status: 'open', createdAt: nowIso, closedAt: null, closedDate: null }
      list.push(open)
    }
    open.days.push(day)
    open.days.sort()
    assigned.add(day)
    if (open.days.length >= CYCLE_SIZE) {
      open.status = 'closed'
      open.closedAt = nowIso
      open.closedDate = todayDate
      open = null
    }
  }
  return list
}

/** Define quais revisões criar/remover. Nunca recria uma revisão existente (concluída ou não). */
export function planReviewChanges({ reviews, cycles, studyDates, today, nowIso }) {
  const existing = new Set(reviews.map((r) => r.id))
  const studied = new Set(studyDates)
  const create = []
  const remove = []
  for (const date of studyDates) {
    const id = dailyKey(date)
    if (date < today && !existing.has(id)) {
      create.push({ id, key: id, type: 'daily', refDate: date, releasedDate: addDays(date, 1), createdAt: nowIso, startedAt: null, completedAt: null, snapshot: null })
    }
  }
  for (const c of cycles) {
    const id = weeklyKey(c.number)
    if (c.status === 'closed' && !existing.has(id)) {
      create.push({ id, key: id, type: 'weekly', cycleId: c.id, cycleNumber: c.number, days: [...c.days], releasedDate: c.closedDate, createdAt: nowIso, startedAt: null, completedAt: null, snapshot: null })
    }
  }
  // Só sai da fila a revisão diária cujo dia deixou de ter registros (porque a pessoa os excluiu/moveu).
  for (const r of reviews) if (r.type === 'daily' && !r.completedAt && !studied.has(r.refDate)) remove.push(r.id)
  return { create, remove }
}

export const reviewDays = (review) => (review.type === 'daily' ? [review.refDate] : review.days || [])

/** Agrupa estudos em assuntos únicos (matéria + assunto), com as datas em que apareceram. */
export function groupTopics(studies) {
  const map = new Map()
  for (const s of [...studies].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''))) {
    const k = topicKey(s.subjectId, s.topic)
    if (!map.has(k)) map.set(k, { subjectId: s.subjectId, topic: s.topic.trim(), dates: [], notes: [] })
    const t = map.get(k)
    if (!t.dates.includes(s.date)) t.dates.push(s.date)
    if (s.notes && s.notes.trim()) t.notes.push(s.notes.trim())
  }
  return [...map.values()]
}

/** Conteúdo de uma revisão: assuntos, questões, respostas já dadas e progresso. */
export function buildReviewContent(review, { studies, questions, logs }) {
  const days = new Set(reviewDays(review))
  const answers = {}
  for (const l of logs) if (l.reviewId === review.id && l.kind === 'question') answers[l.itemId] = l

  let qs
  let topics
  if (review.completedAt && review.snapshot) {
    const ids = new Set(review.snapshot.questionIds)
    qs = questions.filter((q) => ids.has(q.id))
    topics = review.snapshot.topics
  } else {
    // Questões já dominadas não voltam para novas revisões, mas se já foram respondidas nesta, continuam contando.
    qs = questions.filter((q) => days.has(q.date) && (q.status !== 'mastered' || answers[q.id]))
    topics = groupTopics(studies.filter((s) => days.has(s.date)))
  }
  qs = [...qs].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''))
  const answered = qs.filter((q) => answers[q.id])
  const correct = answered.filter((q) => answers[q.id].correct).length
  const subjectIds = [...new Set([...topics.map((t) => t.subjectId), ...qs.map((q) => q.subjectId)])]
  return {
    days: [...days].sort(), topics, questions: qs, answers, subjectIds,
    total: qs.length, answered: answered.length, correct, wrong: answered.length - correct,
    allAnswered: answered.length === qs.length,
    progress: qs.length ? Math.round((answered.length / qs.length) * 100) : review.completedAt ? 100 : 0
  }
}

export function reviewStatus(review, content) {
  if (review.completedAt) return 'completed'
  if (review.startedAt || content.answered > 0) return 'in_progress'
  return 'pending'
}
export const isOverdue = (review, today) => !review.completedAt && review.releasedDate < today
export const daysOverdue = (review, today) => Math.max(0, diffDays(review.releasedDate, today))

/** Próximas revisões (apenas fatos calculados a partir dos registros). */
export function getUpcoming({ studyDates, cycles, flashcards, today }) {
  const tomorrow = addDays(today, 1)
  const open = cycles.find((c) => c.status === 'open')
  return {
    dailyTomorrow: studyDates.includes(today) ? { refDate: today, availableOn: tomorrow } : null,
    cycle: { number: open ? open.number : (cycles.reduce((m, c) => Math.max(m, c.number), 0) + 1), studied: open ? open.days.length : 0, size: CYCLE_SIZE },
    flashcardsTomorrow: flashcards.filter((f) => f.dueDate === tomorrow).length
  }
}
