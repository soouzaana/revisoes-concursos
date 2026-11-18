import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { deleteDatabase } from '../src/database/db'
import { getAll, putOne } from '../src/database/repository'
import { buildReviewContent, planReviewChanges, reconcileCycles, weeklyKey } from '../src/services/reviewEngine'
import { listTopics, makeScope, withTopicActive } from '../src/services/activityScope'
import { completeReview, recordQuestionAnswer, syncReviews } from '../src/services/reviewService'
import { buildBackup, restoreBackup } from '../src/services/backupService'
import { newCardFields } from '../src/services/flashcardEngine'
import { useSubjectsStore } from '../src/stores/subjects'
import { useSettingsStore } from '../src/stores/settings'
import { useActivityStore } from '../src/stores/activity'
import { useFlashcardsStore } from '../src/stores/flashcards'
import { useStudiesStore } from '../src/stores/studies'
import { useReviewsStore } from '../src/stores/reviews'
import { useQuestionsStore } from '../src/stores/questions'
import { addDays, todayStr } from '../src/utils/date'

// Ambiente de teste (node): simula o mínimo de navegador usado pelo settings store (tema).
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} })
globalThis.document = { documentElement: { setAttribute() {} }, querySelector: () => null }

const NOW = '2026-11-02T10:00:00.000Z'
const D = (n) => addDays('2026-10-01', n) // dias consecutivos
const days = (n, from = 0) => Array.from({ length: n }, (_, i) => D(from + i))
const st = (date, subjectId, topic) => ({ id: `st-${date}-${subjectId}-${topic}`, date, subjectId, topic, notes: '', createdAt: date })
const q = (id, date, subjectId, topic, extra = {}) => ({ id, date, subjectId, topic, statement: 'Q' + id, options: [], correctAnswer: 'x', explanation: '', status: 'open', createdAt: date + id, ...extra })

describe('frequência semanal configurável (motor)', () => {
  it('fecha o ciclo na quantidade configurada (3, 7, 10)', () => {
    for (const n of [3, 4, 5, 6, 7, 8, 10, 13]) {
      const c = reconcileCycles([], days(n), NOW, '2026-11-02', n)
      expect(c).toHaveLength(1); expect(c[0]).toMatchObject({ status: 'closed', size: n }); expect(c[0].days).toHaveLength(n)
      expect(reconcileCycles([], days(n - 1), NOW, '2026-11-02', n)[0].status).toBe('open')
    }
  })
  it('exemplo do enunciado: 5 dias e depois 7 — próximos ciclos usam 7, histórico intacto, sem duplicar', () => {
    let c = reconcileCycles([], days(5), NOW, D(5), 5)
    const cycle1 = JSON.stringify(c[0])
    const r1 = planReviewChanges({ reviews: [], cycles: c, studyDates: days(5), today: D(5), nowIso: NOW }).create.filter((r) => r.type === 'weekly')
    expect(r1.map((r) => r.id)).toEqual(['weekly:1'])

    // mudou para 7: 6 dias novos NÃO fecham; o 7º fecha
    c = reconcileCycles(c, days(11), NOW, D(11), 7)
    expect(c[0] && JSON.stringify(c[0])).toBe(cycle1) // ciclo 1 imutável
    expect(c[1]).toMatchObject({ number: 2, status: 'open' }); expect(c[1].days).toHaveLength(6)
    c = reconcileCycles(c, days(12), NOW, D(12), 7)
    expect(c[1]).toMatchObject({ number: 2, status: 'closed', size: 7 }); expect(c[1].days).toEqual(days(7, 5))
    const plan = planReviewChanges({ reviews: r1, cycles: c, studyDates: days(12), today: D(12), nowIso: NOW })
    expect(plan.create.filter((r) => r.type === 'weekly').map((r) => r.id)).toEqual(['weekly:2']) // weekly:1 não é recriada
    // reexecutar não muda nada (idempotente)
    expect(JSON.stringify(reconcileCycles(c, days(12), NOW, D(12), 7))).toBe(JSON.stringify(c))
  })
  it('mudar a frequência com ciclo aberto: aumenta (segue aberto) e diminui (fecha e libera)', () => {
    const open = reconcileCycles([], days(4), NOW, D(4), 5)
    expect(reconcileCycles(open, days(4), NOW, D(4), 7)[0]).toMatchObject({ status: 'open', number: 1 })
    const down = reconcileCycles(open, days(4), NOW, D(4), 3) // 4 dias, meta 3
    expect(down.map((c) => [c.number, c.status, c.days.length])).toEqual([[1, 'closed', 3], [2, 'open', 1]])
    const big = reconcileCycles(reconcileCycles([], days(9), NOW, D(9), 10), days(9), NOW, D(9), 3)
    expect(big.map((c) => c.status)).toEqual(['closed', 'closed', 'closed'])
  })
  it('só dias com estudo contam (dias sem registro e múltiplos registros no mesmo dia)', () => {
    const dates = [D(0), D(2), D(5), D(6), D(9)] // com buracos
    expect(reconcileCycles([], dates, NOW, D(9), 5)[0].status).toBe('closed')
  })
})

