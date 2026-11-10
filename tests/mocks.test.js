import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { deleteDatabase, getDB } from '../src/database/db'
import { getAll, putOne } from '../src/database/repository'
import { buildBackup, restoreBackup } from '../src/services/backupService'
import {
  comparePeriods, filterExams, frequencyHistory, getSchedule, mockOverview, monthlyAverages, normalizeEntry, overallSeries,
  restrictToSubject, seriesSummary, subjectRanking, subjectSeries, validateMockExam
} from '../src/services/mockEngine'

const ex = (id, date, subs, o = {}) => ({ id, name: id, date, contest: '', board: '', notes: '', createdAt: date, subjects: subs, ...o })
const S = (subjectId, total, correct, wrong = total - correct, blank = total - correct - wrong) => ({ subjectId, total, correct, wrong, blank })

describe('cadastro: consistência de acertos/erros/em branco', () => {
  it('calcula em branco quando só acertos e erros são informados', () => {
    expect(normalizeEntry({ total: 10, correct: 7, wrong: 2, blank: '' }).value).toEqual({ total: 10, correct: 7, wrong: 2, blank: 1 })
  })
  it('exige que a soma feche com o total e rejeita excesso', () => {
    expect(normalizeEntry({ total: 10, correct: 7, wrong: 2, blank: 2 }).errors.blank).toMatch(/soma/)
    expect(normalizeEntry({ total: 10, correct: 8, wrong: 5, blank: '' }).errors.correct).toMatch(/excedem/)
    expect(normalizeEntry({ total: '', correct: 1, wrong: 0 }).ok).toBe(false)
    expect(normalizeEntry({ total: 10, correct: 7, wrong: 2, blank: 1 }).ok).toBe(true)
  })
  it('valida simulado: nome, data futura, matéria repetida e ao menos uma matéria', () => {
    const base = { name: 'S1', date: '2026-11-09', subjects: [{ subjectId: 'a', total: 10, correct: 5, wrong: 5, blank: '' }] }
    expect(validateMockExam(base, '2026-11-10').valid).toBe(true)
    expect(validateMockExam({ ...base, name: ' ' }, '2026-11-10').errors.name).toBeTruthy()
    expect(validateMockExam({ ...base, date: '2026-12-01' }, '2026-11-10').errors.date).toMatch(/futuro/)
    expect(validateMockExam({ ...base, subjects: [] }, '2026-11-10').errors.subjects).toBeTruthy()
    const dup = validateMockExam({ ...base, subjects: [base.subjects[0], base.subjects[0]] }, '2026-11-10')
    expect(dup.errors.rows[1].subjectId).toMatch(/repetida/)
  })
})

