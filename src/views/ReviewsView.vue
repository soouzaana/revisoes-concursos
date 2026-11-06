<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Play, AlertTriangle } from 'lucide-vue-next'
import { useReviewsStore } from '../stores/reviews'
import { useFlashcardsStore } from '../stores/flashcards'
import { useClockStore } from '../stores/clock'
import { useSubjectsStore } from '../stores/subjects'
import { CYCLE_SIZE } from '../services/reviewEngine'
import { formatDate, relativeDay } from '../utils/date'
import { plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ReviewCard from '../components/ReviewCard.vue'
import CycleDots from '../components/ui/CycleDots.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'

const reviews = useReviewsStore(), cards = useFlashcardsStore(), clock = useClockStore(), subjects = useSubjectsStore()
const tab = ref('daily')
const view = ref('pending')

const tabs = computed(() => [
  { id: 'daily', label: 'Diária', n: reviews.dailyPending.length },
  { id: 'weekly', label: 'Semanal', n: reviews.weeklyPending.length },
  { id: 'cards', label: 'Flashcards', n: cards.due.length }
])
const list = computed(() => {
  if (tab.value === 'daily') return view.value === 'pending' ? reviews.dailyPending : reviews.dailyDone
  if (tab.value === 'weekly') return view.value === 'pending' ? reviews.weeklyPending : reviews.weeklyDone
  return []
})

// Flashcards: resumo pendente e histórico por dia
const dueSubjects = computed(() => [...new Set(cards.due.map((c) => c.subjectId))])
const dueTopics = computed(() => [...new Set(cards.due.map((c) => c.topic))])
const overdueCards = computed(() => cards.due.filter((c) => c.dueDate < clock.today).length)
const doneToday = computed(() => reviews.logs.filter((l) => l.kind === 'flashcard' && l.mode !== 'free' && l.date === clock.today).length)
const cardProgress = computed(() => { const t = doneToday.value + cards.due.length; return t ? Math.round((doneToday.value / t) * 100) : 0 })
const cardHistory = computed(() => {
  const m = {}
  for (const l of reviews.logs.filter((x) => x.kind === 'flashcard')) { const d = (m[l.date] ||= { date: l.date, n: 0, ok: 0 }); d.n++; if (l.correct) d.ok++ }
  return Object.values(m).sort((a, b) => b.date.localeCompare(a.date))
})
const emptyText = computed(() => view.value === 'pending'
  ? (tab.value === 'daily' ? 'O que você estudar hoje aparece aqui a partir de amanhã.' : `A cada ${CYCLE_SIZE} dias estudados uma revisão semanal é liberada.`)
  : 'As revisões concluídas aparecem aqui.')
</script>

<template>
  <PageHeader title="Central de revisões" subtitle="Nada some sozinho: o que atrasar continua aqui até você concluir." />

  <div class="mb-5 flex gap-1 rounded-2xl bg-sunken p-1" role="tablist">
    <button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="tab === t.id" class="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
      :class="tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-mute'" @click="tab = t.id">
      {{ t.label }}<span v-if="t.n" class="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{{ t.n }}</span>
    </button>
  </div>

  <div v-if="tab === 'weekly'" class="panel mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
    <div>
      <p class="text-sm font-bold">Ciclo {{ reviews.openCycle?.number ?? (reviews.cycles.length + 1) }} em andamento</p>
      <p class="text-xs text-mute">Só contam dias com registro de estudo. Falta(m) {{ CYCLE_SIZE - (reviews.openCycle?.days.length ?? 0) }} para liberar a próxima revisão semanal.</p>
    </div>
    <CycleDots :studied="reviews.openCycle?.days.length ?? 0" :size="CYCLE_SIZE" />
  </div>

  <template v-if="tab !== 'cards'">
    <div class="mb-4 flex gap-2 text-sm">
      <button class="pill !px-3.5 !py-1.5" :class="view === 'pending' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'pending'">Pendentes</button>
      <button class="pill !px-3.5 !py-1.5" :class="view === 'done' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'done'">Histórico</button>
    </div>
    <EmptyState v-if="!list.length" :title="view === 'pending' ? 'Nenhuma revisão pendente' : 'Nada concluído ainda'" :text="emptyText" />
    <div v-else class="space-y-3"><ReviewCard v-for="r in list" :key="r.id" :review="r" /></div>
  </template>

  <template v-else>
    <div class="mb-4 flex gap-2 text-sm">
      <button class="pill !px-3.5 !py-1.5" :class="view === 'pending' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'pending'">Pendentes</button>
      <button class="pill !px-3.5 !py-1.5" :class="view === 'done' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'done'">Histórico</button>
    </div>
    <template v-if="view === 'pending'">
      <EmptyState v-if="!cards.due.length" title="Nenhum flashcard pendente" :text="cards.items.length ? 'Os cartões voltam conforme o intervalo de cada um. Você pode estudar quando quiser.' : 'Crie cartões na aba Flashcards para revisá-los aqui.'"><RouterLink v-if="cards.items.length" to="/flashcards/livre" class="btn-primary">Estudar flashcards</RouterLink></EmptyState>
      <article v-else class="panel p-4" :class="overdueCards ? 'border-warn/60' : ''">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-display text-base font-bold">{{ plural(cards.due.length, 'cartão', 'cartões') }} para revisar</h3>
          <span v-if="overdueCards" class="pill bg-warn-soft text-warn"><AlertTriangle :size="12" /> {{ overdueCards }} atrasado(s)</span>
        </div>
        <p class="mt-0.5 text-xs text-mute">Referência: {{ formatDate(clock.today) }}</p>
        <div class="mt-3 flex flex-wrap gap-1.5"><SubjectDot v-for="id in dueSubjects" :key="id" :id="id" /></div>
        <p class="mt-2 line-clamp-2 text-sm text-mute">{{ dueTopics.join(' · ') }}</p>
        <div class="mt-3 flex items-center gap-3">
          <div class="flex-1"><ProgressBar :value="cardProgress" /><p class="mt-1 text-xs text-mute">{{ doneToday }} revisado(s) hoje</p></div>
          <RouterLink to="/flashcards/livre" class="btn-line btn-sm">Estudo livre</RouterLink>
          <RouterLink to="/flashcards/estudar" class="btn-primary btn-sm"><Play :size="14" />{{ doneToday ? 'Continuar' : 'Iniciar' }}</RouterLink>
        </div>
      </article>
    </template>
    <template v-else>
      <EmptyState v-if="!cardHistory.length" title="Nenhuma revisão de flashcards ainda" text="Cada sessão de flashcards fica registrada aqui por dia." />
      <ul v-else class="panel divide-y divide-line">
        <li v-for="h in cardHistory" :key="h.date" class="flex items-center justify-between px-4 py-3 text-sm">
          <span class="font-semibold">{{ relativeDay(h.date, clock.today) }} <span class="font-normal text-mute">{{ formatDate(h.date) }}</span></span>
          <span>{{ plural(h.n, 'cartão', 'cartões') }} · <span class="font-semibold text-ok">{{ h.ok }} acerto(s)</span></span>
        </li>
      </ul>
    </template>
  </template>
</template>
