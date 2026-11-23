<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, X, Ban, Link2, Search, BookText, Info, RotateCcw, Settings2 } from 'lucide-vue-next'
import { useConcursoStore } from '../stores/concurso'
import { useEditalStore } from '../stores/edital'
import { useStudiesStore } from '../stores/studies'
import { useQuestionsStore } from '../stores/questions'
import { useFlashcardsStore } from '../stores/flashcards'
import { useReviewsStore } from '../stores/reviews'
import { useSubjectsStore } from '../stores/subjects'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../composables/useToast'
import { LEVELS, buildRecords, matchTopics, parseSynonyms, searchRecords, LEVEL_RANK } from '../services/editalMatcher'
import { norm } from '../utils/text'
import { formatDate } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const concurso = useConcursoStore(), edital = useEditalStore(), studies = useStudiesStore(), questions = useQuestionsStore(), cards = useFlashcardsStore()
const reviews = useReviewsStore(), subjects = useSubjectsStore(), settings = useSettingsStore(), toast = useToast()

const subjectFilter = ref(''), levelFilter = ref(''), showDecided = ref(false)
const selected = reactive(new Set())
const manual = ref(null), manualQ = ref(''), synOpen = ref(false), synText = ref('')

// histórico COMPLETO do usuário (inclusive anterior ao concurso) — somente leitura
const records = computed(() => {
  const reviewedKeys = new Set()
  for (const r of reviews.enriched) if (r.completedAt) for (const t of r.content.topics) reviewedKeys.add(`${t.subjectId}|${norm(t.topic)}`)
  return buildRecords({ studies: studies.items, questions: questions.items, flashcards: cards.items, reviewedKeys, nameOf: (id) => subjects.nameOf(id) })
})
const synonyms = computed(() => parseSynonyms(settings.synonymsText))
const topics = computed(() => concurso.topics)
const discName = (t) => subjects.nameOf(t.subjectId)
const results = computed(() => matchTopics(topics.value.map((t) => ({ id: t.id, text: t.name, disciplineName: discName(t) })), records.value, { synonyms: synonyms.value }))

const decided = (t) => ['confirmed', 'partial', 'not_studied', 'ignored'].includes(t.matchState)
const rows = computed(() => topics.value
  .filter((t) => (showDecided.value ? true : !decided(t)))
  .filter((t) => !subjectFilter.value || t.subjectId === subjectFilter.value)
  .map((t) => ({ t, m: results.value.get(t.id) }))
  .filter((r) => !levelFilter.value || r.m.level === levelFilter.value)
  .sort((a, b) => LEVEL_RANK[b.m.level] - LEVEL_RANK[a.m.level] || a.t.name.localeCompare(b.t.name, 'pt-BR')))
const pendingCount = computed(() => topics.value.filter((t) => !decided(t)).length)
const LEVEL_TONE = { exact: 'bg-ok-soft text-ok', probable: 'bg-accent-soft text-accent', partial: 'bg-warn-soft text-warn', none: 'bg-sunken text-mute' }
const STATE_LABEL = { confirmed: 'Confirmado como estudado', partial: 'Parcialmente estudado', not_studied: 'Ainda não estudado', ignored: 'Sugestão ignorada' }
const recordsOf = (c) => ['study', 'question', 'flashcard'].map((k) => ({ kind: k, ids: c.rec.ids[k] })).filter((x) => x.ids.length)
const countsText = (rec) => [rec.counts.study && `${rec.counts.study} estudo(s)`, rec.counts.question && `${rec.counts.question} questão(ões)`, rec.counts.flashcard && `${rec.counts.flashcard} flashcard(s)`, rec.reviewed && 'revisado'].filter(Boolean).join(' · ')

const wrap = async (fn, ok) => { try { await fn(); if (ok) toast.ok(ok) } catch (e) { toast.error(e.message) } }
const confirm = (row, state) => wrap(() => edital.confirmMatch(row.t.id, state, recordsOf(row.m.candidates[0]), { confidence: row.m.level }), state === 'partial' ? 'Marcado como parcialmente estudado' : 'Marcado como estudado')
const notStudied = (row) => wrap(() => edital.decideMatch(row.t.id, 'not_studied'))
const ignore = (row) => wrap(() => edital.decideMatch(row.t.id, 'ignored'))
const reset = (t) => wrap(() => edital.resetMatch(t.id), 'Decisão desfeita')
const toggle = (id) => (selected.has(id) ? selected.delete(id) : selected.add(id))
const selectable = computed(() => rows.value.filter((r) => r.m.candidates.length && !decided(r.t)))
async function batch(state) {
  const ids = [...selected]
  for (const id of ids) { const r = selectable.value.find((x) => x.t.id === id); if (r) await edital.confirmMatch(id, state, recordsOf(r.m.candidates[0]), { confidence: r.m.level }) }
  selected.clear(); toast.ok(`${ids.length} conteúdo(s) atualizado(s) por sua confirmação`)
}
const selectAll = (lvl) => { for (const r of selectable.value) if (!lvl || r.m.level === lvl) selected.add(r.t.id) }

