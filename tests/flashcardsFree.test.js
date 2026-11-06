import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { deleteDatabase } from '../src/database/db'
import { getAll, putOne } from '../src/database/repository'
import { syncReviews, recordQuestionAnswer } from '../src/services/reviewService'
import { reviewFlashcard, backfillCardHistory } from '../src/services/flashcardService'
import { applyFlashcardReview, cardStats, newCardFields } from '../src/services/flashcardEngine'
import { applyFilters, buildSession, emptyFilters, PRESETS } from '../src/services/flashcardFilters'

const TODAY = '2026-11-06'
const card = (id, o = {}) => ({ id, subjectId: 's1', topic: 'Modelo OSI', front: id, back: 'b', createdAt: '2026-11-01T10:00:00Z', ...newCardFields('2026-11-01'), ...o })
const hist = (...answers) => answers.map(([date, correct]) => ({ date, at: date + 'T10:00:00Z', correct, mode: 'scheduled' }))
const F = (o = {}) => ({ ...emptyFilters(), ...o })

describe('estatísticas individuais (histórico real)', () => {
  it('calcula revisões, acertos, erros e taxas a partir do histórico', () => {
    const c = card('a', { history: hist(['2026-11-01', false], ['2026-11-02', true], ['2026-11-03', true], ['2026-11-04', false]) })
    const s = cardStats(c, TODAY)
    expect([s.reviews, s.correct, s.wrong]).toEqual([4, 2, 2])
    expect(s.accuracy).toBe(0.5); expect(s.errorRate).toBe(0.5)
    expect(cardStats(card('n'), TODAY).errorRate).toBeNull()
  })
  it('aplicar revisão acrescenta ao histórico (modo registrado) e reagenda', () => {
    const r = applyFlashcardReview(card('a'), false, TODAY, 'free')
    expect(r.history).toHaveLength(1); expect(r.history[0]).toMatchObject({ correct: false, mode: 'free', date: TODAY })
    expect(r.dueDate).toBe('2026-11-07'); expect(r.lastReviewedDate).toBe(TODAY)
  })
})

describe('filtros combináveis', () => {
  const cards = [
    card('osi-ruim', { topic: 'Modelo OSI', history: hist(['2026-11-01', false], ['2026-11-02', false], ['2026-11-03', true]) }),
    card('osi-bom', { topic: 'Modelo OSI', history: hist(['2026-11-01', true], ['2026-11-02', true]), level: 4 }),
    card('osi-novo', { topic: 'Modelo OSI' }),
    card('tcp', { topic: 'TCP/IP', history: hist(['2026-11-02', false]) }),
    card('port', { subjectId: 's2', topic: 'Crase', createdAt: '2026-10-10T10:00:00Z', history: hist(['2026-10-12', false]) })
  ]
  const ids = (l) => l.map((c) => c.id)

  it('Informática + Modelo OSI + maior taxa de erros', () => {
    const out = buildSession(cards, F({ subjectIds: ['s1'], topics: ['Modelo OSI'], performance: 'high_error' }), { today: TODAY })
    expect(ids(out)).toEqual(['osi-ruim', 'osi-bom'])  // osi-novo (sem histórico) fica de fora
  })
  it('menor taxa de erros e maior taxa de acertos', () => {
    expect(ids(buildSession(cards, F({ subjectIds: ['s1'], performance: 'low_error' }), { today: TODAY }))[0]).toBe('osi-bom')
    expect(ids(buildSession(cards, F({ performance: 'high_accuracy' }), { today: TODAY }))[0]).toBe('osi-bom')
  })
  it('domínio: dominados, não dominados e nunca revisados', () => {
    expect(ids(applyFilters(cards, F({ mastery: 'mastered' }), TODAY))).toEqual(['osi-bom'])
    expect(applyFilters(cards, F({ mastery: 'not_mastered' }), TODAY)).toHaveLength(4)
    expect(ids(applyFilters(cards, F({ mastery: 'never' }), TODAY))).toEqual(['osi-novo'])
  })
  it('histórico: mais errados, erros recentes (14 dias) e mais revisados', () => {
    expect(ids(buildSession(cards, F({ history: 'most_wrong' }), { today: TODAY }))[0]).toBe('osi-ruim')
    expect(ids(applyFilters(cards, F({ history: 'recent_wrong' }), TODAY))).not.toContain('port') // erro antigo
    expect(ids(buildSession(cards, F({ history: 'most_reviewed' }), { today: TODAY }))[0]).toBe('osi-ruim')
  })
  it('data de cadastro', () => {
    expect(ids(applyFilters(cards, F({ createdTo: '2026-10-31' }), TODAY))).toEqual(['port'])
    expect(applyFilters(cards, F({ createdFrom: '2026-11-01' }), TODAY)).toHaveLength(4)
  })
  it('quantidade, aleatório e atalhos', () => {
    expect(buildSession(cards, F(), { limit: 2, today: TODAY })).toHaveLength(2)
    const r = buildSession(cards, F(), { random: true, limit: 3, today: TODAY, rng: () => 0.1 })
    expect(r).toHaveLength(3)
    const errs = PRESETS.find((p) => p.id === 'errors')
    expect(ids(applyFilters(cards, F(errs.filters), TODAY))).toEqual(['osi-ruim', 'tcp', 'port'])
    expect(PRESETS.map((p) => p.id)).toEqual(['all', 'errors', 'not_mastered', 'never', 'hardest', 'random'])
  })
})

