// Motor do módulo SIMULADOS (lógica pura, sem UI nem banco).
// Independente do sistema de revisões. Só usa dados registrados manualmente pelo usuário.
import { addDays, diffDays, isValidDateStr, monthKey, todayStr } from '../utils/date'
import { norm } from '../utils/text'

export const DEFAULT_FREQUENCY = 15
export const FREQUENCY_PRESETS = [7, 10, 15, 20, 30]
export const MAX_FREQUENCY = 365
/** Variação (pontos percentuais por simulado) abaixo da qual a tendência é considerada estável. */
export const TREND_THRESHOLD = 1

export const isValidFrequency = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_FREQUENCY

// ---------- números e formatação ----------
export const pct = (correct, total) => (total > 0 ? (correct / total) * 100 : null)
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null)

export function fmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${(Math.round(v * 10) / 10).toString().replace('.', ',')}%`
}
export function fmtDelta(v) {
  if (v === null || v === undefined) return '—'
  const r = Math.round(v * 10) / 10
  return `${r > 0 ? '+' : ''}${r.toString().replace('.', ',')} p.p.`
}

// ---------- validação e normalização de uma matéria do simulado ----------
const blankInput = (v) => v === '' || v === null || v === undefined
const toInt = (v) => (typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.')))

/**
 * Valida a linha de uma matéria. Em branco é opcional: se omitido, é calculado (total - acertos - erros).
 * Se informado, acertos + erros + em branco precisam fechar com o total.
 * @returns {{ok:boolean, value?:{total,correct,wrong,blank}, errors:Record<string,string>}}
 */
export function normalizeEntry(raw) {
  const errors = {}
  const need = (key, label, min) => {
    if (blankInput(raw[key])) { errors[key] = `Informe ${label}.`; return null }
    const n = toInt(raw[key])
    if (!Number.isInteger(n) || n < min) { errors[key] = min ? 'Use um número inteiro maior que 0.' : 'Use um número inteiro (0 ou mais).'; return null }
    return n
  }
  const total = need('total', 'o total de questões', 1)
  const correct = need('correct', 'os acertos', 0)
  const wrong = need('wrong', 'os erros (0 se não houve)', 0)
  let blank = null
  if (!blankInput(raw.blank)) blank = need('blank', 'as questões em branco', 0)
  if (Object.keys(errors).length) return { ok: false, errors }

  if (correct + wrong > total) {
    errors.correct = `Acertos + erros (${correct + wrong}) excedem o total (${total}).`
    return { ok: false, errors }
  }
  if (blank === null) blank = total - correct - wrong
  else if (correct + wrong + blank !== total) {
    errors.blank = `A soma (${correct + wrong + blank}) precisa ser igual ao total (${total}).`
    return { ok: false, errors }
  }
  return { ok: true, value: { total, correct, wrong, blank }, errors }
}

/** Valida o simulado inteiro. `form.subjects` = [{subjectId, total, correct, wrong, blank}] (valores de formulário). */
export function validateMockExam(form, today = todayStr()) {
  const errors = {}
  const name = (form.name || '').trim()
  if (!name) errors.name = 'Dê um nome ao simulado.'
  else if (name.length > 120) errors.name = 'Use até 120 caracteres.'
  if (!isValidDateStr(form.date)) errors.date = 'Informe uma data válida.'
  else if (form.date > today) errors.date = 'A data não pode estar no futuro.'
  if ((form.contest || '').length > 120) errors.contest = 'Use até 120 caracteres.'
  if ((form.board || '').length > 120) errors.board = 'Use até 120 caracteres.'
  if ((form.notes || '').length > 2000) errors.notes = 'Use até 2000 caracteres.'

  const rows = form.subjects || []
  const rowErrors = []
  const entries = []
  const seen = new Set()
  rows.forEach((r, i) => {
    const e = {}
    if (!r.subjectId) e.subjectId = 'Escolha a matéria.'
    else if (seen.has(r.subjectId)) e.subjectId = 'Matéria repetida neste simulado.'
    seen.add(r.subjectId)
    const n = normalizeEntry(r)
    Object.assign(e, n.errors)
    rowErrors[i] = e
    if (n.ok && !e.subjectId) entries.push({ subjectId: r.subjectId, ...n.value })
  })
  if (!rows.length) errors.subjects = 'Adicione ao menos uma matéria.'
  if (rowErrors.some((e) => Object.keys(e).length)) errors.rows = rowErrors
  return { errors, entries, valid: !Object.keys(errors).length }
}

// ---------- totais e séries ----------
export function sumEntries(entries) {
  const t = entries.reduce((a, e) => ({ total: a.total + e.total, correct: a.correct + e.correct, wrong: a.wrong + e.wrong, blank: a.blank + e.blank }), { total: 0, correct: 0, wrong: 0, blank: 0 })
  return { ...t, pct: pct(t.correct, t.total) }
}
export const examTotals = (exam) => sumEntries(exam.subjects || [])

export const sortAsc = (exams) => [...exams].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''))
export const sortDesc = (exams) => sortAsc(exams).reverse()

/** Série geral: um ponto por simulado, em ordem cronológica. */
export function overallSeries(exams) {
  return sortAsc(exams).map((e) => ({ examId: e.id, name: e.name, date: e.date, ...examTotals(e) })).filter((p) => p.total > 0)
}

/** Mantém só a matéria escolhida em cada simulado (simulados sem ela são descartados — ausência ≠ zero). */
export function restrictToSubject(exams, subjectId) {
  if (!subjectId) return exams
  return exams.map((e) => ({ ...e, subjects: e.subjects.filter((s) => s.subjectId === subjectId) })).filter((e) => e.subjects.length)
}

export function subjectSeries(exams, subjectId) {
  return sortAsc(exams).flatMap((e) => {
    const s = e.subjects.find((x) => x.subjectId === subjectId)
    return s && s.total > 0 ? [{ examId: e.id, name: e.name, date: e.date, ...s, pct: pct(s.correct, s.total) }] : []
  })
}

function slope(values) {
  const n = values.length
  const mx = (n - 1) / 2, my = mean(values)
  let num = 0, den = 0
  values.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2 })
  return den ? num / den : 0
}

/** Resumo de uma série [{pct,...}] em ordem cronológica. */
export function seriesSummary(series) {
  const n = series.length
  if (!n) return { n: 0, current: null, best: null, worst: null, avg: null, delta: null, trend: { kind: 'insufficient', slope: 0 }, stagnant: false }
  const values = series.map((p) => p.pct)
  const best = series.reduce((a, p) => (p.pct > a.pct ? p : a))
  const worst = series.reduce((a, p) => (p.pct < a.pct ? p : a))
  const delta = n >= 2 ? values[n - 1] - values[n - 2] : null
  let kind = 'insufficient'
  let sl = 0
  if (n >= 2) {
    sl = n === 2 ? delta : slope(values)
    kind = Math.abs(sl) < TREND_THRESHOLD ? 'flat' : sl > 0 ? 'up' : 'down'
  }
  const last3 = values.slice(-3)
  const stagnant = n >= 3 && Math.max(...last3) - Math.min(...last3) <= 3
  return { n, current: values[n - 1], best, worst, avg: mean(values), delta, trend: { kind, slope: sl }, stagnant }
}

export const TREND_LABEL = { up: 'Em evolução', down: 'Em queda', flat: 'Estável', insufficient: 'Dados insuficientes' }

/** Ranking de matérias (ausência em um simulado não conta como zero). */
export function subjectRanking(exams) {
  const ids = [...new Set(exams.flatMap((e) => e.subjects.map((s) => s.subjectId)))]
  return ids.map((subjectId) => {
    const series = subjectSeries(exams, subjectId)
    const sum = seriesSummary(series)
    return {
      subjectId, exams: series.length, avg: sum.avg, best: sum.best?.pct ?? null, worst: sum.worst?.pct ?? null,
      current: sum.current, questions: series.reduce((a, p) => a + p.total, 0), correct: series.reduce((a, p) => a + p.correct, 0),
      trend: sum.trend, stagnant: sum.stagnant
    }
  }).filter((r) => r.exams > 0)
}

export function monthlyAverages(exams) {
  const by = new Map()
  for (const p of overallSeries(exams)) {
    const k = monthKey(p.date)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(p)
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({
    key, n: list.length, avg: mean(list.map((p) => p.pct)), correct: list.reduce((a, p) => a + p.correct, 0), total: list.reduce((a, p) => a + p.total, 0)
  }))
}

// ---------- filtros e comparação de períodos ----------
export function filterExams(exams, f = {}) {
  const q = norm(f.q || '')
  return exams.filter((e) =>
    (!q || norm(e.name).includes(q)) &&
    (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) &&
    (!f.contest || e.contest === f.contest) && (!f.board || e.board === f.board) &&
    (!f.ids?.length || f.ids.includes(e.id)))
}

export const distinctValues = (exams, field) =>
  [...new Set(exams.map((e) => (e[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

/** Compara dois períodos {from,to}: média geral e por matéria. Períodos sem simulados retornam null. */
export function comparePeriods(exams, a, b) {
  const part = (range) => {
    const list = filterExams(exams, range)
    const series = overallSeries(list)
    const bySubject = Object.fromEntries(subjectRanking(list).map((r) => [r.subjectId, r.avg]))
    return { n: list.length, avg: mean(series.map((p) => p.pct)), bySubject }
  }
  const A = part(a), B = part(b)
  const ids = [...new Set([...Object.keys(A.bySubject), ...Object.keys(B.bySubject)])]
  return {
    a: A, b: B,
    diff: A.avg !== null && B.avg !== null ? A.avg - B.avg : null,
    subjects: ids.map((subjectId) => ({ subjectId, a: A.bySubject[subjectId] ?? null, b: B.bySubject[subjectId] ?? null,
      diff: A.bySubject[subjectId] != null && B.bySubject[subjectId] != null ? A.bySubject[subjectId] - B.bySubject[subjectId] : null }))
  }
}

/** Indicadores para o Dashboard. */
export function mockOverview(exams) {
  const series = overallSeries(exams)
  const sum = seriesSummary(series)
  const rank = subjectRanking(exams).filter((r) => r.avg !== null).sort((a, b) => b.avg - a.avg)
  return {
    count: exams.length, last: sum.current, avg: sum.avg, delta: sum.delta, lastExam: series.at(-1) || null,
    bestSubject: rank[0] || null, worstSubject: rank.length >= 2 ? rank.at(-1) : null
  }
}

// ---------- frequência sugerida (apenas lembrete; nunca cria nem bloqueia simulados) ----------
/**
 * Próxima data = data do simulado MAIS RECENTE + frequência. Sem simulados: sem previsão.
 * Se a data passar sem novo cadastro, o status vira "overdue" e permanece assim (lembrete pendente).
 */
export function getSchedule({ exams, frequencyDays = DEFAULT_FREQUENCY, today = todayStr() }) {
  if (!exams.length) return { status: 'none', frequencyDays, lastDate: null, nextDate: null, daysLeft: null, overdueDays: 0, elapsed: 0 }
  const lastDate = exams.reduce((m, e) => (e.date > m ? e.date : m), exams[0].date)
  const nextDate = addDays(lastDate, frequencyDays)
  const daysLeft = diffDays(today, nextDate)
  return {
    status: daysLeft > 0 ? 'upcoming' : daysLeft === 0 ? 'due' : 'overdue',
    frequencyDays, lastDate, nextDate, daysLeft, overdueDays: Math.max(0, -daysLeft),
    elapsed: Math.min(1, Math.max(0, diffDays(lastDate, today) / frequencyDays))
  }
}

/** Histórico de datas com o intervalo real entre simulados (do mais recente ao mais antigo). */
export function frequencyHistory({ exams, frequencyDays = DEFAULT_FREQUENCY }) {
  const asc = sortAsc(exams)
  const rows = asc.map((e, i) => {
    const interval = i === 0 ? null : diffDays(asc[i - 1].date, e.date)
    let status = 'first'
    if (interval !== null) status = interval > frequencyDays ? 'late' : interval < frequencyDays ? 'early' : 'on_time'
    return { examId: e.id, name: e.name, date: e.date, interval, status, diff: interval === null ? null : interval - frequencyDays }
  })
  const gaps = rows.filter((r) => r.interval !== null)
  const kept = gaps.filter((r) => r.status !== 'late').length
  return {
    rows: rows.reverse(), frequencyDays,
    avgInterval: gaps.length ? mean(gaps.map((r) => r.interval)) : null,
    longest: gaps.length ? Math.max(...gaps.map((r) => r.interval)) : null,
    kept, gaps: gaps.length, adherence: gaps.length ? Math.round((kept / gaps.length) * 100) : null
  }
}
