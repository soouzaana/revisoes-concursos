<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Play, AlertTriangle, Filter, FilterX, Check, EyeOff } from 'lucide-vue-next'
import { useReviewsStore } from '../stores/reviews'
import { useFlashcardsStore } from '../stores/flashcards'
import { useClockStore } from '../stores/clock'
import { useSubjectsStore } from '../stores/subjects'
import { useSettingsStore } from '../stores/settings'
import { useActivityStore } from '../stores/activity'
import { formatDate, relativeDay } from '../utils/date'
import { plural, topicKey } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ReviewCard from '../components/ReviewCard.vue'
import CycleDots from '../components/ui/CycleDots.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'

const reviews = useReviewsStore(), cards = useFlashcardsStore(), clock = useClockStore(), subjects = useSubjectsStore()
const settings = useSettingsStore(), activity = useActivityStore()
const size = computed(() => settings.weeklyCycleSize)

// Filtros combináveis: Tipo (abas) + Status + Matéria + Assunto + "somente ativas"
const tab = ref('all')          // all | daily | weekly | cards  (tipo de revisão)
const view = ref('pending')     // pending | done | all           (status)
const showFilters = ref(false)
const fSubject = ref(''), fTopic = ref('')
const onlyActive = computed(() => settings.reviewsOnlyActive)
const hasFilters = computed(() => !!(fSubject.value || fTopic.value))
const clearFilters = () => { fSubject.value = ''; fTopic.value = '' }

const involvesActive = (r) => (r.completedAt ? r.content.subjectIds.some((id) => activity.scope.isSubjectActive(id)) : !r.content.inactiveOnly)
const topicKeysOf = (r) => new Set([...r.content.topics.map((t) => topicKey(t.subjectId, t.topic)), ...r.content.questions.map((q) => topicKey(q.subjectId, q.topic))])
const typeOk = (r) => tab.value === 'all' || tab.value === r.type
const filterOk = (r) => (!fSubject.value || r.content.subjectIds.includes(fSubject.value)) && (!fTopic.value || topicKeysOf(r).has(fTopic.value))
const visible = (r) => typeOk(r) && filterOk(r) && (!onlyActive.value || involvesActive(r))

