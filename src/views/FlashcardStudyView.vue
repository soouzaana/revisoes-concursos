<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Check, X, RotateCw, PartyPopper } from 'lucide-vue-next'
import { useFlashcardsStore } from '../stores/flashcards'
import { useToast } from '../composables/useToast'
import { INTERVALS } from '../services/flashcardEngine'
import { relativeDay } from '../utils/date'
import { useClockStore } from '../stores/clock'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const cards = useFlashcardsStore(), router = useRouter(), toast = useToast(), clock = useClockStore()
const queue = ref([])
const i = ref(0)
const flipped = ref(false)
const stats = ref({ ok: 0, no: 0 })
const busy = ref(false)
const last = ref(null)

onMounted(() => { queue.value = cards.due.map((c) => c.id); addEventListener('keydown', onKey) })
onUnmounted(() => removeEventListener('keydown', onKey))

const card = computed(() => cards.items.find((c) => c.id === queue.value[i.value]))
const finished = computed(() => queue.value.length > 0 && i.value >= queue.value.length)
const progress = computed(() => (queue.value.length ? Math.round((i.value / queue.value.length) * 100) : 0))

async function answer(correct) {
  if (busy.value || !card.value) return
  busy.value = true
  try {
    last.value = await cards.review(card.value.id, correct)
    correct ? stats.value.ok++ : stats.value.no++
    flipped.value = false
    setTimeout(() => { i.value++ }, 180)
  } catch (e) { toast.error(e.message) } finally { busy.value = false }
}
function onKey(e) {
  if (e.target.closest?.('input,textarea,select')) return
  if (e.code === 'Space') { e.preventDefault(); flipped.value = !flipped.value }
  else if (flipped.value && e.key === '1') answer(false)
  else if (flipped.value && e.key === '2') answer(true)
}
</script>

<template>
  <button class="btn-ghost btn-sm mb-3 -ml-2" @click="router.push('/flashcards')"><ArrowLeft :size="16" /> Flashcards</button>

  <EmptyState v-if="!queue.length" title="Nenhum cartão pendente" text="Quando um cartão estiver no prazo de revisão, ele aparece aqui."><button class="btn-line" @click="router.push('/flashcards')">Ver meus cartões</button></EmptyState>

  <section v-else-if="finished" class="panel p-8 text-center">
    <PartyPopper :size="32" class="mx-auto mb-3 text-ok" />
    <h1 class="font-display text-2xl font-extrabold">Sessão concluída</h1>
    <p class="mt-1 text-sm text-mute"><b class="text-ok">{{ stats.ok }}</b> acerto(s) · <b class="text-danger">{{ stats.no }}</b> erro(s)</p>
    <p class="mt-1 text-xs text-mute">Cartões errados voltam amanhã.</p>
    <div class="mt-5 flex justify-center gap-2"><button class="btn-line" @click="router.push('/revisoes')">Central de revisões</button><button class="btn-primary" @click="router.push('/')">Início</button></div>
  </section>

  <section v-else-if="card">
    <div class="mb-4 flex items-center gap-3"><div class="flex-1"><ProgressBar :value="progress" /></div><span class="text-xs font-semibold text-mute">{{ i + 1 }}/{{ queue.length }}</span></div>
    <div class="mb-2 flex items-center gap-2 text-xs"><SubjectDot :id="card.subjectId" /><span class="font-semibold">{{ card.topic }}</span><span class="ml-auto text-mute">Nível {{ card.level }}</span></div>

    <div class="flip-scene">
      <button class="flip-card block h-72 w-full text-left sm:h-80" :class="{ flipped }" :aria-label="flipped ? 'Mostrar a pergunta' : 'Virar o cartão'" @click="flipped = !flipped">
        <div class="flip-face panel flex flex-col justify-center overflow-y-auto p-6">
          <p class="mb-3 text-xs font-bold text-mute">Pergunta</p>
          <p class="whitespace-pre-line text-lg font-medium leading-snug">{{ card.front }}</p>
          <p class="mt-auto pt-4 text-xs text-mute">Toque para virar</p>
        </div>
        <div class="flip-face flip-back panel flex flex-col justify-center overflow-y-auto border-accent bg-accent-soft p-6">
          <p class="mb-3 text-xs font-bold text-accent">Resposta</p>
          <p class="whitespace-pre-line text-lg font-medium leading-snug">{{ card.back }}</p>
        </div>
      </button>
    </div>

    <div class="mt-5 min-h-[3.25rem]">
      <button v-if="!flipped" class="btn-primary w-full" @click="flipped = true"><RotateCw :size="17" /> Virar cartão</button>
      <div v-else class="grid grid-cols-2 gap-3">
        <button class="btn-danger" :disabled="busy" @click="answer(false)"><X :size="17" /> Errei</button>
        <button class="btn-ok" :disabled="busy" @click="answer(true)"><Check :size="17" /> Acertei</button>
      </div>
    </div>
    <p class="mt-3 text-center text-xs text-mute">Errou: volta amanhã · Acertou: próximo intervalo ({{ INTERVALS.slice(0, 4).join(', ') }}… dias) <span class="hidden sm:inline">· Atalhos: espaço vira, 1 errei, 2 acertei</span></p>
  </section>
</template>
