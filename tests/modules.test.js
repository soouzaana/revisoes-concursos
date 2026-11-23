import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { deleteDatabase, getDB } from '../src/database/db'
import { getAll, putOne } from '../src/database/repository'
import { buildBackup, restoreBackup } from '../src/services/backupService'
import { useSubjectsStore } from '../src/stores/subjects'
import { useSettingsStore } from '../src/stores/settings'
import { useStudiesStore } from '../src/stores/studies'
import { useReviewsStore } from '../src/stores/reviews'
import { useHabitsStore } from '../src/stores/habits'
import { useTasksStore } from '../src/stores/tasks'
import { useNotesStore } from '../src/stores/notes'
import { useEventsStore } from '../src/stores/events'
import { useConcursoStore } from '../src/stores/concurso'
import { useProgressStore } from '../src/stores/progress'
import { useClockStore } from '../src/stores/clock'
import { reviewFlashcard } from '../src/services/flashcardService'
import { newCardFields } from '../src/services/flashcardEngine'
import { addDays, todayStr } from '../src/utils/date'

globalThis.matchMedia = () => ({ matches: false, addEventListener() {} })
globalThis.document = { documentElement: { setAttribute() {} }, querySelector: () => null }

const today = todayStr()
async function boot() {
  await deleteDatabase(); setActivePinia(createPinia())
  const settings = useSettingsStore(); await settings.load()
  const subjects = useSubjectsStore(); await subjects.load()
  return { settings, subjects }
}
const loadAll = async () => { for (const s of [useStudiesStore, useHabitsStore, useTasksStore, useNotesStore, useEventsStore, useConcursoStore]) await s().load(); await useReviewsStore().sync() }

