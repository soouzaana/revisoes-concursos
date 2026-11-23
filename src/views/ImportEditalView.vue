<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { FileUp, ShieldCheck, ArrowRight, ArrowLeft, Trash2, Plus, IndentIncrease, IndentDecrease, FileText, AlertTriangle, Check } from 'lucide-vue-next'
import { useConcursoStore } from '../stores/concurso'
import { useEditalStore } from '../stores/edital'
import { useSubjectsStore } from '../stores/subjects'
import { useToast } from '../composables/useToast'
import { extractPdf, PdfError, MAX_PDF_MB } from '../services/pdfService'
import { parseEdital } from '../services/editalParser'
import { diffStages, diffSyllabus, summarize } from '../services/editalDiff'
import { STAGE_TYPES } from '../services/stageEngine'
import { buildTree } from '../services/concursoEngine'
import { norm, keywords, sameWord } from '../utils/text'
import { formatDate } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'

const route = useRoute(), router = useRouter(), toast = useToast()
const concurso = useConcursoStore(), edital = useEditalStore(), subjects = useSubjectsStore()
const rectify = computed(() => route.query.modo === 'retificacao' && !!concurso.current)

const step = ref('upload') // upload | reading | review | diff | saving
const ocrMode = ref('auto'), target = ref(concurso.current ? 'current' : 'new')
const file = ref(null), progress = ref({ stage: '', current: 0, total: 0, page: 0 }), error = ref('')
const extracted = ref(null), splitSemi = ref(false)
const draft = reactive({ meta: {}, disciplines: [], stages: [], criteria: [], warnings: [] })
const diff = ref([]), openDisc = ref(0), viewPage = ref(0), uidN = ref(1)
const nid = () => uidN.value++

const stageOpts = Object.entries(STAGE_TYPES)
const pct = computed(() => (progress.value.total ? Math.round((progress.value.current / progress.value.total) * 100) : 0))
const MESSAGES = { text: 'Lendo o texto das páginas', 'ocr-init': 'Preparando o OCR (offline)', ocr: 'Reconhecendo texto das páginas escaneadas (OCR)', done: 'Concluído' }
const progressLabel = computed(() => `${MESSAGES[progress.value.stage] || 'Processando'}… ${progress.value.page ? 'página ' + progress.value.page + ' · ' : ''}${progress.value.current}/${progress.value.total}`)

function bestSubject(name) {
  const exact = subjects.items.find((s) => norm(s.name) === norm(name))
  if (exact) return exact.id
  const K = keywords(name)
  const hit = subjects.items.find((s) => { const S = keywords(s.name); return S.length && K.length && S.every((x) => K.some((y) => sameWord(x, y))) && K.every((y) => S.some((x) => sameWord(x, y))) })
  return hit?.id || ''
}
function loadDraft(parsed) {
  draft.meta = { ...parsed.meta }
  draft.disciplines = parsed.disciplines.map((d) => ({ uid: nid(), name: d.name, subjectId: bestSubject(d.name), items: d.items.map((i) => ({ uid: nid(), ...i })) }))
  draft.stages = parsed.stages.map((s) => ({ uid: nid(), ...s }))
  draft.criteria = parsed.criteria.map((c) => ({ uid: nid(), ...c }))
  draft.warnings = parsed.warnings
}
const reparse = () => { if (extracted.value) loadDraft(parseEdital(extracted.value.pages, { splitSemicolons: splitSemi.value })) }

function pick(e) { file.value = e.target.files?.[0] || null; error.value = '' }
async function read() {
  error.value = ''
  step.value = 'reading'; progress.value = { stage: 'text', current: 0, total: 0, page: 0 }
  try {
    extracted.value = await extractPdf(file.value, { ocr: ocrMode.value, onProgress: (p) => { progress.value = { page: 0, ...p } } })
    const parsed = parseEdital(extracted.value.pages, { splitSemicolons: splitSemi.value })
    loadDraft(parsed)
    for (const w of extracted.value.warnings) draft.warnings.push(w)
    if (rectify.value) {
      const existingStages = edital.myStages
      const existingTopics = concurso.contests.length ? concurso.subjectIds.map((sid) => ({ subjectName: subjects.nameOf(sid), items: concurso.topics.filter((t) => t.subjectId === sid).map((t) => ({ id: t.id, text: t.name })) })) : []
      diff.value = [...diffStages(existingStages, parsed.stages), ...diffSyllabus(existingTopics, parsed.disciplines)]
      step.value = 'diff'
    } else step.value = 'review'
  } catch (e) {
    error.value = e instanceof PdfError ? e.message : 'Erro inesperado ao processar o PDF: ' + e.message
    step.value = 'upload'
  }
}