describe('escopo: matérias/assuntos ativos (motor)', () => {
  const subjects = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', active: false }, { id: 'c', name: 'C', active: true }]
  it('matéria sem o campo `active` (dados antigos) é ativa; assunto é por chave normalizada', () => {
    const sc = makeScope(subjects, [])
    expect(sc.isActive('a', 'X')).toBe(true); expect(sc.isActive('b', 'X')).toBe(false)
    const off = makeScope(subjects, withTopicActive([], 'c|redes de computadores', false))
    expect(off.isActive('c', 'Redes de Computadores')).toBe(false); expect(off.isActive('c', 'Linux')).toBe(true)
    expect(withTopicActive(withTopicActive([], 'k', false), 'k', true)).toEqual([])
  })
  it('listTopics agrega estudos, questões e cartões por assunto', () => {
    const t = listTopics('a', { studies: [st(D(0), 'a', 'Redes')], questions: [q('1', D(0), 'a', 'redes')], flashcards: [{ subjectId: 'a', topic: 'Linux' }, { subjectId: 'z', topic: 'Outro' }] })
    expect(t.map((x) => [x.topic, x.studies, x.questions, x.flashcards])).toEqual([['Linux', 0, 0, 1], ['Redes', 1, 1, 0]])
  })
  const review = { id: 'daily:x', type: 'daily', refDate: D(0) }
  const data = { studies: [st(D(0), 'a', 'Redes'), st(D(0), 'b', 'Hist'), st(D(0), 'c', 'Linux')], questions: [q('1', D(0), 'a', 'Redes'), q('2', D(0), 'b', 'Hist'), q('3', D(0), 'c', 'Linux')], logs: [] }
  it('exclui conteúdo de matéria inativa e de assunto inativo; preserva o que já foi respondido', () => {
    const sc = makeScope(subjects, ['c|linux'])
    const c = buildReviewContent(review, data, sc)
    expect(c.questions.map((x) => x.id)).toEqual(['1']); expect(c.topics.map((t) => t.topic)).toEqual(['Redes'])
    expect(c.hiddenCount).toBe(4); expect(c.inactiveOnly).toBe(false)
    const answered = buildReviewContent(review, { ...data, logs: [{ reviewId: 'daily:x', kind: 'question', itemId: '2', correct: true }] }, sc)
    expect(answered.questions.map((x) => x.id)).toEqual(['1', '2'])
  })
  it('revisão só com conteúdo inativo é sinalizada e, se aberta, mostra tudo', () => {
    const c = buildReviewContent(review, { ...data, studies: [data.studies[1]], questions: [data.questions[1]] }, makeScope(subjects, []))
    expect(c.inactiveOnly).toBe(true); expect(c.questions).toHaveLength(1)
  })
  it('sem escopo o comportamento antigo é mantido', () => {
    expect(buildReviewContent(review, data).questions).toHaveLength(3)
  })
  it('revisão concluída usa o snapshot (histórico não muda ao desativar)', () => {
    const done = { ...review, completedAt: NOW, snapshot: { questionIds: ['2'], topics: [{ subjectId: 'b', topic: 'Hist', dates: [D(0)], notes: [] }], total: 1, correct: 1, wrong: 0 } }
    const c = buildReviewContent(done, data, makeScope(subjects, []))
    expect(c.questions.map((x) => x.id)).toEqual(['2']); expect(c.inactiveOnly).toBe(false)
  })
})

