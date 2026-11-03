import { describe, it, expect } from 'vitest'
import { reconcileCycles, planReviewChanges, getStudyDates, buildReviewContent, isOverdue, daysOverdue } from '../src/services/reviewEngine'
import { applyFlashcardReview, newCardFields, masteryOf } from '../src/services/flashcardEngine'
import { addDays, todayStr, toDateStr } from '../src/utils/date'

const st = (date, subjectId = 's1', topic = 'T') => ({ id: date + topic, date, subjectId, topic, createdAt: date })
const NOW = '2026-11-02T10:00:00.000Z'

describe('dias estudados', () => {
  it('vários registros no mesmo dia contam como UM dia', () => {
    expect(getStudyDates([st('2026-11-02', 's1', 'A'), st('2026-11-02', 's2', 'B'), st('2026-11-03')])).toEqual(['2026-11-02', '2026-11-03'])
  })
})

describe('ciclos semanais (5 dias estudados)', () => {
  const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']
  it('4 dias: ciclo aberto, sem revisão semanal', () => {
    const c = reconcileCycles([], days.slice(0, 4), NOW, '2026-11-05')
    expect(c).toHaveLength(1); expect(c[0].status).toBe('open'); expect(c[0].days).toHaveLength(4)
    const plan = planReviewChanges({ reviews: [], cycles: c, studyDates: days.slice(0, 4), today: '2026-11-05', nowIso: NOW })
    expect(plan.create.some((r) => r.type === 'weekly')).toBe(false)
  })
  it('5º dia fecha o ciclo e libera a semanal; o 6º abre novo ciclo', () => {
    let c = reconcileCycles([], days, NOW, '2026-11-06')
    expect(c[0].status).toBe('closed'); expect(c[0].number).toBe(1)
    const plan = planReviewChanges({ reviews: [], cycles: c, studyDates: days, today: '2026-11-06', nowIso: NOW })
    const w = plan.create.filter((r) => r.type === 'weekly')
    expect(w).toHaveLength(1); expect(w[0].id).toBe('weekly:1'); expect(w[0].days).toEqual(days)
    c = reconcileCycles(c, [...days, '2026-11-09'], NOW, '2026-11-09')
    expect(c).toHaveLength(2); expect(c[1].number).toBe(2); expect(c[1].status).toBe('open'); expect(c[1].days).toEqual(['2026-11-09'])
  })
  it('fins de semana e dias sem registro não contam (só importa quem tem registro)', () => {
    const sparse = ['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-12', '2026-11-20'] // saltos e fins de semana
    const c = reconcileCycles([], sparse, NOW, '2026-11-20')
    expect(c[0].status).toBe('closed')
  })
  it('é idempotente: reconciliar de novo não altera nem duplica', () => {
    const c1 = reconcileCycles([], days, NOW, '2026-11-06')
    const c2 = reconcileCycles(c1, days, '2030-01-01T00:00:00Z', '2030-01-01')
    expect(c2).toEqual(c1)
    const p1 = planReviewChanges({ reviews: [], cycles: c1, studyDates: days, today: '2026-11-06', nowIso: NOW })
    const existing = p1.create
    const p2 = planReviewChanges({ reviews: existing, cycles: c1, studyDates: days, today: '2026-11-06', nowIso: NOW })
    expect(p2.create).toHaveLength(0)
  })
  it('ciclo fechado não muda se um dia antigo for apagado; ciclo aberto perde o dia', () => {
    const closed = reconcileCycles([], days, NOW, '2026-11-06')
    const after = reconcileCycles(closed, days.slice(1), NOW, '2026-11-07')
    expect(after[0].days).toEqual(days)
    const open = reconcileCycles([], days.slice(0, 3), NOW, '2026-11-04')
    expect(reconcileCycles(open, days.slice(0, 2), NOW, '2026-11-04')[0].days).toHaveLength(2)
  })
  it('importação de 12 dias de uma vez gera 2 ciclos fechados + 1 aberto', () => {
    const many = Array.from({ length: 12 }, (_, i) => addDays('2026-10-01', i))
    const c = reconcileCycles([], many, NOW, '2026-11-02')
    expect(c.map((x) => [x.number, x.status, x.days.length])).toEqual([[1, 'closed', 5], [2, 'closed', 5], [3, 'open', 2]])
  })
})

