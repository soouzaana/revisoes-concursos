<script setup>
import { computed, reactive, ref } from 'vue'
import { Plus, Search, FilterX } from 'lucide-vue-next'
import { useQuestionsStore } from '../stores/questions'
import { useSubjectsStore } from '../stores/subjects'
import { useReviewsStore } from '../stores/reviews'
import { formatDate } from '../utils/date'
import { norm, plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'
import SubjectSelect from '../components/forms/SubjectSelect.vue'
import QuestionFormModal from '../components/forms/QuestionFormModal.vue'
import QuestionDetailModal from '../components/QuestionDetailModal.vue'

const questions = useQuestionsStore(), subjects = useSubjectsStore(), reviews = useReviewsStore()
const f = reactive({ q: '', subjectId: '', topic: '', from: '', to: '', status: '' })
const formOpen = ref(false), editing = ref(null), detailId = ref(null)

const topics = computed(() => (f.subjectId ? questions.topicsFor(f.subjectId) : [...new Set(questions.items.map((q) => q.topic))]).sort((a, b) => a.localeCompare(b, 'pt-BR')))
const filtered = computed(() => {
  const term = norm(f.q)
  return questions.items.filter((q) =>
    (!f.subjectId || q.subjectId === f.subjectId) && (!f.topic || q.topic === f.topic) && (!f.status || q.status === f.status) &&
    (!f.from || q.date >= f.from) && (!f.to || q.date <= f.to) &&
    (!term || norm([q.statement, q.topic, q.explanation, q.correctAnswer, ...(q.options || [])].join(' ')).includes(term)))
})
const active = computed(() => Object.values(f).some(Boolean))
const clear = () => Object.assign(f, { q: '', subjectId: '', topic: '', from: '', to: '', status: '' })
const stats = (id) => { const l = reviews.logs.filter((x) => x.kind === 'question' && x.itemId === id); return { n: l.length, ok: l.filter((x) => x.correct).length } }
function newQ() { editing.value = null; formOpen.value = true }
function edit(q) { detailId.value = null; editing.value = q; formOpen.value = true }
</script>

<template>
  <PageHeader title="Caderno de erros" :subtitle="plural(questions.items.length, 'questão registrada', 'questões registradas')">
    <button class="btn-primary" @click="newQ"><Plus :size="17" /> Nova questão</button>
  </PageHeader>

  <div class="panel mb-5 space-y-3 p-4">
    <div class="relative">
      <Search :size="17" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
      <input v-model="f.q" class="field !pl-10" type="search" placeholder="Pesquisar no enunciado, assunto ou explicação" aria-label="Pesquisar questões" />
    </div>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <SubjectSelect v-model="f.subjectId" allow-all @update:model-value="f.topic = ''" />
      <select v-model="f.topic" class="field" aria-label="Assunto"><option value="">Todos os assuntos</option><option v-for="t in topics" :key="t" :value="t">{{ t }}</option></select>
      <select v-model="f.status" class="field" aria-label="Status"><option value="">Qualquer status</option><option value="not_mastered">Não dominadas</option><option value="mastered">Dominadas</option></select>
      <label class="flex items-center gap-2 text-xs font-semibold text-mute">De <input v-model="f.from" type="date" class="field" aria-label="Data inicial" /></label>
      <label class="flex items-center gap-2 text-xs font-semibold text-mute">Até <input v-model="f.to" type="date" class="field" aria-label="Data final" /></label>
      <button v-if="active" class="btn-ghost justify-self-start" @click="clear"><FilterX :size="16" /> Limpar filtros</button>
    </div>
  </div>

  <EmptyState v-if="!questions.items.length" title="Seu caderno está vazio" text="Registre questões que errou ou que deram dificuldade. Elas voltam nas suas revisões.">
    <button class="btn-primary" @click="newQ"><Plus :size="17" /> Adicionar a primeira questão</button>
  </EmptyState>
  <EmptyState v-else-if="!filtered.length" title="Nenhuma questão encontrada" text="Ajuste a busca ou os filtros."><button class="btn-line" @click="clear">Limpar filtros</button></EmptyState>
  <ul v-else class="space-y-3">
    <li v-for="q in filtered" :key="q.id">
      <button class="panel block w-full p-4 text-left transition hover:border-accent" @click="detailId = q.id">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <SubjectDot :id="q.subjectId" /><span class="font-semibold">{{ q.topic }}</span>
          <span class="text-mute">{{ formatDate(q.date) }}</span>
          <span class="pill ml-auto" :class="q.status === 'mastered' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'">{{ q.status === 'mastered' ? 'Dominada' : 'Não dominada' }}</span>
        </div>
        <p class="line-clamp-2 text-sm">{{ q.statement }}</p>
        <p v-if="stats(q.id).n" class="mt-2 text-xs text-mute">Revisada {{ plural(stats(q.id).n, 'vez', 'vezes') }} · {{ stats(q.id).ok }} acerto(s)</p>
      </button>
    </li>
  </ul>

  <QuestionFormModal :open="formOpen" :question="editing" @close="formOpen = false" />
  <QuestionDetailModal :id="detailId" @close="detailId = null" @edit="edit" />
</template>
