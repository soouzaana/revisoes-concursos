import { addDays } from '../utils/date'

/** Intervalos (dias) a cada acerto consecutivo. */
export const INTERVALS = [1, 3, 7, 15, 30, 60, 120]
/** Cartão é "dominado" a partir deste nível (4 acertos seguidos). */
export const MASTERED_LEVEL = 4

export function newCardFields(today) {
  return { level: 0, intervalDays: 0, dueDate: today, lastReviewedDate: null, lapses: 0 }
}

/** Repetição espaçada simples. Errou: volta para o nível 0 e revisa no dia seguinte. */
export function applyFlashcardReview(card, correct, today) {
  if (correct) {
    const level = card.level + 1
    const intervalDays = INTERVALS[Math.min(level, INTERVALS.length) - 1]
    return { ...card, level, intervalDays, dueDate: addDays(today, intervalDays), lastReviewedDate: today }
  }
  return { ...card, level: 0, intervalDays: 1, dueDate: addDays(today, 1), lastReviewedDate: today, lapses: (card.lapses || 0) + 1 }
}

export const isDue = (card, today) => card.dueDate <= today
export const isMastered = (card) => card.level >= MASTERED_LEVEL
/** 'new' | 'learning' | 'mastered' */
export function masteryOf(card) {
  if (isMastered(card)) return 'mastered'
  return card.lastReviewedDate ? 'learning' : 'new'
}
export const MASTERY_LABEL = { new: 'Novo', learning: 'Aprendendo', mastered: 'Dominado' }
