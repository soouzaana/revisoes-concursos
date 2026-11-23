/**
 * Interpretação LOCAL do edital: regras, expressões regulares e análise de texto.
 * Não usa IA nem qualquer serviço externo. Tudo o que é extraído guarda página e trecho de origem
 * e pode ser corrigido pelo usuário antes de confirmar. Nada é inventado: sem dado = "A definir".
 */
import { norm } from '../utils/text'
import { STAGE_TYPES } from './stageEngine'

const MONTHS = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 }
const MONTH_RE = 'janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro'
const pad = (n) => String(n).padStart(2, '0')
const daysIn = (y, m) => new Date(y, m, 0).getDate()

// ---------------------------------------------------------------- linhas
const PAGE_NUM = /^(p[aá]gina|p[aá]g\.?)?\s*\d{1,4}(\s*(de|\/)\s*\d{1,4})?$/i
/** Junta as páginas em linhas {page, text}; remove cabeçalhos/rodapés repetidos e numeração de página. */
export function buildLines(pages) {
  const freq = new Map()
  for (const p of pages) for (const l of new Set((p.text || '').split(/\r?\n/).map((x) => norm(x).replace(/\d+/g, '#').trim()).filter(Boolean))) freq.set(l, (freq.get(l) || 0) + 1)
  const lines = []
  for (const p of pages) {
    for (const raw of (p.text || '').split(/\r?\n/)) {
      const text = raw.replace(/\s+/g, ' ').trim()
      const key = norm(text).replace(/\d+/g, '#').trim()
      const repeated = pages.length >= 3 && text.length < 110 && key && freq.get(key) >= Math.max(3, pages.length * 0.5)
      if (text && (repeated || PAGE_NUM.test(text) || (/^edital\s+n[ºo°.]/i.test(text) && p !== pages[0] && text.length < 40))) continue
      lines.push({ page: p.page, text })
    }
  }
  return lines
}

// ---------------------------------------------------------------- datas
function validDate(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m) }
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const fullYear = (y) => (y < 100 ? 2000 + y : y)
const mnum = (s) => MONTHS[norm(s)]

/** Todas as datas/períodos de uma linha: [{start, end, yearMissing, index}] (datas ISO). */
export function findDates(line) {
  const found = []
  const taken = []
  const free = (a, b) => !taken.some(([x, y]) => a < y && b > x)
  const push = (m, item) => { const a = m.index, b = m.index + m[0].length; if (free(a, b)) { taken.push([a, b]); found.push({ ...item, index: a, endIndex: b }) } }

  // "10 a 20 de janeiro de 2027"
  for (const m of line.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2})\\s*[º°]?\\s*(?:a|à|até|e|-|–|—)\\s*(\\d{1,2})\\s*[º°]?\\s+de\\s+(${MONTH_RE})(?:\\s+(?:de|do ano de)?\\s*(\\d{4}))?`, 'gi'))) {
    const mo = mnum(m[3]), y = m[4] ? Number(m[4]) : null, yy = y ?? 0
    if (validDate(yy || 2000, mo, +m[1]) && validDate(yy || 2000, mo, +m[2])) push(m, { start: y ? ymd(y, mo, +m[1]) : `?-${pad(mo)}-${pad(+m[1])}`, end: y ? ymd(y, mo, +m[2]) : `?-${pad(mo)}-${pad(+m[2])}`, yearMissing: !y })
  }
  // "10 de janeiro de 2027" / "10 de janeiro"
  for (const m of line.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2})\\s*[º°]?\\s+de\\s+(${MONTH_RE})(?:\\s+(?:de|do ano de)?\\s*(\\d{4}))?`, 'gi'))) {
    const mo = mnum(m[2]), y = m[3] ? Number(m[3]) : null
    if (validDate(y || 2000, mo, +m[1])) push(m, { start: y ? ymd(y, mo, +m[1]) : `?-${pad(mo)}-${pad(+m[1])}`, yearMissing: !y })
  }
  // dd/mm/aaaa (qualquer separador) e dd/mm (somente com barra)
  for (const m of line.matchAll(/(?<![\d./-])(\d{1,2})\s*([/.-])\s*(\d{1,2})(?:\s*\2\s*(\d{4}|\d{2}))(?!\d)/g)) {
    const y = fullYear(+m[4]); if (validDate(y, +m[3], +m[1])) push(m, { start: ymd(y, +m[3], +m[1]), yearMissing: false })
  }
  for (const m of line.matchAll(/(?<![\d./-])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) {
    if (validDate(2000, +m[2], +m[1])) push(m, { start: `?-${pad(+m[2])}-${pad(+m[1])}`, yearMissing: true })
  }
  found.sort((a, b) => a.index - b.index)
  // dois pontos ligados por "a", "até", "–" viram um período
  const out = []
  for (let i = 0; i < found.length; i++) {
    const cur = found[i], nxt = found[i + 1]
    if (!cur.end && nxt && !nxt.end) {
      const gap = line.slice(cur.endIndex, nxt.index)
      if (/^\s*(a|à|ao|até|e|–|—|-|a\s+partir\s+de)\s*$/i.test(gap)) {
        const y = nxt.start.startsWith('?') ? null : nxt.start.slice(0, 4)
        const fix = (d) => (d.startsWith('?') && y ? y + d.slice(1) : d)
        out.push({ start: fix(cur.start), end: nxt.start, yearMissing: cur.start.startsWith('?') && !y || nxt.start.startsWith('?'), index: cur.index }); i++; continue
      }
    }
    out.push(cur)
  }
  return out
}

