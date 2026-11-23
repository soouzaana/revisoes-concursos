import { describe, it, expect } from 'vitest'
import { findDates, findTime, parseEdital, classifyStage } from '../src/services/editalParser'
import { EDITAL } from './fixtures/edital'

describe('datas', () => {
  it('períodos, datas por extenso e ignora número de lei', () => {
    expect(findDates('Período de inscrições de 20/01/2027 a 28/02/2027')).toMatchObject([{ start: '2027-01-20', end: '2027-02-28' }])
    expect(findDates('de 10 a 20 de janeiro de 2027')).toMatchObject([{ start: '2027-01-10', end: '2027-01-20' }])
    expect(findDates('prova em 14 de março de 2027')).toMatchObject([{ start: '2027-03-14' }])
    expect(findDates('Lei 8.112/90 e art. 5º')).toHaveLength(0)
    expect(findDates('data 31/02/2027')).toHaveLength(0) // inválida
    expect(findDates('de 10/01 a 20/02/2027')[0]).toMatchObject({ start: '2027-01-10', end: '2027-02-20', yearMissing: false })
  })
  it('horário', () => { expect(findTime('às 14h')).toBe('14:00'); expect(findTime('às 8h30')).toBe('08:30'); expect(findTime('sem hora')).toBe('') })
  it('classifica etapas', () => {
    expect(classifyStage('Solicitação de isenção da taxa de inscrição')).toBe('isencao')
    expect(classifyStage('Pagamento da taxa de inscrição')).toBe('pagamento')
    expect(classifyStage('Prazo para recursos contra o gabarito')).toBe('recursos')
    expect(classifyStage('Resultado preliminar da prova objetiva')).toBe('resultado_preliminar')
    expect(classifyStage('Resultado definitivo')).toBe('resultado_definitivo')
    expect(classifyStage('Teste de Aptidão Física (TAF)')).toBe('taf')
    expect(classifyStage('Texto qualquer sem relação')).toBeNull()
  })
})

describe('parser do edital (local, sem IA)', () => {
  const r = parseEdital(EDITAL)
  it('metadados com página de origem', () => {
    expect(r.meta.board).toBe('FGV'); expect(r.meta.role).toBe('Analista Administrativo'); expect(r.meta.vagas).toBe('25')
    expect(r.meta.organ).toMatch(/PREFEITURA/i); expect(r.meta.requisitos).toMatch(/curso superior/)
    expect(r.meta.sources.board.page).toBe(1); expect(r.meta.examDate).toBe('2027-03-14')
  })
  it('etapas: só as que existem, com página e trecho; sem inventar', () => {
    const k = Object.fromEntries(r.stages.map((s) => [s.key, s]))
    expect(Object.keys(k).sort()).toEqual(['gabarito', 'inscricoes', 'isencao', 'pagamento', 'prova_objetiva', 'publicacao_edital', 'recursos', 'resultado_preliminar', 'taf'].sort())
    expect(k.inscricoes).toMatchObject({ startDate: '2027-01-20', endDate: '2027-02-28', page: 1 })
    expect(k.prova_objetiva).toMatchObject({ startDate: '2027-03-14', time: '14:00' })
    expect(k.recursos).toMatchObject({ startDate: '2027-03-16', endDate: '2027-03-17' })
    expect(k.resultado_preliminar).toMatchObject({ startDate: '', tbd: true })
    expect(k.taf).toMatchObject({ startDate: '', tbd: true })
    expect(k.inscricoes.excerpt).toMatch(/inscrições/)
    expect(r.stages.some((s) => s.startDate === '1990-12-11' || s.startDate === '2024-01-10')).toBe(false)
    expect(k.posse).toBeUndefined(); expect(k.curso_formacao).toBeUndefined()
  })
  it('critério de eliminação identificado', () => { expect(r.criteria.some((c) => /eliminado/.test(c.text))).toBe(true) })
  it('conteúdo programático: disciplina → tópico → subtópico, texto original', () => {
    expect(r.disciplines.map((d) => d.name)).toEqual(['Língua Portuguesa', 'Direito Constitucional', 'Informática'])
    const lp = r.disciplines[0].items
    expect(lp.map((i) => [i.depth, i.number])).toEqual([[0, '1'], [0, '2'], [0, '3'], [1, '3.1'], [1, '3.2']])
    expect(lp[1].text).toBe('Emprego do sinal indicativo de crase')
    expect(lp[3].text).toBe('Concordância do verbo com o sujeito')
    const dc = r.disciplines[1].items
    expect(dc.map((i) => [i.depth, i.text])).toEqual([[0, 'Princípios fundamentais'], [0, 'Direitos e garantias fundamentais:'.replace(/:$/, '')], [1, 'Direitos individuais e coletivos'], [1, 'Direitos sociais'], [0, 'Organização do Estado']])
    expect(r.disciplines[2].items[1].text).toBe('Segurança da informação, backup e vírus de computador')
    expect(r.disciplines.every((d) => d.items.every((i) => i.page === 2))).toBe(true)
  })
  it('não inclui o anexo de requerimento e opção de dividir por ponto e vírgula', () => {
    expect(JSON.stringify(r.disciplines)).not.toMatch(/Declaro/)
    const s = parseEdital(EDITAL, { splitSemicolons: true })
    expect(s.disciplines[0].items.length).toBe(r.disciplines[0].items.length) // sem ';' em tópicos com ':' do fixture de LP → mesma estrutura
  })
  it('PDF sem nada reconhecível devolve avisos em vez de inventar', () => {
    const e = parseEdital([{ page: 1, text: 'Texto solto sem estrutura nenhuma.' }])
    expect(e.disciplines).toEqual([]); expect(e.stages).toEqual([]); expect(e.warnings.length).toBeGreaterThan(0)
  })
})
