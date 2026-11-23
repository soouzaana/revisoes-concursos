import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { deleteDatabase } from '../src/database/db'
import { getAll } from '../src/database/repository'
import { buildBackup, restoreBackup } from '../src/services/backupService'
import { useSubjectsStore } from '../src/stores/subjects'
import { useSettingsStore } from '../src/stores/settings'
import { useStudiesStore } from '../src/stores/studies'
import { useConcursoStore } from '../src/stores/concurso'
import { useEditalStore } from '../src/stores/edital'
import { useActivityStore } from '../src/stores/activity'
import { todayStr } from '../src/utils/date'

globalThis.matchMedia = () => ({ matches: false, addEventListener() {} })
globalThis.document = { documentElement: { setAttribute() {} }, querySelector: () => null }

const doc = { name: 'edital-teste.pdf', pageCount: 1, ocrPages: 0, pages: [{ page: 1, text: 'texto', method: 'text' }] }
const importArgs = () => ({
  target: 'new', meta: { name: 'Concurso Teste', board: 'Banca X', examDate: '2099-05-10' },
  disciplines: [{ name: 'Direito Teste', items: [{ depth: 0, number: '1', text: 'Princípios', page: 1 }, { depth: 1, number: '1.1', text: 'Legalidade', page: 1 }] }],
  stagesIn: [{ key: 'prova_objetiva', name: 'Prova objetiva', startDate: '2099-05-10', page: 1, excerpt: 'prova em 10/05' }, { key: 'taf', name: 'TAF', page: 1 }],
  criteria: [], doc
})
async function boot() {
  await deleteDatabase(); setActivePinia(createPinia())
  await useSettingsStore().load(); await useSubjectsStore().load()
  await useConcursoStore().load(); const e = useEditalStore(); await e.load()
  return e
}

