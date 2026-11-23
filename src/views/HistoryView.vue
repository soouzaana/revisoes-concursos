<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, Repeat, Layers, Timer, Check, ClipboardCheck, ListChecks, StickyNote, ArrowRight } from 'lucide-vue-next'
import { useProgressStore } from '../stores/progress'
import { useClockStore } from '../stores/clock'
import { CATEGORIES, CATEGORY_KEYS, filterTimeline, timeLabel } from '../services/activityEngine'
import { addDays, formatDate, relativeDay } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const progress = useProgressStore(), clock = useClockStore()
const cats = ref([]), from = ref(''), to = ref(''), shown = ref(40)
const ICONS = { study: BookOpen, review: Repeat, flashcard: Layers, session: Timer, habit: Check, mock: ClipboardCheck, task: ListChecks, note: StickyNote }
const list = computed(() => filterTimeline(progress.events, { categories: cats.value, from: from.value, to: to.value }))
const groups = computed(() => {
  const g = []
  for (const e of list.value.slice(0, shown.value)) { const last = g[g.length - 1]; if (last && last.date === e.date) last.items.push(e); else g.push({ date: e.date, items: [e] }) }
  return g
})
const toggle = (k) => { cats.value = cats.value.includes(k) ? cats.value.filter((x) => x !== k) : [...cats.value, k]; shown.value = 40 }
const quick = (n) => { from.value = n ? addDays(clock.today, -(n - 1)) : ''; to.value = '' }
</script>

<template>
  <PageHeader title="Histórico" subtitle="Linha do tempo de tudo o que você fez. Toque em um registro para abrir a atividade." />

  <div class="mb-5 space-y-2">
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Categorias"><button v-for="k in CATEGORY_KEYS" :key="k" class="btn-sm rounded-full px-3 py-1.5 text-xs font-semibold" :class="cats.includes(k) ? 'bg-accent text-accent-fg' : 'bg-sunken text-mute'" :aria-pressed="cats.includes(k)" :data-testid="`hist-${k}`" @click="toggle(k)">{{ CATEGORIES[k].label }}</button><button v-if="cats.length" class="btn-ghost btn-sm" @click="cats = []">Limpar</button></div>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <input v-model="from" type="date" class="field !w-auto !py-1.5 text-xs" aria-label="De" /><span class="text-mute">até</span><input v-model="to" type="date" class="field !w-auto !py-1.5 text-xs" aria-label="Até" />
      <button class="btn-ghost btn-sm" @click="quick(7)">7 dias</button><button class="btn-ghost btn-sm" @click="quick(30)">30 dias</button><button class="btn-ghost btn-sm" @click="quick(0)">Tudo</button>
    </div>
  </div>

  <EmptyState v-if="!list.length" :title="progress.events.length ? 'Nada neste filtro' : 'Sem atividades ainda'" :text="progress.events.length ? 'Ajuste as categorias ou o período.' : 'Registre estudos, revisões, hábitos e simulados: tudo aparece aqui.'" />
  <div v-else class="space-y-5" data-testid="timeline">
    <section v-for="g in groups" :key="g.date">
      <h2 class="mb-1.5 text-sm font-bold capitalize text-mute">{{ relativeDay(g.date, clock.today) }} · {{ formatDate(g.date) }}</h2>
      <ul class="panel divide-y divide-line">
        <li v-for="e in g.items" :key="e.id" data-testid="timeline-item">
          <RouterLink :to="e.to" class="flex items-center gap-3 px-4 py-3 transition hover:bg-sunken">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><component :is="ICONS[e.category]" :size="17" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{{ e.title }}</span><span class="block truncate text-xs text-mute">{{ CATEGORIES[e.category].label }}<template v-if="e.detail"> · {{ e.detail }}</template></span></span>
            <span class="shrink-0 text-xs text-mute">{{ timeLabel(e.at) }}</span><ArrowRight :size="14" class="shrink-0 text-mute" />
          </RouterLink>
        </li>
      </ul>
    </section>
    <button v-if="list.length > shown" class="btn-line w-full" @click="shown += 40">Mostrar mais ({{ list.length - shown }})</button>
  </div>
</template>
