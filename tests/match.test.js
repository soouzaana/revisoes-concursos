import { describe, it, expect } from 'vitest'
import { DEFAULT_SYNONYMS, buildRecords, levelOf, matchTopics, parseSynonyms, searchRecords, stringifySynonyms } from '../src/services/editalMatcher'
import { diffStages, diffSyllabus, summarize } from '../src/services/editalDiff'
import { parseEdital } from '../src/services/editalParser'
import { EDITAL } from './fixtures/edital'

const names = { s1: 'Português', s2: 'Direito Constitucional', s3: 'Informática' }
const nameOf = (id) => names[id] || ''
const st = (id, subjectId, topic) => ({ id, subjectId, topic, date: '2026-01-01' })
const records = buildRecords({
  studies: [st('a', 's1', 'Crase'), st('b', 's1', 'Concordância verbal e nominal'), st('c', 's2', 'Direitos individuais e coletivos'), st('d', 's3', 'Sistemas operacionais Windows e Linux'), st('e', 's1', 'Interpretacao de textos'), st('f', 's3', 'Hardware')],
  questions: [{ id: 'q1', subjectId: 's1', topic: 'Crase', date: '2026-01-02' }], flashcards: [{ id: 'c1', subjectId: 's1', topic: 'crase', createdAt: '2026-01-03' }], nameOf
})
const topic = (id, text, disciplineName = 'Língua Portuguesa') => ({ id, text, disciplineName })

describe('cruzamento por texto (sem IA)', () => {
  it('agrupa histórico por matéria+assunto preservando os ids originais', () => {
    const crase = records.find((r) => r.norm === 'crase')
    expect(crase.counts).toEqual({ study: 1, question: 1, flashcard: 1 }); expect(crase.ids.question).toEqual(['q1'])
  })
  it('exemplo da especificação: "Crase" × "Emprego do sinal indicativo de crase"', () => {
    const m = matchTopics([topic('t1', 'Emprego do sinal indicativo de crase')], records).get('t1')
    expect(['exact', 'probable']).toContain(m.level); expect(m.candidates[0].rec.label).toBe('Crase')
    expect(m.level).not.toBe('none')
  })
  it('exata, provável, parcial e sem correspondência', () => {
    const r = matchTopics([
      topic('ex', 'Concordância verbal e nominal'), topic('pr', 'Direitos individuais e coletivos e sociais', 'Direito Constitucional'),
      topic('pa', 'Hardware e periféricos de entrada', 'Informática'), topic('no', 'Orçamento público e finanças', 'Administração Financeira')
    ], records)
    expect(r.get('ex').level).toBe('exact')
    expect(r.get('pr').level).toBe('probable')
    expect(['partial', 'probable']).toContain(r.get('pa').level)
    expect(r.get('no').level).toBe('none'); expect(r.get('no').candidates).toEqual([])
  })
  it('acentos não atrapalham', () => {
    const m = matchTopics([topic('t', 'Compreensão e interpretação de textos')], records).get('t')
    expect(m.candidates[0].rec.label).toBe('Interpretacao de textos')
  })
  it('dicionário local editável amplia equivalências', () => {
    const rs = buildRecords({ studies: [st('x', 's3', 'Vírus e malwares')], nameOf })
    const t = [topic('t', 'Segurança da informação', 'Informática')]
    const sem = matchTopics(t, rs, { synonyms: [] }).get('t')
    const com = matchTopics(t, rs, { synonyms: [['segurança da informação', 'vírus', 'malwares']] }).get('t')
    expect(sem.level).toBe('none'); expect(com.level).toBe('probable'); expect(com.candidates[0].reason).toMatch(/dicionário/)
    expect(parseSynonyms(stringifySynonyms(DEFAULT_SYNONYMS))).toEqual(DEFAULT_SYNONYMS)
  })
  it('conteúdo de outra matéria não vira "exato" automaticamente', () => {
    const m = matchTopics([topic('t', 'Crase', 'Direito Penal')], records).get('t')
    expect(m.level).not.toBe('exact')
  })
  it('busca manual tolera erro de digitação', () => { expect(searchRecords(records, 'conkordancia')[0]?.label).toMatch(/Concord/) })
  it('níveis por limiar', () => { expect([1, 0.8, 0.5, 0.2].map(levelOf)).toEqual(['exact', 'probable', 'partial', 'none']) })
})

describe('retificação: diferenças', () => {
  const base = parseEdital(EDITAL)
  const existing = base.stages.map((s, i) => ({ ...s, id: 'st' + i, name: s.name }))
  const edit = (pages) => parseEdital(pages)
  const mod = EDITAL.map((p) => ({ ...p, text: p.text.replace('Prova objetiva 14 de março de 2027, às 14h', 'Prova objetiva 21 de março de 2027, às 14h').replace('Divulgação dos gabaritos 15/03/2027\n', 'Convocação para o curso de formação 10/04/2027\n') }))
  const inc = edit(mod)
  it('destaca data alterada, etapa incluída e etapa removida (remoção sem seleção padrão)', () => {
    const ch = diffStages(existing, inc.stages)
    const s = summarize(ch)
    expect(ch.find((c) => c.type === 'stage_date')).toMatchObject({ label: expect.stringMatching(/Prova objetiva/), before: '14/03/2027 14:00', after: '21/03/2027 14:00', selected: true })
    expect(s).toMatchObject({ dates: 1, stagesAdded: 1, stagesRemoved: 1 })
    expect(ch.find((c) => c.type === 'stage_removed').selected).toBe(false)
    expect(ch.find((c) => c.type === 'stage_added').after).toBe('10/04/2027')
  })
  it('sem mudanças → lista vazia', () => { expect(diffStages(existing, base.stages)).toEqual([]) })
  it('conteúdo: assunto novo, removido e renomeado', () => {
    const ex = [{ subjectName: 'Língua Portuguesa', items: [{ id: 'a', text: 'Compreensão e interpretação de textos' }, { id: 'b', text: 'Emprego do sinal indicativo de crase' }, { id: 'c', text: 'Fonética' }] }]
    const incoming = [{ name: 'Língua Portuguesa', items: [{ text: 'Compreensão e interpretação de textos' }, { text: 'Emprego do sinal indicativo da crase' }, { text: 'Ortografia oficial' }] }, { name: 'Raciocínio Lógico', items: [{ text: 'Lógica' }] }]
    const s = summarize(diffSyllabus(ex, incoming))
    expect(s).toMatchObject({ topicsRenamed: 1, topicsAdded: 2, topicsRemoved: 1 })
  })
})
