// Filtros e montagem de sessões de estudo livre. Lógica pura (sem UI).
import { cardStats, isMastered } from './flashcardEngine'

export const emptyFilters = () => ({
  subjectIds: [], topics: [], mastery: '', performance: '', history: '', createdFrom: '', createdTo: '', onlyErrors: false
})

export const MASTERY_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'mastered', label: 'Dominados' },
  { value: 'not_mastered', label: 'Não dominados' },
  { value: 'never', label: 'Nunca revisados' }
]
export const PERFORMANCE_OPTIONS = [
  { value: '', label: 'Sem ordenação' },
  { value: 'high_error', label: 'Maior taxa de erros' },
  { value: 'low_error', label: 'Menor taxa de erros' },
  { value: 'high_accuracy', label: 'Maior taxa de acertos' }
]
export const HISTORY_OPTIONS = [
  { value: '', label: 'Sem ordenação' },
  { value: 'most_wrong', label: 'Cartões mais errados' },
  { value: 'recent_wrong', label: 'Mais errei recentemente' },
  { value: 'most_reviewed', label: 'Mais revisados' }
]

export const PRESETS = [
  { id: 'all', label: 'Todos os flashcards', filters: {}, limit: 0, random: false },
  { id: 'errors', label: 'Somente os que erro', filters: { onlyErrors: true, performance: 'high_error' }, limit: 0, random: false },
  { id: 'not_mastered', label: 'Somente os não dominados', filters: { mastery: 'not_mastered' }, limit: 0, random: false },
  { id: 'never', label: 'Somente os nunca revisados', filters: { mastery: 'never' }, limit: 0, random: false },
  { id: 'hardest', label: 'Mais difíceis', filters: { performance: 'high_error', history: 'most_wrong' }, limit: 20, random: false },
  { id: 'random', label: 'Revisão aleatória', filters: {}, limit: 20, random: true }
]

const createdDate = (c) => (c.createdAt || '').slice(0, 10)

/** Cartões que atendem a todos os filtros combinados (E lógico). */
export function applyFilters(cards, f, today) {
  return cards.filter((c) => {
    const st = cardStats(c, today)
    if (f.subjectIds.length && !f.subjectIds.includes(c.subjectId)) return false
    if (f.topics.length && !f.topics.includes(c.topic)) return false
    if (f.mastery === 'mastered' && !isMastered(c)) return false
    if (f.mastery === 'not_mastered' && isMastered(c)) return false
    if (f.mastery === 'never' && st.reviews > 0) return false
    if (f.onlyErrors && st.wrong === 0) return false
    // Filtros de desempenho/histórico dependem de respostas reais: cartões sem histórico ficam de fora.
    if (f.performance && st.reviews === 0) return false
    if (f.history === 'most_wrong' && st.wrong === 0) return false
    if (f.history === 'recent_wrong' && st.recentWrong === 0) return false
    if (f.history === 'most_reviewed' && st.reviews === 0) return false
    if (f.createdFrom && createdDate(c) < f.createdFrom) return false
    if (f.createdTo && createdDate(c) > f.createdTo) return false
    return true
  })
}

function comparators(f, today) {
  const S = (c) => cardStats(c, today)
  const list = []
  if (f.performance === 'high_error') list.push((a, b) => S(b).errorRate - S(a).errorRate || S(b).wrong - S(a).wrong)
  if (f.performance === 'low_error') list.push((a, b) => S(a).errorRate - S(b).errorRate || S(b).reviews - S(a).reviews)
  if (f.performance === 'high_accuracy') list.push((a, b) => S(b).accuracy - S(a).accuracy || S(b).reviews - S(a).reviews)
  if (f.history === 'most_wrong') list.push((a, b) => S(b).wrong - S(a).wrong)
  if (f.history === 'recent_wrong') list.push((a, b) => S(b).recentWrong - S(a).recentWrong)
  if (f.history === 'most_reviewed') list.push((a, b) => S(b).reviews - S(a).reviews)
  // padrão: os mais "vencidos" primeiro, depois ordem de criação
  list.push((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.createdAt || '').localeCompare(b.createdAt || ''))
  return list
}

export function shuffle(list, rng = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Aplica filtros, ordena (ou embaralha) e limita. `limit` 0 = todos os resultados. */
export function buildSession(cards, f, { limit = 0, random = false, today, rng = Math.random }) {
  let out = applyFilters(cards, f, today)
  if (random) out = shuffle(out, rng)
  else {
    const cmps = comparators(f, today)
    out = [...out].sort((a, b) => { for (const c of cmps) { const r = c(a, b); if (r) return r } return 0 })
  }
  return limit > 0 ? out.slice(0, limit) : out
}
