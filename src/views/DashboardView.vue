<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { PenLine, Play, ArrowRight, CalendarCheck, Repeat, Layers } from 'lucide-vue-next'
import { useStudiesStore } from '../stores/studies'
import { useQuestionsStore } from '../stores/questions'
import { useFlashcardsStore } from '../stores/flashcards'
import { useReviewsStore } from '../stores/reviews'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { computeStats } from '../services/statsEngine'
import { getUpcoming, CYCLE_SIZE } from '../services/reviewEngine'
import { formatDate } from '../utils/date'
import { plural } from '../utils/text'
import CycleDots from '../components/ui/CycleDots.vue'

const studies = useStudiesStore(), questions = useQuestionsStore(), cards = useFlashcardsStore(), reviews = useReviewsStore(), subjects = useSubjectsStore(), clock = useClockStore()

const stats = computed(() => computeStats({ subjects: subjects.items, studies: studies.items, questions: questions.items, flashcards: cards.items, logs: reviews.logs }, clock.today))
const up = computed(() => getUpcoming({ studyDates: studies.studyDates, cycles: reviews.cycles, flashcards: cards.items, today: clock.today }))
const totalPending = computed(() => reviews.dailyPending.length + reviews.weeklyPending.length + cards.due.length)
const startTo = computed(() => {
  const r = reviews.dailyPending[0] || reviews.weeklyPending[0]
  if (r) return `/revisoes/${encodeURIComponent(r.id)}`
  return cards.due.length ? '/flashcards/estudar' : '/revisoes'
})
const dateLabel = computed(() => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))
const overdue = computed(() => [...reviews.dailyPending, ...reviews.weeklyPending].filter((r) => r.overdue).length)

