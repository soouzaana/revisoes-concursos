<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, Pencil, Trash2, CalendarClock, Flag, Hourglass, CheckCircle2, XCircle, Circle, Clock, FileText, Upload, GitCompare, Trophy } from 'lucide-vue-next'
import { useConcursoStore } from '../stores/concurso'
import { useEditalStore } from '../stores/edital'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { STAGE_STATUS, STAGE_TYPES, STATUS_TONE, candidateSituation, dateLabel, isFinished, isNegative, nextStage, sortStages, upcomingDates, visibleStages, waitingResults } from '../services/stageEngine'
import { formatDate, relativeDay } from '../utils/date'
import { plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'

const concurso = useConcursoStore(), edital = useEditalStore(), clock = useClockStore(), toast = useToast(), confirm = useConfirm()
const c = computed(() => concurso.current)
const stages = computed(() => sortStages(visibleStages(edital.myStages)))
const hidden = computed(() => edital.myStages.filter((s) => s.withdrawn))
const next = computed(() => nextStage(edital.myStages, clock.today))
const upcoming = computed(() => upcomingDates(edital.myStages, clock.today, 5))
const situation = computed(() => candidateSituation(edital.myStages))
const waiting = computed(() => waitingResults(edital.myStages))
const doneStages = computed(() => stages.value.filter(isFinished).length)
const p = computed(() => concurso.progress)
const open = ref(false), editing = ref(null), errors = ref({}), srcOpen = ref(null)
const blank = () => ({ key: 'outro', name: '', startDate: '', endDate: '', time: '', description: '', status: 'not_started', score: '', rank: '', result: '', notes: '' })
const form = reactive(blank())

const trajectory = computed(() => {
  const out = []
  for (const s of edital.myStages) for (const h of s.history || []) out.push({ at: h.at, label: `${s.name}: ${STAGE_STATUS[h.status]}`, detail: [h.score && `nota ${h.score}`, h.rank && `classificação ${h.rank}`, h.result, h.notes].filter(Boolean).join(' · ') })
  for (const ch of edital.myChanges) out.push({ at: ch.at, label: ch.label, detail: [ch.before && `antes: ${ch.before}`, ch.after && `depois: ${ch.after}`, ch.detail].filter(Boolean).join(' · '), doc: true })
  return out.sort((a, b) => b.at.localeCompare(a.at))
})
const NODE = { not_started: Circle, awaiting: Clock, done: CheckCircle2, awaiting_result: Hourglass, approved: Trophy, failed: XCircle, eliminated: XCircle, waived: Circle, cancelled: Circle }
const nodeRing = (s) => (next.value?.id === s.id ? 'ring-2 ring-accent' : '')
const tone = (s) => (isNegative(s) ? 'border-danger/60' : s.status === 'approved' ? 'border-ok/60' : s.status === 'awaiting_result' ? 'border-warn/60' : next.value?.id === s.id ? 'border-accent' : 'border-line')
const dot = (s) => (isNegative(s) ? 'text-danger' : s.status === 'approved' || s.status === 'done' ? 'text-ok' : s.status === 'awaiting_result' ? 'text-warn' : next.value?.id === s.id ? 'text-accent' : 'text-mute')
const docName = (s) => edital.docById(s.source?.docId)?.name || ''
const srcPageText = computed(() => edital.docById(srcOpen.value?.source?.docId)?.pages.find((x) => x.page === srcOpen.value?.source?.page)?.text || '')

function openNew() { editing.value = null; Object.assign(form, blank()); errors.value = {}; open.value = true }
function openEdit(s) { editing.value = s.id; Object.assign(form, blank(), { key: s.key, name: s.name, startDate: s.startDate, endDate: s.endDate, time: s.time, description: s.description, status: s.status, score: s.score, rank: s.rank, result: s.result, notes: s.notes }); errors.value = {}; open.value = true }
async function submit() { try { await edital.saveStage({ ...form }, editing.value); open.value = false; toast.ok('Etapa salva') } catch (e) { errors.value = e.errors || {}; if (!e.errors) toast.error(e.message) } }
async function del(s) { if (await confirm({ title: 'Excluir etapa', message: `Excluir "${s.name}" e o histórico dela?\nPara apenas ocultar, use uma retificação.`, confirmLabel: 'Excluir', danger: true })) { await edital.removeStage(s.id); open.value = false; toast.ok('Etapa excluída') } }
const onKey = () => { if (form.key !== 'outro' && !form.name) form.name = STAGE_TYPES[form.key] }
const quick = (s, status) => edital.updateStageStatus(s.id, { status })
const when = (iso) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const countdown = computed(() => (concurso.daysToExam === null ? '' : concurso.daysToExam > 0 ? `faltam ${plural(concurso.daysToExam, 'dia', 'dias')}` : concurso.daysToExam === 0 ? 'a prova é hoje' : ''))
const SIT = { good: 'bg-ok-soft text-ok', bad: 'bg-danger-soft text-danger', wait: 'bg-warn-soft text-warn', neutral: 'bg-sunken text-mute', none: 'bg-sunken text-mute' }
</script>

<template>
  <PageHeader title="Cronograma do concurso" subtitle="Acompanhe todas as etapas. Os status são registrados por você — nada avança sozinho.">
    <RouterLink to="/concurso/importar?modo=retificacao" class="btn-line btn-sm" data-testid="import-rectification"><GitCompare :size="14" /> Importar retificação</RouterLink>
    <button v-if="c" class="btn-primary btn-sm" data-testid="new-stage" @click="openNew"><Plus :size="14" /> Etapa</button>
  </PageHeader>

  <EmptyState v-if="!c" title="Nenhum concurso cadastrado" text="Importe o edital em PDF ou cadastre o concurso manualmente.">
    <RouterLink to="/concurso/importar" class="btn-primary"><Upload :size="16" /> Importar edital</RouterLink><RouterLink to="/concurso/edital" class="btn-line">Cadastrar manualmente</RouterLink>
  </EmptyState>

  <template v-else>
    <section class="panel mb-6 p-5" data-testid="tracking-panel">
      <h2 class="font-display text-xl font-extrabold">{{ c.name }}</h2>
      <p class="text-sm text-mute">{{ [c.role, c.organ, c.board && 'Banca ' + c.board, c.vagas && c.vagas + ' vaga(s)'].filter(Boolean).join(' · ') || 'Cargo e banca não informados' }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span v-if="c.examDate" class="flex items-center gap-1.5 font-semibold"><CalendarClock :size="16" class="text-accent" />Prova: {{ formatDate(c.examDate) }}</span>
        <span v-if="countdown" class="pill bg-accent-soft text-accent" data-testid="countdown">{{ countdown }}</span>
        <span class="pill" :class="SIT[situation.tone]" data-testid="situation">{{ situation.label }}</span>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p class="font-display text-2xl font-extrabold">{{ p.completionPct }}%</p><p class="text-xs text-mute">do conteúdo programático</p></div>
        <div><p class="font-display text-2xl font-extrabold text-ok">{{ p.done }}</p><p class="text-xs text-mute">tópicos estudados</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ p.pending }}</p><p class="text-xs text-mute">pendentes</p></div>
        <div><p class="font-display text-2xl font-extrabold text-accent">{{ p.count.mastered }}</p><p class="text-xs text-mute">dominados</p></div>
      </div>
      <ProgressBar :value="p.completionPct" tone="ok" class="mt-3" />
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-sunken p-3 text-sm" data-testid="next-stage"><p class="text-xs font-semibold uppercase tracking-wide text-mute"><Flag :size="12" class="mr-1 inline" />Próxima etapa</p><template v-if="next"><p class="mt-1 font-semibold">{{ next.name }}</p><p class="text-xs text-mute">{{ dateLabel(next) }}<template v-if="next.startDate"> · {{ relativeDay(next.startDate, clock.today) }}</template></p></template><p v-else class="mt-1 text-mute">Nenhuma etapa pendente.</p></div>
        <div class="rounded-xl bg-sunken p-3 text-sm"><p class="text-xs font-semibold uppercase tracking-wide text-mute">Resumo</p><p class="mt-1">{{ doneStages }} de {{ stages.length }} etapa(s) concluída(s)</p><p v-if="waiting.length" class="text-xs font-semibold text-warn">{{ plural(waiting.length, 'resultado aguardado', 'resultados aguardados') }}</p></div>
      </div>
      <div v-if="upcoming.length" class="mt-4"><p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mute">Próximas datas importantes</p><ul class="space-y-1 text-sm"><li v-for="s in upcoming" :key="s.id" class="flex justify-between gap-3"><span class="truncate">{{ s.name }}</span><span class="shrink-0 text-xs text-mute">{{ dateLabel(s) }}</span></li></ul></div>
    </section>

    <section class="mb-8">
      <h2 class="mb-3 font-display text-lg font-bold">Linha do tempo</h2>
      <EmptyState v-if="!stages.length" title="Sem etapas cadastradas" text="Importe o edital para extrair as datas ou adicione as etapas manualmente. O que não estiver no edital aparece como “A definir”.">
        <button class="btn-primary" @click="openNew"><Plus :size="16" /> Adicionar etapa</button>
      </EmptyState>
      <ol v-else class="relative space-y-3 border-l-2 border-line pl-5" data-testid="timeline-stages">
        <li v-for="s in stages" :key="s.id" class="relative" data-testid="stage-item">
          <span class="absolute -left-[31px] top-4 grid h-5 w-5 place-items-center rounded-full bg-surface" :class="[dot(s), nodeRing(s)]"><component :is="NODE[s.status]" :size="18" /></span>
          <div class="panel p-4" :class="tone(s)">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0"><p class="font-semibold" :class="s.status === 'cancelled' && 'line-through text-mute'">{{ s.name }}<span v-if="next?.id === s.id" class="pill ml-2 bg-accent text-accent-fg">próxima</span></p>
                <p class="text-sm" :class="s.startDate ? 'text-mute' : 'font-semibold text-warn'">{{ dateLabel(s) }}</p></div>
              <span class="pill" :class="STATUS_TONE[s.status]" data-testid="stage-status">{{ STAGE_STATUS[s.status] }}</span>
            </div>
            <p v-if="s.score || s.rank || s.result" class="mt-1.5 text-xs"><template v-if="s.score">Nota: <b>{{ s.score }}</b> </template><template v-if="s.rank">· Classificação: <b>{{ s.rank }}</b> </template><template v-if="s.result">· {{ s.result }}</template></p>
            <p v-if="s.notes" class="mt-1 text-xs text-mute">{{ s.notes }}</p>
            <p v-if="s.source?.page" class="mt-1.5 text-[11px] text-mute">Origem: {{ docName(s) || 'documento' }}, p. {{ s.source.page }}<button v-if="s.source.docId" class="ml-1 font-semibold text-accent" @click="srcOpen = s">ver trecho</button></p>
            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <select :value="s.status" class="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold" :aria-label="`Status de ${s.name}`" @change="quick(s, $event.target.value)"><option v-for="(l, k) in STAGE_STATUS" :key="k" :value="k">{{ l }}</option></select>
              <button class="btn-line btn-sm" @click="openEdit(s)"><Pencil :size="13" /> Editar / resultado</button>
            </div>
          </div>
        </li>
      </ol>
      <p v-if="hidden.length" class="mt-3 text-xs text-mute">{{ plural(hidden.length, 'etapa oculta', 'etapas ocultas') }} por retificações (dados preservados).</p>
    </section>

    <section class="mb-8">
      <h2 class="mb-3 font-display text-lg font-bold">Histórico da trajetória</h2>
      <p v-if="!trajectory.length" class="text-sm text-mute">As mudanças de status, resultados e atualizações de edital aparecem aqui.</p>
      <ul v-else class="panel divide-y divide-line" data-testid="trajectory"><li v-for="(t, i) in trajectory" :key="i" class="px-4 py-3 text-sm"><p class="font-medium">{{ t.label }}</p><p v-if="t.detail" class="text-xs text-mute">{{ t.detail }}</p><p class="text-[11px] text-mute">{{ when(t.at) }}</p></li></ul>
    </section>

    <section v-if="edital.myDocs.length" class="mb-8">
      <h2 class="mb-3 font-display text-lg font-bold">Documentos importados</h2>
      <ul class="panel divide-y divide-line text-sm"><li v-for="d in edital.myDocs" :key="d.id" class="flex items-center gap-3 px-4 py-3"><FileText :size="16" class="shrink-0 text-mute" /><span class="min-w-0 flex-1 truncate">{{ d.name }}<span class="block text-xs text-mute">{{ d.kind === 'retificacao' ? 'Retificação' : 'Edital' }} · {{ d.pageCount }} página(s){{ d.ocrPages ? ` · ${d.ocrPages} por OCR` : '' }} · {{ when(d.importedAt) }}</span></span></li></ul>
    </section>
  </template>

  <BaseModal :open="open" wide :title="editing ? 'Editar etapa' : 'Nova etapa'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label" for="sg-key">Tipo</label><select id="sg-key" v-model="form.key" class="field" @change="onKey"><option v-for="(l, k) in STAGE_TYPES" :key="k" :value="k">{{ l }}</option></select></div>
        <div><label class="label" for="sg-name">Nome</label><input id="sg-name" v-model="form.name" class="field" :class="{ 'field-error': errors.name }" /><p v-if="errors.name" class="hint-error">{{ errors.name }}</p></div>
        <div><label class="label" for="sg-start">Data inicial</label><input id="sg-start" v-model="form.startDate" type="date" class="field" :class="{ 'field-error': errors.startDate }" /></div>
        <div><label class="label" for="sg-end">Data final</label><input id="sg-end" v-model="form.endDate" type="date" class="field" :class="{ 'field-error': errors.endDate }" /><p v-if="errors.endDate" class="hint-error">{{ errors.endDate }}</p></div>
        <div><label class="label" for="sg-time">Horário</label><input id="sg-time" v-model="form.time" type="time" class="field" /></div>
        <div><label class="label" for="sg-status">Status</label><select id="sg-status" v-model="form.status" class="field"><option v-for="(l, k) in STAGE_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
        <div><label class="label" for="sg-score">Nota obtida</label><input id="sg-score" v-model="form.score" class="field" inputmode="decimal" /></div>
        <div><label class="label" for="sg-rank">Classificação</label><input id="sg-rank" v-model="form.rank" class="field" placeholder="Ex.: 12º" /></div>
      </div>
      <div><label class="label" for="sg-result">Resultado</label><input id="sg-result" v-model="form.result" class="field" placeholder="Ex.: Aprovado na lista de ampla concorrência" /></div>
      <div><label class="label" for="sg-desc">Descrição</label><textarea id="sg-desc" v-model="form.description" rows="2" class="field" /></div>
      <div><label class="label" for="sg-notes">Observações</label><textarea id="sg-notes" v-model="form.notes" rows="2" class="field" /></div>
      <p v-if="editing" class="text-xs text-mute">Ao salvar, a atualização fica registrada no histórico da trajetória com data e hora.</p>
      <div class="flex gap-2"><button class="btn-primary flex-1" type="submit" data-testid="save-stage">Salvar etapa</button><button v-if="editing" type="button" class="btn-ghost text-danger" @click="del(edital.stages.find((x) => x.id === editing))"><Trash2 :size="16" /></button></div>
    </form>
  </BaseModal>

  <BaseModal :open="!!srcOpen" wide :title="srcOpen ? `Página ${srcOpen.source.page} — ${docName(srcOpen)}` : ''" @close="srcOpen = null">
    <p v-if="srcOpen?.source.excerpt" class="mb-2 rounded-lg bg-accent-soft p-2 text-xs text-accent">Trecho usado: “{{ srcOpen.source.excerpt }}”</p>
    <pre class="max-h-[60dvh] overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3 text-xs">{{ srcPageText }}</pre>
  </BaseModal>
</template>
