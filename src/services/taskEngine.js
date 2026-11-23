import { addDays, parseDate, toDateStr } from '../utils/date'

export const PRIORITIES = { high: 'Alta', medium: 'Média', low: 'Baixa' }
export const RECURRENCES = { none: 'Não repete', daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês' }
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

export function nextDue(due, recurrence) {
  if (!due || !recurrence || recurrence === 'none') return null
  if (recurrence === 'daily') return addDays(due, 1)
  if (recurrence === 'weekly') return addDays(due, 7)
  const d = parseDate(due); const day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toDateStr(d)
}
export const isOverdue = (t, today) => t.status !== 'done' && !!t.dueDate && t.dueDate < today

/** filter: all | pending | done | overdue; priority: '' | high | medium | low */
export function filterTasks(tasks, { filter = 'pending', priority = '', category = '' } = {}, today) {
  return tasks
    .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.status === 'done' : filter === 'overdue' ? isOverdue(t, today) : t.status !== 'done'))
    .filter((t) => !priority || t.priority === priority)
    .filter((t) => !category || (t.category || '') === category)
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
}