export function findTime(line) {
  const m = line.match(/(?:[àa]s|das|a partir das|hor[aá]rio[:\s]*)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i) || line.match(/\b(\d{1,2})\s*h\s*(\d{2})?\b/i) || line.match(/\b(\d{1,2}):(\d{2})\b/)
  if (!m) return ''
  const h = +m[1], mi = m[2] ? +m[2] : 0
  return h <= 23 && mi <= 59 ? `${pad(h)}:${pad(mi)}` : ''
}

// ---------------------------------------------------------------- etapas
const STAGE_RULES = [
  ['isencao', /isen[cç][aã]o|isent[oa]s?\b/],
  ['pagamento', /pagamento|boleto|vencimento d[ao] (boleto|taxa)|taxa de inscri[cç][aã]o.*(pag|venc)/],
  ['recursos', /recurso|interposi[cç][aã]o/],
  ['gabarito', /gabarito/],
  ['resultado_definitivo', /resultado (definitivo|final d[ao]s? (prova|avalia))|classifica[cç][aã]o definitiva/],
  ['resultado_preliminar', /resultado (preliminar|provis[oó]rio|parcial)|classifica[cç][aã]o (preliminar|provis[oó]ria)|convoca[cç][aã]o para .*(taf|exame)/],
  ['resultado_final', /resultado final|classifica[cç][aã]o final/],
  ['homologacao', /homologa[cç][aã]o/],
  ['taf', /aptid[aã]o f[ií]sica|\btaf\b|teste f[ií]sico|capacidade f[ií]sica/],
  ['psicologica', /psicol[oó]gic/],
  ['medica', /exames? m[eé]dic|avalia[cç][aã]o m[eé]dic|per[ií]cia m[eé]dic|junta m[eé]dic|exames? de sa[uú]de/],
  ['investigacao_social', /investiga[cç][aã]o (social|funcional)|sindic[aâ]ncia|vida pregressa/],
  ['curso_formacao', /curso de forma[cç][aã]o|forma[cç][aã]o profissional|academia de pol[ií]cia/],
  ['prova_titulos', /avalia[cç][aã]o de t[ií]tulos|prova de t[ií]tulos|entrega de t[ií]tulos|\bt[ií]tulos\b/],
  ['prova_discursiva', /prova (discursiva|dissertativa)|reda[cç][aã]o|prova escrita discursiva/],
  ['prova_pratica', /prova pr[aá]tica|teste pr[aá]tico/],
  ['prova_objetiva', /prova objetiva|provas objetivas|prova escrita|aplica[cç][aã]o d[ao]s? provas?|realiza[cç][aã]o d[ao]s? provas?|^provas?\b/],
  ['inscricoes', /inscri[cç][oõ]es|per[ií]odo de inscri|inscri[cç][aã]o/],
  ['publicacao_edital', /publica[cç][aã]o d[oe]s?te? edital|publica[cç][aã]o do edital|edital de abertura|divulga[cç][aã]o do edital/],
  ['convocacao', /convoca[cç][aã]o|convoca[cç][oõ]es/],
  ['nomeacao', /nomea[cç][aã]o/],
  ['posse', /\bposse\b|tomada de posse/]
]
export function classifyStage(text) {
  const n = norm(text)
  for (const [key, re] of STAGE_RULES) {
    // as regras acima usam acentos: testa no texto original em minúsculas e no normalizado
    if (re.test(text.toLowerCase()) || re.test(n)) return key
  }
  return null
}
const TBD = /a definir|a ser (divulgad|definid|informad|publicad|anunciad|confirmad)|sem data prevista|data a confirmar|em breve/i
const LEGAL_REF = /\b(lei|decreto|portaria|resolu[cç][aã]o|instru[cç][aã]o normativa|emenda|medida provis[oó]ria|constitui[cç][aã]o)\b[^.]{0,40}\bn[ºo°.]?\s*\d|\bart\.?\s*\d/i
const dominantYear = (dates) => {
  const c = new Map(); for (const d of dates) { const y = d.slice(0, 4); if (y !== '?') c.set(y, (c.get(y) || 0) + 1) }
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ? Number([...c.entries()].sort((a, b) => b[1] - a[1])[0][0]) : null
}

