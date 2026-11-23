export const norm = (s) => (s ?? '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
export const LETTERS = ['A', 'B', 'C', 'D', 'E']
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)
export const topicKey = (subjectId, topic) => `${subjectId}|${norm(topic)}`

// --- Comparação textual (usada no cruzamento edital × histórico). NÃO é IA: só normalização, palavras-chave e similaridade. ---
export const STOPWORDS = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'um', 'uma', 'uns', 'umas', 'ao', 'aos', 'que', 'se', 'sua', 'seu', 'ou', 'como', 'entre', 'sobre', 'sem', 'sob', 'ate', 'pelo', 'pela', 'pelos', 'pelas', 'art', 'lei', 'n', 'nº', 'no', 'ii', 'iii', 'etc'])
/** Radical aproximado (remove plural, sufixos comuns e vogal final). */
export function stem(w) {
  if (w.length <= 3) return w
  w = w.replace(/(coes|cao)$/, 'c').replace(/mente$/, '')
  w = w.replace(/(ais|eis|ois|uis)$/, (m) => ({ a: 'al', e: 'el', o: 'ol', u: 'ul' })[m[0]])
  w = w.replace(/(es|s)$/, '')
  return w.length > 4 ? w.replace(/[aeo]$/, '') : w
}
/** Palavras-chave normalizadas (sem acento, sem palavras vazias, em radical). */
export const keywords = (s) => norm(s).split(/[^a-z0-9]+/).filter((t) => t && !STOPWORDS.has(t) && !/^\d+$/.test(t)).map(stem).filter((t) => t.length > 1)
/** Duas palavras equivalentes: iguais ou com prefixo comum longo (concordância ≈ concordar). */
export function sameWord(a, b) {
  if (a === b) return true
  const m = Math.min(a.length, b.length)
  if (m < 5) return false
  let i = 0
  while (i < m && a[i] === b[i]) i++
  return i >= 6 || i >= m - 1
}