describe('estudo livre × revisões do caderno de erros', () => {
  beforeEach(async () => {
    await deleteDatabase()
    await putOne('subjects', { id: 's1', name: 'Informática', color: '#2b4acb' })
  })

  it('cartão não pendente pode ser estudado; atualiza histórico/SRS e não toca nas revisões diárias', async () => {
    await putOne('studies', { id: 'st', date: '2026-11-05', subjectId: 's1', topic: 'OSI', notes: '', createdAt: 'x' })
    await putOne('questions', { id: 'q1', date: '2026-11-05', subjectId: 's1', topic: 'OSI', statement: 'Q', options: [], correctAnswer: 'x', status: 'not_mastered', createdAt: 'q' })
    await syncReviews(TODAY)
    const before = await getAll('reviews')
    expect(before.map((r) => r.id)).toEqual(['daily:2026-11-05'])

    await putOne('flashcards', card('c1', { dueDate: '2026-12-31' })) // longe de vencer
    await reviewFlashcard('c1', true, TODAY, 'free')
    await reviewFlashcard('c1', false, TODAY, 'free') // quantas vezes quiser, no mesmo dia
    const [c] = await getAll('flashcards')
    expect(c.history.map((h) => [h.correct, h.mode])).toEqual([[true, 'free'], [false, 'free']])
    expect(c.dueDate).toBe('2026-11-07')

    const after = await getAll('reviews')
    expect(after).toEqual(before)                         // revisão diária intacta
    expect(after[0].completedAt ?? null).toBeNull()
    const logs = await getAll('reviewLog')
    expect(logs.every((l) => l.kind === 'flashcard' && l.mode === 'free' && l.reviewId === null)).toBe(true)
    // e a revisão do caderno continua utilizável normalmente
    await recordQuestionAnswer({ reviewId: 'daily:2026-11-05', question: { id: 'q1', subjectId: 's1' }, correct: true, today: TODAY })
  })

  it('cartões antigos (sem history) são reconstruídos a partir do reviewLog', async () => {
    const { history, ...legacy } = card('old')
    await putOne('flashcards', legacy)
    await putOne('reviewLog', { id: 'l1', kind: 'flashcard', itemId: 'old', reviewId: null, correct: false, date: '2026-11-02', at: '2026-11-02T10:00:00Z' })
    await putOne('reviewLog', { id: 'l2', kind: 'flashcard', itemId: 'old', reviewId: null, correct: true, date: '2026-11-03', at: '2026-11-03T10:00:00Z' })
    expect(await backfillCardHistory()).toBe(1)
    const [c] = await getAll('flashcards')
    expect(cardStats(c, TODAY)).toMatchObject({ reviews: 2, correct: 1, wrong: 1 })
    expect(await backfillCardHistory()).toBe(0)
  })
})