/** Extrai etapas e datas. Cada etapa: chave, nome, datas, horário, trecho e página de origem. */
export function extractStages(lines) {
  const raw = []
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i].text
    if (!L) continue
    const dates = findDates(L)
    const stripped = L.replace(/\d{1,2}\s*[/.-]\s*\d{1,2}(\s*[/.-]\s*\d{2,4})?|\d{1,2}\s*[º°]?\s+de\s+\w+(\s+de\s+\d{4})?/gi, ' ').replace(/\b(a|até|e|às|as|das|h)\b|[–—:;,.()-]/gi, ' ').replace(/\s+/g, ' ').trim()
    const prev = lines[i - 1]?.text || '', next = lines[i + 1]?.text || ''
    let key = classifyStage(L)
    let label = stripped
    if (!key && stripped.length < 30 && prev && !findDates(prev).length) { key = classifyStage(prev); if (key) label = prev }
    if (!key && stripped.length < 4 && next && !findDates(next).length) { key = classifyStage(next); if (key) label = next }
    if (!dates.length) {
      if (key && TBD.test(L) && !LEGAL_REF.test(L)) raw.push({ key, name: STAGE_TYPES[key], startDate: '', endDate: '', time: '', tbd: true, description: L.slice(0, 240), page: lines[i].page, excerpt: L.slice(0, 240), review: false })
      continue
    }
    if (LEGAL_REF.test(L) && !key) continue
    const time = findTime(L)
    for (const d of dates) {
      raw.push({ key: key || 'outro', name: key ? STAGE_TYPES[key] : (label.replace(/^[-–•\s]+/, '').slice(0, 90) || 'Data importante'), startDate: d.start, endDate: d.end || '', time, tbd: false, yearMissing: !!d.yearMissing, description: L.slice(0, 240), page: lines[i].page, excerpt: L.slice(0, 240), review: !key })
    }
  }
  // ano ausente: herda o da data mais próxima já lida (marcado para revisão — nunca silencioso)
  const dom = dominantYear(raw.map((r) => r.startDate).filter((d) => d && !d.startsWith('?')))
  let lastYear = null
  for (const r of raw) {
    const y = r.startDate && !r.startDate.startsWith('?') ? r.startDate.slice(0, 4) : null
    if (y) lastYear = y
    if (r.startDate.startsWith('?')) {
      const use = lastYear || dom
      if (use) { r.startDate = use + r.startDate.slice(1); if (r.endDate.startsWith('?')) r.endDate = use + r.endDate.slice(1); r.review = true; r.note = 'Ano não consta no trecho; confirme.' }
      else { r.startDate = ''; r.endDate = ''; r.tbd = true; r.review = true; r.note = 'Data sem ano no documento.' }
    }
  }
  // datas soltas (sem etapa conhecida) só entram se estiverem próximas do ano dominante: evita datas de leis citadas
  const kept = raw.filter((r) => {
    const y = r.startDate ? +r.startDate.slice(0, 4) : null
    if (y && y < 2000) return false
    if (r.key === 'outro') return y && dom && Math.abs(y - dom) <= 2
    return true
  })
  const seen = new Set(), out = []
  for (const r of kept) { const k = `${r.key}|${r.startDate}|${r.endDate}|${r.name}`; if (!seen.has(k)) { seen.add(k); out.push(r) } }
  return out
}

