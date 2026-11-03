import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDatabase, withTx } from '../src/database/db'
import { getAll, putOne } from '../src/database/repository'
import { syncReviews, recordQuestionAnswer, completeReview } from '../src/services/reviewService'
import { reviewFlashcard } from '../src/services/flashcardService'
import { buildBackup, restoreBackup, validateBackup } from '../src/services/backupService'
import { newCardFields } from '../src/services/flashcardEngine'

const study = (date, id = date) => ({ id, date, subjectId: 's1', topic: 'Modelo OSI', notes: '', createdAt: date })
const question = (id, date) => ({ id, date, subjectId: 's1', topic: 'Modelo OSI', statement: 'Q?', options: [], correctAnswer: 'x', status: 'not_mastered', createdAt: id })

beforeEach(async () => {
  await deleteDatabase()
  await putOne('subjects', { id: 's1', name: 'Informática', color: '#2b4acb' })
})

describe('fluxo completo com IndexedDB', () => {
  it('diária: segunda registra, terça aparece; concluir; sync não duplica nem reabre', async () => {
    await putOne('studies', study('2026-11-02'))
    await putOne('questions', question('q1', '2026-11-02'))
    await syncReviews('2026-11-02')
    expect(await getAll('reviews')).toHaveLength(0)
    await syncReviews('2026-11-03')
    await syncReviews('2026-11-03') // repetido
    await Promise.all([syncReviews('2026-11-03'), syncReviews('2026-11-03')]) // concorrente
    let reviews = await getAll('reviews')
    expect(reviews.map((r) => r.id)).toEqual(['daily:2026-11-02'])

    await expect(completeReview('daily:2026-11-02')).rejects.toThrow(/Responda todas/)
    await recordQuestionAnswer({ reviewId: 'daily:2026-11-02', question: question('q1', '2026-11-02'), correct: false, today: '2026-11-03' })
    await recordQuestionAnswer({ reviewId: 'daily:2026-11-02', question: question('q1', '2026-11-02'), correct: true, today: '2026-11-03' }) // corrige
    expect(await getAll('reviewLog')).toHaveLength(1)
    const done = await completeReview('daily:2026-11-02', '2026-11-03')
    expect(done.snapshot.correct).toBe(1)
    await syncReviews('2026-11-20')
    reviews = await getAll('reviews')
    expect(reviews).toHaveLength(1); expect(reviews[0].completedAt).toBeTruthy()
    await expect(recordQuestionAnswer({ reviewId: 'daily:2026-11-02', question: question('q1', '2026-11-02'), correct: true })).rejects.toThrow(/concluída/)
  })

  it('semanal: 5 dias estudados liberam weekly:1 com as questões dos 5 dias; novo ciclo depois', async () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']
    for (const [i, d] of days.entries()) {
      await putOne('studies', study(d)); await putOne('studies', study(d, d + 'b')) // 2 registros/dia
      await putOne('questions', question('q' + i, d))
      await syncReviews(d)
      const weekly = (await getAll('reviews')).filter((r) => r.type === 'weekly')
      expect(weekly).toHaveLength(i === 4 ? 1 : 0)
    }
    const cycles = await getAll('cycles')
    expect(cycles).toHaveLength(1); expect(cycles[0].status).toBe('closed')
    await putOne('studies', study('2026-11-09'))
    await syncReviews('2026-11-09')
    const c2 = (await getAll('cycles')).sort((a, b) => a.number - b.number)
    expect(c2.map((c) => c.status)).toEqual(['closed', 'open'])
    expect((await getAll('reviews')).filter((r) => r.type === 'weekly')).toHaveLength(1)
  })

  it('apagar todos os estudos de um dia remove a diária pendente, mas preserva concluídas', async () => {
    await putOne('studies', study('2026-11-02')); await putOne('studies', study('2026-11-03'))
    await syncReviews('2026-11-05')
    expect(await getAll('reviews')).toHaveLength(2)
    await completeReview('daily:2026-11-02', '2026-11-05')
    await withTx(['studies'], 'readwrite', async (s) => { await s.studies.delete('2026-11-02'); await s.studies.delete('2026-11-03') })
    await syncReviews('2026-11-05')
    expect((await getAll('reviews')).map((r) => r.id)).toEqual(['daily:2026-11-02'])
  })

  it('flashcard: grava histórico e reagenda', async () => {
    await putOne('flashcards', { id: 'f1', subjectId: 's1', topic: 'T', front: 'a', back: 'b', createdAt: 'x', ...newCardFields('2026-11-02') })
    const c = await reviewFlashcard('f1', true, '2026-11-02')
    expect(c.dueDate).toBe('2026-11-03')
    const logs = await getAll('reviewLog')
    expect(logs).toHaveLength(1); expect(logs[0].kind).toBe('flashcard')
  })

  it('backup: exporta, valida, restaura e rejeita arquivos inválidos', async () => {
    await putOne('studies', study('2026-11-02')); await putOne('questions', question('q1', '2026-11-02'))
    await syncReviews('2026-11-03')
    const backup = JSON.parse(JSON.stringify(await buildBackup()))
    await deleteDatabase()
    const counts = await restoreBackup(backup)
    expect(counts.studies).toBe(1); expect(counts.reviews).toBe(1)
    expect(await getAll('questions')).toHaveLength(1)
    expect(() => validateBackup({ app: 'x' })).toThrow()
    expect(() => validateBackup({ app: 'revisoes-concursos', version: 1, data: { subjects: 'no' } })).toThrow()
    expect(() => validateBackup(null)).toThrow()
  })
})