describe('serviço: sincronização com frequência alterada e conclusão com escopo (IndexedDB)', () => {
  beforeEach(async () => { await deleteDatabase() })
  const seed = async (dates) => { for (const d of dates) await putOne('studies', st(d, 's1', 'T')) }

  it('mudar 5 → 7 não duplica nem descarta revisões; histórico preservado', async () => {
    await seed(days(5))
    await syncReviews(D(6))
    let reviews = await getAll('reviews')
    expect(reviews.filter((r) => r.type === 'weekly').map((r) => r.id)).toEqual([weeklyKey(1)])
    // conclui a semanal 1 e deixa as diárias pendentes
    await putOne('reviews', { ...reviews.find((r) => r.id === 'weekly:1'), completedAt: NOW, snapshot: { questionIds: [], topics: [], total: 0, correct: 0, wrong: 0 } })
    const pendingBefore = reviews.filter((r) => r.type === 'daily' && !r.completedAt).map((r) => r.id).sort()

    await putOne('settings', { key: 'weeklyCycleSize', value: 7 })
    await seed(days(6, 5)) // +6 dias (total 11)
    await syncReviews(D(12)); await syncReviews(D(12))
    reviews = await getAll('reviews')
    expect(reviews.filter((r) => r.type === 'weekly').map((r) => r.id)).toEqual(['weekly:1']) // 6 < 7: ainda não
    expect((await getAll('cycles')).map((c) => [c.number, c.status, c.days.length])).toEqual([[1, 'closed', 5], [2, 'open', 6]])
    await seed([D(11)])
    await syncReviews(D(13)); await syncReviews(D(13))
    reviews = await getAll('reviews')
    expect(reviews.filter((r) => r.type === 'weekly').map((r) => r.id).sort()).toEqual(['weekly:1', 'weekly:2'])
    expect(reviews.find((r) => r.id === 'weekly:1').completedAt).toBe(NOW) // concluída continua concluída
    for (const id of pendingBefore) expect(reviews.some((r) => r.id === id && !r.completedAt)).toBe(true) // pendentes não somem
    expect(new Set(reviews.map((r) => r.id)).size).toBe(reviews.length) // sem duplicatas
    const c2 = (await getAll('cycles')).find((c) => c.number === 2)
    expect(c2).toMatchObject({ status: 'closed', size: 7 })
  })

  it('reduzir a frequência libera a semanal se a nova meta já foi atingida', async () => {
    await seed(days(4)); await syncReviews(D(5))
    expect((await getAll('reviews')).some((r) => r.type === 'weekly')).toBe(false)
    await putOne('settings', { key: 'weeklyCycleSize', value: 3 }); await syncReviews(D(5))
    expect((await getAll('reviews')).filter((r) => r.type === 'weekly').map((r) => r.id)).toEqual(['weekly:1'])
  })

  it('concluir exige só as questões ativas; inativas ficam fora e dados são preservados', async () => {
    await putOne('subjects', { id: 's1', name: 'Ativa', color: '#000', active: true })
    await putOne('subjects', { id: 's2', name: 'Inativa', color: '#111', active: false })
    await putOne('studies', st(D(0), 's1', 'T')); await putOne('studies', st(D(0), 's2', 'U'))
    await putOne('questions', q('q1', D(0), 's1', 'T')); await putOne('questions', q('q2', D(0), 's2', 'U'))
    await syncReviews(D(1))
    await expect(completeReview('daily:' + D(0), D(1))).rejects.toThrow(/Responda/)
    await recordQuestionAnswer({ reviewId: 'daily:' + D(0), question: { id: 'q1', subjectId: 's1' }, correct: true, today: D(1) })
    const done = await completeReview('daily:' + D(0), D(1))
    expect(done.snapshot.questionIds).toEqual(['q1'])
    expect((await getAll('questions')).map((x) => x.id).sort()).toEqual(['q1', 'q2']) // nada apagado
    expect((await getAll('studies'))).toHaveLength(2)
  })

  it('configurações (frequência e assuntos inativos) vão no backup e voltam na restauração', async () => {
    await putOne('settings', { key: 'weeklyCycleSize', value: 8 }); await putOne('settings', { key: 'inactiveTopics', value: ['s1|linux'] })
    await putOne('subjects', { id: 's1', name: 'X', color: '#000', active: false })
    const backup = await buildBackup(); await deleteDatabase(); await restoreBackup(backup)
    const settings = Object.fromEntries((await getAll('settings')).map((r) => [r.key, r.value]))
    expect(settings.weeklyCycleSize).toBe(8); expect(settings.inactiveTopics).toEqual(['s1|linux'])
    expect((await getAll('subjects'))[0].active).toBe(false)
  })
})

