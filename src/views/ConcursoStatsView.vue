<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useStudiesStore } from '../stores/studies'
import { useReviewsStore } from '../stores/reviews'
import { useConcursoStore } from '../stores/concurso'
import { useMocksStore } from '../stores/mocks'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { concursoStats } from '../services/concursoEngine'
import { addDays, formatMonthLabel, monthKey } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import MiniBars from '../components/charts/MiniBars.vue'

const studies = useStudiesStore(), reviews = useReviewsStore(), concurso = useConcursoStore(), mocks = useMocksStore(), subjects = useSubjectsStore(), clock = useClockStore()
const preset = ref('all'), from = ref(''), to = ref(''), subjectId = ref('')
const PRESETS = [['all', 'Tudo'], ['7', '7 dias'], ['30', '30 dias'], ['month', 'Este mês'], ['custom', 'Personalizado']]
function setPreset(p) {
  preset.value = p
  if (p === 'all') { from.value = ''; to.value = '' }
  else if (p === 'month') { from.value = monthKey(clock.today) + '-01'; to.value = clock.today }
  else if (p !== 'custom') { from.value = addDays(clock.today, -(Number(p) - 1)); to.value = clock.today }
}
const s = computed(() => concursoStats({
  studies: studies.items, cycleSessions: concurso.sessions, logs: reviews.logs, reviews: reviews.reviews, syllabus: concurso.syllabus,
  mockExams: mocks.items, from: from.value, to: to.value, subjectId: subjectId.value, today: clock.today
}))
const hours = (h) => (h ? (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h' : '0 h')
const cards = computed(() => [
  ['Dias estudados', s.value.studyDays], ['Horas acumuladas', hours(s.value.hours)], ['Questões resolvidas', s.value.questions],
  ['Aproveitamento', s.value.accuracy == null ? '—' : s.value.accuracy + '%'], ['Assuntos estudados', `${s.value.topicsStudied}/${s.value.topicsTotal}`],
  ['Assuntos dominados', s.value.topicsMastered], ['Revisões concluídas', s.value.reviewsDone], ['Simulados realizados', s.value.mocks]
])
</script>

<template>
  <PageHeader title="Estatísticas do concurso" subtitle="Indicadores da preparação, calculados dos seus registros.">
    <RouterLink to="/estatisticas" class="btn-line btn-sm">Estatísticas detalhadas</RouterLink>
  </PageHeader>

  <div class="mb-5 space-y-2">
    <div class="flex flex-wrap gap-1.5" role="tablist"><button v-for="[k, l] in PRESETS" :key="k" role="tab" :aria-selected="preset === k" class="btn-sm rounded-full px-3 py-1.5 text-xs font-semibold" :class="preset === k ? 'bg-accent text-accent-fg' : 'bg-sunken text-mute'" @click="setPreset(k)">{{ l }}</button></div>
    <div class="flex flex-wrap items-center gap-2">
      <template v-if="preset === 'custom'"><input v-model="from" type="date" class="field !w-auto !py-1.5 text-xs" aria-label="De" /><span class="text-xs text-mute">até</span><input v-model="to" type="date" :max="clock.today" class="field !w-auto !py-1.5 text-xs" aria-label="Até" /></template>
      <select v-model="subjectId" class="field !w-auto !py-1.5 text-xs" aria-label="Matéria"><option value="">Todas as matérias</option><option v-for="x in subjects.items" :key="x.id" :value="x.id">{{ x.name }}</option></select>
    </div>
  </div>

  <section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="concurso-kpis">
    <div v-for="[l, v] in cards" :key="l" class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ v }}</p><p class="text-xs text-mute">{{ l }}</p></div>
  </section>

  <section class="panel p-5">
    <h2 class="mb-1 font-display text-lg font-bold">Evolução mensal</h2>
    <p v-if="!s.monthly.length" class="text-sm text-mute">Sem registros no período selecionado.</p>
    <template v-else>
      <p class="mb-1 text-xs font-semibold text-mute">Horas de estudo por mês</p>
      <MiniBars :items="s.monthly.map((m) => ({ label: formatMonthLabel(m.month), value: Math.round(m.hours * 10) / 10 }))" unit=" h" :height="90" label="Horas por mês" />
      <p class="mb-1 mt-4 text-xs font-semibold text-mute">Dias estudados por mês</p>
      <MiniBars :items="s.monthly.map((m) => ({ label: formatMonthLabel(m.month), value: m.days }))" :height="90" label="Dias por mês" />
      <p class="mb-1 mt-4 text-xs font-semibold text-mute">Aproveitamento nas questões</p>
      <MiniBars :items="s.monthly.map((m) => ({ label: formatMonthLabel(m.month), value: m.accuracy }))" :max="100" unit="%" :height="90" label="Aproveitamento por mês" />
      <div class="mt-2 flex gap-1.5 text-[10px] text-mute"><span v-for="m in s.monthly" :key="m.month" class="flex-1 text-center">{{ formatMonthLabel(m.month) }}</span></div>
    </template>
  </section>
</template>
