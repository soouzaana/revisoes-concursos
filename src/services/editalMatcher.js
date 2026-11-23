/**
 * Cruzamento do edital com o histórico por COMPARAÇÃO TEXTUAL: normalização de acentos, palavras-chave,
 * similaridade, busca aproximada (Fuse.js) e um dicionário local editável de termos equivalentes.
 * Não é compreensão semântica de IA. O resultado são SUGESTÕES: nada é marcado como estudado sem confirmação.
 */
import Fuse from 'fuse.js'
import { keywords, norm, sameWord } from '../utils/text'

/** Dicionário inicial (editável pelo usuário em "Termos equivalentes"). Cada linha é um grupo de termos que significam o mesmo conteúdo. */
export const DEFAULT_SYNONYMS = [
  ['crase', 'sinal indicativo de crase', 'acento grave'],
  ['regência', 'regência verbal e nominal', 'regência verbal', 'regência nominal'],
  ['concordância', 'concordância verbal e nominal', 'concordância verbal', 'concordância nominal'],
  ['pontuação', 'emprego dos sinais de pontuação', 'sinais de pontuação'],
  ['interpretação de texto', 'compreensão e interpretação de textos', 'interpretação textual'],
  ['sistema operacional', 'sistemas operacionais', 'windows', 'linux'],
  ['segurança da informação', 'segurança digital', 'malware', 'vírus de computador'],
  ['remédios constitucionais', 'habeas corpus', 'mandado de segurança', 'habeas data'],
  ['atos administrativos', 'ato administrativo'],
  ['licitações', 'licitação', 'licitações e contratos'],
  ['direitos fundamentais', 'direitos e garantias fundamentais', 'direitos individuais e coletivos'],
  ['raciocínio lógico', 'lógica proposicional', 'proposições lógicas'],
  ['porcentagem', 'percentagem', 'razão e proporção'],
  ['princípios da administração pública', 'princípios administrativos', 'limpe', 'lindb']
]
const GENERIC = new Set(['direit', 'conceit', 'introduc', 'introdu', 'princip', 'geral', 'noc', 'nocoe', 'estud', 'teoria', 'norma', 'form', 'aspect'])
export const LEVELS = { exact: 'Correspondência exata', probable: 'Correspondência provável', partial: 'Correspondência parcial', none: 'Sem correspondência' }
export const LEVEL_RANK = { exact: 3, probable: 2, partial: 1, none: 0 }
export const levelOf = (s) => (s >= 0.98 ? 'exact' : s >= 0.75 ? 'probable' : s >= 0.4 ? 'partial' : 'none')

/** Linhas de texto "a = b = c" ⇄ grupos. */
export const parseSynonyms = (text) => text.split(/\r?\n/).map((l) => l.split(/\s*=\s*/).map((t) => t.trim()).filter(Boolean)).filter((g) => g.length >= 2)
export const stringifySynonyms = (groups) => groups.map((g) => g.join(' = ')).join('\n')

