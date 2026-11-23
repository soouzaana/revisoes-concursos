import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll } from '../database/repository'
import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { plain } from '../utils/plain'
import { norm } from '../utils/text'
import { isValidDateStr } from '../utils/date'
import { withHistory, STAGE_STATUS } from '../services/stageEngine'
import { useConcursoStore } from './concurso'
import { useSubjectsStore } from './subjects'
import { useSettingsStore } from './settings'

/** Edital importado: documentos, etapas do cronograma, vínculos com o histórico e registro de alterações. */
export const useEditalStore = defineStore('edital', () => {
  const docs = ref([])
  const stages = ref([])
  const links = ref([])
  const changes = ref([])
  const concurso = useConcursoStore(), subjects = useSubjectsStore(), settings = useSettingsStore()

  async function load() {
    const [d, s, l, c] = await Promise.all([getAll('editalDocs'), getAll('contestStages'), getAll('topicLinks'), getAll('editalChanges')])
    docs.value = d.sort((a, b) => a.importedAt.localeCompare(b.importedAt)); stages.value = s; links.value = l
    changes.value = c.sort((a, b) => b.at.localeCompare(a.at))
  }
  const contestId = computed(() => concurso.current?.id || '')
  const myStages = computed(() => stages.value.filter((s) => s.contestId === contestId.value))
  const myDocs = computed(() => docs.value.filter((d) => d.contestId === contestId.value))
  const myChanges = computed(() => changes.value.filter((c) => c.contestId === contestId.value))
  const linksByTopic = computed(() => { const m = {}; for (const l of links.value) (m[l.topicId] ||= []).push(l); return m })
  const docById = (id) => docs.value.find((d) => d.id === id)
  const synonymsText = computed(() => settings.synonymsText)

  /** Garante a matéria (existente por nome ou nova). */
  async function ensureSubject(name) {
    const hit = subjects.items.find((s) => norm(s.name) === norm(name))
    return hit || subjects.add(name)
  }

  /**
   * Confirma a importação já revisada pelo usuário. `disciplines`: [{ name, subjectId?, items:[{depth,number,text,page}] }].
   * Grava tudo em uma única transação; nunca apaga dados existentes.
   */
  async function confirmImport({ target, meta, disciplines, stagesIn, criteria = [], doc }) {
    const subjIds = []
    for (const d of disciplines) { const s = d.subjectId ? subjects.get(d.subjectId) : await ensureSubject(d.name); subjIds.push(s.id) }
    const now = new Date().toISOString()
    let contest = target === 'current' ? concurso.current : null
    const merged = (c) => ({
      ...c, name: meta.name?.trim() || c.name || 'Concurso', organ: meta.organ || c.organ || '', role: meta.role || c.role || '', board: meta.board || c.board || '',
      vagas: meta.vagas || c.vagas || '', requisitos: meta.requisitos || c.requisitos || '', examDate: meta.examDate || c.examDate || '', criteria: criteria.length ? criteria : c.criteria || []
    })
    if (!contest) contest = merged({ id: uid(), status: 'studying', subjectIds: [], createdAt: now })
    else contest = merged(plain(contest))
    contest.subjectIds = [...new Set([...(contest.subjectIds || []), ...subjIds])]
    const docRec = { id: uid(), contestId: contest.id, name: doc.name, kind: 'edital', importedAt: now, pageCount: doc.pageCount, ocrPages: doc.ocrPages, pages: doc.pages.map((p) => ({ page: p.page, text: p.text, method: p.method })) }
    const existingTopics = concurso.syllabus.filter((t) => t.contestId === contest.id)
    const topics = []
    disciplines.forEach((d, di) => {
      const stack = []; const siblings = new Map()
      for (const it of d.items) {
        const depth = Math.min(it.depth, stack.length) // não permite pular níveis
        const parentId = depth === 0 ? null : stack[depth - 1]
        const key = `${subjIds[di]}|${parentId}`
        const order = (siblings.get(key) ?? existingTopics.filter((t) => t.subjectId === subjIds[di] && (t.parentId || null) === parentId).length)
        siblings.set(key, order + 1)
        const t = { id: uid(), contestId: contest.id, subjectId: subjIds[di], parentId, name: it.text, numbering: it.number || '', status: 'not_started', order, reviews: [], lastReviewedAt: '', createdAt: now, source: { docId: docRec.id, page: it.page }, matchState: 'pending' }
        stack.length = depth; stack[depth] = t.id
        topics.push(t)
      }
    })
    const stageRecs = stagesIn.map((s) => ({
      id: uid(), contestId: contest.id, key: s.key, name: s.name, startDate: s.startDate || '', endDate: s.endDate || '', time: s.time || '', description: s.description || '',
      status: 'not_started', source: { docId: docRec.id, page: s.page, excerpt: s.excerpt || '' }, notes: '', score: '', rank: '', result: '', statusUpdatedAt: '', history: [], dateHistory: [], createdAt: now, tbd: !s.startDate
    }))
    const log = { id: uid(), contestId: contest.id, docId: docRec.id, at: now, kind: 'import', label: `Edital importado: ${doc.name}`, detail: `${topics.length} assunto(s), ${stageRecs.length} etapa(s)` }
    await withTx(['contests', 'syllabus', 'contestStages', 'editalDocs', 'editalChanges'], 'readwrite', async (s) => {
      await s.contests.put(contest); await s.editalDocs.put(docRec); await s.editalChanges.put(log)
      for (const t of topics) await s.syllabus.put(t)
      for (const st of stageRecs) await s.contestStages.put(st)
    })
    if (target !== 'current' || !settings.currentContestId) await settings.setCurrentContest(contest.id)
    await Promise.all([concurso.load(), load()])
    return { contest, topics, stages: stageRecs }
  }

  // --- etapas ---
  async function saveStage(form, id = null) {
    const errors = {}
    if (!(form.name || '').trim()) errors.name = 'Informe o nome da etapa.'
    for (const f of ['startDate', 'endDate']) if (form[f] && !isValidDateStr(form[f])) errors[f] = 'Data inválida.'
    if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = 'O fim não pode ser antes do início.'
    if (Object.keys(errors).length) throw Object.assign(new Error('Formulário inválido'), { errors })
    const prev = id ? stages.value.find((s) => s.id === id) : null
    const base = prev ? plain(prev) : { id: uid(), contestId: contestId.value, status: 'not_started', history: [], dateHistory: [], notes: '', score: '', rank: '', result: '', source: null, createdAt: new Date().toISOString() }
    if (!base.contestId) throw new Error('Cadastre o concurso primeiro.')
    let next = { ...base, key: form.key || 'outro', name: form.name.trim(), startDate: form.startDate || '', endDate: form.endDate || '', time: form.time || '', description: (form.description || '').trim(), tbd: !form.startDate }
    if (prev && (prev.startDate !== next.startDate || prev.endDate !== next.endDate || prev.time !== next.time)) next.dateHistory = [...(prev.dateHistory || []), { at: new Date().toISOString(), origin: 'manual', startDate: prev.startDate, endDate: prev.endDate, time: prev.time }]
    next = withHistory(next, { status: form.status ?? next.status, score: form.score ?? next.score, rank: form.rank ?? next.rank, result: form.result ?? next.result, notes: form.notes ?? next.notes })
    await withTx(['contestStages'], 'readwrite', (s) => s.contestStages.put(next))
    await load(); return next
  }
  /** Status, nota, classificação, resultado e observações: só o usuário altera (nada avança sozinho). */
  async function updateStageStatus(id, patch) {
    const st = stages.value.find((s) => s.id === id); if (!st) return
    if (patch.status && !STAGE_STATUS[patch.status]) throw new Error('Status inválido.')
    const next = withHistory(plain(st), patch)
    await withTx(['contestStages'], 'readwrite', (s) => s.contestStages.put(next)); await load()
  }
  async function removeStage(id) { await withTx(['contestStages'], 'readwrite', (s) => s.contestStages.delete(id)); await load() }

  // --- retificações ---
  /**
   * Aplica as diferenças que o usuário confirmou. Nunca apaga status/resultado/observações: etapas ou assuntos
   * "removidos" ficam preservados e apenas marcados como retirados (withdrawn).
   */
  async function applyRectification({ changes: list, doc }) {
    const now = new Date().toISOString()
    const docRec = { id: uid(), contestId: contestId.value, name: doc.name, kind: 'retificacao', importedAt: now, pageCount: doc.pageCount, ocrPages: doc.ocrPages, pages: doc.pages.map((p) => ({ page: p.page, text: p.text, method: p.method })) }
    const logs = []
    const log = (kind, label, before, after) => logs.push({ id: uid(), contestId: contestId.value, docId: docRec.id, at: now, kind, label, before: before ?? '', after: after ?? '' })
    const newStages = [], newTopics = [], upStages = [], upTopics = []
    for (const ch of list.filter((c) => c.selected)) {
      if (ch.type === 'stage_date') {
        const st = stages.value.find((s) => s.id === ch.stageId); if (!st) continue
        const i = ch.incoming
        upStages.push({ ...plain(st), startDate: i.startDate || '', endDate: i.endDate || '', time: i.time || st.time, tbd: !i.startDate, dateHistory: [...(st.dateHistory || []), { at: now, origin: docRec.id, startDate: st.startDate, endDate: st.endDate, time: st.time }], source: { docId: docRec.id, page: i.page, excerpt: i.excerpt || '' } })
        log('stage_date', ch.label, ch.before, ch.after)
      } else if (ch.type === 'stage_added') {
        const i = ch.incoming
        newStages.push({ id: uid(), contestId: contestId.value, key: i.key, name: i.name, startDate: i.startDate || '', endDate: i.endDate || '', time: i.time || '', description: i.description || '', status: 'not_started', source: { docId: docRec.id, page: i.page, excerpt: i.excerpt || '' }, notes: '', score: '', rank: '', result: '', statusUpdatedAt: '', history: [], dateHistory: [], createdAt: now, tbd: !i.startDate })
        log('stage_added', ch.label, '', ch.after)
      } else if (ch.type === 'stage_removed') {
        const st = stages.value.find((s) => s.id === ch.stageId); if (!st) continue
        upStages.push({ ...plain(st), withdrawn: true, withdrawnAt: now, withdrawnBy: docRec.id }) // preservado, só oculto
        log('stage_removed', ch.label, ch.before, '')
      } else if (ch.type === 'topic_added') {
        const subj = subjects.items.find((s) => norm(s.name) === norm(ch.subjectName)); if (!subj) continue
        const sibl = concurso.syllabus.filter((t) => t.subjectId === subj.id && !t.parentId).length + newTopics.length
        newTopics.push({ id: uid(), contestId: contestId.value, subjectId: subj.id, parentId: null, name: ch.incoming.text, numbering: ch.incoming.number || '', status: 'not_started', order: sibl, reviews: [], lastReviewedAt: '', createdAt: now, source: { docId: docRec.id, page: ch.incoming.page }, matchState: 'pending' })
        log('topic_added', ch.label, '', ch.after)
      } else if (ch.type === 'discipline_added') {
        const subj = await ensureSubject(ch.discipline.name)
        const c = concurso.current; if (c && !c.subjectIds.includes(subj.id)) upTopics.push({ __contest: { ...plain(c), subjectIds: [...c.subjectIds, subj.id] } })
        const stack = []
        for (const it of ch.discipline.items) {
          const depth = Math.min(it.depth, stack.length); const t = { id: uid(), contestId: contestId.value, subjectId: subj.id, parentId: depth ? stack[depth - 1] : null, name: it.text, numbering: it.number || '', status: 'not_started', order: newTopics.length, reviews: [], lastReviewedAt: '', createdAt: now, source: { docId: docRec.id, page: it.page }, matchState: 'pending' }
          stack.length = depth; stack[depth] = t.id; newTopics.push(t)
        }
        log('topic_added', ch.label, '', ch.after)
      } else if (ch.type === 'topic_renamed') {
        const t = concurso.syllabus.find((x) => x.id === ch.topicId); if (!t) continue
        upTopics.push({ ...plain(t), name: ch.incoming.text, previousNames: [...(t.previousNames || []), t.name], source: { docId: docRec.id, page: ch.incoming.page } }) // status e revisões preservados
        log('topic_renamed', ch.label, ch.before, ch.after)
      } else if (ch.type === 'topic_removed') {
        const t = concurso.syllabus.find((x) => x.id === ch.topicId); if (!t) continue
        upTopics.push({ ...plain(t), withdrawn: true, withdrawnAt: now, withdrawnBy: docRec.id })
        log('topic_removed', ch.label, ch.before, '')
      }
    }
    log('rectification', `Documento importado: ${doc.name}`, '', `${list.filter((c) => c.selected).length} alteração(ões) aplicada(s)`)
    await withTx(['editalDocs', 'contestStages', 'syllabus', 'contests', 'editalChanges'], 'readwrite', async (s) => {
      await s.editalDocs.put(docRec)
      for (const x of [...upStages, ...newStages]) await s.contestStages.put(x)
      for (const x of [...upTopics, ...newTopics]) { if (x.__contest) await s.contests.put(x.__contest); else await s.syllabus.put(x) }
      for (const l of logs) await s.editalChanges.put(l)
    })
    await Promise.all([concurso.load(), load()])
    return { applied: logs.length - 1 }
  }

  // --- vínculos com o histórico (somente o usuário confirma) ---
  /**
   * Confirma uma correspondência. `records`: [{ kind, ids:[...] }] — grava uma referência por registro original.
   * Não cria nem altera estudos/questões/flashcards. `state`: 'confirmed' | 'partial'.
   */
  async function confirmMatch(topicId, state, records, { confidence = '', manual = false } = {}) {
    const t = concurso.syllabus.find((x) => x.id === topicId); if (!t) return
    const now = new Date().toISOString()
    const recs = []
    for (const r of records) for (const refId of r.ids) recs.push({ id: `${topicId}:${r.kind}:${refId}`, topicId, kind: r.kind, refId, state, confidence, manual, createdAt: now })
    const rank = { not_started: 0, studying: 1, partial: 2, studied: 3, reviewing: 4, mastered: 5 }
    const want = state === 'partial' ? 'partial' : 'studied'
    const status = rank[t.status] >= rank[want] && t.status !== 'studying' ? t.status : want // nunca rebaixa nem sobrescreve revisando/dominado
    await withTx(['topicLinks', 'syllabus'], 'readwrite', async (s) => {
      for (const l of recs) await s.topicLinks.put(l)
      await s.syllabus.put({ ...plain(t), status, matchState: state === 'partial' ? 'partial' : 'confirmed' })
    })
    await Promise.all([concurso.load(), load()])
  }
  /** "Ainda não estudei" ou "ignorar sugestão": registra a decisão sem alterar o histórico. */
  async function decideMatch(topicId, decision) {
    const t = concurso.syllabus.find((x) => x.id === topicId); if (!t) return
    await withTx(['syllabus'], 'readwrite', (s) => s.syllabus.put({ ...plain(t), matchState: decision, ...(decision === 'not_studied' && t.status === 'partial' ? { status: 'not_started' } : {}) }))
    await concurso.load()
  }
  async function resetMatch(topicId) {
    const t = concurso.syllabus.find((x) => x.id === topicId); if (!t) return
    await withTx(['syllabus', 'topicLinks'], 'readwrite', async (s) => {
      await s.syllabus.put({ ...plain(t), matchState: 'pending' })
      for (const k of await s.topicLinks.index('topicId').getAllKeys(topicId)) await s.topicLinks.delete(k) // só a referência; o histórico não é tocado
    })
    await Promise.all([concurso.load(), load()])
  }
  /** Vínculo direto (ao registrar estudo/questão/flashcard escolhendo o assunto do edital). */
  async function linkRecord(topicId, kind, refId) {
    if (!topicId) return
    const t = concurso.syllabus.find((x) => x.id === topicId); if (!t) return
    await withTx(['topicLinks', 'syllabus'], 'readwrite', async (s) => {
      await s.topicLinks.put({ id: `${topicId}:${kind}:${refId}`, topicId, kind, refId, state: 'confirmed', confidence: 'direct', manual: true, createdAt: new Date().toISOString() })
      if (t.status === 'not_started') await s.syllabus.put({ ...plain(t), status: 'studying' })
    })
    await Promise.all([concurso.load(), load()])
  }

  return { docs, stages, links, changes, myStages, myDocs, myChanges, linksByTopic, contestId, synonymsText, load, docById, confirmImport, saveStage, updateStageStatus, removeStage, applyRectification, confirmMatch, decideMatch, resetMatch, linkRecord }
})
