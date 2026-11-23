/**
 * Motor de atividades: ofensiva (streak), heatmap e histórico.
 * Tudo é DERIVADO dos registros reais (nenhuma cópia é gravada) — por isso a mesma atividade
 * nunca é contada duas vezes. Datas sempre no fuso local; atividades futuras são ignoradas.
 */
import { addDays, diffDays, monthKey, parseDate, toDateStr } from '../utils/date'

export const CATEGORIES = {
  study: { label: 'Estudos', to: '/estudos' },
  review: { label: 'Revisões', to: '/revisoes' },
  flashcard: { label: 'Flashcards', to: '/flashcards' },
  session: { label: 'Sessões do ciclo', to: '/concurso/ciclo' },
  habit: { label: 'Hábitos', to: '/habitos' },
  mock: { label: 'Simulados', to: '/simulados' },
  task: { label: 'Tarefas', to: '/tarefas' },
  note: { label: 'Anotações', to: '/anotacoes' }
}
export const CATEGORY_KEYS = Object.keys(CATEGORIES)
export const DEFAULT_STREAK_CATEGORIES = ['study', 'review', 'flashcard', 'session', 'habit', 'mock']
export const FLASHCARDS_PER_UNIT = 10

/** ISO (UTC) -> 'YYYY-MM-DD' no fuso local do aparelho. */
export const localDate = (iso) => toDateStr(new Date(iso))
const clock = (iso) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
export const timeLabel = (iso) => (iso ? clock(iso) : '')

/**
 * Lista única de eventos de atividade. `data`: { studies, reviews, logs, habits, habitLogs, tasks,
 * mockExams, notes, cycleSessions, syllabus, nameOf }. Cada evento tem id estável (sem duplicatas).
 */