// ---------------------------------------------------------------- metadados
const BANCAS = ['CEBRASPE', 'CESPE', 'FGV', 'FCC', 'VUNESP', 'IBFC', 'IDECAN', 'CESGRANRIO', 'QUADRIX', 'AOCP', 'FUNDATEC', 'IADES', 'CONSULPLAN', 'FUNCAB', 'CETRO', 'FAFIPA', 'IBADE', 'FUNDEP', 'FEPESE', 'COPEVE', 'UFPR', 'NUCEPE', 'IDIB', 'OBJETIVA CONCURSOS', 'INSTITUTO AOCP', 'FADESP', 'FUNIVERSA', 'NC-UFPR', 'FUMARC', 'COMPERVE', 'SELECON', 'CONSESP', 'LEGALLE', 'INAZ DO PARÁ', 'MS CONCURSOS', 'RBO']
const ORG_RE = /(prefeitura|tribunal|c[aâ]mara|assembleia|secretaria|minist[eé]rio|instituto|universidade|pol[ií]cia|defensoria|conselho|banco|governo|ag[eê]ncia|autarquia|funda[cç][aã]o|companhia|empresa|c[oó]rpo de bombeiros|minist[eé]rio p[uú]blico|procuradoria|c[aâ]mara municipal|servi[cç]o)\b/i

export function extractMeta(lines) {
  const head = lines.slice(0, 80)
  const text = lines.map((l) => l.text).join('\n')
  const meta = { name: '', organ: '', role: '', roles: [], board: '', vagas: '', requisitos: '', examDate: '', sources: {} }
  const mark = (k, line) => { meta.sources[k] = { page: line.page, excerpt: line.text.slice(0, 200) } }
  const nameLine = head.find((l) => /(concurso p[uú]blico|processo seletivo|edital\s*(n[ºo°.]|de abertura))/i.test(l.text) && !/\d{1,2}\/\d{1,2}\/\d{2,4}|\bpublica[cç][aã]o\b/i.test(l.text) && l.text.length < 160)
  if (nameLine) { meta.name = nameLine.text.replace(/\s+/g, ' ').trim(); mark('name', nameLine) }
  const orgLine = head.find((l) => ORG_RE.test(l.text) && l.text.length < 120 && !/concurso|edital/i.test(l.text)) || head.find((l) => ORG_RE.test(l.text) && l.text.length < 140)
  if (orgLine) { meta.organ = orgLine.text.trim(); mark('organ', orgLine) }
  for (const l of lines) {
    const m = l.text.match(/banca\s+(?:organizadora|examinadora|executora)?\s*[:\-–]?\s*([A-Za-zÀ-ú0-9 .\-–&/]{3,70})/i)
    if (m && !meta.board && !/ser[aá]|ser |ficar/i.test(m[1].slice(0, 8))) { meta.board = m[1].replace(/\s{2,}.*/, '').replace(/[.;,]+$/, '').trim(); mark('board', l) }
  }
  if (!meta.board) {
    for (const l of lines.slice(0, 400)) { const b = BANCAS.find((x) => new RegExp(`(^|[^A-Za-z])${x}([^A-Za-z]|$)`).test(l.text)); if (b) { meta.board = b; mark('board', l); break } }
  }
  const roleSet = new Set()
  for (const l of lines) {
    const m = l.text.match(/^cargos?\s*(?:\d+)?\s*[:\-–]\s*(.{4,90})$/i)
    if (m) { roleSet.add(m[1].replace(/[.;]+$/, '').trim()); if (!meta.role) { meta.role = m[1].replace(/[.;]+$/, '').trim(); mark('role', l) } }
  }
  meta.roles = [...roleSet].slice(0, 20)
  for (const l of lines) {
    const m = l.text.match(/(?:total de |n[uú]mero de |oferece |s[aã]o oferecidas |ofertadas? )?(\d[\d.]*)\s*(?:\([^)]*\)\s*)?vagas?\b/i)
    if (m && /vaga/i.test(l.text)) { meta.vagas = m[1].replace(/\.$/, ''); mark('vagas', l); break }
  }
  const idx = lines.findIndex((l) => /requisitos?\s*(?:para (?:a )?investidura|do cargo|exigidos?|b[aá]sicos?)?\s*[:\-–]/i.test(l.text))
  if (idx >= 0) {
    const body = lines.slice(idx, idx + 3).map((l) => l.text).join(' ').replace(/^.*?[:\-–]\s*/, '').slice(0, 360)
    meta.requisitos = body.trim(); mark('requisitos', lines[idx])
  }
  void text
  return meta
}

