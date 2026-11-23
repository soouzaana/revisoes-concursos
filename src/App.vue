<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { House, Flame, History, LayoutGrid, Target, Settings, WifiOff, CalendarDays, ListChecks, Layers, StickyNote, Repeat, NotebookPen, PenLine, ChartColumn, TrendingUp, Timer, ClipboardCheck } from 'lucide-vue-next'
import { useAppStore } from './stores/app'
import { useReviewsStore } from './stores/reviews'
import { useFlashcardsStore } from './stores/flashcards'
import { useMocksStore } from './stores/mocks'
import { useOnline } from './composables/useOnline'
import ToastHost from './components/ui/ToastHost.vue'
import ConfirmHost from './components/ui/ConfirmHost.vue'

const app = useAppStore(), reviews = useReviewsStore(), cards = useFlashcardsStore(), mocks = useMocksStore(), route = useRoute()
const online = useOnline()
const logo = import.meta.env.BASE_URL + 'favicon.svg'
const pending = computed(() => reviews.dailyPendingActive.length + reviews.weeklyPendingActive.length + cards.due.length)

// Três áreas principais + histórico. Sidebar (desktop) lista tudo; navegação inferior (celular) leva às áreas.
const sections = [
  { title: 'Visão geral', items: [
    { to: '/', label: 'Início', icon: House, name: 'home' },
    { to: '/ofensiva', label: 'Ofensiva', icon: Flame, name: 'streak' },
    { to: '/historico', label: 'Histórico', icon: History, name: 'history' }] },
  { title: 'Aplicativos', items: [
    { to: '/calendario', label: 'Calendário', icon: CalendarDays, name: 'calendar' },
    { to: '/habitos', label: 'Hábitos', icon: Flame, name: 'habits' },
    { to: '/tarefas', label: 'Tarefas', icon: ListChecks, name: 'tasks' },
    { to: '/flashcards', label: 'Flashcards', icon: Layers, name: 'flashcards', cards: true },
    { to: '/anotacoes', label: 'Anotações', icon: StickyNote, name: 'notes' }] },
  { title: 'Meu Concurso', items: [
    { to: '/concurso/edital', label: 'Edital', icon: Target, name: 'edital' },
    { to: '/estudos', label: 'Registrar estudo', icon: PenLine, name: 'studies' },
    { to: '/revisoes', label: 'Revisões', icon: Repeat, name: 'reviews', badge: true },
    { to: '/concurso/revisao-assuntos', label: 'Revisão de assuntos', icon: ClipboardCheck, name: 'topic-review' },
    { to: '/caderno', label: 'Caderno de erros', icon: NotebookPen, name: 'notebook' },
    { to: '/concurso/ciclo', label: 'Ciclo de estudos', icon: Timer, name: 'cycle' },
    { to: '/concurso/estatisticas', label: 'Estatísticas', icon: ChartColumn, name: 'concurso-stats' },
    { to: '/simulados', label: 'Desempenho', icon: TrendingUp, name: 'mocks', dot: true }] }
]
const bottom = [
  { to: '/', label: 'Visão geral', icon: House, area: 'overview' },
  { to: '/aplicativos', label: 'Aplicativos', icon: LayoutGrid, area: 'apps' },
  { to: '/concurso', label: 'Meu Concurso', icon: Target, area: 'concurso', badge: true },
  { to: '/historico', label: 'Histórico', icon: History, area: 'history' }
]
const activeName = computed(() => route.meta.parent || route.name)
const isActive = (n) => activeName.value === n
const area = computed(() => route.meta.area)

const resume = () => { if (document.visibilityState === 'visible') app.onResume() }
let timer
onMounted(() => {
  app.init()
  document.addEventListener('visibilitychange', resume)
  addEventListener('focus', resume)
  timer = setInterval(resume, 60000)
})
onUnmounted(() => { document.removeEventListener('visibilitychange', resume); removeEventListener('focus', resume); clearInterval(timer) })
</script>

<template>
  <div class="min-h-dvh md:pl-64">
    <!-- Sidebar (telas maiores) -->
    <aside class="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6 md:flex">
      <div class="mb-6 flex items-center gap-3 px-2">
        <img :src="logo" alt="" class="h-9 w-9 rounded-xl" />
        <span class="font-display text-lg font-extrabold leading-tight">Revisões<br /><span class="text-sm font-semibold text-mute">para concursos</span></span>
      </div>
      <nav class="flex flex-1 flex-col gap-4" aria-label="Principal">
        <div v-for="sec in sections" :key="sec.title">
          <p class="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-mute/80">{{ sec.title }}</p>
          <RouterLink v-for="n in sec.items" :key="n.to" :to="n.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-sunken"
            :class="isActive(n.name) ? 'bg-accent-soft text-accent' : 'text-mute'">
            <component :is="n.icon" :size="18" />{{ n.label }}
            <span v-if="n.badge && pending" class="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{{ pending }}</span>
            <span v-if="n.dot && mocks.reminderActive" class="ml-auto h-2.5 w-2.5 rounded-full bg-warn" aria-label="Simulado sugerido" />
          </RouterLink>
        </div>
        <RouterLink to="/ajustes" class="mt-auto flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-sunken" :class="isActive('settings') ? 'bg-accent-soft text-accent' : 'text-mute'"><Settings :size="18" />Ajustes</RouterLink>
      </nav>
      <p v-if="!online" class="mt-3 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-semibold text-warn"><WifiOff :size="14" /> Offline — tudo continua funcionando</p>
    </aside>

    <!-- Barra superior (celular) -->
    <header class="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur md:hidden">
      <span class="flex items-center gap-2 font-display text-base font-extrabold"><img :src="logo" alt="" class="h-7 w-7 rounded-lg" />Revisões</span>
      <span class="flex items-center gap-1">
        <WifiOff v-if="!online" :size="16" class="mr-1 text-warn" aria-label="Offline" />
        <RouterLink to="/ofensiva" class="rounded-xl p-2.5 transition hover:bg-sunken" :class="isActive('streak') ? 'text-accent' : 'text-mute'" aria-label="Ofensiva"><Flame :size="20" /></RouterLink>
        <RouterLink to="/ajustes" class="rounded-xl p-2.5 transition hover:bg-sunken" :class="isActive('settings') ? 'text-accent' : 'text-mute'" aria-label="Ajustes"><span class="relative"><Settings :size="20" /></span></RouterLink>
      </span>
    </header>

    <main class="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
      <div v-if="app.error" class="panel border-danger p-6 text-sm text-danger">{{ app.error }}</div>
      <div v-else-if="!app.ready" class="py-20 text-center text-sm text-mute">Carregando seus dados…</div>
      <RouterView v-else v-slot="{ Component }"><component :is="Component" :key="$route.fullPath" class="animate-rise" /></RouterView>
    </main>

    <!-- Navegação inferior (celular): as três áreas + histórico -->
    <nav class="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur md:hidden" aria-label="Principal">
      <RouterLink v-for="n in bottom" :key="n.to" :to="n.to" class="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition" :class="area === n.area ? 'text-accent' : 'text-mute'" :data-testid="`tab-${n.area}`">
        <span class="relative"><component :is="n.icon" :size="22" :stroke-width="area === n.area ? 2.5 : 2" />
          <span v-if="n.badge && pending" class="absolute -right-2.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-accent-fg">{{ pending > 99 ? '99+' : pending }}</span>
          <span v-if="n.badge && mocks.reminderActive && !pending" class="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-warn" /></span>
        {{ n.label }}
      </RouterLink>
    </nav>
    <ToastHost /><ConfirmHost />
  </div>
</template>