const prep = (groups) => groups.map((g) => g.map((t) => ` ${norm(t)} `))
/** Marcadores de equivalência presentes em um texto (ex.: "§3"). */
export function markers(text, prepared) {
  const n = ` ${norm(text).replace(/[^a-z0-9]+/g, ' ').trim()} `
  const out = new Set()
  prepared.forEach((g, i) => { if (g.some((p) => n.includes(p.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')))) out.add(i) })
  return out
}

/** Agrupa o histórico (estudos, questões, flashcards, revisões) em "conteúdos" por matéria e assunto. */
export function buildRecords({ studies = [], questions = [], flashcards = [], reviewedKeys = new Set(), nameOf = () => '' }) {
  const map = new Map()
  const add = (kind, item, dateField) => {
    const topic = (item.topic || '').trim(); if (!topic) return
    const key = `${item.subjectId}|${norm(topic)}`
    const r = map.get(key) || { key, subjectId: item.subjectId, subjectName: nameOf(item.subjectId), label: topic, norm: norm(topic), ids: { study: [], question: [], flashcard: [] }, labels: new Map(), lastDate: '' }
    r.ids[kind].push(item.id)
    r.labels.set(topic, (r.labels.get(topic) || 0) + 1)
    const d = item[dateField] || ''; if (d > r.lastDate) r.lastDate = d
    map.set(key, r)
  }
  for (const s of studies) add('study', s, 'date')
  for (const q of questions) add('question', q, 'date')
  for (const c of flashcards) add('flashcard', c, 'createdAt')
  return [...map.values()].map((r) => ({
    ...r, label: [...r.labels.entries()].sort((a, b) => b[1] - a[1])[0][0], labels: undefined,
    counts: { study: r.ids.study.length, question: r.ids.question.length, flashcard: r.ids.flashcard.length }, reviewed: reviewedKeys.has(r.key)
  }))
}

function pair(topicText, disciplineName, rec, prepared) {
  const T = keywords(topicText), R = keywords(rec.label)
  if (!T.length || !R.length) return { score: 0, reason: '' }
  const matchedR = R.filter((r) => T.some((t) => sameWord(r, t))).length
  const matchedT = T.filter((t) => R.some((r) => sameWord(r, t))).length
  const cR = matchedR / R.length, cT = matchedT / T.length
  let score = 0.65 * cR + 0.35 * cT, reason = ''
  const equal = cR === 1 && cT === 1
  if (cR === 1 && !equal) { score = Math.max(score, 0.8); reason = 'O registro está contido no texto do edital' }
  else if (cT === 1 && T.length >= 2 && !equal) { score = Math.max(score, 0.78); reason = 'O texto do edital está contido no registro' }
  else if (cT === 1 && !equal) { score = Math.max(score, 0.6); reason = 'Uma palavra em comum' }
  if (R.length === 1 && GENERIC.has(R[0])) score = Math.min(score, 0.6)
  const mT = markers(topicText, prepared), mR = markers(rec.label, prepared)
  const shared = [...mT].some((m) => mR.has(m))
  if (shared) { score = Math.max(score, 0.82); reason = 'Termos equivalentes (dicionário)' }
  // matéria parecida reforça; matéria diferente enfraquece
  const D = keywords(disciplineName || ''), S = keywords(rec.subjectName || '')
  const subjOk = D.length && S.length ? D.some((d) => S.some((s) => sameWord(d, s))) || [...markers(disciplineName, prepared)].some((m) => markers(rec.subjectName, prepared).has(m)) : null
  if (subjOk === true) score = Math.min(1, score + 0.04)
  if (subjOk === false) score = Math.max(0, score - 0.12)
  if (equal && subjOk !== false) { score = 1; reason = 'Mesmas palavras-chave' }
  else if (equal) { score = 0.9; reason = 'Mesmas palavras-chave, mas em outra matéria' }
  return { score, reason }
}

/**
 * topics: [{ id, text, disciplineName }]. Retorna Map(topicId → { level, score, candidates:[{ rec, score, level, reason }] }).
 * Nada aqui altera dados: são apenas sugestões para o usuário revisar.
 */
export function matchTopics(topics, records, { synonyms = DEFAULT_SYNONYMS } = {}) {
  const prepared = prep(synonyms)
  const fuse = new Fuse(records, { keys: ['norm'], includeScore: true, threshold: 0.3, ignoreLocation: true, minMatchCharLength: 3 })
  const out = new Map()
  for (const t of topics) {
    const scored = new Map()
    for (const rec of records) {
      const p = pair(t.text, t.disciplineName, rec, prepared)
      if (p.score >= 0.4) scored.set(rec.key, { rec, score: p.score, reason: p.reason })
    }
    // busca aproximada: tolera erros de digitação em termos que as regras acima não casaram
    for (const hit of fuse.search(norm(t.text), { limit: 5 })) {
      if (hit.score <= 0.3 && !scored.has(hit.item.key)) scored.set(hit.item.key, { rec: hit.item, score: 0.45, reason: 'Busca aproximada (texto parecido)' })
    }
    const candidates = [...scored.values()].map((c) => ({ ...c, level: levelOf(c.score) })).sort((a, b) => b.score - a.score).slice(0, 3)
    out.set(t.id, { level: candidates[0]?.level || 'none', score: candidates[0]?.score || 0, candidates })
  }
  return out
}

/** Busca tolerante a erros no histórico (para associar manualmente). */
export function searchRecords(records, query, limit = 20) {
  const q = norm(query).trim()
  if (!q) return records.slice(0, limit)
  const fuse = new Fuse(records, { keys: ['norm', 'subjectName'], threshold: 0.4, ignoreLocation: true })
  return fuse.search(q, { limit }).map((r) => r.item)
}
