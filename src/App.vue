<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { House, PenLine, Repeat, NotebookPen, Layers, ChartColumn, Settings, WifiOff } from 'lucide-vue-next'
import { useAppStore } from './stores/app'
import { useReviewsStore } from './stores/reviews'
import { useFlashcardsStore } from './stores/flashcards'
import { useOnline } from './composables/useOnline'
import ToastHost from './components/ui/ToastHost.vue'
import ConfirmHost from './components/ui/ConfirmHost.vue'

const app = useAppStore(), reviews = useReviewsStore(), cards = useFlashcardsStore(), route = useRoute()
const online = useOnline()
const logo = import.meta.env.BASE_URL + 'favicon.svg'
const pending = computed(() => reviews.dailyPending.length + reviews.weeklyPending.length + cards.due.length)

const main = [
  { to: '/', label: 'Início', icon: House, name: 'home' },
  { to: '/estudos', label: 'Estudos', icon: PenLine, name: 'studies' },
  { to: '/revisoes', label: 'Revisões', icon: Repeat, name: 'reviews', badge: true },
  { to: '/caderno', label: 'Caderno', icon: NotebookPen, name: 'notebook' },
  { to: '/flashcards', label: 'Cards', icon: Layers, name: 'flashcards' }
]
const extra = [
  { to: '/estatisticas', label: 'Estatísticas', icon: ChartColumn, name: 'stats' },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, name: 'settings' }
]
const activeName = computed(() => route.meta.parent || route.name)
const isActive = (n) => activeName.value === n

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
    <aside class="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
      <div class="mb-8 flex items-center gap-3 px-2">
        <img :src="logo" alt="" class="h-9 w-9 rounded-xl" />
        <span class="font-display text-lg font-extrabold leading-tight">Revisões<br /><span class="text-sm font-semibold text-mute">para concursos</span></span>
      </div>
      <nav class="flex flex-1 flex-col gap-1" aria-label="Principal">
        <RouterLink v-for="n in [...main, ...extra]" :key="n.to" :to="n.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-sunken"
          :class="isActive(n.name) ? 'bg-accent-soft text-accent' : 'text-mute'">
          <component :is="n.icon" :size="19" />{{ n.label === 'Cards' ? 'Flashcards' : n.label }}
          <span v-if="n.badge && pending" class="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{{ pending }}</span>
        </RouterLink>
      </nav>
      <p v-if="!online" class="flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-semibold text-warn"><WifiOff :size="14" /> Offline — tudo continua funcionando</p>
    </aside>

    <!-- Barra superior (celular) -->
    <header class="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur md:hidden">
      <span class="flex items-center gap-2 font-display text-base font-extrabold"><img :src="logo" alt="" class="h-7 w-7 rounded-lg" />Revisões</span>
      <span class="flex items-center gap-1">
        <WifiOff v-if="!online" :size="16" class="mr-1 text-warn" aria-label="Offline" />
        <RouterLink v-for="n in extra" :key="n.to" :to="n.to" class="rounded-xl p-2.5 transition hover:bg-sunken" :class="isActive(n.name) ? 'text-accent' : 'text-mute'" :aria-label="n.label"><component :is="n.icon" :size="20" /></RouterLink>
      </span>
    </header>

    <main class="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
      <div v-if="app.error" class="panel border-danger p-6 text-sm text-danger">{{ app.error }}</div>
      <div v-else-if="!app.ready" class="py-20 text-center text-sm text-mute">Carregando seus dados…</div>
      <RouterView v-else v-slot="{ Component }"><component :is="Component" :key="$route.fullPath" class="animate-rise" /></RouterView>
    </main>

    <!-- Navegação inferior (celular) -->
    <nav class="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur md:hidden" aria-label="Principal">
      <RouterLink v-for="n in main" :key="n.to" :to="n.to" class="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition" :class="isActive(n.name) ? 'text-accent' : 'text-mute'">
        <span class="relative"><component :is="n.icon" :size="22" :stroke-width="isActive(n.name) ? 2.5 : 2" />
          <span v-if="n.badge && pending" class="absolute -right-2.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-[18px] text-accent-fg">{{ pending > 99 ? '99+' : pending }}</span></span>
        {{ n.label }}
      </RouterLink>
    </nav>
    <ToastHost /><ConfirmHost />
  </div>
</template>