describe('revisão diária D+1', () => {
  it('só libera a revisão de D quando hoje > D', () => {
    const studyDates = ['2026-11-02']
    expect(planReviewChanges({ reviews: [], cycles: [], studyDates, today: '2026-11-02', nowIso: NOW }).create).toHaveLength(0)
    const next = planReviewChanges({ reviews: [], cycles: [], studyDates, today: '2026-11-03', nowIso: NOW }).create
    expect(next).toHaveLength(1); expect(next[0].id).toBe('daily:2026-11-02')
  })
  it('revisão atrasada continua pendente e indicada como atrasada', () => {
    const r = planReviewChanges({ reviews: [], cycles: [], studyDates: ['2026-11-02'], today: '2026-11-06', nowIso: NOW }).create[0]
    expect(isOverdue(r, '2026-11-06')).toBe(true); expect(daysOverdue(r, '2026-11-06')).toBe(3)
    expect(isOverdue(r, '2026-11-03')).toBe(false)
  })
  it('não duplica nem remove revisão concluída', () => {
    const done = { id: 'daily:2026-11-02', type: 'daily', refDate: '2026-11-02', completedAt: NOW }
    const p = planReviewChanges({ reviews: [done], cycles: [], studyDates: [], today: '2026-11-10', nowIso: NOW })
    expect(p.create).toHaveLength(0); expect(p.remove).toHaveLength(0)
  })
  it('sexta -> segunda: revisão de sexta aparece na segunda', () => {
    const p = planReviewChanges({ reviews: [], cycles: [], studyDates: ['2026-11-06'], today: '2026-11-09', nowIso: NOW })
    expect(p.create[0].refDate).toBe('2026-11-06')
  })
})

describe('conteúdo da revisão', () => {
  const q = (id, date, status = 'not_mastered') => ({ id, date, subjectId: 's1', topic: 'T', status, createdAt: id })
  it('diária reúne questões do dia; semanal reúne as dos 5 dias', () => {
    const questions = [q('a', '2026-11-02'), q('b', '2026-11-03'), q('c', '2026-11-09')]
    const daily = { id: 'daily:2026-11-02', type: 'daily', refDate: '2026-11-02' }
    expect(buildReviewContent(daily, { studies: [st('2026-11-02')], questions, logs: [] }).questions.map((x) => x.id)).toEqual(['a'])
    const weekly = { id: 'weekly:1', type: 'weekly', days: ['2026-11-02', '2026-11-03'] }
    expect(buildReviewContent(weekly, { studies: [], questions, logs: [] }).questions.map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('progresso conta respostas; dominadas já respondidas continuam contando', () => {
    const questions = [q('a', '2026-11-02'), q('b', '2026-11-02', 'mastered')]
    const rev = { id: 'daily:2026-11-02', type: 'daily', refDate: '2026-11-02' }
    let c = buildReviewContent(rev, { studies: [], questions, logs: [] })
    expect(c.total).toBe(1)
    const logs = [{ reviewId: rev.id, kind: 'question', itemId: 'b', correct: true }]
    c = buildReviewContent(rev, { studies: [], questions, logs })
    expect(c.total).toBe(2); expect(c.answered).toBe(1); expect(c.progress).toBe(50)
  })
})

describe('flashcards (repetição espaçada)', () => {
  it('acerto aumenta o intervalo progressivamente; erro volta para amanhã', () => {
    let c = { id: 'x', ...newCardFields('2026-11-02') }
    const seq = []
    let day = '2026-11-02'
    for (let i = 0; i < 5; i++) { c = applyFlashcardReview(c, true, day); seq.push(c.intervalDays); day = c.dueDate }
    expect(seq).toEqual([1, 3, 7, 15, 30])
    expect(masteryOf(c)).toBe('mastered')
    c = applyFlashcardReview(c, false, '2026-12-01')
    expect(c.level).toBe(0); expect(c.dueDate).toBe('2026-12-02'); expect(masteryOf(c)).toBe('learning')
  })
})

describe('datas locais', () => {
  it('toDateStr usa o fuso local', () => {
    expect(toDateStr(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02')
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
