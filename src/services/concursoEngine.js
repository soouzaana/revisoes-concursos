import { diffDays, monthKey } from '../utils/date'
import { norm } from '../utils/text'

export const TOPIC_STATUS = {
  not_started: 'Não iniciado', studying: 'Estudando', partial: 'Parcialmente estudado', studied: 'Estudado', reviewing: 'Revisando', mastered: 'Dominado'
}
export const STATUS_ORDER = Object.keys(TOPIC_STATUS)
export const CONTEST_STATUS = { open: 'Edital aberto', planned: 'Previsto', studying: 'Em preparação', done: 'Prova realizada', closed: 'Encerrado' }
export const ATTENTION_DAYS = 14

export function syllabusProgress(allTopics) {
  const topics = allTopics.filter((t) => !t.withdrawn) // assuntos retirados por retificação não entram na conta
  const count = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]))
  for (const t of topics) count[t.status] = (count[t.status] || 0) + 1
  const total = topics.length
  const done = count.studied + count.reviewing + count.mastered
  return { total, count, done, pending: total - done, completionPct: total ? Math.round((done / total) * 100) : 0, masteredPct: total ? Math.round((count.mastered / total) * 100) : 0 }
}

/** Constrói a árvore matéria → assunto → subassuntos a partir da lista plana. */
export function buildTree(topics) {
  const byParent = new Map()
  for (const t of topics) { const k = t.parentId || null; (byParent.get(k) || byParent.set(k, []).get(k)).push(t) }
  const walk = (parent) => (byParent.get(parent) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((t) => ({ ...t, children: walk(t.id) }))
  return walk(null)
}

/** Motivos pelos quais um assunto precisa de atenção (lista vazia = ok). */
export function attentionReasons(topic, { today, questions = [], days = ATTENTION_DAYS }) {
  const reasons = []
  if (topic.status === 'studied' || topic.status === 'reviewing') {
    if (!topic.lastReviewedAt) reasons.push('Nunca revisado')
    else if (diffDays(topic.lastReviewedAt, today) >= days) reasons.push(`Sem revisão há ${diffDays(topic.lastReviewedAt, today)} dias`)
  }
  const key = norm(topic.name)
  const errors = questions.filter((q) => q.subjectId === topic.subjectId && norm(q.topic) === key && q.status !== 'mastered').length
  if (errors >= 2) reasons.push(`${errors} questões não dominadas`)
  return reasons
}

/** Progresso da rodada atual do ciclo de estudos. */
export function cycleProgress(cycle, sessions) {
  const items = [...(cycle?.items || [])].sort((a, b) => a.order - b.order)
  const start = cycle?.roundStart || ''
  const rows = items.map((it) => {
    const all = sessions.filter((s) => s.subjectId === it.subjectId)
    const round = all.filter((s) => s.date >= start)
    const done = round.reduce((a, s) => a + (Number(s.minutes) || 0), 0)
    const target = Number(it.targetMinutes) || 0
    return { ...it, roundMinutes: done, totalMinutes: all.reduce((a, s) => a + (Number(s.minutes) || 0), 0), pct: target ? Math.min(100, Math.round((done / target) * 100)) : 0, complete: target > 0 && done >= target }
  })
  const next = rows.find((r) => !r.complete) || null
  return { rows, next, roundComplete: rows.length > 0 && !next }
}

/** Estatísticas do concurso com filtro de período e matéria. */
export function concursoStats({ studies, cycleSessions, logs, reviews, syllabus, mockExams, from = '', to = '', subjectId = '', today }) {
  const inRange = (d) => (!from || d >= from) && (!to || d <= to)
  const okSub = (id) => !subjectId || id === subjectId
  const st = studies.filter((s) => inRange(s.date) && okSub(s.subjectId))
  const ses = cycleSessions.filter((s) => inRange(s.date) && okSub(s.subjectId))
  const q = logs.filter((l) => l.kind === 'question' && inRange(l.date) && okSub(l.subjectId))
  const correct = q.filter((l) => l.correct).length
  const days = new Set([...st.map((s) => s.date), ...ses.map((s) => s.date)])
  const minutes = st.reduce((a, s) => a + (Number(s.minutes) || 0), 0) + ses.reduce((a, s) => a + (Number(s.minutes) || 0), 0)
  const topics = syllabus.filter((t) => okSub(t.subjectId))
  const prog = syllabusProgress(topics)
  const topicReviews = topics.reduce((a, t) => a + (t.reviews || []).filter((r) => inRange(r.date)).length, 0)
  const doneReviews = reviews.filter((r) => r.completedAt && inRange(r.completedAt.slice(0, 10))).length + topicReviews
  const mocks = mockExams.filter((m) => inRange(m.date) && m.date <= today && (!subjectId || (m.subjects || []).some((s) => s.subjectId === subjectId)))
  const months = new Map()
  const bump = (d, f) => { const k = monthKey(d); const m = months.get(k) || { month: k, days: new Set(), minutes: 0, questions: 0, correct: 0 }; f(m); months.set(k, m) }
  for (const s of st) bump(s.date, (m) => { m.days.add(s.date); m.minutes += Number(s.minutes) || 0 })
  for (const s of ses) bump(s.date, (m) => { m.days.add(s.date); m.minutes += Number(s.minutes) || 0 })
  for (const l of q) bump(l.date, (m) => { m.questions++; if (l.correct) m.correct++ })
  return {
    studyDays: days.size, hours: minutes / 60, minutes, questions: q.length, correct, accuracy: q.length ? Math.round((correct / q.length) * 100) : null,
    topicsStudied: prog.done, topicsMastered: prog.count.mastered, topicsTotal: prog.total, reviewsDone: doneReviews, mocks: mocks.length,
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ month: m.month, days: m.days.size, hours: m.minutes / 60, questions: m.questions, accuracy: m.questions ? Math.round((m.correct / m.questions) * 100) : null }))
  }
}