export function collectEvents(data, today) {
  const out = []
  const nameOf = data.nameOf || (() => '')
  const push = (e) => { if (e.date && e.date <= today) out.push({ minutes: 0, units: 1, ...e }) }

  for (const s of data.studies || []) {
    push({ id: `study:${s.id}`, category: 'study', date: s.date, at: s.createdAt, minutes: Number(s.minutes) || 0, title: `Estudou ${s.topic}`, detail: nameOf(s.subjectId), to: '/estudos' })
  }
  for (const r of data.reviews || []) {
    if (!r.completedAt) continue
    push({ id: `review:${r.id}`, category: 'review', date: localDate(r.completedAt), at: r.completedAt,
      title: r.type === 'daily' ? `Revisão diária de ${r.refDate?.split('-').reverse().join('/')}` : `Revisão semanal do ciclo ${r.cycleNumber ?? ''}`.trim(), detail: 'Caderno de erros', to: `/revisoes/${encodeURIComponent(r.id)}` })
  }
  for (const t of data.syllabus || []) {
    for (const rv of t.reviews || []) push({ id: `topic-review:${rv.id}`, category: 'review', date: rv.date, at: rv.at || `${rv.date}T12:00:00`, title: `Revisou ${t.name}`, detail: [nameOf(t.subjectId), rv.note].filter(Boolean).join(' · '), to: '/concurso/revisao-assuntos' })
  }
  // Flashcards: um evento por dia (agrupa as respostas); intensidade = 1 unidade a cada 10 cartões.
  const byDay = new Map()
  for (const l of data.logs || []) {
    if (l.kind !== 'flashcard') continue
    const g = byDay.get(l.date) || { n: 0, ok: 0, at: '' }
    g.n++; if (l.correct) g.ok++; if (l.at > g.at) g.at = l.at
    byDay.set(l.date, g)
  }
  for (const [date, g] of byDay) push({ id: `flashcards:${date}`, category: 'flashcard', date, at: g.at, units: Math.ceil(g.n / FLASHCARDS_PER_UNIT), count: g.n, title: `Estudou ${g.n} ${g.n === 1 ? 'flashcard' : 'flashcards'}`, detail: `${g.ok} ${g.ok === 1 ? 'acerto' : 'acertos'}`, to: '/flashcards' })

  const habitName = new Map((data.habits || []).map((h) => [h.id, h.name]))
  for (const l of data.habitLogs || []) push({ id: `habit:${l.id}`, category: 'habit', date: l.date, at: l.at || `${l.date}T12:00:00`, title: `Hábito: ${habitName.get(l.habitId) ?? 'removido'}`, detail: 'Concluído', to: '/habitos' })
  for (const t of data.tasks || []) if (t.completedAt) push({ id: `task:${t.id}`, category: 'task', date: localDate(t.completedAt), at: t.completedAt, title: `Concluiu: ${t.title}`, detail: t.category || 'Tarefa', to: '/tarefas' })
  for (const m of data.mockExams || []) push({ id: `mock:${m.id}`, category: 'mock', date: m.date, at: m.createdAt || `${m.date}T12:00:00`, title: `Simulado: ${m.name}`, detail: m.board || m.contest || '', to: '/simulados' })
  for (const n of data.notes || []) push({ id: `note:${n.id}`, category: 'note', date: localDate(n.createdAt), at: n.createdAt, title: `Anotação: ${n.title || 'Sem título'}`, detail: n.folder || '', to: '/anotacoes' })
  for (const c of data.cycleSessions || []) push({ id: `session:${c.id}`, category: 'session', date: c.date, at: c.at || `${c.date}T12:00:00`, minutes: Number(c.minutes) || 0, title: `Sessão de ciclo: ${nameOf(c.subjectId)}`, detail: `${c.minutes || 0} min`, to: '/concurso/ciclo' })
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

/** 0 sem atividade · 1 baixa · 2 moderada · 3 alta · 4 muito alta */
export function levelFor(units) {
  if (units <= 0) return 0
  if (units <= 2) return 1
  if (units <= 4) return 2
  if (units <= 7) return 3
  return 4
}
export const LEVEL_LABELS = ['Sem atividade', 'Atividade baixa', 'Atividade moderada', 'Atividade alta', 'Atividade muito alta']

/** Agrupa por dia só as categorias que contam (ofensiva/heatmap). */
export function buildDayMap(events, categories = DEFAULT_STREAK_CATEGORIES) {
  const allowed = new Set(categories)
  const map = new Map()
  for (const e of events) {
    if (!allowed.has(e.category)) continue
    const d = map.get(e.date) || { date: e.date, units: 0, count: 0, minutes: 0, sessions: 0, habits: 0, reviews: 0, events: [] }
    d.units += e.units; d.count += e.count ?? 1; d.minutes += e.minutes
    if (e.category === 'study' || e.category === 'session') d.sessions++
    if (e.category === 'habit') d.habits++
    if (e.category === 'review') d.reviews++
    d.events.push(e)
    map.set(e.date, d)
  }
  for (const d of map.values()) d.level = levelFor(d.units)
  return map
}

/** Ofensiva atual, maior, total de dias ativos e histórico de sequências. */
export function computeStreaks(dayMap, today) {
  const dates = [...dayMap.keys()].filter((d) => d <= today).sort()
  const runs = []
  for (const d of dates) {
    const last = runs[runs.length - 1]
    if (last && diffDays(last.end, d) === 1) { last.end = d; last.length++ } else runs.push({ start: d, end: d, length: 1 })
  }
  const activeToday = dayMap.has(today)
  const lastRun = runs[runs.length - 1]
  // Hoje ainda não conta como "quebra": a sequência só zera se ontem também ficou sem atividade.
  const alive = lastRun && (lastRun.end === today || lastRun.end === addDays(today, -1))
  const current = alive ? lastRun.length : 0
  let best = runs.reduce((a, r) => (r.length > (a?.length ?? 0) ? r : a), null)
  return {
    current, activeToday, totalActive: dates.length,
    longest: best?.length ?? 0, longestRange: best ? { start: best.start, end: best.end } : null,
    currentStart: alive ? lastRun.start : null,
    runs: [...runs].reverse().map((r) => ({ ...r, ongoing: alive && r === lastRun }))
  }
}

/** % de dias ativos no mês (dias decorridos até hoje). */
export function monthActive(dayMap, month, today) {
  const first = `${month}-01`
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const end = today.startsWith(month) ? today : `${month}-${String(lastDay).padStart(2, '0')}`
  if (end < first) return { active: 0, elapsed: 0, pct: 0 }
  const elapsed = diffDays(first, end) + 1
  let active = 0
  for (const d of dayMap.keys()) if (d >= first && d <= end) active++
  return { active, elapsed, pct: Math.round((active / elapsed) * 100) }
}

/** Colunas (semanas, domingo→sábado) do heatmap de um ano. Dias fora do ano ou futuros vêm como null. */
export function yearGrid(year, today) {
  const first = `${year}-01-01`, last = `${year}-12-31`
  const start = addDays(first, -parseDate(first).getDay())
  const weeks = []
  for (let d = start; d <= last; d = addDays(d, 7)) {
    const col = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(d, i)
      col.push(day < first || day > last ? null : { date: day, future: day > today })
    }
    weeks.push(col)
  }
  return weeks
}

/** Linha do tempo filtrada por categorias e período. */
export function filterTimeline(events, { categories = null, from = '', to = '' } = {}) {
  const set = categories && categories.length ? new Set(categories) : null
  return events.filter((e) => (!set || set.has(e.category)) && (!from || e.date >= from) && (!to || e.date <= to))
}

export const eventsByMonth = (events, key) => events.filter((e) => monthKey(e.date) === key)
