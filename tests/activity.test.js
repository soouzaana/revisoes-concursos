import { describe, it, expect } from 'vitest'
import { buildDayMap, collectEvents, computeStreaks, levelFor, localDate, monthActive, yearGrid, filterTimeline } from '../src/services/activityEngine'
import { consistency, habitStreak, isScheduled } from '../src/services/habitEngine'
import { nextDue, filterTasks } from '../src/services/taskEngine'
import { attentionReasons, cycleProgress, syllabusProgress, concursoStats } from '../src/services/concursoEngine'

const T = '2026-11-22'
const base = { studies: [], reviews: [], logs: [], habits: [], habitLogs: [], tasks: [], mockExams: [], notes: [], cycleSessions: [], syllabus: [] }
const st = (id, date, minutes = 0) => ({ id, date, subjectId: 's1', topic: 'X', createdAt: `${date}T15:00:00.000Z`, minutes })

describe('ofensiva', () => {
  it('conta dias consecutivos e mantém a sequência se hoje ainda não teve atividade', () => {
    const ev = collectEvents({ ...base, studies: [st('a', '2026-11-19'), st('b', '2026-11-20'), st('c', '2026-11-21')] }, T)
    const s = computeStreaks(buildDayMap(ev), T)
    expect(s.current).toBe(3); expect(s.activeToday).toBe(false); expect(s.longest).toBe(3)
  })
  it('zera quando ontem e hoje ficaram sem atividade e guarda o histórico de sequências', () => {
    const ev = collectEvents({ ...base, studies: [st('a', '2026-11-10'), st('b', '2026-11-11'), st('c', '2026-11-12'), st('d', '2026-11-20')] }, T)
    const s = computeStreaks(buildDayMap(ev), T)
    expect(s.current).toBe(0); expect(s.longest).toBe(3); expect(s.runs).toHaveLength(2); expect(s.totalActive).toBe(4)
  })
  it('hábitos e revisões também contam; atividades futuras são ignoradas', () => {
    const ev = collectEvents({ ...base, habits: [{ id: 'h', name: 'Ler' }], habitLogs: [{ id: 'h:2026-11-22', habitId: 'h', date: '2026-11-22' }, { id: 'h:2026-11-23', habitId: 'h', date: '2026-11-23' }], studies: [st('f', '2026-12-01')] }, T)
    expect(ev).toHaveLength(1)
    expect(computeStreaks(buildDayMap(ev), T).current).toBe(1)
  })
  it('categorias configuráveis: tarefas só contam se habilitadas', () => {
    const ev = collectEvents({ ...base, tasks: [{ id: 't', title: 'a', completedAt: '2026-11-22T14:00:00.000Z' }] }, T)
    expect(buildDayMap(ev).size).toBe(0)
    expect(buildDayMap(ev, ['task']).size).toBe(1)
  })
  it('virada de data usa o fuso local (não UTC)', () => {
    // 23:30 em Manaus (UTC-4) = 03:30 UTC do dia seguinte: precisa cair no dia local
    const iso = new Date(2026, 10, 21, 23, 30).toISOString()
    expect(localDate(iso)).toBe('2026-11-21')
  })
  it('não duplica: 25 flashcards no dia = 1 evento (3 unidades); ids únicos', () => {
    const logs = Array.from({ length: 25 }, (_, i) => ({ id: 'l' + i, kind: 'flashcard', date: '2026-11-20', at: `2026-11-20T10:${String(i).padStart(2, '0')}:00.000Z`, correct: i % 2 === 0 }))
    const ev = collectEvents({ ...base, logs, studies: [st('a', '2026-11-20', 30)] }, T)
    expect(ev.filter((e) => e.category === 'flashcard')).toHaveLength(1)
    expect(new Set(ev.map((e) => e.id)).size).toBe(ev.length)
    const day = buildDayMap(ev).get('2026-11-20')
    expect(day.units).toBe(4); expect(day.minutes).toBe(30); expect(day.level).toBe(2); expect(day.sessions).toBe(1)
  })
  it('níveis, percentual do mês e grade anual', () => {
    expect([0, 1, 2, 3, 5, 8, 20].map(levelFor)).toEqual([0, 1, 1, 2, 3, 4, 4])
    const ev = collectEvents({ ...base, studies: [st('a', '2026-11-01'), st('b', '2026-11-22')] }, T)
    expect(monthActive(buildDayMap(ev), '2026-11', T)).toEqual({ active: 2, elapsed: 22, pct: 9 })
    const grid = yearGrid(2026, T)
    expect(grid.flat().filter(Boolean)).toHaveLength(365)
    expect(grid.flat().find((d) => d?.date === '2026-11-23').future).toBe(true)
  })
  it('timeline filtra por categoria e período', () => {
    const ev = collectEvents({ ...base, studies: [st('a', '2026-11-10'), st('b', '2026-11-20')], notes: [{ id: 'n', title: 't', createdAt: '2026-11-20T12:00:00.000Z' }] }, T)
    expect(filterTimeline(ev, { categories: ['study'], from: '2026-11-15' })).toHaveLength(1)
    expect(filterTimeline(ev)).toHaveLength(3)
  })
})