export function extractCriteria(lines) {
  const re = /eliminat[oó]ri|ser[aá] eliminad|ser[aá] considerad[oa]s? aprovad|ser[aá] aprovad|nota m[ií]nima|n[aã]o ser[aá] classificad|crit[eé]rios? de (aprova|elimina|desempate)|obter[aá]? (?:no m[ií]nimo|pontua[cç][aã]o m[ií]nima)|ser[aá] desclassificad/i
  const out = [], seen = new Set()
  for (const l of lines) if (re.test(l.text) && l.text.length > 25) { const k = norm(l.text).slice(0, 80); if (!seen.has(k)) { seen.add(k); out.push({ text: l.text.slice(0, 320), page: l.page }) } if (out.length >= 15) break }
  return out
}

// ---------------------------------------------------------------- conteúdo programático
const ZONE_HEAD = /^(anexo\s+[ivxlc\d]+\s*[-–—:.]?\s*)?(d[oa]s?\s+)?(conte[uú]dos?\s+program[aá]ticos?|programa\s+das\s+provas|programa\s+de\s+(provas|disciplinas)|programa[s]?\s+e\s+bibliografia|conte[uú]dos?\s+das\s+provas)/i
const ZONE_END = /^anexo\s+[ivxlc\d]+\s*[-–—:.]?\s*(.*)$/i
const GROUP_HEAD = /^conhecimentos?\s+(b[aá]sicos?|espec[ií]ficos?|gerais)\b/i
const IGNORE_HEAD = /^(conte[uú]dos?|anexo|cargos?|n[ií]vel|prova|parte|obs|observa|nota|p[aá]gina|edital|concurso|bibliografia|refer[eê]ncias|programa|quadro|tabela|legisla[cç][aã]o aplic)/i
const ITEM_START = /^(\d{1,2}(?:\.\d{1,2}){0,3}[.)]?\s+\S|[-–•*▪●]\s+\S|[a-z]\)\s+\S|[ivx]{1,4}\s*[-–.)]\s+\S)/i
const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'com'])
const titleCase = (s) => s.toLowerCase().split(' ').map((w, i) => (i && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
const upperRatio = (s) => { const l = s.replace(/[^A-Za-zÀ-ú]/g, ''); return l.length ? l.replace(/[^A-ZÀ-Ý]/g, '').length / l.length : 0 }
const INLINE = /(?:^|(?<=[\s.;:]))(\d{1,2}(?:\.\d{1,2}){0,3})(?:\.|\))?\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g

function headingAt(lines, i, ctx) {
  const t = lines[i].text
  if (!t) return null
  // forma em linha ("DISCIPLINA: 1 Tópico. 2 Tópico…") pode ser longa; as demais formas são curtas
  const inline = t.match(/^([A-ZÀ-Ý][A-ZÀ-Ý0-9 ,\-–/&ªº]{3,80}):\s*(\S.*)$/)
  if (inline && upperRatio(inline[1]) > 0.85 && !/\d/.test(inline[1]) && !IGNORE_HEAD.test(inline[1])) return { name: inline[1].trim(), rest: inline[2] }
  if (t.length > 140) return null
  const m = t.match(/^(?:disciplina|mat[eé]ria|componente curricular)\s*[:\-–]\s*(.+)$/i)
  if (m) return { name: m[1].trim(), rest: '' }
  if (GROUP_HEAD.test(t) && t.length < 60) {
    const nx = lines.slice(i + 1, i + 3).find((l) => l.text)
    ctx.group = t
    return nx && ITEM_START.test(nx.text) ? { name: t.replace(/[:\s]+$/, ''), rest: '' } : { skip: true }
  }
  if (t.length >= 4 && t.length <= 90 && upperRatio(t) >= 0.85 && !/\d/.test(t) && !/[.;]$/.test(t) && !IGNORE_HEAD.test(t) && /[A-Za-zÀ-ú]{3}/.test(t)) return { name: t.replace(/[:\s]+$/, ''), rest: '' }
  const nx = lines.slice(i + 1, i + 3).find((l) => l.text)
  if (t.length <= 70 && /^[A-ZÀ-Ý]/.test(t) && !/^\d/.test(t) && !/[.;,]$/.test(t) && !ITEM_START.test(t) && nx && ITEM_START.test(nx.text) && !IGNORE_HEAD.test(t) && t.split(' ').length <= 8) return { name: t.replace(/:$/, ''), rest: '' }
  return null
}

function splitInline(text) {
  const marks = [...text.matchAll(INLINE)]
  if (!marks.length) return [{ number: '', text }]
  const out = []
  if (marks[0].index > 0 && text.slice(0, marks[0].index).trim()) out.push({ number: '', text: text.slice(0, marks[0].index).trim() })
  marks.forEach((m, k) => { out.push({ number: m[1], text: text.slice(m.index + m[0].length, k + 1 < marks.length ? marks[k + 1].index : undefined).trim() }) })
  return out
}
const clean = (s) => s.replace(/\s+/g, ' ').replace(/[\s.;,:]+$/, '').trim()

function parseItems(block, opts) {
  // 1) agrupa linhas em itens (nova linha numerada/marcador = novo item; demais = continuação)
  const items = []
  for (const l of block) {
    if (!l.text) continue
    if (ITEM_START.test(l.text) || !items.length) items.push({ text: l.text, page: l.page })
    else {
      const cur = items[items.length - 1]
      cur.text = /[a-zà-ú]-$/.test(cur.text) && /^[a-zà-ú]/.test(l.text) ? cur.text.slice(0, -1) + l.text : cur.text + ' ' + l.text
    }
  }
  // 2) interpreta numeração/marcadores e quebra sequências numeradas "em parágrafo"
  const out = []
  let lastNumDepth = -1
  const put = (depth, number, text, page, extra = {}) => { const t = clean(text); if (t) out.push({ depth: Math.min(depth, 3), number, text: t, page, ...extra }) }
  for (const it of items) {
    let t = it.text
    const bullet = t.match(/^([-–•*▪●]|[a-z]\)|[ivx]{1,4}\s*[-–.)])\s+(.*)$/i)
    if (bullet && !/^\d/.test(t)) { put(lastNumDepth >= 0 ? lastNumDepth + 1 : 0, '', bullet[2], it.page); continue }
    for (const seg of splitInline(t)) {
      if (!seg.number) { put(0, '', seg.text, it.page, { uncertain: true }); continue }
      const depth = seg.number.split('.').length - 1
      lastNumDepth = depth
      put(depth, seg.number, seg.text, it.page)
    }
  }
  if (opts.splitSemicolons) {
    const res = []
    for (const it of out) {
      const parts = it.text.split(/\s*;\s*/)
      const colon = it.text.indexOf(':')
      if (parts.length >= 3 && colon > 0 && it.depth < 3) {
        const head = it.text.slice(0, colon).trim(); const rest = it.text.slice(colon + 1).split(/\s*;\s*/)
        res.push({ ...it, text: head }); rest.forEach((r) => clean(r) && res.push({ ...it, depth: it.depth + 1, number: '', text: clean(r), uncertain: true }))
      } else res.push(it)
    }
    return res
  }
  return out
}