describe('migração v2 → v3', () => {
  it('preserva dados existentes e só adiciona stores novos', async () => {
    await deleteDatabase()
    await new Promise((res, rej) => {
      const r = indexedDB.open('revisoes-concursos', 2)
      r.onupgradeneeded = () => {
        const db = r.result
        for (const n of ['subjects', 'studies', 'questions', 'flashcards', 'reviews', 'reviewLog', 'cycles', 'mockExams']) db.createObjectStore(n, { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      r.onsuccess = () => { const tx = r.result.transaction(['subjects', 'mockExams'], 'readwrite'); tx.objectStore('subjects').put({ id: 's1', name: 'Direito' }); tx.objectStore('mockExams').put({ id: 'm1', date: '2026-01-01', name: 'S1', subjects: [] }); tx.oncomplete = () => { r.result.close(); res() } }
      r.onerror = () => rej(r.error)
    })
    const db = await getDB()
    expect(db.version).toBe(3)
    for (const n of ['habits', 'habitLogs', 'tasks', 'notes', 'events', 'contests', 'syllabus', 'studyCycle', 'cycleSessions']) expect([...db.objectStoreNames]).toContain(n)
    expect((await getAll('subjects'))[0].name).toBe('Direito')
    expect((await getAll('mockExams'))).toHaveLength(1)
  })
})

describe('integração entre módulos: ofensiva, histórico e estatísticas', () => {
  beforeEach(boot)

  it('registrar estudo, concluir hábito, tarefa e flashcard → ofensiva e histórico, sem duplicar', async () => {
    const subjects = useSubjectsStore(); const s = await subjects.add('Informática')
    await loadAll()
    const progress = useProgressStore()
    expect(progress.streak.current).toBe(0)

    await useStudiesStore().add({ date: today, subjectId: s.id, topic: 'Redes', notes: '', minutes: 45 })
    const habits = useHabitsStore(); const h = await habits.save({ name: 'Ler', days: [] })
    await habits.toggle(h.id); await habits.toggle(h.id); await habits.toggle(h.id) // liga/desliga/liga: 1 registro só
    const tasks = useTasksStore(); const t = await tasks.save({ title: 'Imprimir edital', dueDate: today }); await tasks.toggle(t.id)
    const card = { id: 'c1', subjectId: s.id, topic: 'Redes', front: 'a', back: 'b', ...newCardFields(today), createdAt: new Date().toISOString() }
    await putOne('flashcards', card); await reviewFlashcard('c1', true, today, 'free'); await reviewFlashcard('c1', false, today, 'free')
    await useReviewsStore().load()

    expect(await getAll('habitLogs')).toHaveLength(1)
    const ev = progress.events
    expect(new Set(ev.map((e) => e.id)).size).toBe(ev.length)
    expect(ev.filter((e) => e.category === 'flashcard')).toHaveLength(1)
    expect(ev.find((e) => e.category === 'flashcard').count).toBe(2)
    expect(ev.map((e) => e.category).sort()).toEqual(['flashcard', 'habit', 'study', 'task'])
    expect(progress.streak.current).toBe(1) // tarefa não conta por padrão; o resto sim
    expect(progress.dayMap.get(today).minutes).toBe(45)

    await useSettingsStore().setStreakCategories(['task'])
    expect(progress.dayMap.get(today).count).toBe(1)
  })

  it('flashcard sozinho já mantém a ofensiva (não exige registro de estudo)', async () => {
    const s = await useSubjectsStore().add('Direito'); await loadAll()
    await putOne('flashcards', { id: 'c', subjectId: s.id, topic: 't', front: 'a', back: 'b', ...newCardFields(addDays(today, -1)), createdAt: new Date().toISOString() })
    await reviewFlashcard('c', true, addDays(today, -1), 'free'); await reviewFlashcard('c', true, today, 'free')
    await useReviewsStore().load()
    expect(useProgressStore().streak.current).toBe(2)
  })

  it('tarefa recorrente cria a próxima ocorrência uma única vez', async () => {
    await boot(); const tasks = useTasksStore(); await tasks.load()
    const t = await tasks.save({ title: 'Simulado semanal', dueDate: today, recurrence: 'weekly' })
    await tasks.toggle(t.id); await tasks.toggle(t.id); await tasks.toggle(t.id) // concluir, reabrir, concluir
    expect(tasks.items).toHaveLength(2)
    expect(tasks.items.filter((x) => x.status !== 'done')[0].dueDate).toBe(addDays(today, 7))
  })

  it('hábito não aceita data futura; anotação entra no histórico mas não na ofensiva padrão', async () => {
    await boot(); await loadAll()
    const habits = useHabitsStore(); const h = await habits.save({ name: 'Treinar', days: [1, 3, 5] })
    await expect(habits.toggle(h.id, addDays(today, 1))).rejects.toThrow()
    await useNotesStore().save({ title: 'Resumo', content: 'x', tags: '#lei, direito', folder: 'Direito' })
    const p = useProgressStore()
    expect(p.events.some((e) => e.category === 'note')).toBe(true)
    expect(p.streak.current).toBe(0)
    expect(useNotesStore().items[0].tags).toEqual(['lei', 'direito'])
    expect(useNotesStore().search('RESUMO')).toHaveLength(1)
  })

  it('Meu Concurso: edital, status, revisão de assunto (histórico + ofensiva) e ciclo', async () => {
    const subjects = useSubjectsStore(); const s = await subjects.add('Português'); await loadAll()
    const c = useConcursoStore()
    await c.saveContest({ name: 'TJ-AM', role: 'Analista', board: 'FGV', examDate: addDays(today, 30), status: 'studying' })
    expect(c.current.name).toBe('TJ-AM'); expect(c.daysToExam).toBe(30)
    await c.addSubject(s.id)
    const t1 = await c.addTopic({ subjectId: s.id, name: 'Crase' }); const t2 = await c.addTopic({ subjectId: s.id, name: 'Sintaxe' })
    const sub = await c.addTopic({ subjectId: s.id, name: 'Orações', parentId: t2.id })
    expect(c.progress.total).toBe(3); expect(c.progress.completionPct).toBe(0)
    await c.updateTopic(t1.id, { status: 'mastered' })
    expect(c.progress.completionPct).toBe(33)
    await c.reviewTopic(t2.id, { date: today, note: 'revisei' }); await c.reviewTopic(t2.id, { date: today, note: 'revisei de novo' })
    expect(c.syllabus.find((x) => x.id === t2.id).reviews).toHaveLength(1) // mesmo dia = mesma revisão
    expect(c.syllabus.find((x) => x.id === t2.id).status).toBe('reviewing')
    await expect(c.reviewTopic(t2.id, { date: addDays(today, 1) })).rejects.toThrow()
    expect(useProgressStore().events.filter((e) => e.category === 'review')).toHaveLength(1)
    expect(useProgressStore().streak.current).toBe(1)
    await c.removeTopic(t2.id) // remove subassuntos juntos
    expect(c.syllabus.some((x) => x.id === sub.id)).toBe(false)

    await c.addCycleItem({ subjectId: s.id, targetMinutes: 60, priority: 'high' })
    await expect(c.addCycleItem({ subjectId: s.id })).rejects.toThrow()
    await c.addSession({ subjectId: s.id, minutes: 60 })
    expect(c.cycleInfo.roundComplete).toBe(true)
    await c.startNewRound()
    expect(c.cycleInfo.rows[0].totalMinutes).toBe(60)
    await expect(c.addSession({ subjectId: s.id, minutes: 0 })).rejects.toThrow()
    expect(useProgressStore().dayMap.get(today).minutes).toBe(60)
  })

  it('backup v3 guarda e restaura tudo; excluir concurso não apaga matérias nem estudos', async () => {
    const s = await useSubjectsStore().add('Matemática'); await loadAll()
    await useStudiesStore().add({ date: today, subjectId: s.id, topic: 'Juros', notes: '' })
    await useHabitsStore().save({ name: 'Estudar' }); await useEventsStore().save({ title: 'Prova', date: today })
    const c = useConcursoStore(); await c.saveContest({ name: 'X' }); await c.addSubject(s.id); await c.addTopic({ subjectId: s.id, name: 'A' })
    const b = await buildBackup(); expect(b.version).toBe(3)
    await deleteDatabase(); await restoreBackup(b)
    expect((await getAll('habits'))).toHaveLength(1); expect(await getAll('syllabus')).toHaveLength(1); expect(await getAll('events')).toHaveLength(1)
    setActivePinia(createPinia()); await useSettingsStore().load(); await useSubjectsStore().load(); await loadAll()
    const c2 = useConcursoStore(); await c2.removeContest(c2.current.id)
    expect(await getAll('syllabus')).toHaveLength(0); expect(await getAll('subjects')).toHaveLength(1); expect(await getAll('studies')).toHaveLength(1)
  })
})
