<script setup>
import { computed, ref } from 'vue'
import { useStudiesStore } from '../stores/studies'
import { useQuestionsStore } from '../stores/questions'
import { useFlashcardsStore } from '../stores/flashcards'
import { useReviewsStore } from '../stores/reviews'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { computeStats } from '../services/statsEngine'
import PageHeader from '../components/ui/PageHeader.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'

const studies = useStudiesStore(), questions = useQuestionsStore(), cards = useFlashcardsStore(), reviews = useReviewsStore(), subjects = useSubjectsStore(), clock = useClockStore()
const s = computed(() => computeStats({ subjects: subjects.items, studies: studies.items, questions: questions.items, flashcards: cards.items, logs: reviews.logs }, clock.today))
const mode = ref('weekly')
const series = computed(() => (mode.value === 'weekly' ? s.value.weekly : s.value.monthly))
const maxQ = computed(() => Math.max(1, ...series.value.map((p) => p.correct + p.wrong)))
const maxD = computed(() => Math.max(1, ...series.value.map((p) => p.studies)))
const empty = computed(() => !s.value.studies && !s.value.questions && !s.value.cards && !s.value.reviewedTotal)
</script>

<template>
  <PageHeader title="Estatísticas" subtitle="Calculadas a partir dos seus registros reais." />
  <p v-if="empty" class="mb-6 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">Ainda não há dados. Registre estudos e faça revisões para ver sua evolução.</p>

  <section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ s.studiedDays }}</p><p class="text-xs text-mute">Dias estudados</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ s.studies }}</p><p class="text-xs text-mute">Conteúdos registrados</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ s.questions }}</p><p class="text-xs text-mute">Questões cadastradas</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold"><span class="text-ok">{{ s.reviewedCorrect }}</span> / <span class="text-danger">{{ s.reviewedWrong }}</span></p><p class="text-xs text-mute">Questões certas / erradas nas revisões</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ s.accuracy === null ? '—' : s.accuracy + '%' }}</p><p class="text-xs text-mute">Aproveitamento</p></div>
    <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ s.cardsMastered }} <span class="text-base font-semibold text-mute">/ {{ s.cardsNotMastered }}</span></p><p class="text-xs text-mute">Flashcards dominados / não dominados</p></div>
  </section>

  <section class="panel mb-6 p-5">
    <div class="mb-4 flex items-center justify-between gap-2">
      <h2 class="font-display text-lg font-bold">Evolução</h2>
      <div class="flex gap-1 rounded-xl bg-sunken p-1 text-xs font-semibold">
        <button class="rounded-lg px-3 py-1.5" :class="mode === 'weekly' ? 'bg-surface shadow-sm' : 'text-mute'" @click="mode = 'weekly'">Semanal</button>
        <button class="rounded-lg px-3 py-1.5" :class="mode === 'monthly' ? 'bg-surface shadow-sm' : 'text-mute'" @click="mode = 'monthly'">Mensal</button>
      </div>
    </div>
    <p class="mb-2 text-xs font-semibold text-mute">Questões revisadas (certas e erradas)</p>
    <div class="flex h-28 items-end gap-2" role="img" :aria-label="'Questões revisadas por período'">
      <div v-for="p in series" :key="p.key" class="flex h-full flex-1 flex-col justify-end gap-px">
        <div class="rounded-t bg-danger" :style="{ height: (p.wrong / maxQ) * 100 + '%' }" :title="p.wrong + ' erros'" />
        <div class="bg-ok" :class="p.wrong ? '' : 'rounded-t'" :style="{ height: (p.correct / maxQ) * 100 + '%' }" :title="p.correct + ' acertos'" />
        <div v-if="!p.correct && !p.wrong" class="h-0.5 rounded bg-line" />
      </div>
    </div>
    <div class="mt-1 flex gap-2 text-center text-[11px] text-mute"><span v-for="p in series" :key="p.key" class="flex-1">{{ p.label }}</span></div>
    <div class="mt-5 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs text-mute"><tr><th class="py-1.5 pr-3 font-semibold">Período</th><th class="px-2 font-semibold">Dias estudados</th><th class="px-2 font-semibold">Conteúdos</th><th class="px-2 font-semibold">Acertos / erros</th><th class="pl-2 font-semibold">Aproveit.</th></tr></thead>
        <tbody class="divide-y divide-line">
          <tr v-for="p in [...series].reverse()" :key="p.key"><td class="py-2 pr-3 font-medium">{{ mode === 'weekly' ? 'Sem. ' + p.label : p.label }}</td><td class="px-2">{{ p.studiedDays }}</td><td class="px-2">{{ p.studies }}</td><td class="px-2">{{ p.correct }} / {{ p.wrong }}</td><td class="pl-2">{{ p.accuracy === null ? '—' : p.accuracy + '%' }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel p-5">
    <h2 class="mb-4 font-display text-lg font-bold">Desempenho por matéria</h2>
    <p v-if="!s.bySubject.length" class="text-sm text-mute">Nenhuma matéria cadastrada.</p>
    <ul v-else class="space-y-5">
      <li v-for="b in s.bySubject" :key="b.subject.id">
        <div class="mb-1.5 flex items-center justify-between gap-3 text-sm"><SubjectDot :id="b.subject.id" bare /><span class="font-semibold">{{ b.accuracy === null ? 'Sem revisões' : b.accuracy + '%' }}</span></div>
        <ProgressBar :value="b.accuracy ?? 0" tone="ok" />
        <p class="mt-1.5 text-xs text-mute">{{ b.studies }} estudo(s) · {{ b.questions }} questão(ões) · {{ b.correct }} acerto(s) / {{ b.wrong }} erro(s) · {{ b.cardsMastered }}/{{ b.cards }} cartões dominados</p>
      </li>
    </ul>
  </section>
</template>
