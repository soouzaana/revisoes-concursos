/** Estatísticas calculadas somente a partir de registros reais. Lógica pura. */
import { addDays, monthKey, startOfWeek, formatDayMonth, formatMonthLabel, toDateStr } from '../utils/date'
import { pct } from '../utils/text'
import { getStudyDates } from './reviewEngine'
import { isMastered } from './flashcardEngine'

export function computeStats({ subjects, studies, questions, flashcards, logs }, today) {
  const qLogs = logs.filter((l) => l.kind === 'question')
  const correct = qLogs.filter((l) => l.correct).length
  const wrong = qLogs.length - correct
  const mastered = flashcards.filter(isMastered).length
  const fLogs = logs.filter((l) => l.kind === 'flashcard')

  const bySubject = subjects.map((s) => {
    const ql = qLogs.filter((l) => l.subjectId === s.id)
    const c = ql.filter((l) => l.correct).length
    const fl = flashcards.filter((f) => f.subjectId === s.id)
    return {
      subject: s,
      studies: studies.filter((x) => x.subjectId === s.id).length,
      questions: questions.filter((q) => q.subjectId === s.id).length,
      reviewed: ql.length, correct: c, wrong: ql.length - c, accuracy: pct(c, ql.length),
      cards: fl.length, cardsMastered: fl.filter(isMastered).length
    }
  })

  const studyDates = getStudyDates(studies)
  const bucket = (key) => ({ key, studiedDays: new Set(), studies: 0, correct: 0, wrong: 0, cards: 0 })
  const fill = (keyOf, keys) => {
    const map = new Map(keys.map((k) => [k, bucket(k)]))
    for (const s of studies) { const b = map.get(keyOf(s.date)); if (b) { b.studies++; b.studiedDays.add(s.date) } }
    for (const l of qLogs) { const b = map.get(keyOf(l.date)); if (b) l.correct ? b.correct++ : b.wrong++ }
    for (const l of fLogs) { const b = map.get(keyOf(l.date)); if (b) b.cards++ }
    return [...map.values()].map((b) => ({ ...b, studiedDays: b.studiedDays.size, accuracy: pct(b.correct, b.correct + b.wrong) }))
  }

  const thisWeek = startOfWeek(today)
  const weekKeys = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)))
  const weekly = fill(startOfWeek, weekKeys).map((b) => ({ ...b, label: formatDayMonth(b.key) }))

  const [y, m] = today.split('-').map(Number)
  const monthKeys = Array.from({ length: 6 }, (_, i) => monthKey(toDateStr(new Date(y, m - 1 - (5 - i), 1))))
  const monthly = fill(monthKey, monthKeys).map((b) => ({ ...b, label: formatMonthLabel(b.key) }))

  return {
    studiedDays: studyDates.length, studies: studies.length, questions: questions.length,
    reviewedCorrect: correct, reviewedWrong: wrong, reviewedTotal: qLogs.length, accuracy: pct(correct, qLogs.length),
    cards: flashcards.length, cardsMastered: mastered, cardsNotMastered: flashcards.length - mastered,
    cardReviews: fLogs.length, bySubject, weekly, monthly
  }
}