// ---- edição da estrutura
const move = (it, d) => { it.depth = Math.max(0, Math.min(3, it.depth + d)) }
const addItem = (d) => d.items.push({ uid: nid(), depth: 0, number: '', text: '', page: 0 })
const delItem = (d, it) => { d.items = d.items.filter((x) => x !== it) }
const onKey = (s) => { if (s.key !== 'outro') s.name = STAGE_TYPES[s.key] }
const addDisc = () => { draft.disciplines.push({ uid: nid(), name: '', subjectId: '', items: [] }); openDisc.value = draft.disciplines.length - 1 }
const addStage = () => draft.stages.push({ uid: nid(), key: 'outro', name: '', startDate: '', endDate: '', time: '', description: '', page: 0, excerpt: '', review: false })
const totalItems = computed(() => draft.disciplines.reduce((a, d) => a + d.items.filter((i) => i.text.trim()).length, 0))
const pageText = computed(() => extracted.value?.pages.find((p) => p.page === Number(viewPage.value))?.text || '')
const canConfirm = computed(() => (draft.meta.name || '').trim() && (draft.disciplines.length || draft.stages.length))

async function confirm() {
  step.value = 'saving'
  try {
    const disciplines = draft.disciplines.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), subjectId: d.subjectId, items: d.items.filter((i) => i.text.trim()).map((i) => ({ depth: i.depth, number: i.number, text: i.text.trim(), page: i.page })) }))
    const stagesIn = draft.stages.filter((s) => s.name.trim() || s.key !== 'outro').map((s) => ({ ...s, name: s.name.trim() || STAGE_TYPES[s.key] }))
    await edital.confirmImport({ target: target.value, meta: draft.meta, disciplines, stagesIn, criteria: draft.criteria.map((c) => ({ text: c.text, page: c.page })), doc: { name: file.value.name, pageCount: extracted.value.pageCount, ocrPages: extracted.value.ocrPages, pages: extracted.value.pages } })
    toast.ok('Edital importado')
    router.push('/concurso/cruzamento')
  } catch (e) { toast.error(e.message); step.value = 'review' }
}
async function applyDiff() {
  step.value = 'saving'
  try {
    const { applied } = await edital.applyRectification({ changes: diff.value, doc: { name: file.value.name, pageCount: extracted.value.pageCount, ocrPages: extracted.value.ocrPages, pages: extracted.value.pages } })
    toast.ok(applied ? `${applied} alteração(ões) aplicada(s)` : 'Documento registrado sem alterações')
    router.push('/concurso/acompanhamento')
  } catch (e) { toast.error(e.message); step.value = 'diff' }
}
const summary = computed(() => summarize(diff.value))
const selectedCount = computed(() => diff.value.filter((c) => c.selected).length)
const TYPE_LABEL = { stage_date: 'Data alterada', stage_added: 'Etapa incluída', stage_removed: 'Etapa removida', topic_added: 'Assunto incluído', discipline_added: 'Disciplina incluída', topic_removed: 'Assunto removido', topic_renamed: 'Texto alterado' }
const TYPE_TONE = { stage_date: 'bg-warn-soft text-warn', stage_added: 'bg-ok-soft text-ok', stage_removed: 'bg-danger-soft text-danger', topic_added: 'bg-ok-soft text-ok', discipline_added: 'bg-ok-soft text-ok', topic_removed: 'bg-danger-soft text-danger', topic_renamed: 'bg-warn-soft text-warn' }
void buildTree; void formatDate
</script>