describe('totais, séries e matérias ausentes', () => {
  // exemplo do enunciado
  const pcro = ex('PCRO', '2026-11-09', [S('ce', 50, 40, 10), S('lp', 10, 8, 2), S('inf', 10, 7, 2), S('rl', 10, 6, 3)])
  it('totais gerais do exemplo do enunciado', () => {
    const [p] = overallSeries([pcro])
    expect([p.total, p.correct, p.wrong, p.blank]).toEqual([80, 61, 17, 2])
    expect(Math.round(p.pct * 100) / 100).toBe(76.25)
  })
  const exams = [
    ex('s1', '2026-08-01', [S('ce', 50, 30), S('lp', 10, 5)]),
    ex('s2', '2026-09-01', [S('ce', 50, 35)]),                 // sem Português: não conta como zero
    ex('s3', '2026-10-01', [S('ce', 50, 38), S('lp', 10, 7)]),
    ex('s4', '2026-11-01', [S('ce', 50, 40), S('lp', 10, 8)])
  ]
  it('evolução por matéria: ausência ≠ zero, melhor/pior/média/delta/tendência', () => {
    const lp = subjectSeries(exams, 'lp')
    expect(lp.map((p) => p.name)).toEqual(['s1', 's3', 's4'])
    const ce = seriesSummary(subjectSeries(exams, 'ce'))
    expect(ce.n).toBe(4); expect(ce.current).toBe(80); expect(ce.best.pct).toBe(80); expect(ce.worst.pct).toBe(60)
    expect(ce.avg).toBeCloseTo((60 + 70 + 76 + 80) / 4)
    expect(ce.delta).toBe(4); expect(ce.trend.kind).toBe('up'); expect(ce.stagnant).toBe(false)
  })
  it('detecta estagnação e queda', () => {
    const flat = seriesSummary([70, 71, 70, 71].map((pct) => ({ pct })))
    expect(flat.stagnant).toBe(true); expect(flat.trend.kind).toBe('flat')
    expect(seriesSummary([80, 70, 60].map((pct) => ({ pct }))).trend.kind).toBe('down')
    expect(seriesSummary([50].map((pct) => ({ pct }))).trend.kind).toBe('insufficient')
  })
  it('ranking de matérias e filtro por matéria', () => {
    const r = subjectRanking(exams)
    const ce = r.find((x) => x.subjectId === 'ce'), lp = r.find((x) => x.subjectId === 'lp')
    expect(ce.questions).toBe(200); expect(lp.questions).toBe(30); expect(lp.exams).toBe(3)
    expect(restrictToSubject(exams, 'lp')).toHaveLength(3)
  })
  it('média mensal, filtros e comparação de períodos', () => {
    expect(monthlyAverages(exams).map((m) => m.key)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(filterExams(exams, { from: '2026-09-01', to: '2026-10-31' }).map((e) => e.id)).toEqual(['s2', 's3'])
    expect(filterExams([ex('a', '2026-01-01', [], { board: 'IBADE', contest: 'PCRO' }), ex('b', '2026-01-02', [])], { board: 'IBADE' })).toHaveLength(1)
    const c = comparePeriods(exams, { from: '2026-10-01', to: '2026-11-30' }, { from: '2026-08-01', to: '2026-09-30' })
    expect(c.diff).toBeGreaterThan(0)
    expect(comparePeriods([], { from: '', to: '' }, { from: '', to: '' }).diff).toBeNull()
  })
  it('overview do dashboard', () => {
    const o = mockOverview(exams)
    expect(o.count).toBe(4); expect(o.bestSubject.subjectId).toBe('ce'); expect(o.worstSubject.subjectId).toBe('lp')
    expect(mockOverview([]).last).toBeNull()
  })
})

describe('frequência sugerida', () => {
  const e1 = ex('a', '2026-10-01', [S('x', 10, 5)]), e2 = ex('b', '2026-10-20', [S('x', 10, 6)])
  it('sem simulados: sem previsão', () => expect(getSchedule({ exams: [], today: '2026-11-10' }).status).toBe('none'))
  it('próxima = mais recente + frequência; faltam N dias; lembrete na data e pendente depois', () => {
    expect(getSchedule({ exams: [e1], frequencyDays: 15, today: '2026-10-10' })).toMatchObject({ status: 'upcoming', nextDate: '2026-10-16', daysLeft: 6 })
    expect(getSchedule({ exams: [e1], frequencyDays: 15, today: '2026-10-16' }).status).toBe('due')
    const late = getSchedule({ exams: [e1], frequencyDays: 15, today: '2026-10-20' })
    expect(late.status).toBe('overdue'); expect(late.overdueDays).toBe(4)
    expect(getSchedule({ exams: [e1], frequencyDays: 15, today: '2026-11-30' }).status).toBe('overdue') // continua pendente
  })
  it('cadastro antecipado ou editar a data recalcula a previsão', () => {
    expect(getSchedule({ exams: [e1, e2], frequencyDays: 15, today: '2026-10-21' }).nextDate).toBe('2026-11-04')
    expect(getSchedule({ exams: [e1, { ...e2, date: '2026-10-25' }], frequencyDays: 15, today: '2026-10-26' }).nextDate).toBe('2026-11-09')
    expect(getSchedule({ exams: [e1, e2], frequencyDays: 7, today: '2026-10-21' }).nextDate).toBe('2026-10-27')
  })
  it('histórico com intervalos reais e aderência', () => {
    const h = frequencyHistory({ exams: [e1, e2, ex('c', '2026-11-12', [S('x', 10, 7)])], frequencyDays: 15 })
    expect(h.rows.map((r) => [r.name, r.interval, r.status])).toEqual([['c', 23, 'late'], ['b', 19, 'late'], ['a', null, 'first']])
    expect(h.adherence).toBe(0); expect(h.longest).toBe(23)
    expect(frequencyHistory({ exams: [e1, e2], frequencyDays: 30 }).rows[0].status).toBe('early')
  })
})

describe('banco: migração v1 → v2 e backup', () => {
  it('atualiza do v1 preservando todos os dados e cria o store de simulados', async () => {
    await deleteDatabase()
    // cria um banco v1 "antigo" com dados reais usando a API nativa
    await new Promise((res, rej) => {
      const r = indexedDB.open('revisoes-concursos', 1)
      r.onupgradeneeded = () => {
        const db = r.result
        db.createObjectStore('subjects', { keyPath: 'id' }); db.createObjectStore('settings', { keyPath: 'key' })
        for (const n of ['studies', 'questions', 'flashcards', 'reviews', 'reviewLog', 'cycles']) db.createObjectStore(n, { keyPath: 'id' })
      }
      r.onsuccess = () => { const tx = r.result.transaction('subjects', 'readwrite'); tx.objectStore('subjects').put({ id: 's1', name: 'Informática' }); tx.oncomplete = () => { r.result.close(); res() } }
      r.onerror = () => rej(r.error)
    })
    const db = await getDB()
    expect(db.version).toBe(2)
    expect([...db.objectStoreNames]).toContain('mockExams')
    expect((await getAll('subjects')).map((s) => s.name)).toEqual(['Informática'])
    expect(await getAll('mockExams')).toEqual([])
  })
  it('simulados entram no backup e são restaurados; backup antigo (v1) continua aceito', async () => {
    await deleteDatabase()
    await putOne('subjects', { id: 's1', name: 'Informática', color: '#000' })
    await putOne('mockExams', ex('m1', '2026-11-09', [S('s1', 10, 7)]))
    const backup = await buildBackup()
    expect(backup.data.mockExams).toHaveLength(1)
    await deleteDatabase()
    await restoreBackup(backup)
    expect((await getAll('mockExams'))[0].id).toBe('m1')
    const old = { ...backup, version: 1, data: { ...backup.data } }; delete old.data.mockExams
    await expect(restoreBackup(old)).resolves.toBeTruthy()
  })
})
