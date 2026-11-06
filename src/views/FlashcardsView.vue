<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, Search, Play, Pencil, Trash2, FilterX } from 'lucide-vue-next'
import { useFlashcardsStore } from '../stores/flashcards'
import { useSubjectsStore } from '../stores/subjects'
import { useReviewsStore } from '../stores/reviews'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { cardStats, isDue, masteryOf, MASTERY_LABEL } from '../services/flashcardEngine'
import { formatDate, relativeDay } from '../utils/date'
import { norm, plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'
import SubjectSelect from '../components/forms/SubjectSelect.vue'
import FlashcardFormModal from '../components/forms/FlashcardFormModal.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const cards = useFlashcardsStore(), subjects = useSubjectsStore(), reviews = useReviewsStore(), clock = useClockStore()
const toast = useToast(), confirm = useConfirm()
const f = reactive({ q: '', subjectId: '', topic: '', status: '' })
const formOpen = ref(false), editing = ref(null), detail = ref(null)

const topics = computed(() => (f.subjectId ? cards.topicsFor(f.subjectId) : [...new Set(cards.items.map((c) => c.topic))]).sort((a, b) => a.localeCompare(b, 'pt-BR')))
const filtered = computed(() => {
  const t = norm(f.q)
  return cards.items.filter((c) => (!f.subjectId || c.subjectId === f.subjectId) && (!f.topic || c.topic === f.topic) &&
    (!f.status || (f.status === 'due' ? isDue(c, clock.today) : f.status === 'mastered' ? masteryOf(c) === 'mastered' : masteryOf(c) !== 'mastered')) &&
    (!t || norm(c.front + ' ' + c.back + ' ' + c.topic).includes(t)))
})
// organizado por matéria e assunto
const groups = computed(() => {
  const m = new Map()
  for (const c of filtered.value) {
    if (!m.has(c.subjectId)) m.set(c.subjectId, new Map())
    const t = m.get(c.subjectId)
    if (!t.has(c.topic)) t.set(c.topic, [])
    t.get(c.topic).push(c)
  }
  return [...m.entries()].map(([sid, t]) => ({ sid, topics: [...t.entries()].map(([topic, items]) => ({ topic, items })) })).sort((a, b) => subjects.nameOf(a.sid).localeCompare(subjects.nameOf(b.sid), 'pt-BR'))
})
const active = computed(() => Object.values(f).some(Boolean))
const clear = () => Object.assign(f, { q: '', subjectId: '', topic: '', status: '' })
const tone = (c) => ({ new: 'bg-sunken text-mute', learning: 'bg-accent-soft text-accent', mastered: 'bg-ok-soft text-ok' })[masteryOf(c)]
const history = (id) => reviews.logs.filter((l) => l.kind === 'flashcard' && l.itemId === id).sort((a, b) => b.at.localeCompare(a.at))
const rateOf = (v) => (v == null ? '—' : Math.round(v * 100) + '%')
const nextLabel = (c) => (isDue(c, clock.today) ? 'Pendente' : `Próxima: ${relativeDay(c.dueDate, clock.today)}`)

function edit(c) { detail.value = null; editing.value = c; formOpen.value = true }
function create() { editing.value = null; formOpen.value = true }
async function del(c) {
  if (!(await confirm({ title: 'Excluir cartão', message: 'Excluir este flashcard e o histórico dele?', confirmLabel: 'Excluir', danger: true }))) return
  await cards.remove(c.id); detail.value = null; toast.ok('Cartão excluído')
}
</script>

<template>
  <PageHeader title="Flashcards" :subtitle="`${plural(cards.items.length, 'cartão', 'cartões')} · ${cards.masteredCount} dominado(s) · ${cards.due.length} pendente(s)`">
    <RouterLink v-if="cards.items.length" to="/flashcards/livre" class="btn-soft"><Play :size="16" /> Estudar flashcards</RouterLink>
    <RouterLink v-if="cards.due.length" to="/flashcards/estudar" class="btn-line">Revisão programada ({{ cards.due.length }})</RouterLink>
    <button class="btn-primary" @click="create"><Plus :size="17" /> Novo cartão</button>
  </PageHeader>

  <div class="panel mb-5 space-y-3 p-4">
    <div class="relative">
      <Search :size="17" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
      <input v-model="f.q" type="search" class="field !pl-10" placeholder="Pesquisar nos cartões" aria-label="Pesquisar cartões" />
    </div>
    <div class="grid gap-3 sm:grid-cols-3">
      <SubjectSelect v-model="f.subjectId" allow-all @update:model-value="f.topic = ''" />
      <select v-model="f.topic" class="field" aria-label="Assunto"><option value="">Todos os assuntos</option><option v-for="t in topics" :key="t" :value="t">{{ t }}</option></select>
      <select v-model="f.status" class="field" aria-label="Situação">
        <option value="">Todos</option><option value="due">Pendentes para revisar</option><option value="mastered">Dominados</option><option value="not_mastered">Não dominados</option>
      </select>
    </div>
    <button v-if="active" class="btn-ghost btn-sm" @click="clear"><FilterX :size="15" /> Limpar filtros</button>
  </div>

  <EmptyState v-if="!cards.items.length" title="Nenhum cartão criado" text="Crie perguntas e respostas curtas. Os cartões voltam em intervalos cada vez maiores conforme você acerta.">
    <button class="btn-primary" @click="create"><Plus :size="17" /> Criar o primeiro cartão</button>
  </EmptyState>
  <EmptyState v-else-if="!filtered.length" title="Nenhum cartão encontrado" text="Ajuste a busca ou os filtros."><button class="btn-line" @click="clear">Limpar filtros</button></EmptyState>

  <div v-else class="space-y-7">
    <section v-for="g in groups" :key="g.sid">
      <h2 class="mb-2 flex items-center gap-2 font-display text-lg font-bold"><SubjectDot :id="g.sid" bare /></h2>
      <div v-for="t in g.topics" :key="t.topic" class="mb-4">
        <h3 class="mb-1.5 px-1 text-sm font-semibold text-mute">{{ t.topic }} <span class="font-normal">({{ t.items.length }})</span></h3>
        <ul class="panel divide-y divide-line overflow-hidden">
          <li v-for="c in t.items" :key="c.id">
            <button class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunken" @click="detail = c">
              <span class="min-w-0 flex-1"><span class="line-clamp-2 text-sm font-medium">{{ c.front }}</span><span class="mt-0.5 block text-xs text-mute">{{ nextLabel(c) }}</span></span>
              <span class="pill shrink-0" :class="tone(c)">{{ MASTERY_LABEL[masteryOf(c)] }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  </div>

  <FlashcardFormModal :open="formOpen" :card="editing" @close="formOpen = false" />

  <BaseModal :open="!!detail" title="Cartão" @close="detail = null">
    <div v-if="detail" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2 text-xs"><SubjectDot :id="detail.subjectId" /><span class="font-semibold">{{ detail.topic }}</span><span class="pill" :class="tone(detail)">{{ MASTERY_LABEL[masteryOf(detail)] }} · nível {{ detail.level }}</span></div>
      <div><p class="text-xs font-bold text-mute">Pergunta</p><p class="whitespace-pre-line">{{ detail.front }}</p></div>
      <div class="rounded-xl bg-sunken p-3"><p class="text-xs font-bold text-mute">Resposta</p><p class="whitespace-pre-line">{{ detail.back }}</p></div>
      <p class="text-xs text-mute">Criado em {{ formatDate(detail.createdAt.slice(0, 10)) }}</p>
      <dl class="grid grid-cols-3 gap-2 text-center text-xs">
        <div class="rounded-xl bg-sunken p-2"><dt class="text-mute">Revisões</dt><dd class="text-base font-bold">{{ cardStats(detail).reviews }}</dd></div>
        <div class="rounded-xl bg-sunken p-2"><dt class="text-mute">Acertos</dt><dd class="text-base font-bold text-ok">{{ cardStats(detail).correct }}</dd></div>
        <div class="rounded-xl bg-sunken p-2"><dt class="text-mute">Erros</dt><dd class="text-base font-bold text-danger">{{ cardStats(detail).wrong }}</dd></div>
        <div class="rounded-xl bg-sunken p-2"><dt class="text-mute">Taxa de acerto</dt><dd class="text-base font-bold">{{ rateOf(cardStats(detail).accuracy) }}</dd></div>
        <div class="rounded-xl bg-sunken p-2"><dt class="text-mute">Taxa de erro</dt><dd class="text-base font-bold">{{ rateOf(cardStats(detail).errorRate) }}</dd></div>
        <div class="rounded-xl bg-sunken p-2"><dt class="text-mute">Nível</dt><dd class="text-base font-bold">{{ detail.level }}</dd></div>
      </dl>
      <p class="text-xs text-mute">Última revisão: {{ detail.lastReviewedDate ? formatDate(detail.lastReviewedDate) : 'nunca' }} · Próxima sugerida: {{ formatDate(detail.dueDate) }} ({{ nextLabel(detail) }})</p>
      <div>
        <h3 class="mb-1.5 text-sm font-bold">Histórico de revisões</h3>
        <p v-if="!history(detail.id).length" class="text-sm text-mute">Ainda não revisado.</p>
        <ul v-else class="divide-y divide-line rounded-xl border border-line text-sm">
          <li v-for="h in history(detail.id)" :key="h.id" class="flex items-center justify-between px-3 py-2">
            <span class="font-semibold" :class="h.correct ? 'text-ok' : 'text-danger'">{{ h.correct ? 'Acertei' : 'Errei' }}</span><span class="text-xs text-mute">{{ h.mode === 'free' ? 'Estudo livre · ' : '' }}{{ formatDate(h.date) }}</span>
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <button class="btn-ghost text-danger" @click="del(detail)"><Trash2 :size="16" /> Excluir</button>
      <button class="btn-line" @click="edit(detail)"><Pencil :size="16" /> Editar</button>
    </template>
  </BaseModal>
</template>