<template>
  <PageHeader :title="rectify ? 'Importar retificação' : 'Importar edital'" :subtitle="rectify ? 'Compare uma retificação ou cronograma atualizado com o que já está cadastrado.' : 'Envie o PDF do edital: o app extrai e organiza o conteúdo para você revisar.'">
    <RouterLink to="/concurso/edital" class="btn-line btn-sm"><ArrowLeft :size="14" /> Voltar ao edital</RouterLink>
  </PageHeader>

  <!-- 1. envio -->
  <section v-if="step === 'upload' || step === 'reading'" class="space-y-4">
    <div class="panel flex gap-3 p-4 text-sm"><ShieldCheck :size="20" class="mt-0.5 shrink-0 text-ok" /><p><b>Tudo é processado neste aparelho.</b> O PDF não é enviado a nenhum servidor, não há chaves de API nem custo. A interpretação usa regras de texto e comparação de palavras (não é inteligência artificial) e <b>você revisa tudo</b> antes de confirmar.</p></div>
    <div class="panel space-y-4 p-5">
      <div v-if="!rectify && concurso.current" class="space-y-1 text-sm">
        <p class="label">Importar para</p>
        <label class="flex items-center gap-2"><input v-model="target" type="radio" value="current" /> Concurso atual: <b>{{ concurso.current.name }}</b> (soma ao que já existe)</label>
        <label class="flex items-center gap-2"><input v-model="target" type="radio" value="new" /> Novo concurso</label>
      </div>
      <div>
        <label class="label" for="pdf-file">Arquivo PDF {{ rectify ? '(retificação ou atualização)' : 'do edital' }}</label>
        <input id="pdf-file" type="file" accept="application/pdf,.pdf" class="field" :disabled="step === 'reading'" data-testid="pdf-input" @change="pick" />
        <p class="mt-1 text-xs text-mute">Até {{ MAX_PDF_MB }} MB. PDFs escaneados são lidos por OCR em português, também offline (pode levar alguns minutos).</p>
      </div>
      <fieldset class="text-sm" :disabled="step === 'reading'">
        <legend class="label">Leitura de texto</legend>
        <label class="flex items-center gap-2"><input v-model="ocrMode" type="radio" value="auto" /> Automática: OCR somente nas páginas sem texto</label>
        <label class="flex items-center gap-2"><input v-model="ocrMode" type="radio" value="force" /> Forçar OCR em todas as páginas (use se o texto sair truncado)</label>
        <label class="flex items-center gap-2"><input v-model="ocrMode" type="radio" value="off" /> Sem OCR (mais rápido)</label>
      </fieldset>
      <p v-if="error" class="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger" role="alert" data-testid="import-error"><AlertTriangle :size="16" class="mt-0.5 shrink-0" />{{ error }}</p>
      <div v-if="step === 'reading'" class="space-y-2" data-testid="import-progress"><ProgressBar :value="pct" /><p class="text-xs text-mute">{{ progressLabel }}</p></div>
      <button class="btn-primary" :disabled="!file || step === 'reading'" data-testid="read-pdf" @click="read"><FileUp :size="18" /> {{ step === 'reading' ? 'Processando…' : 'Ler PDF' }}</button>
    </div>
  </section>

  <!-- 2. retificação: diferenças -->
  <section v-else-if="step === 'diff'" class="space-y-4" data-testid="diff-step">
    <div class="panel p-4 text-sm">
      <p class="font-semibold">{{ diff.length ? `${diff.length} diferença(s) encontrada(s) em "${file?.name}"` : 'Nenhuma diferença encontrada.' }}</p>
      <p class="mt-1 text-mute">Datas alteradas: {{ summary.dates }} · Etapas incluídas: {{ summary.stagesAdded }} · Etapas removidas: {{ summary.stagesRemoved }} · Assuntos incluídos: {{ summary.topicsAdded }} · Removidos: {{ summary.topicsRemoved }} · Alterados: {{ summary.topicsRenamed }}</p>
      <p class="mt-2 text-xs text-mute">Nada é apagado: status, resultados e observações são mantidos. O que for "removido" fica preservado e apenas oculto. Marque o que deseja aplicar.</p>
    </div>
    <ul class="space-y-2">
      <li v-for="c in diff" :key="c.id" class="panel flex items-start gap-3 p-3.5" data-testid="diff-item">
        <input v-model="c.selected" type="checkbox" class="mt-1 h-4 w-4 accent-[rgb(var(--c-accent))]" :aria-label="`Aplicar: ${c.label}`" />
        <div class="min-w-0 flex-1 text-sm">
          <span class="pill" :class="TYPE_TONE[c.type]">{{ TYPE_LABEL[c.type] }}</span>
          <p class="mt-1 font-medium">{{ c.label }}</p>
          <p v-if="c.before" class="text-xs text-mute">Antes: <span class="line-through">{{ c.before }}</span></p>
          <p v-if="c.after" class="text-xs">Depois: <b>{{ c.after }}</b></p>
        </div>
      </li>
    </ul>
    <div class="flex flex-wrap gap-2"><button class="btn-primary" data-testid="apply-diff" @click="applyDiff"><Check :size="16" /> Aplicar {{ selectedCount }} alteração(ões)</button><button class="btn-line" @click="step = 'upload'">Cancelar</button></div>
  </section>

  <!-- 3. revisão da estrutura extraída -->
  <section v-else-if="step === 'review' || step === 'saving'" class="space-y-6" data-testid="review-step">
    <div class="panel p-4 text-sm">
      <p class="font-semibold">Revise e corrija antes de confirmar.</p>
      <p class="mt-1 text-mute">{{ extracted.pageCount }} página(s) lida(s){{ extracted.ocrPages ? `, ${extracted.ocrPages} por OCR` : '' }} · {{ draft.disciplines.length }} disciplina(s) · {{ totalItems }} assunto(s) · {{ draft.stages.length }} etapa(s). Cada item guarda a página de origem.</p>
      <ul v-if="draft.warnings.length" class="mt-2 space-y-1 text-xs text-warn"><li v-for="w in draft.warnings" :key="w" class="flex gap-1.5"><AlertTriangle :size="13" class="mt-0.5 shrink-0" />{{ w }}</li></ul>
    </div>

    <div class="panel space-y-3 p-5">
      <h2 class="font-display text-lg font-bold">Concurso</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label" for="im-name">Nome do concurso</label><input id="im-name" v-model="draft.meta.name" class="field" /></div>
        <div><label class="label" for="im-organ">Órgão</label><input id="im-organ" v-model="draft.meta.organ" class="field" /></div>
        <div><label class="label" for="im-role">Cargo</label><input id="im-role" v-model="draft.meta.role" class="field" list="im-roles" /><datalist id="im-roles"><option v-for="r in draft.meta.roles || []" :key="r" :value="r" /></datalist></div>
        <div><label class="label" for="im-board">Banca organizadora</label><input id="im-board" v-model="draft.meta.board" class="field" /></div>
        <div><label class="label" for="im-vagas">Vagas</label><input id="im-vagas" v-model="draft.meta.vagas" class="field" placeholder="Não informado" /></div>
        <div><label class="label" for="im-exam">Data da prova</label><input id="im-exam" v-model="draft.meta.examDate" type="date" class="field" /></div>
      </div>
      <div><label class="label" for="im-req">Requisitos do cargo</label><textarea id="im-req" v-model="draft.meta.requisitos" rows="2" class="field" /></div>
      <ul v-if="draft.criteria.length" class="space-y-1.5 text-xs text-mute"><li class="label !mb-0">Critérios de aprovação/eliminação identificados</li><li v-for="c in draft.criteria" :key="c.uid" class="flex items-start gap-2 rounded-lg bg-sunken p-2"><span class="flex-1">{{ c.text }} <span class="text-[11px]">(p. {{ c.page }})</span></span><button class="text-danger" aria-label="Remover critério" @click="draft.criteria = draft.criteria.filter((x) => x !== c)"><Trash2 :size="13" /></button></li></ul>
    </div>

    <div class="panel space-y-3 p-5">
      <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-display text-lg font-bold">Conteúdo programático</h2><label class="flex items-center gap-2 text-xs text-mute"><input v-model="splitSemi" type="checkbox" @change="reparse" /> Dividir itens separados por ponto e vírgula em subtópicos <span>(refaz a leitura)</span></label></div>
      <p v-if="!draft.disciplines.length" class="text-sm text-mute">Nenhuma disciplina identificada. Adicione manualmente.</p>
      <div v-for="(d, di) in draft.disciplines" :key="d.uid" class="rounded-xl border border-line" data-testid="import-discipline">
        <div class="flex flex-wrap items-center gap-2 p-3">
          <button class="btn-ghost btn-sm" :aria-expanded="openDisc === di" @click="openDisc = openDisc === di ? -1 : di">{{ openDisc === di ? '▾' : '▸' }}</button>
          <input v-model="d.name" class="field !w-auto min-w-[10rem] flex-1 !py-1.5 font-semibold" aria-label="Nome da disciplina" />
          <select v-model="d.subjectId" class="field !w-auto !py-1.5 text-xs" aria-label="Matéria do app"><option value="">Criar/usar matéria "{{ d.name || '…' }}"</option><option v-for="s in subjects.items" :key="s.id" :value="s.id">Usar: {{ s.name }}</option></select>
          <span class="text-xs text-mute">{{ d.items.length }} item(ns)</span>
          <button class="btn-ghost btn-sm text-danger" aria-label="Remover disciplina" @click="draft.disciplines.splice(di, 1)"><Trash2 :size="14" /></button>
        </div>
        <div v-if="openDisc === di" class="space-y-1.5 border-t border-line p-3">
          <div v-for="it in d.items" :key="it.uid" class="flex items-center gap-1.5" :style="{ paddingLeft: it.depth * 18 + 'px' }">
            <span class="w-9 shrink-0 text-right text-[11px] text-mute">{{ it.number }}</span>
            <input v-model="it.text" class="field !py-1.5 text-sm" aria-label="Texto do assunto" />
            <span v-if="it.page" class="shrink-0 text-[11px] text-mute">p.{{ it.page }}</span>
            <button class="btn-ghost btn-sm !p-1" aria-label="Diminuir nível" :disabled="it.depth === 0" @click="move(it, -1)"><IndentDecrease :size="14" /></button>
            <button class="btn-ghost btn-sm !p-1" aria-label="Aumentar nível" :disabled="it.depth >= 3" @click="move(it, 1)"><IndentIncrease :size="14" /></button>
            <button class="btn-ghost btn-sm !p-1 text-danger" aria-label="Remover assunto" @click="delItem(d, it)"><Trash2 :size="13" /></button>
          </div>
          <button class="btn-soft btn-sm" @click="addItem(d)"><Plus :size="14" /> Assunto</button>
        </div>
      </div>
      <button class="btn-line btn-sm" @click="addDisc"><Plus :size="14" /> Disciplina</button>
    </div>

    <div class="panel space-y-3 p-5">
      <h2 class="font-display text-lg font-bold">Cronograma e datas importantes</h2>
      <p v-if="!draft.stages.length" class="text-sm text-mute">Nenhuma data identificada. Você pode cadastrar etapas depois (aparecerão como "A definir").</p>
      <div v-for="s in draft.stages" :key="s.uid" class="rounded-xl border p-3" :class="s.review ? 'border-warn/60' : 'border-line'" data-testid="import-stage">
        <div class="grid gap-2 sm:grid-cols-[12rem_1fr]">
          <select v-model="s.key" class="field !py-1.5 text-sm" aria-label="Tipo da etapa" @change="onKey(s)"><option v-for="[k, l] in stageOpts" :key="k" :value="k">{{ l }}</option></select>
          <input v-model="s.name" class="field !py-1.5 text-sm" aria-label="Nome da etapa" />
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><label class="text-[11px] text-mute">Início</label><input v-model="s.startDate" type="date" class="field !py-1.5 text-sm" /></div>
          <div><label class="text-[11px] text-mute">Fim</label><input v-model="s.endDate" type="date" class="field !py-1.5 text-sm" /></div>
          <div><label class="text-[11px] text-mute">Horário</label><input v-model="s.time" type="time" class="field !py-1.5 text-sm" /></div>
          <div class="flex items-end"><button class="btn-ghost btn-sm text-danger" aria-label="Remover etapa" @click="draft.stages = draft.stages.filter((x) => x !== s)"><Trash2 :size="14" /> Remover</button></div>
        </div>
        <p v-if="!s.startDate" class="mt-1 text-xs font-semibold text-warn">A definir</p>
        <p v-if="s.excerpt" class="mt-1.5 text-[11px] text-mute">Origem: p. {{ s.page }} — “{{ s.excerpt }}”<span v-if="s.note" class="font-semibold text-warn"> · {{ s.note }}</span></p>
      </div>
      <button class="btn-line btn-sm" @click="addStage"><Plus :size="14" /> Etapa</button>
    </div>

    <details class="panel p-4 text-sm"><summary class="flex cursor-pointer items-center gap-2 font-semibold"><FileText :size="16" /> Ver o texto extraído de uma página</summary>
      <div class="mt-3 space-y-2"><select v-model="viewPage" class="field !w-auto !py-1.5 text-xs" aria-label="Página"><option :value="0">Escolha a página</option><option v-for="p in extracted.pages" :key="p.page" :value="p.page">Página {{ p.page }} ({{ p.method === 'ocr' ? 'OCR' : p.method === 'text' ? 'texto' : 'sem texto' }})</option></select><pre v-if="viewPage" class="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken p-3 text-xs">{{ pageText }}</pre></div></details>

    <div class="flex flex-wrap gap-2"><button class="btn-primary" :disabled="!canConfirm || step === 'saving'" data-testid="confirm-import" @click="confirm">{{ step === 'saving' ? 'Salvando…' : 'Confirmar importação' }} <ArrowRight :size="16" /></button><button class="btn-line" @click="step = 'upload'">Cancelar</button></div>
  </section>
</template>
