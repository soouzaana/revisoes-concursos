// Datas sempre como 'YYYY-MM-DD' no fuso LOCAL (nunca UTC), para o "dia" do usuário ser o dia real.
const pad = (n) => String(n).padStart(2, '0')
export const toDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayStr = () => toDateStr(new Date())
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toDateStr(parseDate(s)) === s
}
export function addDays(s, n) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
/** b - a em dias */
export function diffDays(a, b) {
  const A = parseDate(a), B = parseDate(b)
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000)
}
export const formatDate = (s) => (s ? s.split('-').reverse().join('/') : '')
const fmtShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
const fmtDM = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const fmtMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
export const formatDateShort = (s) => fmtShort.format(parseDate(s)).replace('.', '')
export const formatDayMonth = (s) => fmtDM.format(parseDate(s)).replace('.', '')
export const formatMonthLabel = (key) => fmtMonth.format(parseDate(key + '-01')).replace('.', '')
export function relativeDay(s, today) {
  const d = diffDays(today, s)
  if (d === 0) return 'Hoje'
  if (d === -1) return 'Ontem'
  if (d === 1) return 'Amanhã'
  return formatDateShort(s)
}
export function startOfWeek(s) {
  const d = parseDate(s)
  const dow = (d.getDay() + 6) % 7 // segunda = 0
  d.setDate(d.getDate() - dow)
  return toDateStr(d)
}
export const monthKey = (s) => s.slice(0, 7)