const subjectOptions = computed(() => subjects.items.filter((s) => reviews.enriched.some((r) => r.content.subjectIds.includes(s.id)) || cards.items.some((c) => c.subjectId === s.id)))
const topicOptions = computed(() => {
  const m = new Map()
  for (const r of reviews.enriched) for (const t of r.content.topics) if (!fSubject.value || t.subjectId === fSubject.value) m.set(topicKey(t.subjectId, t.topic), t.topic)
  for (const c of cards.items) if (!fSubject.value || c.subjectId === fSubject.value) m.set(topicKey(c.subjectId, c.topic), c.topic)
  return [...m.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
})
watch(fSubject, () => { if (fTopic.value && !topicOptions.value.some((o) => o.key === fTopic.value)) fTopic.value = '' })

const pendings = computed(() => reviews.enriched.filter((r) => !r.completedAt && visible(r)).sort((a, b) => (a.refDate || a.releasedDate).localeCompare(b.refDate || b.releasedDate)))
const dones = computed(() => reviews.enriched.filter((r) => r.completedAt && visible(r)).sort((a, b) => b.completedAt.localeCompare(a.completedAt)))
const list = computed(() => (view.value === 'pending' ? pendings.value : view.value === 'done' ? dones.value : [...pendings.value, ...dones.value]))
// Pendentes ocultas por serem só de conteúdo inativo (aparecem ao desligar "Somente ativas")
const hiddenInactive = computed(() => (onlyActive.value ? reviews.enriched.filter((r) => !r.completedAt && typeOk(r) && r.content.inactiveOnly).length : 0))

const tabCount = (type) => {
  const d = onlyActive.value ? reviews.dailyPendingActive : reviews.dailyPending
  const w = onlyActive.value ? reviews.weeklyPendingActive : reviews.weeklyPending
  return type === 'daily' ? d.length : type === 'weekly' ? w.length : d.length + w.length
}
const dueList = computed(() => (onlyActive.value ? cards.due : cards.dueAll).filter((c) =>
  (!fSubject.value || c.subjectId === fSubject.value) && (!fTopic.value || topicKey(c.subjectId, c.topic) === fTopic.value)))
const tabs = computed(() => [
  { id: 'all', label: 'Todas', n: tabCount('all') },
  { id: 'daily', label: 'Diária', n: tabCount('daily') },
  { id: 'weekly', label: 'Semanal', n: tabCount('weekly') },
  { id: 'cards', label: 'Flashcards', n: (onlyActive.value ? cards.due : cards.dueAll).length }
])

// Flashcards: resumo pendente e histórico por dia
const dueSubjects = computed(() => [...new Set(dueList.value.map((c) => c.subjectId))])
const dueTopics = computed(() => [...new Set(dueList.value.map((c) => c.topic))])
const overdueCards = computed(() => dueList.value.filter((c) => c.dueDate < clock.today).length)
const doneToday = computed(() => reviews.logs.filter((l) => l.kind === 'flashcard' && l.mode !== 'free' && l.date === clock.today).length)
const cardProgress = computed(() => { const t = doneToday.value + dueList.value.length; return t ? Math.round((doneToday.value / t) * 100) : 0 })
const cardHistory = computed(() => {
  const m = {}
  for (const l of reviews.logs.filter((x) => x.kind === 'flashcard')) { const d = (m[l.date] ||= { date: l.date, n: 0, ok: 0 }); d.n++; if (l.correct) d.ok++ }
  return Object.values(m).sort((a, b) => b.date.localeCompare(a.date))
})
const emptyText = computed(() => {
  if (view.value === 'done') return 'As revisões concluídas aparecem aqui.'
  if (hasFilters.value || onlyActive.value) return 'Nenhuma revisão com esses filtros. Ajuste os filtros ou desligue "Somente matérias ativas".'
  return tab.value === 'weekly' ? `A cada ${size.value} dias estudados uma revisão semanal é liberada.` : 'O que você estudar hoje aparece aqui a partir de amanhã.'
})
const openDays = computed(() => reviews.openCycle?.days.length ?? 0)
</script>

<template>
  <PageHeader title="Central de revisões" subtitle="Nada some sozinho: o que atrasar continua aqui até você concluir." />

  <div class="mb-5 flex gap-1 rounded-2xl bg-sunken p-1" role="tablist">
    <button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="tab === t.id" class="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition"
      :class="tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-mute'" @click="tab = t.id">
      {{ t.label }}<span v-if="t.n" class="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{{ t.n }}</span>
    </button>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
    <button role="switch" :aria-checked="onlyActive" data-testid="only-active" class="pill !px-3.5 !py-1.5 transition" :class="onlyActive ? 'bg-accent text-accent-fg' : 'bg-sunken text-mute'" @click="settings.setReviewsOnlyActive(!onlyActive)"><Check v-if="onlyActive" :size="13" /> Somente matérias ativas</button>
    <button class="pill !px-3.5 !py-1.5 transition" :class="hasFilters ? 'bg-accent-soft text-accent' : 'bg-sunken text-mute'" :aria-expanded="showFilters" @click="showFilters = !showFilters"><Filter :size="13" /> Filtros<template v-if="hasFilters"> ●</template></button>
    <RouterLink to="/ajustes" class="ml-auto text-xs font-semibold text-accent">Gerenciar matérias</RouterLink>
  </div>

  <section v-if="showFilters" class="panel mb-4 p-4" data-testid="review-filters">
    <div class="grid gap-3 sm:grid-cols-2">
      <div><label class="label" for="rf-subject">Matéria</label><select id="rf-subject" v-model="fSubject" class="field"><option value="">Todas</option><option v-for="s in subjectOptions" :key="s.id" :value="s.id">{{ s.name }}{{ s.active === false ? ' (inativa)' : '' }}</option></select></div>
      <div><label class="label" for="rf-topic">Assunto</label><select id="rf-topic" v-model="fTopic" class="field"><option value="">Todos</option><option v-for="o in topicOptions" :key="o.key" :value="o.key">{{ o.label }}</option></select></div>
    </div>
    <button v-if="hasFilters" class="btn-ghost btn-sm mt-3" @click="clearFilters"><FilterX :size="14" /> Limpar filtros</button>
  </section>

  <div v-if="tab === 'weekly'" class="panel mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
    <div>
      <p class="text-sm font-bold">Ciclo {{ reviews.openCycle?.number ?? (reviews.cycles.length + 1) }} em andamento · a cada {{ size }} dias estudados</p>
      <p class="text-xs text-mute">Só contam dias com registro de estudo. Falta(m) {{ Math.max(0, size - openDays) }} para liberar a próxima revisão semanal.</p>
    </div>
    <CycleDots :studied="openDays" :size="size" />
  </div>

  <template v-if="tab !== 'cards'">
    <div class="mb-4 flex gap-2 text-sm" role="group" aria-label="Status">
      <button class="pill !px-3.5 !py-1.5" :class="view === 'pending' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'pending'">Pendentes</button>
      <button class="pill !px-3.5 !py-1.5" :class="view === 'done' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'done'">Concluídas</button>
      <button class="pill !px-3.5 !py-1.5" :class="view === 'all' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'all'">Todas</button>
    </div>
    <p v-if="hiddenInactive && view !== 'done'" class="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-xs text-mute" data-testid="hidden-inactive"><EyeOff :size="14" />{{ plural(hiddenInactive, 'revisão pendente oculta', 'revisões pendentes ocultas') }} (só de matérias/assuntos inativos).<button class="font-semibold text-accent" @click="settings.setReviewsOnlyActive(false)">Mostrar</button></p>
    <EmptyState v-if="!list.length" :title="view === 'done' ? 'Nada concluído ainda' : 'Nenhuma revisão pendente'" :text="emptyText" />
    <div v-else class="space-y-3"><ReviewCard v-for="r in list" :key="r.id" :review="r" /></div>
  </template>

  <template v-else>
    <div class="mb-4 flex gap-2 text-sm">
      <button class="pill !px-3.5 !py-1.5" :class="view === 'pending' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'pending'">Pendentes</button>
      <button class="pill !px-3.5 !py-1.5" :class="view === 'done' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'done'">Histórico</button>
    </div>
    <template v-if="view === 'pending'">
      <EmptyState v-if="!dueList.length" title="Nenhum flashcard pendente" :text="cards.items.length ? 'Os cartões voltam conforme o intervalo de cada um; cartões de matérias inativas não acumulam aqui. Você pode estudar qualquer cartão quando quiser.' : 'Crie cartões na aba Flashcards para revisá-los aqui.'"><RouterLink v-if="cards.items.length" to="/flashcards/livre" class="btn-primary">Estudar flashcards</RouterLink></EmptyState>
      <article v-else class="panel p-4" :class="overdueCards ? 'border-warn/60' : ''">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-display text-base font-bold">{{ plural(dueList.length, 'cartão', 'cartões') }} para revisar</h3>
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
