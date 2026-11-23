import { addDays, parseDate, startOfWeek, toDateStr } from '../utils/date'

export const KINDS = {
  event: { label: 'Eventos', dot: 'bg-accent' },
  task: { label: 'Tarefas', dot: 'bg-warn' },
  study: { label: 'Estudos', dot: 'bg-ok' },
  mock: { label: 'Simulados', dot: 'bg-danger' },
  review: { label: 'Revisões previstas', dot: 'bg-[#9333ea]' }
}

/** Reúne tudo que aparece no calendário, indexado por data. Nada é copiado para o banco. */
export function buildCalendarItems({ events = [], tasks = [], studies = [], mockExams = [], mockNext = null, reviews = [], studyDates = [], today, nameOf = () => '' }) {
  const map = new Map()
  const add = (date, item) => { if (!date) return; (map.get(date) || map.set(date, []).get(date)).push(item) }
  for (const e of events) add(e.date, { id: `event:${e.id}`, kind: 'event', title: e.title, time: e.time, editable: e.id, raw: e })
  for (const t of tasks) add(t.dueDate, { id: `task:${t.id}`, kind: 'task', title: t.title, done: t.status === 'done', to: '/tarefas' })
  for (const s of studies) add(s.date, { id: `study:${s.id}`, kind: 'study', title: `Estudo: ${s.topic}`, sub: nameOf(s.subjectId), to: '/estudos' })
  for (const m of mockExams) add(m.date, { id: `mock:${m.id}`, kind: 'mock', title: `Simulado: ${m.name}`, done: true, to: '/simulados' })
  if (mockNext && mockNext >= today) add(mockNext, { id: 'mock:next', kind: 'mock', title: 'Simulado sugerido', to: '/simulados/novo' })
  // Revisões: pendentes na data em que foram liberadas; amanhã, a diária do que foi estudado hoje.
  let hasToday = false
  for (const r of reviews) {
    if (r.completedAt) continue
    if (r.type === 'daily' && r.refDate === today) hasToday = true
    const date = r.type === 'daily' ? (r.releasedDate || addDays(r.refDate, 1)) : r.releasedDate
    add(date && date > today ? date : today, { id: `review:${r.id}`, kind: 'review', title: r.type === 'daily' ? 'Revisão diária' : `Revisão semanal (ciclo ${r.cycleNumber ?? ''})`, to: `/revisoes/${encodeURIComponent(r.id)}` })
  }
  if (studyDates.includes(today) && !hasToday) add(addDays(today, 1), { id: 'review:tomorrow', kind: 'review', title: 'Revisão diária (estudo de hoje)', to: '/revisoes' })
  return map
}

/** 6 semanas (42 dias) cobrindo o mês, começando no domingo. */
export function monthGrid(year, month) { // month: 0-11
  const first = toDateStr(new Date(year, month, 1))
  const start = addDays(first, -parseDate(first).getDay())
  return Array.from({ length: 42 }, (_, i) => { const d = addDays(start, i); return { date: d, inMonth: parseDate(d).getMonth() === month } })
}
/** 7 dias da semana (domingo a sábado) que contém `date`. */
export function weekDays(date) {
  const start = addDays(date, -parseDate(date).getDay())
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}
export { startOfWeek }
