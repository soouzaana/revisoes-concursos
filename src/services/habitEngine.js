import { addDays, diffDays, parseDate, startOfWeek } from '../utils/date'

/** `days`: null/[] = todos os dias; senão, lista de dias da semana (0 = domingo … 6 = sábado). */
export const isScheduled = (habit, date) => !habit.days?.length || habit.days.includes(parseDate(date).getDay())
export const habitStart = (habit) => habit.startDate || (habit.createdAt || '').slice(0, 10)

/** Sequência atual/maior considerando só os dias previstos (dias fora da frequência não quebram). */
export function habitStreak(habit, doneSet, today) {
  const start = habitStart(habit)
  let current = 0, d = today
  if (isScheduled(habit, d) && !doneSet.has(d)) d = addDays(d, -1) // hoje ainda pode ser feito
  for (; d >= start; d = addDays(d, -1)) {
    if (doneSet.has(d)) current++
    else if (isScheduled(habit, d)) break
  }
  let longest = 0, run = 0
  for (let x = start; x <= today; x = addDays(x, 1)) {
    if (doneSet.has(x)) { run++; longest = Math.max(longest, run) }
    else if (isScheduled(habit, x) && x !== today) run = 0
  }
  return { current, longest }
}

/** Taxa de consistência nos últimos `window` dias (dias previstos concluídos ÷ previstos). */
export function consistency(habit, doneSet, today, window = 30) {
  const start = habitStart(habit)
  let from = addDays(today, -(window - 1))
  if (from < start) from = start
  let planned = 0, done = 0
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (isScheduled(habit, d)) { planned++; if (doneSet.has(d)) done++ } else if (doneSet.has(d)) { /* extra: não altera a taxa */ }
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : 0 }
}

/** Evolução semanal (últimas `weeks` semanas): % concluído dos dias previstos. */
export function weeklyEvolution(habit, doneSet, today, weeks = 8) {
  const start = habitStart(habit)
  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(startOfWeek(today), -7 * i)
    let planned = 0, done = 0
    for (let k = 0; k < 7; k++) {
      const d = addDays(ws, k)
      if (d > today || d < start) continue
      if (isScheduled(habit, d)) { planned++; if (doneSet.has(d)) done++ }
    }
    out.push({ week: ws, planned, done, pct: planned ? Math.round((done / planned) * 100) : null })
  }
  return out
}
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export { diffDays }