describe('hábitos', () => {
  const daily = { id: 'h', startDate: '2026-11-15', createdAt: '2026-11-15T10:00:00Z' }
  it('sequência e consistência; hoje pendente não quebra', () => {
    const done = new Set(['2026-11-19', '2026-11-20', '2026-11-21'])
    expect(habitStreak(daily, done, T)).toEqual({ current: 3, longest: 3 })
    expect(consistency(daily, done, T).planned).toBe(8)
  })
  it('dias específicos: dias fora da frequência não quebram a sequência', () => {
    const seg = { ...daily, days: [1, 3] } // seg e qua; 2026-11-16 seg, 18 qua
    expect(isScheduled(seg, '2026-11-16')).toBe(true)
    expect(habitStreak(seg, new Set(['2026-11-16', '2026-11-18']), T).current).toBe(2)
  })
})

describe('tarefas', () => {
  it('recorrência e filtros', () => {
    expect(nextDue('2026-01-31', 'monthly')).toBe('2026-02-28'); expect(nextDue('2026-11-22', 'weekly')).toBe('2026-11-29'); expect(nextDue('2026-11-22', 'none')).toBeNull()
    const tasks = [{ id: 1, status: 'pending', dueDate: '2026-11-20', priority: 'low' }, { id: 2, status: 'done', priority: 'high' }, { id: 3, status: 'pending', dueDate: '2026-11-25', priority: 'high' }]
    expect(filterTasks(tasks, { filter: 'overdue' }, T).map((t) => t.id)).toEqual([1])
    expect(filterTasks(tasks, { filter: 'pending', priority: 'high' }, T).map((t) => t.id)).toEqual([3])
    expect(filterTasks(tasks, { filter: 'done' }, T).map((t) => t.id)).toEqual([2])
  })
})

describe('meu concurso', () => {
  const topics = [{ id: 1, subjectId: 's1', name: 'A', status: 'mastered' }, { id: 2, subjectId: 's1', name: 'B', status: 'studied', lastReviewedAt: '2026-11-01' }, { id: 3, subjectId: 's2', name: 'C', status: 'not_started' }, { id: 4, subjectId: 's2', name: 'D', status: 'reviewing', lastReviewedAt: '2026-11-21' }]
  it('percentual de conclusão e atenção', () => {
    const p = syllabusProgress(topics)
    expect(p.completionPct).toBe(75); expect(p.masteredPct).toBe(25)
    expect(attentionReasons(topics[1], { today: T })[0]).toMatch(/21 dias/)
    expect(attentionReasons(topics[3], { today: T })).toEqual([])
    expect(attentionReasons({ id: 9, subjectId: 's1', name: 'Z', status: 'studied' }, { today: T })).toEqual(['Nunca revisado'])
  })
  it('ciclo: progresso da rodada, próxima matéria e conclusão', () => {
    const cycle = { roundStart: '2026-11-20', items: [{ id: 'a', subjectId: 's1', order: 0, targetMinutes: 60 }, { id: 'b', subjectId: 's2', order: 1, targetMinutes: 30 }] }
    const sessions = [{ subjectId: 's1', minutes: 60, date: '2026-11-21' }, { subjectId: 's1', minutes: 500, date: '2026-11-01' }]
    const p = cycleProgress(cycle, sessions)
    expect(p.rows[0].complete).toBe(true); expect(p.rows[0].totalMinutes).toBe(560); expect(p.next.subjectId).toBe('s2'); expect(p.roundComplete).toBe(false)
    expect(cycleProgress(cycle, [...sessions, { subjectId: 's2', minutes: 30, date: '2026-11-22' }]).roundComplete).toBe(true)
  })
  it('estatísticas com filtro de matéria e período', () => {
    const logs = [{ kind: 'question', subjectId: 's1', correct: true, date: '2026-11-20' }, { kind: 'question', subjectId: 's1', correct: false, date: '2026-11-21' }, { kind: 'question', subjectId: 's2', correct: true, date: '2026-11-21' }]
    const args = { studies: [st('a', '2026-11-20', 60)], cycleSessions: [{ subjectId: 's2', minutes: 30, date: '2026-11-21' }], logs, reviews: [], syllabus: topics, mockExams: [], today: T }
    const all = concursoStats(args)
    expect(all.hours).toBe(1.5); expect(all.questions).toBe(3); expect(all.studyDays).toBe(2)
    const s1 = concursoStats({ ...args, subjectId: 's1' })
    expect(s1.questions).toBe(2); expect(s1.accuracy).toBe(50); expect(s1.topicsMastered).toBe(1); expect(s1.hours).toBe(1)
    expect(concursoStats({ ...args, from: '2026-11-21' }).studyDays).toBe(1)
  })
})
