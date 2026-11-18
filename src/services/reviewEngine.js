/**
 * Motor de revisões — lógica PURA (sem Vue, sem IndexedDB).
 * Regras:
 *  - Diária (D+1): todo dia com registro de estudo D gera UMA revisão `daily:D`, liberada quando hoje > D.
 *  - Semanal: cada N dias estudados (N configurável; padrão 5; dias distintos com registro) fecham um ciclo e liberam `weekly:N`.
 *  - Escopo: conteúdos de matérias/assuntos inativos ficam fora das revisões automáticas (os dados são preservados).
 *  - Revisões nunca expiram: ficam pendentes até serem concluídas. Chaves determinísticas evitam duplicatas.
 */
import { addDays, diffDays } from '../utils/date'
import { topicKey } from '../utils/text'

export const DEFAULT_CYCLE_SIZE = 5
export const CYCLE_SIZE = DEFAULT_CYCLE_SIZE // alias (valor padrão)
export const WEEKLY_PRESETS = [3, 4, 5, 6, 7, 8, 10]
export const MAX_CYCLE_SIZE = 100
export const isValidCycleSize = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_CYCLE_SIZE
export const dailyKey = (date) => `daily:${date}`
export const weeklyKey = (n) => `weekly:${n}`

/** Dias distintos (ordenados) com ao menos um registro de estudo. */
export const getStudyDates = (studies) => [...new Set(studies.map((s) => s.date))].sort()

/**
 * Distribui os dias estudados em ciclos de `size` dias. Ciclos FECHADOS são imutáveis (histórico estável, cada um
 * guarda o tamanho com que foi fechado). O ciclo ABERTO é reavaliado a cada sincronização: seus dias voltam ao
 * "pool" junto com os dias ainda não atribuídos e são redistribuídos em ordem cronológica. Assim, mudar a frequência
 * vale para os próximos ciclos sem apagar nem duplicar nada (a chave `weekly:N` é única por ciclo).
 */
export function reconcileCycles(cycles, studyDates, nowIso, todayDate, size = DEFAULT_CYCLE_SIZE) {
  const n = isValidCycleSize(size) ? size : DEFAULT_CYCLE_SIZE
  const closed = cycles.filter((c) => c.status === 'closed').map((c) => ({ ...c, days: [...c.days] })).sort((a, b) => a.number - b.number)
  const openOld = cycles.find((c) => c.status === 'open') || null
  const assigned = new Set(closed.flatMap((c) => c.days))
  const pool = studyDates.filter((d) => !assigned.has(d)) // cronológico; dias do ciclo aberto que seguem válidos entram aqui

  const out = [...closed]
  let number = openOld ? openOld.number : closed.reduce((m, c) => Math.max(m, c.number), 0) + 1
  const createdFor = (num) => (openOld && openOld.number === num ? openOld.createdAt : nowIso)
  let i = 0
  while (pool.length - i >= n) {
    out.push({ id: number, number, days: pool.slice(i, i + n), status: 'closed', size: n, createdAt: createdFor(number), closedAt: nowIso, closedDate: todayDate })
    number++
    i += n
  }
  const rest = pool.slice(i)
  if (rest.length) {
    const same = openOld && openOld.number === number && JSON.stringify(openOld.days) === JSON.stringify(rest)
    out.push(same ? { ...openOld, days: [...openOld.days] } : { id: number, number, days: rest, status: 'open', createdAt: createdFor(number), closedAt: null, closedDate: null })
  }
  return out
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
export function buildReviewContent(review, { studies, questions, logs }, scope = null) {
  const days = new Set(reviewDays(review))
  const answers = {}
  for (const l of logs) if (l.reviewId === review.id && l.kind === 'question') answers[l.itemId] = l

  let qs
  let topics
  let inactiveOnly = false
  let hiddenCount = 0
  if (review.completedAt && review.snapshot) {
    const ids = new Set(review.snapshot.questionIds)
    qs = questions.filter((q) => ids.has(q.id))
    topics = review.snapshot.topics
  } else {
    // Questões já dominadas não voltam para novas revisões, mas se já foram respondidas nesta, continuam contando.
    const allQs = questions.filter((q) => days.has(q.date) && (q.status !== 'mastered' || answers[q.id]))
    const allTopics = groupTopics(studies.filter((s) => days.has(s.date)))
    qs = allQs
    topics = allTopics
    if (scope) {
      // Só participa quem está ativo (matéria e assunto); o que já foi respondido nesta revisão permanece.
      const aq = allQs.filter((q) => answers[q.id] || scope.isActive(q.subjectId, q.topic))
      const at = allTopics.filter((t) => scope.isActive(t.subjectId, t.topic))
      if (!aq.length && !at.length && (allQs.length || allTopics.length)) inactiveOnly = true // só conteúdo inativo: mostra tudo se for aberta de propósito
      else { qs = aq; topics = at }
      hiddenCount = allQs.length - qs.length + allTopics.length - topics.length
    }
  }
  qs = [...qs].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''))
  const answered = qs.filter((q) => answers[q.id])
  const correct = answered.filter((q) => answers[q.id].correct).length
  const subjectIds = [...new Set([...topics.map((t) => t.subjectId), ...qs.map((q) => q.subjectId)])]
  return {
    days: [...days].sort(), topics, questions: qs, answers, subjectIds, inactiveOnly, hiddenCount,
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
export function getUpcoming({ studyDates, cycles, flashcards, today, size = DEFAULT_CYCLE_SIZE }) {
  const tomorrow = addDays(today, 1)
  const open = cycles.find((c) => c.status === 'open')
  return {
    dailyTomorrow: studyDates.includes(today) ? { refDate: today, availableOn: tomorrow } : null,
    cycle: { number: open ? open.number : (cycles.reduce((m, c) => Math.max(m, c.number), 0) + 1), studied: open ? open.days.length : 0, size },
    flashcardsTomorrow: flashcards.filter((f) => f.dueDate === tomorrow).length
  }
}
