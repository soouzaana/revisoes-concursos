/** Orquestra o motor de revisões com o IndexedDB. Toda escrita relevante é transacional. */
import { withTx } from '../database/db'
import { todayStr } from '../utils/date'
import { buildReviewContent, getStudyDates, planReviewChanges, reconcileCycles } from './reviewEngine'

let chain = Promise.resolve()

/** Sincroniza ciclos semanais e filas de revisão. Serializado para nunca criar duplicatas. */
export function syncReviews(today = todayStr()) {
  const run = chain.then(() => doSync(today))
  chain = run.catch(() => {})
  return run
}

async function doSync(today) {
  return withTx(['studies', 'cycles', 'reviews', 'reviewLog'], 'readwrite', async (s) => {
    const [studies, cycles, reviews] = await Promise.all([s.studies.getAll(), s.cycles.getAll(), s.reviews.getAll()])
    const nowIso = new Date().toISOString()
    const studyDates = getStudyDates(studies)

    const nextCycles = reconcileCycles(cycles, studyDates, nowIso, today)
    const prev = new Map(cycles.map((c) => [c.id, JSON.stringify(c)]))
    const nextIds = new Set(nextCycles.map((c) => c.id))
    for (const c of cycles) if (!nextIds.has(c.id)) await s.cycles.delete(c.id)
    for (const c of nextCycles) if (prev.get(c.id) !== JSON.stringify(c)) await s.cycles.put(c)

    const plan = planReviewChanges({ reviews, cycles: nextCycles, studyDates, today, nowIso })
    for (const r of plan.create) await s.reviews.add(r) // add: falha se já existir -> nunca sobrescreve
    for (const id of plan.remove) {
      await s.reviews.delete(id)
      const keys = await s.reviewLog.index('reviewId').getAllKeys(id)
      for (const k of keys) await s.reviewLog.delete(k)
    }
    return { created: plan.create.length, removed: plan.remove.length }
  })
}

export async function startReview(reviewId) {
  return withTx(['reviews'], 'readwrite', async (s) => {
    const r = await s.reviews.get(reviewId)
    if (r && !r.completedAt && !r.startedAt) { r.startedAt = new Date().toISOString(); await s.reviews.put(r) }
    return r
  })
}

export async function recordQuestionAnswer({ reviewId, question, correct, today = todayStr() }) {
  const now = new Date().toISOString()
  return withTx(['reviews', 'reviewLog'], 'readwrite', async (s) => {
    const r = await s.reviews.get(reviewId)
    if (!r) throw new Error('Revisão não encontrada.')
    if (r.completedAt) throw new Error('Esta revisão já foi concluída.')
    if (!r.startedAt) { r.startedAt = now; await s.reviews.put(r) }
    const log = {
      id: `${reviewId}:${question.id}`, kind: 'question', reviewId, reviewType: r.type,
      itemId: question.id, subjectId: question.subjectId, correct: !!correct, date: today, at: now
    }
    await s.reviewLog.put(log) // id determinístico: responder de novo apenas atualiza
    return log
  })
}

/** Conclui a revisão (idempotente). Exige todas as questões respondidas e congela um snapshot. */
export async function completeReview(reviewId, today = todayStr()) {
  return withTx(['reviews', 'reviewLog', 'studies', 'questions'], 'readwrite', async (s) => {
    const r = await s.reviews.get(reviewId)
    if (!r) throw new Error('Revisão não encontrada.')
    if (r.completedAt) return r
    const [studies, questions, logs] = await Promise.all([s.studies.getAll(), s.questions.getAll(), s.reviewLog.index('reviewId').getAll(reviewId)])
    const content = buildReviewContent(r, { studies, questions, logs })
    if (!content.allAnswered) throw new Error('Responda todas as questões antes de concluir.')
    r.completedAt = new Date().toISOString()
    r.completedDate = today
    r.snapshot = {
      questionIds: content.questions.map((q) => q.id),
      topics: content.topics,
      total: content.total, correct: content.correct, wrong: content.wrong
    }
    await s.reviews.put(r)
    return r
  })
}
