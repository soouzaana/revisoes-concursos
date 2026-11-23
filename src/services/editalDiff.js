/** Comparação entre o edital cadastrado e uma retificação/atualização. Só gera a LISTA de diferenças; nada é aplicado aqui. */
import { keywords, norm, sameWord } from '../utils/text'
import { STAGE_TYPES } from './stageEngine'

const sim = (a, b) => {
  const A = keywords(a), B = keywords(b)
  if (!A.length || !B.length) return 0
  const m = A.filter((x) => B.some((y) => sameWord(x, y))).length
  return m / Math.max(A.length, B.length)
}
const fmt = (s) => (!s.startDate ? 'A definir' : (s.endDate && s.endDate !== s.startDate ? `${s.startDate} a ${s.endDate}` : s.startDate) + (s.time ? ` ${s.time}` : ''))
const fmtBR = (s) => fmt(s).replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1')
const sameWhen = (a, b) => (a.startDate || '') === (b.startDate || '') && (a.endDate || '') === (b.endDate || '') && ((a.time || '') === (b.time || '') || !b.time)

/** existing: etapas cadastradas; incoming: etapas extraídas do novo documento. */
export function diffStages(existing, incoming) {
  const pool = existing.filter((s) => !s.withdrawn)
  const used = new Set(), changes = []
  for (const inc of incoming) {
    const same = pool.filter((s) => !used.has(s.id) && s.key === inc.key && (inc.key !== 'outro' || norm(s.name) === norm(inc.name)))
    let best = null, bestScore = -1
    for (const s of same) { const sc = (s.startDate === inc.startDate ? 2 : 0) + sim(s.description || s.name, inc.description || inc.name); if (sc > bestScore) { best = s; bestScore = sc } }
    if (!best) {
      changes.push({ id: `add:${inc.key}:${inc.startDate}:${changes.length}`, type: 'stage_added', label: `Nova etapa: ${inc.name || STAGE_TYPES[inc.key]}`, after: fmtBR(inc), selected: true, incoming: inc })
      continue
    }
    used.add(best.id)
    if (!sameWhen(best, inc)) changes.push({ id: `date:${best.id}`, type: 'stage_date', label: `Data alterada: ${best.name}`, before: fmtBR(best), after: fmtBR(inc), selected: true, stageId: best.id, incoming: inc })
  }
  for (const s of pool) if (!used.has(s.id)) changes.push({ id: `rem:${s.id}`, type: 'stage_removed', label: `Etapa não consta na nova versão: ${s.name}`, before: fmtBR(s), selected: false, stageId: s.id })
  return changes
}

/**
 * existing: [{ subjectName, items:[{ id, text }] }] (assuntos já cadastrados, por disciplina);
 * incoming: disciplinas extraídas [{ name, items:[{ text, depth, number, page }] }].
 */
export function diffSyllabus(existing, incoming) {
  const changes = []
  const usedDisc = new Set()
  for (const d of incoming) {
    const ex = existing.find((e) => !usedDisc.has(e.subjectName) && (norm(e.subjectName) === norm(d.name) || sim(e.subjectName, d.name) >= 0.8))
    if (!ex) { changes.push({ id: `disc:${norm(d.name)}`, type: 'discipline_added', label: `Nova disciplina: ${d.name}`, after: `${d.items.length} item(ns)`, selected: true, discipline: d }); continue }
    usedDisc.add(ex.subjectName)
    const exByNorm = new Map(ex.items.map((i) => [norm(i.text), i]))
    const incNorm = new Set(d.items.map((i) => norm(i.text)))
    const removed = ex.items.filter((i) => !incNorm.has(norm(i.text)))
    const added = d.items.filter((i) => !exByNorm.has(norm(i.text)))
    const renamedPairs = []
    for (const a of [...added]) {
      const r = removed.find((x) => !renamedPairs.some((p) => p.before.id === x.id) && sim(x.text, a.text) >= 0.8)
      if (r) { renamedPairs.push({ before: r, after: a }); added.splice(added.indexOf(a), 1) }
    }
    for (const p of renamedPairs) changes.push({ id: `ren:${p.before.id}`, type: 'topic_renamed', label: `Texto alterado em ${ex.subjectName}`, before: p.before.text, after: p.after.text, selected: true, topicId: p.before.id, incoming: p.after })
    for (const a of added) changes.push({ id: `tadd:${norm(ex.subjectName)}:${norm(a.text)}`, type: 'topic_added', label: `Novo assunto em ${ex.subjectName}`, after: a.text, selected: true, subjectName: ex.subjectName, incoming: a })
    for (const r of removed) if (!renamedPairs.some((p) => p.before.id === r.id)) changes.push({ id: `trem:${r.id}`, type: 'topic_removed', label: `Assunto não consta mais em ${ex.subjectName}`, before: r.text, selected: false, topicId: r.id })
  }
  return changes
}

export function summarize(changes) {
  const c = (t) => changes.filter((x) => x.type === t).length
  return { dates: c('stage_date'), stagesAdded: c('stage_added'), stagesRemoved: c('stage_removed'), topicsAdded: c('topic_added') + c('discipline_added'), topicsRemoved: c('topic_removed'), topicsRenamed: c('topic_renamed'), total: changes.length }
}
