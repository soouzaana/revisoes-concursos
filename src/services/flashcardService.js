import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { todayStr } from '../utils/date'
import { applyFlashcardReview } from './flashcardEngine'

/** Avalia um cartão: atualiza o agendamento e grava o histórico na mesma transação. */
/** `mode`: 'scheduled' (revisão programada) ou 'free' (estudo livre). Nunca altera revisões diárias/semanais. */
export async function reviewFlashcard(cardId, correct, today = todayStr(), mode = 'scheduled') {
  return withTx(['flashcards', 'reviewLog'], 'readwrite', async (s) => {
    const card = await s.flashcards.get(cardId)
    if (!card) throw new Error('Cartão não encontrado.')
    const next = applyFlashcardReview(card, correct, today, mode)
    await s.flashcards.put(next)
    await s.reviewLog.put({
      id: uid(), kind: 'flashcard', reviewId: null, itemId: card.id, subjectId: card.subjectId,
      correct: !!correct, mode, date: today, at: new Date().toISOString(), levelBefore: card.level, levelAfter: next.level, nextDue: next.dueDate
    })
    return next
  })
}

/** Cartões criados antes do histórico por cartão: reconstrói `history` a partir do reviewLog (uma única vez). */
export async function backfillCardHistory() {
  return withTx(['flashcards', 'reviewLog'], 'readwrite', async (s) => {
    const cards = await s.flashcards.getAll()
    const missing = cards.filter((c) => !Array.isArray(c.history))
    if (!missing.length) return 0
    const logs = (await s.reviewLog.getAll()).filter((l) => l.kind === 'flashcard')
    for (const c of missing) {
      const history = logs.filter((l) => l.itemId === c.id).sort((a, b) => a.at.localeCompare(b.at))
        .map((l) => ({ date: l.date, at: l.at, correct: !!l.correct, mode: l.mode || 'scheduled' }))
      await s.flashcards.put({ ...c, history })
    }
    return missing.length
  })
}