const manualResults = computed(() => (manual.value ? searchRecords(records.value, manualQ.value) : []))
async function pickManual(rec, state) {
  await wrap(() => edital.confirmMatch(manual.value.id, state, [{ kind: 'study', ids: rec.ids.study }, { kind: 'question', ids: rec.ids.question }, { kind: 'flashcard', ids: rec.ids.flashcard }].filter((x) => x.ids.length), { confidence: 'manual', manual: true }), 'Associação registrada')
  manual.value = null
}
const openSyn = () => { synText.value = settings.synonymsText; synOpen.value = true }
const saveSyn = async () => { await settings.setSynonyms(synText.value); synOpen.value = false; toast.ok('Dicionário salvo') }
</script>

<template>
  <PageHeader title="Cruzamento com o histórico" subtitle="Sugestões de correspondência entre o edital e tudo o que você já estudou.">
    <button class="btn-line btn-sm" @click="openSyn"><Settings2 :size="14" /> Termos equivalentes</button>
  </PageHeader>

  <div class="panel mb-4 flex gap-3 p-4 text-sm"><Info :size="18" class="mt-0.5 shrink-0 text-accent" /><p>As sugestões vêm de <b>comparação de textos</b> (palavras-chave, similaridade e um dicionário local editável) — <b>não é inteligência artificial</b> e pode errar. <b>Nada é marcado como estudado sem a sua confirmação.</b> Confirmar apenas guarda uma referência aos registros originais: o histórico não é alterado nem duplicado.</p></div>

  <EmptyState v-if="!topics.length" title="Sem assuntos no edital" text="Importe o edital ou cadastre os assuntos para cruzar com o histórico.">
    <RouterLink to="/concurso/importar" class="btn-primary">Importar edital</RouterLink><RouterLink to="/concurso/edital" class="btn-line">Ir ao edital</RouterLink>
  </EmptyState>

  <template v-else>
    <p class="mb-3 text-sm text-mute" data-testid="match-summary">{{ records.length }} conteúdo(s) no histórico · <b class="text-ink">{{ pendingCount }}</b> assunto(s) aguardando sua decisão</p>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <select v-model="subjectFilter" class="field !w-auto !py-1.5 text-xs" aria-label="Matéria"><option value="">Todas as matérias</option><option v-for="id in concurso.subjectIds" :key="id" :value="id">{{ subjects.nameOf(id) }}</option></select>
      <select v-model="levelFilter" class="field !w-auto !py-1.5 text-xs" aria-label="Confiança"><option value="">Qualquer confiança</option><option v-for="(l, k) in LEVELS" :key="k" :value="k">{{ l }}</option></select>
      <label class="flex items-center gap-1.5 text-xs text-mute"><input v-model="showDecided" type="checkbox" /> Mostrar decididos</label>
    </div>
    <div v-if="selectable.length" class="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sunken p-3 text-xs">
      <span class="font-semibold">Em lote:</span>
      <button class="btn-line btn-sm" @click="selectAll('exact')">Selecionar exatas</button><button class="btn-line btn-sm" @click="selectAll('')">Selecionar todas</button><button v-if="selected.size" class="btn-ghost btn-sm" @click="selected.clear()">Limpar</button>
      <template v-if="selected.size"><button class="btn-primary btn-sm" data-testid="batch-confirm" @click="batch('confirmed')"><Check :size="13" /> Confirmar {{ selected.size }} como estudados</button><button class="btn-soft btn-sm" @click="batch('partial')">Marcar como parciais</button></template>
    </div>

    <p v-if="!rows.length" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">Nada para decidir neste filtro.</p>
    <ul class="space-y-3">
      <li v-for="row in rows" :key="row.t.id" class="panel p-4" data-testid="match-row">
        <div class="flex items-start gap-3">
          <input v-if="row.m.candidates.length && !decided(row.t)" type="checkbox" class="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--c-accent))]" :checked="selected.has(row.t.id)" :aria-label="`Selecionar ${row.t.name}`" @change="toggle(row.t.id)" />
          <div class="min-w-0 flex-1">
            <p class="text-xs text-mute">{{ discName(row.t) }}</p>
            <p class="font-medium">{{ row.t.name }}</p>
            <p class="mt-1 flex flex-wrap items-center gap-1.5"><span class="pill" :class="LEVEL_TONE[row.m.level]" data-testid="match-level">{{ LEVELS[row.m.level] }}</span><span v-if="decided(row.t)" class="pill bg-ok-soft text-ok">{{ STATE_LABEL[row.t.matchState] }}</span></p>
          </div>
        </div>
        <ul v-if="row.m.candidates.length" class="mt-3 space-y-1.5">
          <li v-for="c in row.m.candidates" :key="c.rec.key" class="rounded-lg bg-sunken px-3 py-2 text-xs">
            <p class="flex items-start gap-1.5"><BookText :size="13" class="mt-0.5 shrink-0 text-mute" /><span><b>{{ c.rec.label }}</b> <span class="text-mute">· {{ c.rec.subjectName }} · {{ countsText(c.rec) }}<template v-if="c.rec.lastDate"> · {{ formatDate(c.rec.lastDate.slice(0, 10)) }}</template></span></span></p>
            <p v-if="c.reason" class="ml-5 mt-0.5 text-mute">{{ c.reason }}</p>
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <template v-if="!decided(row.t)">
            <button v-if="row.m.candidates.length" class="btn-primary btn-sm" data-testid="confirm-studied" @click="confirm(row, 'confirmed')"><Check :size="13" /> Já estudei</button>
            <button v-if="row.m.candidates.length" class="btn-soft btn-sm" @click="confirm(row, 'partial')">Parcialmente</button>
            <button class="btn-line btn-sm" @click="notStudied(row)"><X :size="13" /> Ainda não estudei</button>
            <button v-if="row.m.candidates.length" class="btn-ghost btn-sm" @click="ignore(row)"><Ban :size="13" /> Ignorar sugestão</button>
            <button class="btn-line btn-sm" data-testid="manual-assoc" @click="manual = row.t; manualQ = row.t.name"><Link2 :size="13" /> Associar manualmente</button>
          </template>
          <button v-else class="btn-ghost btn-sm" @click="reset(row.t)"><RotateCcw :size="13" /> Desfazer decisão</button>
        </div>
      </li>
    </ul>
  </template>

  <BaseModal :open="!!manual" wide :title="manual ? `Associar: ${manual.name}` : ''" @close="manual = null">
    <div class="relative mb-3"><Search :size="16" class="pointer-events-none absolute left-3.5 top-3.5 text-mute" /><input v-model="manualQ" class="field !pl-10" placeholder="Buscar no histórico (aceita pequenos erros de digitação)" aria-label="Buscar no histórico" /></div>
    <p v-if="!manualResults.length" class="text-sm text-mute">Nenhum registro encontrado.</p>
    <ul class="space-y-2">
      <li v-for="rec in manualResults" :key="rec.key" class="rounded-xl border border-line p-3 text-sm">
        <p class="font-medium">{{ rec.label }}</p><p class="text-xs text-mute">{{ rec.subjectName }} · {{ countsText(rec) }}</p>
        <div class="mt-2 flex gap-1.5"><button class="btn-primary btn-sm" @click="pickManual(rec, 'confirmed')">Já estudei</button><button class="btn-soft btn-sm" @click="pickManual(rec, 'partial')">Parcialmente</button></div>
      </li>
    </ul>
  </BaseModal>

  <BaseModal :open="synOpen" wide title="Termos equivalentes" @close="synOpen = false">
    <p class="mb-2 text-sm text-mute">Uma linha por grupo; separe os termos com <b>=</b>. Ex.: <code>crase = sinal indicativo de crase</code>. Ajuda o app a reconhecer nomes diferentes para o mesmo conteúdo.</p>
    <textarea v-model="synText" rows="12" class="field font-mono text-xs" aria-label="Dicionário de termos equivalentes" data-testid="synonyms-text" />
    <button class="btn-primary mt-3 w-full" @click="saveSyn">Salvar dicionário</button>
  </BaseModal>
</template>
