import { addDays, diffDays } from '../utils/date'

/** Intervalos (dias) a cada acerto consecutivo. */
export const INTERVALS = [1, 3, 7, 15, 30, 60, 120]
/** Cartão é "dominado" a partir deste nível (4 acertos seguidos). */
export const MASTERED_LEVEL = 4

export function newCardFields(today) {
  return { level: 0, intervalDays: 0, dueDate: today, lastReviewedDate: null, lapses: 0, history: [] }
}

/** Janela (dias) usada em "errei recentemente". */
export const RECENT_DAYS = 14

/** Repetição espaçada simples. Errou: volta para o nível 0 e revisa no dia seguinte. */
export function applyFlashcardReview(card, correct, today, mode = 'scheduled', at = new Date().toISOString()) {
  const history = [...(card.history || []), { date: today, at, correct: !!correct, mode }]
  if (correct) {
    const level = card.level + 1
    const intervalDays = INTERVALS[Math.min(level, INTERVALS.length) - 1]
    return { ...card, level, intervalDays, dueDate: addDays(today, intervalDays), lastReviewedDate: today, history }
  }
  return { ...card, level: 0, intervalDays: 1, dueDate: addDays(today, 1), lastReviewedDate: today, lapses: (card.lapses || 0) + 1, history }
}

/** Estatísticas individuais, calculadas somente a partir do histórico real de respostas. */
export function cardStats(card, today = null) {
  const h = card.history || []
  const reviews = h.length
  const correct = h.filter((x) => x.correct).length
  const wrong = reviews - correct
  const recentWrong = today ? h.filter((x) => !x.correct && diffDays(x.date, today) <= RECENT_DAYS && diffDays(x.date, today) >= 0).length : 0
  return {
    reviews, correct, wrong, recentWrong,
    accuracy: reviews ? correct / reviews : null,
    errorRate: reviews ? wrong / reviews : null,
    lastReviewed: card.lastReviewedDate || null,
    nextDue: card.dueDate,
    level: card.level
  }
}

export const isDue = (card, today) => card.dueDate <= today
export const isMastered = (card) => card.level >= MASTERED_LEVEL
/** 'new' | 'learning' | 'mastered' */
export function masteryOf(card) {
  if (isMastered(card)) return 'mastered'
  return card.lastReviewedDate ? 'learning' : 'new'
}
export const MASTERY_LABEL = { new: 'Novo', learning: 'Aprendendo', mastered: 'Dominado' }
