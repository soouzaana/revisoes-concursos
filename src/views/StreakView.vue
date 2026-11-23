<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight, Flame, Trophy, CalendarDays, Percent } from 'lucide-vue-next'
import { useProgressStore } from '../stores/progress'
import { useSettingsStore } from '../stores/settings'
import { useClockStore } from '../stores/clock'
import { CATEGORIES, CATEGORY_KEYS, LEVEL_LABELS } from '../services/activityEngine'
import { formatDate, formatDayMonth } from '../utils/date'
import { plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import Heatmap from '../components/charts/Heatmap.vue'

const progress = useProgressStore(), settings = useSettingsStore(), clock = useClockStore()
const year = ref(Number(clock.today.slice(0, 4)))
const selected = ref(clock.today)
const day = computed(() => progress.dayMap.get(selected.value))
const yearActive = computed(() => [...progress.dayMap.keys()].filter((d) => d.startsWith(String(year.value))).length)
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)
const toggleCat = (k) => settings.setStreakCategories(settings.streakCategories.includes(k) ? settings.streakCategories.filter((x) => x !== k) : [...settings.streakCategories, k])
</script>

<template>
  <PageHeader title="Ofensiva" subtitle="Dias consecutivos com pelo menos uma atividade válida — estudo, revisão, flashcards, hábitos ou simulado." />

  <section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="streak-stats">
    <div class="panel p-4"><Flame :size="18" class="mb-2 text-warn" /><p class="font-display text-3xl font-extrabold" data-testid="streak-current">{{ progress.streak.current }}</p><p class="text-xs text-mute">Ofensiva atual{{ progress.streak.current && !progress.streak.activeToday ? ' · faça algo hoje para manter' : '' }}</p></div>
    <div class="panel p-4"><Trophy :size="18" class="mb-2 text-accent" /><p class="font-display text-3xl font-extrabold" data-testid="streak-longest">{{ progress.streak.longest }}</p><p class="text-xs text-mute">Maior ofensiva</p></div>
    <div class="panel p-4"><CalendarDays :size="18" class="mb-2 text-ok" /><p class="font-display text-3xl font-extrabold">{{ progress.streak.totalActive }}</p><p class="text-xs text-mute">Dias ativos no total</p></div>
    <div class="panel p-4"><Percent :size="18" class="mb-2 text-accent" /><p class="font-display text-3xl font-extrabold">{{ progress.month.pct }}%</p><p class="text-xs text-mute">Dias ativos no mês ({{ progress.month.active }}/{{ progress.month.elapsed }})</p></div>
  </section>

  <section class="panel mb-6 p-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-display text-lg font-bold">{{ plural(yearActive, 'dia ativo', 'dias ativos') }} em {{ year }}</h2>
      <div class="flex items-center gap-1"><button class="btn-line btn-sm !p-2" aria-label="Ano anterior" @click="year--"><ChevronLeft :size="16" /></button><span class="w-12 text-center font-display font-bold" data-testid="heat-year">{{ year }}</span><button class="btn-line btn-sm !p-2" aria-label="Próximo ano" :disabled="year >= Number(clock.today.slice(0, 4))" @click="year++"><ChevronRight :size="16" /></button></div>
    </div>
    <Heatmap :year="year" :day-map="progress.dayMap" :today="clock.today" :selected="selected" @select="selected = $event" />
  </section>

  <section class="panel mb-6 p-5" data-testid="day-detail">
    <h2 class="mb-3 font-display text-lg font-bold">{{ formatDate(selected) }}</h2>
    <p v-if="!day" class="text-sm text-mute">Sem atividade neste dia.</p>
    <template v-else>
      <p class="mb-3 text-sm font-semibold">{{ LEVEL_LABELS[day.level] }}</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center">
        <div><p class="font-display text-2xl font-extrabold">{{ day.count }}</p><p class="text-xs text-mute">Atividades</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ fmtMin(day.minutes) }}</p><p class="text-xs text-mute">Tempo estudado</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ day.sessions }}</p><p class="text-xs text-mute">Sessões</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ day.habits }}</p><p class="text-xs text-mute">Hábitos</p></div>
        <div><p class="font-display text-2xl font-extrabold">{{ day.reviews }}</p><p class="text-xs text-mute">Revisões</p></div>
      </div>
      <ul class="mt-4 divide-y divide-line text-sm"><li v-for="e in day.events" :key="e.id"><RouterLink :to="e.to" class="flex justify-between gap-3 py-2 hover:text-accent"><span class="truncate">{{ e.title }}</span><span class="shrink-0 text-xs text-mute">{{ CATEGORIES[e.category].label }}</span></RouterLink></li></ul>
    </template>
  </section>

  <div class="grid gap-6 md:grid-cols-2">
    <section class="panel p-5">
      <h2 class="mb-1 font-display text-lg font-bold">O que conta para a ofensiva</h2>
      <p class="mb-3 text-xs text-mute">Também define a cor do mapa de atividades.</p>
      <ul class="space-y-2"><li v-for="k in CATEGORY_KEYS" :key="k"><label class="flex items-center gap-2.5 text-sm"><input type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-accent))]" :checked="settings.streakCategories.includes(k)" :data-testid="`cat-${k}`" @change="toggleCat(k)" />{{ CATEGORIES[k].label }}</label></li></ul>
    </section>
    <section class="panel p-5">
      <h2 class="mb-3 font-display text-lg font-bold">Histórico de ofensivas</h2>
      <p v-if="!progress.streak.runs.length" class="text-sm text-mute">Suas sequências aparecem aqui.</p>
      <ul v-else class="max-h-72 divide-y divide-line overflow-y-auto text-sm" data-testid="streak-history"><li v-for="r in progress.streak.runs" :key="r.start" class="flex justify-between gap-3 py-2"><span>{{ r.start === r.end ? formatDayMonth(r.start) : `${formatDayMonth(r.start)} – ${formatDayMonth(r.end)}` }}</span><span class="font-semibold">{{ plural(r.length, 'dia', 'dias') }}<span v-if="r.ongoing" class="pill ml-1 bg-ok-soft text-ok">em andamento</span></span></li></ul>
    </section>
  </div>
</template>
