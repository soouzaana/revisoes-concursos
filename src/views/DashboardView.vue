<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { PenLine, Play, ArrowRight, CalendarCheck, Repeat, Layers, ClipboardCheck, BellRing, ArrowUp, ArrowDown, Plus, Flame, CalendarDays, Clock, Activity, SlidersHorizontal, Check, ListChecks, Target } from 'lucide-vue-next'
import { useStudiesStore } from '../stores/studies'
import { useQuestionsStore } from '../stores/questions'
import { useFlashcardsStore } from '../stores/flashcards'
import { useReviewsStore } from '../stores/reviews'
import { useSubjectsStore } from '../stores/subjects'
import { useMocksStore } from '../stores/mocks'
import { fmtDelta, fmtPct } from '../services/mockEngine'
import { useClockStore } from '../stores/clock'
import { computeStats } from '../services/statsEngine'
import { getUpcoming } from '../services/reviewEngine'
import { useSettingsStore } from '../stores/settings'
import { formatDate } from '../utils/date'
import { plural } from '../utils/text'
import CycleDots from '../components/ui/CycleDots.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import { useProgressStore } from '../stores/progress'
import { useHabitsStore } from '../stores/habits'
import { useTasksStore } from '../stores/tasks'
import { useConcursoStore } from '../stores/concurso'
import { monthKey, relativeDay } from '../utils/date'
import { filterTasks } from '../services/taskEngine'
import { ref } from 'vue'

