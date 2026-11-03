<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { AlertTriangle, CheckCircle2, Play, RotateCw } from 'lucide-vue-next'
import { formatDate, formatDayMonth } from '../utils/date'
import { plural } from '../utils/text'
import { useSubjectsStore } from '../stores/subjects'
import ProgressBar from './ui/ProgressBar.vue'
import SubjectDot from './ui/SubjectDot.vue'

const props = defineProps({ review: { type: Object, required: true } })
const subjects = useSubjectsStore()
const r = computed(() => props.review)
const c = computed(() => r.value.content)
const done = computed(() => !!r.value.completedAt)
const title = computed(() => (r.value.type === 'daily' ? `Estudo de ${formatDate(r.value.refDate)}` : `Ciclo ${r.value.cycleNumber}`))
const range = computed(() => (r.value.type === 'weekly' ? `${formatDayMonth(c.value.days[0])} a ${formatDayMonth(c.value.days.at(-1))} · ${c.value.days.length} dias estudados` : null))
</script>
<template>
  <article class="panel p-4" :class="r.overdue ? 'border-warn/60' : ''">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-display text-base font-bold">{{ title }}</h3>
      <span v-if="done" class="pill bg-ok-soft text-ok"><CheckCircle2 :size="12" /> Concluída em {{ formatDate(r.completedDate || r.completedAt.slice(0, 10)) }}</span>
      <span v-else-if="r.overdue" class="pill bg-warn-soft text-warn"><AlertTriangle :size="12" /> Atrasada há {{ plural(r.lateDays, 'dia', 'dias') }}</span>
      <span v-else-if="r.status === 'in_progress'" class="pill bg-accent-soft text-accent">Em andamento</span>
      <span v-else class="pill bg-sunken text-mute">Pendente</span>
    </div>
    <p v-if="range" class="mt-0.5 text-xs text-mute">{{ range }}</p>
    <div class="mt-3 flex flex-wrap gap-1.5"><SubjectDot v-for="id in c.subjectIds" :key="id" :id="id" /></div>
    <p v-if="c.topics.length" class="mt-2 line-clamp-2 text-sm text-mute">{{ c.topics.map((t) => t.topic).join(' · ') }}</p>
    <div class="mt-3 flex items-center gap-3">
      <div class="flex-1">
        <ProgressBar :value="c.progress" :tone="done ? 'ok' : 'accent'" />
        <p class="mt-1 text-xs text-mute">
          <template v-if="c.total">{{ c.answered }} de {{ plural(c.total, 'questão', 'questões') }}<template v-if="done"> · {{ c.correct }} acerto(s)</template></template>
          <template v-else>{{ plural(c.topics.length, 'assunto', 'assuntos') }} · sem questões no caderno</template>
        </p>
      </div>
      <RouterLink :to="`/revisoes/${encodeURIComponent(r.id)}`" :class="done ? 'btn-line btn-sm' : 'btn-primary btn-sm'">
        <RotateCw v-if="done" :size="14" /><Play v-else :size="14" />{{ done ? 'Ver' : r.status === 'in_progress' ? 'Continuar' : 'Iniciar' }}
      </RouterLink>
    </div>
  </article>
</template>
