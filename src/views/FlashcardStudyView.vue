<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, X, RotateCw, PartyPopper, Square } from 'lucide-vue-next'
import { useFlashcardsStore } from '../stores/flashcards'
import { useToast } from '../composables/useToast'
import { INTERVALS, cardStats } from '../services/flashcardEngine'
import { relativeDay } from '../utils/date'
import { useClockStore } from '../stores/clock'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const cards = useFlashcardsStore(), route = useRoute(), router = useRouter(), toast = useToast(), clock = useClockStore()
const queue = ref([])
const i = ref(0)
const flipped = ref(false)
const stats = ref({ ok: 0, no: 0 })
const busy = ref(false)
const last = ref(null)
const ended = ref(false)
// 'free' (estudo livre, via /flashcards/estudar?modo=livre) ou 'scheduled' (revisão programada)
const mode = route.query.modo === 'livre' ? 'free' : 'scheduled'
const isFree = mode === 'free'

onMounted(() => {
  if (isFree) {
    const valid = new Set(cards.items.map((c) => c.id))
    queue.value = cards.session.ids.filter((id) => valid.has(id))
    if (!queue.value.length) { router.replace('/flashcards/livre'); return }
  } else queue.value = cards.due.map((c) => c.id)
  addEventListener('keydown', onKey)
})
onUnmounted(() => removeEventListener('keydown', onKey))

const card = computed(() => cards.items.find((c) => c.id === queue.value[i.value]))
const finished = computed(() => ended.value || (queue.value.length > 0 && i.value >= queue.value.length))
const cardInfo = computed(() => (card.value ? cardStats(card.value) : null))
const rate = computed(() => (cardInfo.value?.accuracy == null ? null : Math.round(cardInfo.value.accuracy * 100)))
const progress = computed(() => (queue.value.length ? Math.round((i.value / queue.value.length) * 100) : 0))

async function answer(correct) {
  if (busy.value || !card.value || ended.value) return
  busy.value = true
  try {
    last.value = await cards.review(card.value.id, correct, mode)
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
  <div class="mb-3 flex items-center justify-between">
    <button class="btn-ghost btn-sm -ml-2" @click="router.push('/flashcards')"><ArrowLeft :size="16" /> Flashcards</button>
    <span v-if="queue.length" class="pill" :class="isFree ? 'bg-accent-soft text-accent' : 'bg-sunken text-mute'">{{ isFree ? 'Estudo livre' : 'Revisão programada' }}</span>
  </div>

  <EmptyState v-if="!queue.length" title="Nenhum cartão pendente" text="Nenhum cartão está no prazo de revisão agora — mas você pode estudar quando quiser."><button class="btn-primary" @click="router.push('/flashcards/livre')">Estudar flashcards</button><button class="btn-line" @click="router.push('/flashcards')">Ver meus cartões</button></EmptyState>

  <section v-else-if="finished" class="panel p-8 text-center">
    <PartyPopper :size="32" class="mx-auto mb-3 text-ok" />
    <h1 class="font-display text-2xl font-extrabold">{{ ended && i < queue.length ? 'Sessão encerrada' : 'Sessão concluída' }}</h1>
    <p class="mt-1 text-sm text-mute"><b class="text-ok">{{ stats.ok }}</b> acerto(s) · <b class="text-danger">{{ stats.no }}</b> erro(s)</p>
    <p v-if="ended && i < queue.length" class="mt-1 text-xs text-mute">{{ i }} de {{ queue.length }} cartões estudados.</p>
    <p class="mt-1 text-xs text-mute">Cartões errados voltam amanhã.{{ isFree ? ' Suas revisões do caderno de erros não foram alteradas.' : '' }}</p>
    <div class="mt-5 flex flex-wrap justify-center gap-2">
      <button class="btn-line" @click="router.push('/revisoes')">Central de revisões</button>
      <button class="btn-primary" @click="router.push('/flashcards/livre')">Estudar flashcards</button>
    </div>
  </section>

  <section v-else-if="card">
    <div class="mb-4 flex items-center gap-3"><div class="flex-1"><ProgressBar :value="progress" /></div><span class="text-xs font-semibold text-mute">{{ i + 1 }}/{{ queue.length }}</span><button class="btn-ghost btn-sm !px-2" @click="ended = true"><Square :size="13" /> Encerrar</button></div>
    <div class="mb-2 flex items-center gap-2 text-xs"><SubjectDot :id="card.subjectId" /><span class="font-semibold">{{ card.topic }}</span><span class="ml-auto text-mute">Nível {{ card.level }}<template v-if="cardInfo.reviews"> · {{ cardInfo.reviews }} revis. · {{ rate }}% acerto</template><template v-else> · novo</template></span></div>

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
    <p class="mt-3 text-center text-xs text-mute">{{ isFree ? 'Estudo livre também atualiza o histórico e o agendamento do cartão. ' : '' }}Errou: volta amanhã · Acertou: próximo intervalo ({{ INTERVALS.slice(0, 4).join(', ') }}… dias) <span class="hidden sm:inline">· Atalhos: espaço vira, 1 errei, 2 acertei</span></p>
  </section>
</template>