const studies = useStudiesStore(), questions = useQuestionsStore(), cards = useFlashcardsStore(), reviews = useReviewsStore(), subjects = useSubjectsStore(), clock = useClockStore(), mocks = useMocksStore(), settings = useSettingsStore()
const progress = useProgressStore(), habits = useHabitsStore(), tasks = useTasksStore(), concurso = useConcursoStore()
// Indicadores personalizáveis: o que está em `settings.dashboardHidden` fica oculto.
const WIDGETS = [
  ['streak', 'Ofensiva e recorde'], ['monthDays', 'Dias estudados no mês'], ['hours', 'Horas de estudo'], ['activities', 'Atividades realizadas'],
  ['reviews', 'Revisões e próximas revisões'], ['habits', 'Progresso dos hábitos'], ['tasks', 'Tarefas pendentes'],
  ['concurso', 'Resumo da preparação'], ['mocks', 'Desempenho nos simulados'], ['recent', 'Últimos registros de estudo']
]
const show = (k) => !settings.dashboardHidden.includes(k)
const customizing = ref(false)
const toggleWidget = (k) => settings.setDashboardHidden(show(k) ? [...settings.dashboardHidden, k] : settings.dashboardHidden.filter((x) => x !== k))
const monthStudyDays = computed(() => studies.studyDates.filter((d) => monthKey(d) === monthKey(clock.today)).length)
const monthHours = computed(() => { const h = progress.monthMinutes / 60; return h ? (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h' : '0 h' })
const pendingTasks = computed(() => filterTasks(tasks.items, { filter: 'pending' }, clock.today))
const recentStudies = computed(() => studies.items.slice(0, 5))
const cycleSize = computed(() => settings.weeklyCycleSize)
const mo = computed(() => mocks.overview), sch = computed(() => mocks.schedule)

const stats = computed(() => computeStats({ subjects: subjects.items, studies: studies.items, questions: questions.items, flashcards: cards.items, logs: reviews.logs }, clock.today))
const up = computed(() => getUpcoming({ studyDates: studies.studyDates, cycles: reviews.cycles, flashcards: cards.items, today: clock.today, size: cycleSize.value }))
// Só conta o que está nas matérias/assuntos ativos (os demais ficam preservados, fora das revisões automáticas)
const totalPending = computed(() => reviews.dailyPendingActive.length + reviews.weeklyPendingActive.length + cards.due.length)
const remaining = computed(() => Math.max(0, cycleSize.value - up.value.cycle.studied))
const startTo = computed(() => {
  const r = reviews.dailyPendingActive[0] || reviews.weeklyPendingActive[0]
  if (r) return `/revisoes/${encodeURIComponent(r.id)}`
  return cards.due.length ? '/flashcards/estudar' : '/revisoes'
})
const dateLabel = computed(() => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))
const overdue = computed(() => [...reviews.dailyPendingActive, ...reviews.weeklyPendingActive].filter((r) => r.overdue).length)

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
    <p class="text-sm capitalize text-mute">Visão geral · {{ dateLabel }}</p>
    <h1 class="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{{ isNew ? 'Vamos começar' : totalPending ? `${plural(totalPending, 'revisão pendente', 'revisões pendentes')}` : 'Revisões em dia' }}</h1>
    <p v-if="overdue" class="mt-1 text-sm font-semibold text-warn">{{ plural(overdue, 'revisão atrasada', 'revisões atrasadas') }} — elas continuam esperando por você.</p>
  </header>

  <div v-if="mocks.reminderActive" class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/60 bg-warn-soft p-4 text-warn" role="status" data-testid="mock-reminder">
    <p class="flex items-center gap-2 text-sm font-semibold"><BellRing :size="18" />{{ sch.status === 'due' ? 'Hora de fazer um novo simulado!' : `Novo simulado sugerido desde ${formatDate(sch.nextDate)} — ${plural(sch.overdueDays, 'dia', 'dias')} de atraso.` }}</p>
    <RouterLink to="/simulados/novo" class="btn-primary btn-sm">Cadastrar simulado</RouterLink>
  </div>

  <div class="mb-6 grid gap-3 sm:grid-cols-2">
    <RouterLink to="/estudos" class="btn-primary !justify-between !rounded-2xl !px-5 !py-4 !text-base"><span class="flex items-center gap-2.5"><PenLine :size="20" /> Registrar estudo</span><ArrowRight :size="18" /></RouterLink>
    <RouterLink :to="startTo" class="btn-line !justify-between !rounded-2xl !px-5 !py-4 !text-base"><span class="flex items-center gap-2.5"><Play :size="20" class="text-accent" /> Iniciar revisões</span><span v-if="totalPending" class="rounded-full bg-accent px-2.5 py-0.5 text-sm text-accent-fg">{{ totalPending }}</span></RouterLink>
  </div>

  <section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="kpi-tiles">
    <RouterLink v-if="show('streak')" to="/ofensiva" class="panel p-4 transition hover:border-accent" data-testid="tile-streak"><Flame :size="18" class="mb-2 text-warn" /><p class="font-display text-2xl font-extrabold">{{ progress.streak.current }} <span class="text-sm font-semibold text-mute">{{ progress.streak.current === 1 ? 'dia' : 'dias' }}</span></p><p class="text-xs text-mute">Ofensiva atual · recorde {{ progress.streak.longest }}</p></RouterLink>
    <RouterLink v-if="show('monthDays')" to="/ofensiva" class="panel p-4 transition hover:border-accent" data-testid="tile-days"><CalendarDays :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ monthStudyDays }}</p><p class="text-xs text-mute">Dias estudados no mês</p></RouterLink>
    <RouterLink v-if="show('hours')" to="/concurso/estatisticas" class="panel p-4 transition hover:border-accent" data-testid="tile-hours"><Clock :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ monthHours }}</p><p class="text-xs text-mute">Horas de estudo no mês</p></RouterLink>
    <RouterLink v-if="show('activities')" to="/historico" class="panel p-4 transition hover:border-accent" data-testid="tile-activities"><Activity :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ progress.monthEvents }}</p><p class="text-xs text-mute">Atividades no mês</p></RouterLink>
  </section>

  <template v-if="show('reviews')">
  <section class="mb-6 grid grid-cols-3 gap-3">
    <RouterLink to="/revisoes" class="panel p-4 transition hover:border-accent"><CalendarCheck :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ reviews.dailyPendingActive.length }}</p><p class="text-xs text-mute">Revisões diárias</p></RouterLink>
    <RouterLink to="/revisoes" class="panel p-4 transition hover:border-accent"><Repeat :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ reviews.weeklyPendingActive.length }}</p><p class="text-xs text-mute">Revisões semanais</p></RouterLink>
    <RouterLink to="/revisoes" class="panel p-4 transition hover:border-accent"><Layers :size="18" class="mb-2 text-accent" /><p class="font-display text-2xl font-extrabold">{{ cards.due.length }}</p><p class="text-xs text-mute">Flashcards a revisar</p></RouterLink>
  </section>

  <section class="panel mb-6 p-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="font-display text-lg font-bold">Ciclo {{ up.cycle.number }}</h2>
        <p class="text-sm text-mute" data-testid="cycle-progress">{{ up.cycle.studied }} de {{ cycleSize }} dias estudados · {{ remaining ? `faltam ${plural(remaining, 'dia estudado', 'dias estudados')} para a próxima revisão semanal` : 'revisão semanal liberada' }}</p>
      </div>
      <CycleDots :studied="up.cycle.studied" :size="cycleSize" />
    </div>
  </section>

  <section class="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4" data-testid="scope-summary">
    <p class="text-sm"><b class="text-xl font-extrabold">{{ subjects.activeItems.length }}</b> <span class="text-mute">{{ subjects.activeItems.length === 1 ? 'matéria ativa' : 'matérias ativas' }}</span>
      <span class="mx-2 text-line">|</span><b class="text-xl font-extrabold">{{ subjects.inactiveItems.length }}</b> <span class="text-mute">{{ subjects.inactiveItems.length === 1 ? 'inativa' : 'inativas' }}</span></p>
    <RouterLink to="/ajustes" class="text-sm font-semibold text-accent">Gerenciar <ArrowRight :size="14" class="inline" /></RouterLink>
  </section>

  </template>

  <section v-if="show('concurso')" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.studiedDays }}</p><p class="text-xs text-mute">Dias estudados</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.studies }}</p><p class="text-xs text-mute">Conteúdos registrados</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.questions }}</p><p class="text-xs text-mute">Questões no caderno</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ stats.cards }}</p><p class="text-xs text-mute">Flashcards</p></div>
  </section>

  <div class="grid gap-6 md:grid-cols-2">
    <section v-if="show('habits')" class="panel p-5" data-testid="dash-habits">
      <h2 class="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Flame :size="18" class="text-warn" />Hábitos de hoje</h2>
      <p v-if="!habits.todayList.length" class="text-sm text-mute">Nenhum hábito previsto para hoje.</p>
      <template v-else>
        <p class="mb-2 text-sm"><b class="text-xl">{{ habits.todayProgress.done }}</b> de {{ habits.todayProgress.total }} concluídos</p>
        <ProgressBar :value="(habits.todayProgress.done / habits.todayProgress.total) * 100" tone="ok" />
        <ul class="mt-3 space-y-1.5 text-sm"><li v-for="h in habits.todayList.slice(0, 4)" :key="h.habit.id" class="flex items-center gap-2" :class="h.doneToday && 'text-mute'"><Check :size="14" :class="h.doneToday ? 'text-ok' : 'text-line'" />{{ h.habit.name }}</li></ul>
      </template>
      <RouterLink to="/habitos" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">Abrir hábitos <ArrowRight :size="14" /></RouterLink>
    </section>

    <section v-if="show('tasks')" class="panel p-5" data-testid="dash-tasks">
      <h2 class="mb-3 flex items-center gap-2 font-display text-lg font-bold"><ListChecks :size="18" class="text-accent" />Tarefas pendentes</h2>
      <p v-if="!pendingTasks.length" class="text-sm text-mute">Nenhuma tarefa pendente.</p>
      <ul v-else class="space-y-1.5 text-sm"><li v-for="t in pendingTasks.slice(0, 4)" :key="t.id" class="flex justify-between gap-2"><span class="truncate">{{ t.title }}</span><span class="shrink-0 text-xs" :class="t.dueDate && t.dueDate < clock.today ? 'font-semibold text-danger' : 'text-mute'">{{ t.dueDate ? relativeDay(t.dueDate, clock.today) : '' }}</span></li></ul>
      <p class="mt-2 text-xs text-mute">{{ plural(pendingTasks.length, 'pendente', 'pendentes') }}<template v-if="tasks.overdue.length"> · {{ plural(tasks.overdue.length, 'atrasada', 'atrasadas') }}</template></p>
      <RouterLink to="/tarefas" class="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">Abrir tarefas <ArrowRight :size="14" /></RouterLink>
    </section>

    <section v-if="show('concurso')" class="panel p-5 md:col-span-2" data-testid="dash-concurso">
      <h2 class="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Target :size="18" class="text-accent" />Resumo da preparação</h2>
      <template v-if="concurso.current">
        <p class="font-semibold">{{ concurso.current.name }}<span v-if="concurso.daysToExam !== null && concurso.daysToExam >= 0" class="font-normal text-mute"> · prova em {{ plural(concurso.daysToExam, 'dia', 'dias') }}</span></p>
        <div class="mt-2 flex items-center gap-3"><ProgressBar :value="concurso.progress.completionPct" tone="ok" /><span class="shrink-0 text-sm font-semibold">{{ concurso.progress.completionPct }}%</span></div>
        <p class="mt-1 text-xs text-mute">{{ concurso.progress.done }} de {{ concurso.progress.total }} assuntos do edital estudados · {{ concurso.progress.count.mastered }} dominados</p>
      </template>
      <p v-else class="text-sm text-mute">Cadastre o concurso e o edital para acompanhar sua preparação.</p>
      <RouterLink :to="concurso.current ? '/concurso' : '/concurso/edital'" class="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">{{ concurso.current ? 'Abrir Meu Concurso' : 'Cadastrar concurso' }} <ArrowRight :size="14" /></RouterLink>
    </section>

    <section v-if="show('concurso')" class="panel p-5">
      <h2 class="mb-3 font-display text-lg font-bold">Desempenho</h2>
      <template v-if="stats.reviewedTotal || stats.cards">
        <p v-if="stats.reviewedTotal" class="text-sm">Aproveitamento nas revisões: <b class="text-xl">{{ stats.accuracy }}%</b> <span class="text-mute">({{ stats.reviewedCorrect }} acertos, {{ stats.reviewedWrong }} erros)</span></p>
        <p v-else class="text-sm text-mute">Responda questões em uma revisão para ver o aproveitamento.</p>
        <p v-if="stats.cards" class="mt-2 text-sm">Flashcards dominados: <b>{{ stats.cardsMastered }}</b> de {{ stats.cards }}</p>
      </template>
      <p v-else class="text-sm text-mute">Os indicadores aparecem conforme você revisa.</p>
      <RouterLink to="/estatisticas" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">Ver estatísticas <ArrowRight :size="14" /></RouterLink>
    </section>

    <section v-if="show('reviews')" class="panel p-5">
      <h2 class="mb-3 font-display text-lg font-bold">Próximas revisões</h2>
      <ul class="space-y-2.5 text-sm">
        <li v-if="up.dailyTomorrow">Amanhã: revisão diária de hoje ({{ plural(studies.byDate[clock.today].length, 'assunto', 'assuntos') }})</li>
        <li v-if="up.cycle.studied">Semanal do ciclo {{ up.cycle.number }}: faltam {{ plural(remaining, 'dia estudado', 'dias estudados') }}</li>
        <li v-if="up.flashcardsTomorrow">Amanhã: {{ plural(up.flashcardsTomorrow, 'flashcard', 'flashcards') }}</li>
        <li v-if="!up.dailyTomorrow && !up.cycle.studied && !up.flashcardsTomorrow" class="text-mute">Registre um estudo hoje para agendar a revisão de amanhã.</li>
      </ul>
    </section>
  </div>

  <section v-if="show('mocks')" class="panel mt-6 p-5" data-testid="mock-dashboard">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 font-display text-lg font-bold"><ClipboardCheck :size="18" class="text-accent" />Simulados</h2>
      <RouterLink to="/simulados/novo" class="btn-line btn-sm"><Plus :size="15" /> Novo simulado</RouterLink>
    </div>
    <p v-if="!mo.count" class="text-sm text-mute">Nenhum simulado registrado ainda. Cadastre o primeiro para acompanhar sua evolução e receber a sugestão do próximo.</p>
    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><p class="font-display text-2xl font-extrabold">{{ fmtPct(mo.last) }}</p><p class="text-xs text-mute">Último aproveitamento</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ fmtPct(mo.avg) }}</p><p class="text-xs text-mute">Média geral</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ mo.count }}</p><p class="text-xs text-mute">{{ mo.count === 1 ? 'Simulado realizado' : 'Simulados realizados' }}</p></div>
        <div><p class="flex items-center gap-1 font-display text-2xl font-extrabold" :class="mo.delta > 0 ? 'text-ok' : mo.delta < 0 ? 'text-danger' : ''"><component :is="mo.delta > 0 ? ArrowUp : ArrowDown" v-if="mo.delta" :size="18" />{{ fmtDelta(mo.delta) }}</p><p class="text-xs text-mute">Vs. simulado anterior</p></div>
        <div><p class="truncate font-display text-base font-extrabold text-ok">{{ mo.bestSubject ? subjects.nameOf(mo.bestSubject.subjectId) : '—' }}</p><p class="text-xs text-mute">Melhor matéria{{ mo.bestSubject ? ` · ${fmtPct(mo.bestSubject.avg)}` : '' }}</p></div>
        <div><p class="truncate font-display text-base font-extrabold text-danger">{{ mo.worstSubject ? subjects.nameOf(mo.worstSubject.subjectId) : '—' }}</p><p class="text-xs text-mute">Pior matéria{{ mo.worstSubject ? ` · ${fmtPct(mo.worstSubject.avg)}` : '' }}</p></div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sunken px-4 py-3 text-sm">
        <span>Próximo simulado sugerido: <b>{{ formatDate(sch.nextDate) }}</b></span>
        <span class="font-semibold" :class="sch.status === 'upcoming' ? 'text-mute' : 'text-warn'">{{ sch.status === 'upcoming' ? `faltam ${plural(sch.daysLeft, 'dia', 'dias')}` : sch.status === 'due' ? 'é hoje' : `atrasado há ${plural(sch.overdueDays, 'dia', 'dias')}` }}</span>
      </div>
      <RouterLink to="/simulados" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">Ver evolução <ArrowRight :size="14" /></RouterLink>
    </template>
  </section>

  <section v-if="show('recent')" class="mt-6" data-testid="dash-recent">
    <div class="mb-3 flex items-center justify-between"><h2 class="font-display text-lg font-bold">Últimos registros de estudo</h2><RouterLink to="/historico" class="text-sm font-semibold text-accent">Histórico completo</RouterLink></div>
    <p v-if="!recentStudies.length" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">Seus estudos aparecem aqui depois do primeiro registro.</p>
    <ul v-else class="panel divide-y divide-line">
      <li v-for="st in recentStudies" :key="st.id" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span class="min-w-0"><span class="block truncate font-medium">{{ st.topic }}</span><span class="block truncate text-xs text-mute">{{ subjects.nameOf(st.subjectId) }}{{ st.minutes ? ' · ' + st.minutes + ' min' : '' }}</span></span>
        <span class="shrink-0 text-xs text-mute">{{ relativeDay(st.date, clock.today) }}</span>
      </li>
    </ul>
  </section>

  <div class="mt-8 flex justify-center"><button class="btn-ghost btn-sm" data-testid="customize-dashboard" @click="customizing = true"><SlidersHorizontal :size="14" /> Personalizar indicadores</button></div>
  <BaseModal :open="customizing" title="Indicadores da Visão geral" @close="customizing = false">
    <p class="mb-3 text-sm text-mute">Escolha o que aparece nesta tela. Nada é apagado: os dados continuam disponíveis nas respectivas áreas.</p>
    <ul class="space-y-2.5"><li v-for="[k, l] in WIDGETS" :key="k"><label class="flex items-center gap-2.5 text-sm"><input type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-accent))]" :checked="show(k)" :data-testid="`widget-${k}`" @change="toggleWidget(k)" />{{ l }}</label></li></ul>
    <button class="btn-line mt-4 w-full" @click="settings.setDashboardHidden([])">Mostrar todos</button>
  </BaseModal>
</template>
