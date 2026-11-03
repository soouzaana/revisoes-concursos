<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { ArrowLeft, Eye, Check, X, PartyPopper, ChevronLeft, ChevronRight, Star } from 'lucide-vue-next'
import { useReviewsStore } from '../stores/reviews'
import { useQuestionsStore } from '../stores/questions'
import { useToast } from '../composables/useToast'
import { formatDate, formatDayMonth } from '../utils/date'
import { LETTERS, plural } from '../utils/text'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'

const route = useRoute(), router = useRouter()
const reviews = useReviewsStore(), questions = useQuestionsStore(), toast = useToast()
const review = computed(() => reviews.find(route.params.id))
const c = computed(() => review.value?.content)
const done = computed(() => !!review.value?.completedAt)
const idx = ref(0)
const revealed = ref(false)
const picked = ref('')
const busy = ref(false)

const q = computed(() => c.value?.questions[idx.value])
const ans = computed(() => (q.value ? c.value.answers[q.value.id] : null))
const showResult = computed(() => !!ans.value || revealed.value)
const title = computed(() => (review.value?.type === 'daily' ? `Revisão diária · ${formatDate(review.value.refDate)}` : `Revisão semanal · Ciclo ${review.value?.cycleNumber}`))
const sub = computed(() => (review.value?.type === 'weekly' ? `${formatDayMonth(c.value.days[0])} a ${formatDayMonth(c.value.days.at(-1))}` : ''))

// começa na primeira questão não respondida
let init = false
watch(c, (v) => {
  if (!v || init) return
  init = true
  const first = v.questions.findIndex((x) => !v.answers[x.id])
  idx.value = first < 0 ? 0 : first
  if (!done.value) reviews.start(review.value.id)
}, { immediate: true })
watch(idx, () => { revealed.value = false; picked.value = '' })

const go = (d) => { idx.value = Math.min(Math.max(idx.value + d, 0), c.value.questions.length - 1) }
async function mark(correct) {
  if (busy.value) return
  busy.value = true
  try {
    await reviews.answer(review.value.id, q.value, correct)
    const next = c.value.questions.findIndex((x, i) => i > idx.value && !c.value.answers[x.id])
    if (next >= 0) idx.value = next
  } catch (e) { toast.error(e.message) } finally { busy.value = false }
}
async function finish() {
  try { await reviews.complete(review.value.id); toast.ok('Revisão concluída') } catch (e) { toast.error(e.message) }
}
async function master() { await questions.setStatus(q.value.id, 'mastered'); toast.ok('Questão marcada como dominada') }
const suggestion = computed(() => (picked.value && q.value?.options?.length ? picked.value === q.value.correctAnswer : null))
</script>