const activity = computed(() => {
  const ev = []
  for (const s of studies.items.slice(0, 8)) ev.push({ at: s.createdAt, text: `Estudou ${s.topic}`, sub: subjects.nameOf(s.subjectId) })
  for (const q of questions.items.slice(0, 8)) ev.push({ at: q.createdAt, text: 'Questão adicionada ao caderno', sub: `${subjects.nameOf(q.subjectId)} · ${q.topic}` })
  for (const r of reviews.enriched.filter((x) => x.completedAt)) ev.push({ at: r.completedAt, text: r.type === 'daily' ? `Revisão diária de ${formatDate(r.refDate)} concluída` : `Revisão semanal do ciclo ${r.cycleNumber} concluída`, sub: r.content.total ? `${r.content.correct} de ${r.content.total} acertos` : 'Apenas assuntos' })
  for (const c of cards.items.slice(0, 8)) ev.push({ at: c.createdAt, text: 'Flashcard criado', sub: `${subjects.nameOf(c.subjectId)} · ${c.topic}` })
  return ev.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
})
const when = (iso) => { const d = iso.slice(0, 10); const local = new Date(iso); const ld = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`; return ld === clock.today ? 'hoje' : formatDate(ld || d) }
const isNew = computed(() => !studies.items.length && !questions.items.length && !cards.items.length)
</script>

<template>
  <header class="mb-6">
    <p class="text-sm capitalize text-mute">{{ dateLabel }}</p>
    <h1 class="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{{ isNew ? 'Vamos começar' : totalPending ? `${plural(totalPending, 'revisão pendente', 'revisões pendentes')}` : 'Revisões em dia' }}</h1>
    <p v-if="overdue" class="mt-1 text-sm font-semibold text-warn">{{ plural(overdue, 'revisão atrasada', 'revisões atrasadas') }} — elas continuam esperando por você.</p>
  </header>

  <div class="mb-6 grid gap-3 sm:grid-cols-2">
    <RouterLink to="/estudos" class="btn-primary !justify-between !rounded-2xl !px-5 !py-4 !text-base"><span class="flex items-center gap-2.5"><PenLine :size="20" /> Registrar estudo</span><ArrowRight :size="18" /></RouterLink>
    <RouterLink :to="startTo" class="btn-line !justify-between !rounded-2xl !px-5 !py-4 !text-base"><span class="flex items-center gap-2.5"><Play :size="20" class="text-accent" /> Iniciar revisões</span><span v-if="totalPending" class="rounded-full bg-accent px-2.5 py-0.5 text-sm text-accent-fg">{{ totalPending }}</span></RouterLink>
  </div>

  <section class="mb-6 grid grid-cols-3 gap-3">
    <RouterLink to="/revisoes" class="panel p-4 transition hover:border-accent"><CalendarCheck :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ reviews.dailyPending.length }}</p><p class="text-xs text-mute">Revisões diárias</p></RouterLink>
    <RouterLink to="/revisoes" class="panel p-4 transition hover:border-accent"><Repeat :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ reviews.weeklyPending.length }}</p><p class="text-xs text-mute">Revisões semanais</p></RouterLink>
    <RouterLink to="/revisoes" class="panel p-4 transition hover:border-accent"><Layers :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ cards.due.length }}</p><p class="text-xs text-mute">Flashcards a revisar</p></RouterLink>
  </section>

  <section class="panel mb-6 p-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="font-display text-lg font-bold">Ciclo {{ up.cycle.number }}</h2>
        <p class="text-sm text-mute">{{ up.cycle.studied }} de {{ CYCLE_SIZE }} dias estudados · a revisão semanal é liberada no {{ CYCLE_SIZE }}º</p>
      </div>
      <CycleDots :studied="up.cycle.studied" :size="CYCLE_SIZE" />
    </div>
  </section>

  <section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.studiedDays }}</p><p class="text-xs text-mute">Dias estudados</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.studies }}</p><p class="text-xs text-mute">Conteúdos registrados</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.questions }}</p><p class="text-xs text-mute">Questões no caderno</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.cards }}</p><p class="text-xs text-mute">Flashcards</p></div>
  </section>

  <div class="grid gap-6 md:grid-cols-2">
    <section class="panel p-5">
      <h2 class="mb-3 font-display text-lg font-bold">Desempenho</h2>
      <template v-if="stats.reviewedTotal || stats.cards">
        <p v-if="stats.reviewedTotal" class="text-sm">Aproveitamento nas revisões: <b class="text-xl">{{ stats.accuracy }}%</b> <span class="text-mute">({{ stats.reviewedCorrect }} acertos, {{ stats.reviewedWrong }} erros)</span></p>
        <p v-else class="text-sm text-mute">Responda questões em uma revisão para ver o aproveitamento.</p>
        <p v-if="stats.cards" class="mt-2 text-sm">Flashcards dominados: <b>{{ stats.cardsMastered }}</b> de {{ stats.cards }}</p>
      </template>
      <p v-else class="text-sm text-mute">Os indicadores aparecem conforme você revisa.</p>
      <RouterLink to="/estatisticas" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">Ver estatísticas <ArrowRight :size="14" /></RouterLink>
    </section>

    <section class="panel p-5">
      <h2 class="mb-3 font-display text-lg font-bold">Próximas revisões</h2>
      <ul class="space-y-2.5 text-sm">
        <li v-if="up.dailyTomorrow">Amanhã: revisão diária de hoje ({{ plural(studies.byDate[clock.today].length, 'assunto', 'assuntos') }})</li>
        <li v-if="up.cycle.studied">Semanal do ciclo {{ up.cycle.number }}: faltam {{ plural(CYCLE_SIZE - up.cycle.studied, 'dia estudado', 'dias estudados') }}</li>
        <li v-if="up.flashcardsTomorrow">Amanhã: {{ plural(up.flashcardsTomorrow, 'flashcard', 'flashcards') }}</li>
        <li v-if="!up.dailyTomorrow && !up.cycle.studied && !up.flashcardsTomorrow" class="text-mute">Registre um estudo hoje para agendar a revisão de amanhã.</li>
      </ul>
    </section>
  </div>

  <section class="mt-6">
    <h2 class="mb-3 font-display text-lg font-bold">Atividade recente</h2>
    <p v-if="!activity.length" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">Sua atividade aparece aqui depois do primeiro registro.</p>
    <ul v-else class="panel divide-y divide-line">
      <li v-for="(a, i) in activity" :key="i" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span class="min-w-0"><span class="block truncate font-medium">{{ a.text }}</span><span class="block truncate text-xs text-mute">{{ a.sub }}</span></span>
        <span class="shrink-0 text-xs text-mute">{{ when(a.at) }}</span>
      </li>
    </ul>
  </section>
</template>
