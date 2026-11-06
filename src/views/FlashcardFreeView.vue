<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Play, Shuffle, FilterX, Layers } from 'lucide-vue-next'
import { useFlashcardsStore } from '../stores/flashcards'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { applyFilters, buildSession, emptyFilters, PRESETS, MASTERY_OPTIONS, PERFORMANCE_OPTIONS, HISTORY_OPTIONS } from '../services/flashcardFilters'
import { plural } from '../utils/text'
import EmptyState from '../components/ui/EmptyState.vue'

const router = useRouter(), cards = useFlashcardsStore(), subjects = useSubjectsStore(), clock = useClockStore()
const f = reactive(emptyFilters())
const limit = ref(0)
const random = ref(false)
const preset = ref('all')
const LIMITS = [10, 20, 30, 50, 0]

const subjectOptions = computed(() => {
  const ids = [...new Set(cards.items.map((c) => c.subjectId))]
  return ids.map((id) => ({ id, name: subjects.nameOf(id), n: cards.items.filter((c) => c.subjectId === id).length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
})
const topicOptions = computed(() => {
  const pool = f.subjectIds.length ? cards.items.filter((c) => f.subjectIds.includes(c.subjectId)) : cards.items
  return [...new Set(pool.map((c) => c.topic))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
})
const matched = computed(() => applyFilters(cards.items, f, clock.today))
const sessionSize = computed(() => (limit.value > 0 ? Math.min(limit.value, matched.value.length) : matched.value.length))
const active = computed(() => JSON.stringify(f) !== JSON.stringify(emptyFilters()) || limit.value !== 0 || random.value)

function toggle(list, v) { const i = list.indexOf(v); i >= 0 ? list.splice(i, 1) : list.push(v) }
function toggleSubject(id) {
  toggle(f.subjectIds, id)
  // remove assuntos que deixaram de fazer sentido
  f.topics = f.topics.filter((t) => topicOptions.value.includes(t))
  preset.value = ''
}
function touch() { preset.value = '' }
function applyPreset(p) {
  Object.assign(f, emptyFilters(), p.filters)
  limit.value = p.limit; random.value = p.random; preset.value = p.id
}
function reset() { applyPreset(PRESETS[0]) }
function start() {
  const list = buildSession(cards.items, f, { limit: limit.value, random: random.value, today: clock.today })
  if (!list.length) return
  cards.startSession(list.map((c) => c.id), 'free')
  router.push({ path: '/flashcards/estudar', query: { modo: 'livre' } })
}
</script>

<template>
  <button class="btn-ghost btn-sm mb-3 -ml-2" @click="router.push('/flashcards')"><ArrowLeft :size="16" /> Flashcards</button>
  <header class="mb-5">
    <h1 class="font-display text-2xl font-extrabold sm:text-3xl">Estudar flashcards</h1>
    <p class="mt-1 text-sm text-mute">Estudo livre: escolha qualquer conjunto de cartões, a qualquer hora, quantas vezes quiser. Não depende das revisões programadas.</p>
  </header>

  <EmptyState v-if="!cards.items.length" title="Nenhum cartão criado" text="Crie cartões para poder estudá-los aqui."><button class="btn-primary" @click="router.push('/flashcards')">Ir para Flashcards</button></EmptyState>

  <template v-else>
    <section class="mb-4">
      <h2 class="mb-2 text-sm font-bold">Atalhos</h2>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in PRESETS" :key="p.id" class="pill !px-3.5 !py-1.5 text-sm transition" :class="preset === p.id ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink hover:bg-accent-soft'" @click="applyPreset(p)">
          <Shuffle v-if="p.id === 'random'" :size="13" />{{ p.label }}
        </button>
      </div>
    </section>

    <section class="panel mb-4 space-y-4 p-4">
      <div class="flex items-center justify-between"><h2 class="text-sm font-bold">Filtros</h2><button v-if="active" class="btn-ghost btn-sm" @click="reset"><FilterX :size="14" /> Limpar</button></div>

      <div>
        <p class="label">Matéria</p>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="s in subjectOptions" :key="s.id" class="pill !px-3 !py-1.5 transition" :class="f.subjectIds.includes(s.id) ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink'" :aria-pressed="f.subjectIds.includes(s.id)" @click="toggleSubject(s.id)">{{ s.name }} <span class="opacity-70">{{ s.n }}</span></button>
        </div>
      </div>

      <div>
        <p class="label">Assunto <span class="font-normal text-mute">{{ f.subjectIds.length ? '(das matérias selecionadas)' : '(todas as matérias)' }}</span></p>
        <div class="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
          <button v-for="t in topicOptions" :key="t" class="pill !px-3 !py-1.5 transition" :class="f.topics.includes(t) ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink'" :aria-pressed="f.topics.includes(t)" @click="toggle(f.topics, t); touch()">{{ t }}</button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div><label class="label" for="ff-mastery">Domínio</label><select id="ff-mastery" v-model="f.mastery" class="field" @change="touch"><option v-for="o in MASTERY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select></div>
        <div><label class="label" for="ff-perf">Desempenho</label><select id="ff-perf" v-model="f.performance" class="field" @change="touch"><option v-for="o in PERFORMANCE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select></div>
        <div><label class="label" for="ff-hist">Histórico</label><select id="ff-hist" v-model="f.history" class="field" @change="touch"><option v-for="o in HISTORY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option></select></div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div><label class="label" for="ff-from">Cadastrados a partir de</label><input id="ff-from" v-model="f.createdFrom" type="date" :max="f.createdTo || clock.today" class="field" @change="touch" /></div>
        <div><label class="label" for="ff-to">Até</label><input id="ff-to" v-model="f.createdTo" type="date" :min="f.createdFrom" :max="clock.today" class="field" @change="touch" /></div>
      </div>

      <label class="flex items-center gap-2 text-sm"><input v-model="f.onlyErrors" type="checkbox" class="accent-[rgb(var(--c-accent))]" @change="touch" /> Somente cartões em que já errei</label>
      <p v-if="f.performance || f.history" class="text-xs text-mute">Filtros de desempenho e histórico usam as respostas reais de cada cartão; cartões ainda não revisados ficam de fora.</p>
    </section>

    <section class="panel mb-4 space-y-3 p-4">
      <h2 class="text-sm font-bold">Sessão</h2>
      <div>
        <p class="label">Quantidade de cartões</p>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="n in LIMITS" :key="n" class="pill !px-3.5 !py-1.5 transition" :class="limit === n ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink'" :aria-pressed="limit === n" @click="limit = n; preset = ''">{{ n === 0 ? 'Todos os resultados' : n }}</button>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="random" type="checkbox" class="accent-[rgb(var(--c-accent))]" @change="touch" /> Embaralhar a ordem</label>
    </section>

    <div class="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <p class="text-sm"><Layers :size="16" class="mr-1 inline text-accent" /><b>{{ plural(sessionSize, 'cartão', 'cartões') }}</b> nesta sessão <span v-if="limit > 0 && matched.length > sessionSize" class="text-mute">(de {{ matched.length }} encontrados)</span></p>
      <button class="btn-primary w-full sm:w-auto" :disabled="!sessionSize" @click="start"><Play :size="16" /> Iniciar sessão</button>
    </div>
    <p v-if="!matched.length" class="mt-2 text-center text-sm text-mute">Nenhum cartão atende a esses filtros. Ajuste ou limpe os filtros.</p>
  </template>
</template>