<template>
  <div v-if="!review" class="py-16 text-center">
    <p class="mb-4 text-sm text-mute">Revisão não encontrada.</p>
    <RouterLink to="/revisoes" class="btn-line">Voltar às revisões</RouterLink>
  </div>

  <div v-else>
    <button class="btn-ghost btn-sm mb-3 -ml-2" @click="router.push('/revisoes')"><ArrowLeft :size="16" /> Revisões</button>
    <header class="mb-5">
      <h1 class="font-display text-2xl font-extrabold">{{ title }}</h1>
      <p v-if="sub" class="text-sm text-mute">{{ sub }} · {{ plural(c.days.length, 'dia estudado', 'dias estudados') }}</p>
      <div class="mt-3 flex items-center gap-3">
        <div class="flex-1"><ProgressBar :value="c.progress" :tone="done ? 'ok' : 'accent'" /></div>
        <span class="text-xs font-semibold text-mute">{{ c.answered }}/{{ c.total }}</span>
      </div>
    </header>

    <section class="panel mb-5 p-4">
      <h2 class="mb-3 text-sm font-bold">{{ plural(c.topics.length, 'assunto estudado', 'assuntos estudados') }}</h2>
      <ul class="space-y-2">
        <li v-for="t in c.topics" :key="t.subjectId + t.topic" class="flex flex-wrap items-center gap-2 text-sm">
          <SubjectDot :id="t.subjectId" /><span class="font-semibold">{{ t.topic }}</span>
          <span class="text-xs text-mute">{{ t.dates.map(formatDayMonth).join(', ') }}</span>
          <p v-for="(n, i) in t.notes" :key="i" class="w-full whitespace-pre-line pl-1 text-xs text-mute">{{ n }}</p>
        </li>
      </ul>
    </section>

    <!-- Revisão concluída: resultado -->
    <section v-if="done" class="panel mb-5 p-5 text-center">
      <PartyPopper :size="28" class="mx-auto mb-2 text-ok" />
      <p class="font-display text-lg font-bold">Revisão concluída</p>
      <p class="text-sm text-mute">{{ c.total ? `${c.correct} acerto(s) e ${c.wrong} erro(s)` : 'Revisão apenas dos assuntos' }}</p>
    </section>

    <!-- Questões -->
    <section v-if="c.total">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-bold">Questão {{ idx + 1 }} de {{ c.total }}</h2>
        <div class="flex gap-1">
          <button class="btn-ghost btn-sm !p-2" :disabled="idx === 0" aria-label="Questão anterior" @click="go(-1)"><ChevronLeft :size="16" /></button>
          <button class="btn-ghost btn-sm !p-2" :disabled="idx === c.total - 1" aria-label="Próxima questão" @click="go(1)"><ChevronRight :size="16" /></button>
        </div>
      </div>
      <div class="mb-3 flex flex-wrap gap-1.5" aria-label="Progresso das questões">
        <button v-for="(x, i) in c.questions" :key="x.id" class="h-2.5 w-7 rounded-full transition"
          :class="[i === idx ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : '', c.answers[x.id] ? (c.answers[x.id].correct ? 'bg-ok' : 'bg-danger') : 'bg-line']" :aria-label="'Ir para a questão ' + (i + 1)" @click="idx = i" />
      </div>

      <article v-if="q" class="panel p-5">
        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs"><SubjectDot :id="q.subjectId" /><span class="font-semibold">{{ q.topic }}</span><span class="text-mute">{{ formatDate(q.date) }}</span></div>
        <p class="whitespace-pre-line leading-relaxed">{{ q.statement }}</p>

        <ul v-if="q.options?.length" class="mt-4 space-y-2">
          <li v-for="(o, i) in q.options" :key="i">
            <button class="flex w-full gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition" :disabled="showResult"
              :class="showResult && LETTERS[i] === q.correctAnswer ? 'border-ok bg-ok-soft' : showResult && picked === LETTERS[i] ? 'border-danger bg-danger-soft' : picked === LETTERS[i] ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'"
              @click="picked = LETTERS[i]"><b>{{ LETTERS[i] }}</b><span>{{ o }}</span></button>
          </li>
        </ul>

        <button v-if="!showResult" class="btn-primary mt-5 w-full" @click="revealed = true"><Eye :size="17" /> Revelar resposta</button>

        <div v-else class="mt-5 space-y-3">
          <div class="rounded-xl bg-ok-soft p-3 text-sm"><p class="text-xs font-bold text-ok">Resposta correta</p><p class="mt-0.5 font-semibold">{{ q.correctAnswer }}<template v-if="q.options?.length && q.options[LETTERS.indexOf(q.correctAnswer)]"> — {{ q.options[LETTERS.indexOf(q.correctAnswer)] }}</template></p></div>
          <p v-if="suggestion !== null" class="text-sm font-semibold" :class="suggestion ? 'text-ok' : 'text-danger'">{{ suggestion ? 'Você marcou a alternativa correta.' : `Você marcou ${picked}.` }}</p>
          <div v-if="q.explanation" class="rounded-xl bg-sunken p-3 text-sm"><p class="text-xs font-bold text-mute">Explicação</p><p class="mt-0.5 whitespace-pre-line">{{ q.explanation }}</p></div>

          <div v-if="!done" class="grid grid-cols-2 gap-3 pt-1">
            <button class="btn-danger" :disabled="busy" @click="mark(false)"><X :size="17" /> Errei</button>
            <button class="btn-ok" :disabled="busy" @click="mark(true)"><Check :size="17" /> Acertei</button>
          </div>
          <p v-if="ans" class="text-center text-sm font-semibold" :class="ans.correct ? 'text-ok' : 'text-danger'">Registrado: {{ ans.correct ? 'acertou' : 'errou' }}<span v-if="!done" class="font-normal text-mute"> · toque em outro botão para corrigir</span></p>
          <button v-if="q.status !== 'mastered'" class="btn-ghost btn-sm" @click="master"><Star :size="14" /> Já domino esta questão</button>
        </div>
      </article>
    </section>

    <div v-if="!done" class="mt-6">
      <button class="btn-primary w-full" :disabled="!c.allAnswered" @click="finish"><Check :size="17" /> Concluir revisão</button>
      <p v-if="!c.allAnswered" class="mt-2 text-center text-xs text-mute">Responda {{ plural(c.total - c.answered, 'questão restante', 'questões restantes') }} para concluir.</p>
    </div>
  </div>
</template>