describe('store do edital', () => {
  let e
  beforeEach(async () => { e = await boot() })

  it('confirmImport grava conteúdo hierárquico, etapas "A definir" e documento de origem', async () => {
    const { topics, stages } = await e.confirmImport(importArgs())
    expect(topics).toHaveLength(2)
    expect(topics[1].parentId).toBe(topics[0].id)
    expect(topics.every((t) => t.status === 'not_started' && t.matchState === 'pending')).toBe(true)
    expect(stages.find((s) => s.key === 'taf').tbd).toBe(true)
    expect(e.myDocs).toHaveLength(1)
  })

  it('confirmMatch cria só referências, nunca altera estudos nem marca subassuntos', async () => {
    const studies = useStudiesStore(); const subj = useSubjectsStore().items[0]
    const study = await studies.add({ date: todayStr(), subjectId: subj?.id || (await useSubjectsStore().add('Direito Teste')).id, topic: 'Princípios', notes: '', minutes: 30 }, [])
    const before = JSON.stringify(await getAll('studies'))
    const { topics } = await e.confirmImport(importArgs())
    await e.confirmMatch(topics[0].id, 'confirmed', [{ kind: 'study', ids: [study.id] }], { confidence: 'exata' })
    expect(JSON.stringify(await getAll('studies'))).toBe(before)
    const c = useConcursoStore()
    expect(c.syllabus.find((t) => t.id === topics[0].id).status).toBe('studied')
    expect(c.syllabus.find((t) => t.id === topics[1].id).status).toBe('not_started')
    await e.confirmMatch(topics[0].id, 'confirmed', [{ kind: 'study', ids: [study.id] }]) // repetir não duplica
    expect(await getAll('topicLinks')).toHaveLength(1)
  })

  it('confirmMatch não rebaixa um assunto dominado e resetMatch preserva o histórico', async () => {
    const { topics } = await e.confirmImport(importArgs()); const c = useConcursoStore()
    await c.updateTopic(topics[0].id, { status: 'mastered' })
    await e.confirmMatch(topics[0].id, 'partial', [{ kind: 'study', ids: ['x'] }])
    expect(c.syllabus.find((t) => t.id === topics[0].id).status).toBe('mastered')
    await e.resetMatch(topics[0].id)
    expect(await getAll('topicLinks')).toHaveLength(0)
  })

  it('etapas: status só muda pelo usuário e fica no histórico; datas alteradas registram versão anterior', async () => {
    const { stages } = await e.confirmImport(importArgs())
    const st = stages[0]
    expect(e.myStages.find((s) => s.id === st.id).status).toBe('not_started')
    await e.updateStageStatus(st.id, { status: 'approved', score: '80' })
    const after = e.myStages.find((s) => s.id === st.id)
    expect(after.status).toBe('approved'); expect(after.history.length).toBeGreaterThan(0)
    await e.saveStage({ name: 'Prova objetiva', key: 'prova_objetiva', startDate: '2099-06-01' }, st.id)
    const moved = e.myStages.find((s) => s.id === st.id)
    expect(moved.dateHistory).toHaveLength(1); expect(moved.status).toBe('approved'); expect(moved.score).toBe('80')
    await expect(e.saveStage({ name: '' })).rejects.toThrow()
  })

  it('retificação preserva status/resultado/notas e só marca como retirado', async () => {
    const { stages } = await e.confirmImport(importArgs())
    const [prova, taf] = stages
    await e.updateStageStatus(taf.id, { status: 'eliminated', notes: 'minha nota', result: 'reprovado' })
    await e.applyRectification({ doc: { ...doc, name: 'retificacao.pdf' }, changes: [
      { selected: true, type: 'stage_date', stageId: prova.id, incoming: { startDate: '2099-07-01', page: 1 }, label: 'Data', before: 'a', after: 'b' },
      { selected: true, type: 'stage_removed', stageId: taf.id, label: 'TAF removido', before: 'TAF' },
      { selected: true, type: 'stage_added', incoming: { key: 'discursiva', name: 'Discursiva', page: 1 }, label: 'Nova', after: 'Discursiva' },
      { selected: false, type: 'stage_date', stageId: prova.id, incoming: { startDate: '2100-01-01' }, label: 'ignorada' }
    ] })
    const all = await getAll('contestStages')
    expect(all).toHaveLength(3)
    const t = all.find((s) => s.id === taf.id)
    expect(t.withdrawn).toBe(true); expect(t.status).toBe('eliminated'); expect(t.notes).toBe('minha nota'); expect(t.result).toBe('reprovado')
    const p = all.find((s) => s.id === prova.id)
    expect(p.startDate).toBe('2099-07-01'); expect(p.dateHistory).toHaveLength(1)
    expect((await getAll('editalChanges')).some((c) => c.kind === 'rectification')).toBe(true)
    expect(await getAll('editalDocs')).toHaveLength(2)
  })

  it('vínculo direto do estudo ao assunto do edital não duplica a atividade', async () => {
    const { topics } = await e.confirmImport(importArgs())
    const subj = useSubjectsStore().items.find((s) => s.name === 'Direito Teste')
    const studies = useStudiesStore()
    await studies.add({ date: todayStr(), subjectId: subj.id, topic: 'Princípios', notes: '', minutes: 20, syllabusTopicId: topics[0].id }, [])
    expect(e.linksByTopic[topics[0].id]).toHaveLength(1)
    await useActivityStore().load?.()
    expect((await getAll('studies'))).toHaveLength(1)
  })

  it('backup v4 faz ida e volta com os novos stores', async () => {
    await e.confirmImport(importArgs())
    const b = await buildBackup()
    expect(b.version).toBe(4)
    for (const k of ['editalDocs', 'contestStages', 'topicLinks', 'editalChanges']) expect(b.data[k] ?? b.stores?.[k]).toBeDefined()
    await restoreBackup(JSON.parse(JSON.stringify(b)))
    expect(await getAll('contestStages')).toHaveLength(2)
    expect(await getAll('editalDocs')).toHaveLength(1)
  })
})