describe('stores: desativar/reativar matéria e assunto, flashcards pendentes', () => {
  beforeEach(async () => { await deleteDatabase(); setActivePinia(createPinia()) })

  it('matéria inativa: sem flashcards pendentes na central, cartões seguem disponíveis; reativar continua de onde parou', async () => {
    const subjects = useSubjectsStore(), settings = useSettingsStore(), activity = useActivityStore(), cards = useFlashcardsStore()
    await settings.load(); await subjects.load()
    const info = await subjects.add('Informática'), port = await subjects.add('Português')
    await cards.load()
    await cards.save({ subjectId: info.id, topic: 'Redes', front: 'f1', back: 'b1' })
    await cards.save({ subjectId: info.id, topic: 'Linux', front: 'f2', back: 'b2' })
    await cards.save({ subjectId: port.id, topic: 'Crase', front: 'f3', back: 'b3' })
    expect(cards.due).toHaveLength(3)

    await activity.setSubjectActive(info.id, false) // desativa matéria
    expect(subjects.inactiveItems.map((s) => s.name)).toEqual(['Informática']); expect(subjects.activeItems.map((s) => s.name)).toEqual(['Português'])
    expect(cards.due.map((c) => c.front)).toEqual(['f3'])       // não acumula na central
    expect(cards.dueAll).toHaveLength(3); expect(cards.items).toHaveLength(3) // continuam acessíveis (estudo livre / busca)

    await activity.setSubjectActive(info.id, true) // reativa
    expect(cards.due).toHaveLength(3)

    await activity.setTopicActive(info.id, 'Linux', false) // assunto
    expect(cards.due.map((c) => c.front).sort()).toEqual(['f1', 'f3'])
    expect(activity.topicsOf(info.id).map((t) => [t.topic, t.active])).toEqual([['Linux', false], ['Redes', true]])
    await activity.setAllTopics(info.id, true)
    expect(cards.due).toHaveLength(3)
  })

  it('persistência: matéria inativa e assuntos inativos sobrevivem a recarregar tudo do IndexedDB', async () => {
    const subjects = useSubjectsStore(), settings = useSettingsStore(), activity = useActivityStore()
    await settings.load(); await subjects.load()
    const s = await subjects.add('Direito'); await activity.setSubjectActive(s.id, false); await activity.setTopicActive(s.id, 'Atos', false)
    await settings.setWeeklyCycleSize(6); await settings.setReviewsOnlyActive(false)
    setActivePinia(createPinia())
    const s2 = useSubjectsStore(), st2 = useSettingsStore(); await st2.load(); await s2.load()
    expect(s2.inactiveItems).toHaveLength(1); expect(st2.inactiveTopics).toEqual([`${s.id}|atos`])
    expect(st2.weeklyCycleSize).toBe(6); expect(st2.reviewsOnlyActive).toBe(false)
    await expect(st2.setWeeklyCycleSize(0)).rejects.toThrow(); await expect(st2.setWeeklyCycleSize(2.5)).rejects.toThrow()
  })

  it('revisões pendentes só das matérias ativas (store) e estudos/questões preservados', async () => {
    const subjects = useSubjectsStore(), settings = useSettingsStore(), activity = useActivityStore(), reviews = useReviewsStore(), studies = useStudiesStore(), questions = useQuestionsStore()
    await settings.load(); await subjects.load()
    const a = await subjects.add('A'), b = await subjects.add('B')
    const y = addDays(todayStr(), -1), y2 = addDays(todayStr(), -2)
    await putOne('studies', st(y, a.id, 'T')); await putOne('studies', st(y2, b.id, 'U'))
    await putOne('questions', q('qa', y, a.id, 'T')); await putOne('questions', q('qb', y2, b.id, 'U'))
    await Promise.all([studies.load(), questions.load()]); await reviews.sync()
    expect(reviews.dailyPendingActive).toHaveLength(2)
    await activity.setSubjectActive(b.id, false)
    expect(reviews.dailyPending).toHaveLength(2)              // a revisão continua existindo (nada é apagado)
    expect(reviews.dailyPendingActive.map((r) => r.refDate)).toEqual([y]) // mas só a ativa conta como pendente
    expect(reviews.dailyPending.find((r) => r.refDate === y2).content.inactiveOnly).toBe(true)
    await activity.setSubjectActive(b.id, true)
    expect(reviews.dailyPendingActive).toHaveLength(2)        // reativou: continua de onde parou
  })
})
