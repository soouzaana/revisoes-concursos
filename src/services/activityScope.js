/**
 * Escopo de revisão: quais matérias e assuntos participam das revisões automáticas.
 * Lógica pura. "Inativo" nunca apaga dados — apenas tira o conteúdo das revisões automáticas.
 *  - Matéria: `subject.active === false` => inativa (ausência do campo = ativa, compatível com dados antigos).
 *  - Assunto: guardado como lista de chaves `matéria|assunto-normalizado` (apenas os desativados).
 */
import { norm, topicKey } from '../utils/text'

export const isSubjectActive = (subject) => subject?.active !== false

export function makeScope(subjects = [], inactiveTopicKeys = []) {
  const off = new Set(subjects.filter((s) => s.active === false).map((s) => s.id))
  const offTopics = new Set(inactiveTopicKeys)
  return {
    isSubjectActive: (subjectId) => !off.has(subjectId),
    /** Conteúdo (matéria + assunto) participa das revisões automáticas? */
    isActive: (subjectId, topic) => !off.has(subjectId) && !offTopics.has(topicKey(subjectId, topic || '')),
    isTopicActive: (subjectId, topic) => !offTopics.has(topicKey(subjectId, topic || ''))
  }
}

/** Assuntos distintos de uma matéria (estudos + questões + flashcards), com contagem de registros. */
export function listTopics(subjectId, { studies = [], questions = [], flashcards = [] }) {
  const map = new Map()
  const add = (topic, kind) => {
    if (!topic || !topic.trim()) return
    const key = topicKey(subjectId, topic)
    if (!map.has(key)) map.set(key, { key, topic: topic.trim(), studies: 0, questions: 0, flashcards: 0 })
    map.get(key)[kind]++
  }
  for (const s of studies) if (s.subjectId === subjectId) add(s.topic, 'studies')
  for (const q of questions) if (q.subjectId === subjectId) add(q.topic, 'questions')
  for (const f of flashcards) if (f.subjectId === subjectId) add(f.topic, 'flashcards')
  return [...map.values()].sort((a, b) => a.topic.localeCompare(b.topic, 'pt-BR'))
}

/** Lista nova de chaves desativadas após ativar/desativar um assunto (sem duplicar). */
export function withTopicActive(inactiveKeys, key, active) {
  const set = new Set(inactiveKeys)
  if (active) set.delete(key)
  else set.add(key)
  return [...set]
}

export { norm }