export function extractSyllabus(lines, opts = {}) {
  const o = { splitSemicolons: false, ...opts }
  const warnings = []
  const cands = []
  lines.forEach((l, i) => { if (l.text.length <= 100 && ZONE_HEAD.test(l.text)) cands.push(i) })
  const attempts = cands.length ? cands : [0]
  let best = null
  for (const start of attempts) {
    const res = runZone(lines, start, o)
    const score = res.disciplines.reduce((a, d) => a + d.items.length, 0)
    if (!best || score >= best.score) best = { ...res, score, start }
  }
  if (!cands.length) warnings.push('Não encontrei uma seção "Conteúdo programático"; revise as disciplinas detectadas.')
  if (!best.disciplines.length) warnings.push('Nenhuma disciplina foi identificada automaticamente. Você pode adicioná-las manualmente.')
  return { disciplines: best.disciplines, warnings }
}

function runZone(lines, start, o) {
  const disciplines = []
  const ctx = { group: '' }
  let cur = null
  const flush = () => {
    if (!cur) return
    let items = parseItems(cur.lines, o)
    if (!items.length && cur.rest) items = parseItems([{ text: cur.rest, page: cur.page }], o)
    const exist = disciplines.find((d) => norm(d.name) === norm(cur.name))
    if (exist) { const seen = new Set(exist.items.map((x) => norm(x.text))); for (const it of items) if (!seen.has(norm(it.text))) exist.items.push(it) }
    else if (items.length) disciplines.push({ name: upperRatio(cur.name) > 0.85 ? titleCase(cur.name) : cur.name, rawName: cur.name, page: cur.page, items })
    cur = null
  }
  for (let i = start + (ZONE_HEAD.test(lines[start]?.text || '') ? 1 : 0); i < lines.length; i++) {
    const t = lines[i].text
    const em = t.match(ZONE_END)
    if (em && i > start + 1 && !/conte[uú]d|program|disciplin|conhecimento/i.test(em[1] || '')) break
    const h = headingAt(lines, i, ctx)
    if (h?.skip) continue
    if (h) {
      flush()
      cur = { name: h.name, rest: h.rest, page: lines[i].page, lines: h.rest ? [{ text: h.rest, page: lines[i].page }] : [] }
      continue
    }
    if (cur) cur.lines.push(lines[i])
  }
  flush()
  // disciplina sem numeração: o texto vira itens por frase
  for (const d of disciplines) if (d.items.length === 1 && d.items[0].uncertain && d.items[0].text.length > 160) {
    const parts = d.items[0].text.split(/(?<=[.;])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/).map(clean).filter(Boolean)
    if (parts.length > 1) d.items = parts.map((p) => ({ depth: 0, number: '', text: p, page: d.items[0].page, uncertain: true }))
  }
  return { disciplines }
}

/** Ponto de entrada: pages = [{ page, text }]. */
export function parseEdital(pages, opts = {}) {
  const lines = buildLines(pages)
  const meta = extractMeta(lines)
  const { disciplines, warnings } = extractSyllabus(lines, opts)
  const stages = extractStages(lines)
  const criteria = extractCriteria(lines)
  const exam = stages.find((s) => s.key === 'prova_objetiva' && s.startDate)
  if (exam) meta.examDate = exam.startDate
  if (!stages.length) warnings.push('Nenhuma data ou etapa foi identificada. O cronograma pode ser cadastrado manualmente ("A definir").')
  if (stages.some((s) => s.review)) warnings.push('Algumas datas precisam de revisão (sem etapa reconhecida ou sem ano no texto).')
  return { meta, disciplines, stages, criteria, warnings, lineCount: lines.length }
}
