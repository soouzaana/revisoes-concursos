/** Etapas do concurso: tipos, status manuais e leitura do andamento. Nada avança sozinho. */
import { diffDays } from '../utils/date'

export const STAGE_TYPES = {
  publicacao_edital: 'Publicação do edital', inscricoes: 'Período de inscrições', isencao: 'Solicitação de isenção', pagamento: 'Pagamento da inscrição',
  prova_objetiva: 'Prova objetiva', gabarito: 'Divulgação dos gabaritos', recursos: 'Recursos', resultado_preliminar: 'Resultado preliminar',
  resultado_definitivo: 'Resultado definitivo', prova_discursiva: 'Prova discursiva', prova_pratica: 'Prova prática', prova_titulos: 'Avaliação de títulos',
  taf: 'Teste de Aptidão Física (TAF)', psicologica: 'Avaliação psicológica', medica: 'Avaliação médica', investigacao_social: 'Investigação social',
  curso_formacao: 'Curso de formação', resultado_final: 'Resultado final', homologacao: 'Homologação', convocacao: 'Convocação', nomeacao: 'Nomeação', posse: 'Posse', outro: 'Outra data importante'
}
/** Ordem típica só para desempate visual — as datas é que mandam. */
export const STAGE_ORDER = Object.keys(STAGE_TYPES)

export const STAGE_STATUS = {
  not_started: 'Não iniciada', awaiting: 'Aguardando realização', done: 'Realizada', awaiting_result: 'Aguardando resultado',
  approved: 'Aprovada', failed: 'Reprovada', eliminated: 'Eliminada', waived: 'Dispensada', cancelled: 'Cancelada'
}
export const STATUS_TONE = {
  not_started: 'bg-sunken text-mute', awaiting: 'bg-accent-soft text-accent', done: 'bg-ok-soft text-ok', awaiting_result: 'bg-warn-soft text-warn',
  approved: 'bg-ok text-white', failed: 'bg-danger-soft text-danger', eliminated: 'bg-danger text-white', waived: 'bg-sunken text-mute', cancelled: 'bg-sunken text-mute line-through'
}
const FINISHED = new Set(['done', 'approved', 'failed', 'eliminated', 'waived', 'cancelled'])
const NEGATIVE = new Set(['failed', 'eliminated'])
export const isFinished = (s) => FINISHED.has(s.status)
export const isNegative = (s) => NEGATIVE.has(s.status)
export const hasDate = (s) => !!s.startDate
export const dateLabel = (s) => (!s.startDate ? 'A definir' : s.endDate && s.endDate !== s.startDate ? `${fmt(s.startDate)} a ${fmt(s.endDate)}` : fmt(s.startDate)) + (s.time ? ` · ${s.time}` : '')
const fmt = (d) => d.split('-').reverse().join('/')

/** Ordena por data (sem data = "A definir" no fim, preservando a ordem típica das etapas). */
export function sortStages(stages) {
  return [...stages].sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || STAGE_ORDER.indexOf(a.key) - STAGE_ORDER.indexOf(b.key) || (a.createdAt || '').localeCompare(b.createdAt || ''))
}
export const visibleStages = (stages) => stages.filter((s) => !s.withdrawn)

/** Próxima etapa: primeira (por data) não finalizada cuja data final ainda não passou ou que está sem data. */
export function nextStage(stages, today) {
  return sortStages(visibleStages(stages)).find((s) => !isFinished(s) && (!s.startDate || (s.endDate || s.startDate) >= today)) || null
}
export const waitingResults = (stages) => visibleStages(stages).filter((s) => s.status === 'awaiting_result')
export const upcomingDates = (stages, today, limit = 5) => sortStages(visibleStages(stages)).filter((s) => s.startDate && !isFinished(s) && (s.endDate || s.startDate) >= today).slice(0, limit)
export const daysUntil = (date, today) => diffDays(today, date)

/** Situação do candidato, calculada somente do que o usuário registrou. */
export function candidateSituation(stages) {
  const vis = visibleStages(stages)
  if (!vis.length) return { tone: 'none', label: 'Sem etapas cadastradas' }
  const eliminated = vis.find(isNegative)
  if (eliminated) return { tone: 'bad', label: `${STAGE_STATUS[eliminated.status]} em: ${eliminated.name}`, stage: eliminated }
  const appr = [...sortStages(vis)].reverse().find((s) => s.status === 'approved')
  const wait = waitingResults(vis)[0]
  if (wait) return { tone: 'wait', label: `Aguardando resultado: ${wait.name}`, stage: wait }
  if (appr) return { tone: 'good', label: `Aprovado em: ${appr.name}`, stage: appr }
  const done = vis.filter((s) => s.status === 'done').length
  return { tone: 'neutral', label: done ? `${done} etapa(s) realizada(s)` : 'Nenhuma etapa realizada ainda' }
}

/** Entrada do histórico da trajetória ao mudar o status/resultado (preserva tudo o que já existia). */
export function withHistory(stage, patch, { origin = 'manual', at = new Date().toISOString() } = {}) {
  const tracked = ['status', 'score', 'rank', 'result', 'notes']
  const changed = tracked.filter((k) => patch[k] !== undefined && (patch[k] ?? '') !== (stage[k] ?? ''))
  const next = { ...stage, ...patch }
  if (!changed.length) return next
  next.statusUpdatedAt = at
  next.history = [...(stage.history || []), { at, origin, status: next.status, score: next.score ?? '', rank: next.rank ?? '', result: next.result ?? '', notes: next.notes ?? '', changed }]
  return next
}
