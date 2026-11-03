export const norm = (s) => (s ?? '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
export const LETTERS = ['A', 'B', 'C', 'D', 'E']
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)
export const topicKey = (subjectId, topic) => `${subjectId}|${norm(topic)}`
