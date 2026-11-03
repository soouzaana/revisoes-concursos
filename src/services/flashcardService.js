import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { todayStr } from '../utils/date'
import { applyFlashcardReview } from './flashcardEngine'

/** Avalia um cartão: atualiza o agendamento e grava o histórico na mesma transação. */
export async function reviewFlashcard(cardId, correct, today = todayStr()) {
  return withTx(['flashcards', 'reviewLog'], 'readwrite', async (s) => {
    const card = await s.flashcards.get(cardId)
    if (!card) throw new Error('Cartão não encontrado.')
    const next = applyFlashcardReview(card, correct, today)
    await s.flashcards.put(next)
    await s.reviewLog.put({
      id: uid(), kind: 'flashcard', reviewId: null, itemId: card.id, subjectId: card.subjectId,
      correct: !!correct, date: today, at: new Date().toISOString(), levelBefore: card.level, levelAfter: next.level, nextDue: next.dueDate
    })
    return next
  })
}
