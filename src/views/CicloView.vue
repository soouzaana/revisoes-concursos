<script setup>
import { computed, reactive, ref } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2, RotateCcw, Play } from 'lucide-vue-next'
import { useConcursoStore } from '../stores/concurso'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { formatDate } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'

const concurso = useConcursoStore(), subjects = useSubjectsStore(), clock = useClockStore(), toast = useToast(), confirm = useConfirm()
const add = reactive({ subjectId: '', priority: 'medium', targetMinutes: 60 })
const sess = reactive({ subjectId: '', minutes: '', date: clock.today })
const P = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const info = computed(() => concurso.cycleInfo)
const available = computed(() => subjects.items.filter((s) => !info.value.rows.some((r) => r.subjectId === s.id)))
const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`)
const wrap = async (fn, ok) => { try { await fn(); if (ok) toast.ok(ok) } catch (e) { toast.error(e.message) } }

const addItem = () => wrap(async () => { await concurso.addCycleItem({ ...add }); add.subjectId = '' }, 'Matéria adicionada ao ciclo')
const addSession = () => wrap(async () => { await concurso.addSession({ ...sess }); sess.minutes = '' }, 'Sessão registrada')
async function delSession(s) { if (await confirm({ title: 'Excluir sessão', message: `Excluir a sessão de ${s.minutes} min?`, confirmLabel: 'Excluir', danger: true })) await concurso.removeSession(s.id) }
</script>

<template>
  <PageHeader title="Ciclo de estudos" subtitle="Opcional e flexível: sem dias fixos, só a sequência e o tempo de cada matéria." />

  <section class="panel mb-6 p-5">
    <h2 class="mb-3 font-display text-lg font-bold">Matérias do ciclo</h2>
    <form class="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]" @submit.prevent="addItem">
      <select v-model="add.subjectId" class="field" aria-label="Matéria do ciclo" required><option value="" disabled>Escolha a matéria</option><option v-for="s in available" :key="s.id" :value="s.id">{{ s.name }}</option></select>
      <select v-model="add.priority" class="field" aria-label="Prioridade"><option v-for="(l, k) in P" :key="k" :value="k">{{ l }}</option></select>
      <input v-model.number="add.targetMinutes" type="number" min="5" step="5" class="field" aria-label="Minutos por rodada" placeholder="Minutos" />
      <button class="btn-primary" type="submit"><Plus :size="16" /> Adicionar</button>
    </form>
    <p v-if="!subjects.items.length" class="mt-2 text-xs text-mute">Cadastre matérias em Estudos ou no Edital primeiro.</p>

    <EmptyState v-if="!info.rows.length" class="mt-4" title="Ciclo vazio" text="Adicione as matérias, o tempo por rodada e a ordem em que quer estudar." />
    <template v-else>
      <div v-if="info.next" class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft p-3 text-sm text-accent" data-testid="cycle-next"><span class="flex items-center gap-2 font-semibold"><Play :size="16" />Próxima do ciclo: {{ subjects.nameOf(info.next.subjectId) }} — faltam {{ fmt(Math.max(0, info.next.targetMinutes - info.next.roundMinutes)) }}</span></div>
      <div v-else class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ok-soft p-3 text-sm text-ok" data-testid="cycle-done"><span class="font-semibold">Rodada completa!</span><button class="btn-ok btn-sm" @click="concurso.startNewRound()"><RotateCcw :size="14" /> Iniciar nova rodada</button></div>
      <ul class="mt-4 space-y-3">
        <li v-for="(r, i) in info.rows" :key="r.id" class="rounded-xl border border-line p-3" data-testid="cycle-item">
          <div class="flex items-center gap-2">
            <span class="w-5 text-center text-xs font-bold text-mute">{{ i + 1 }}</span><SubjectDot :color="subjects.colorOf(r.subjectId)" />
            <span class="min-w-0 flex-1 truncate font-semibold">{{ subjects.nameOf(r.subjectId) }}</span>
            <select :value="r.priority" class="rounded-lg border border-line bg-surface px-1.5 py-1 text-xs" :aria-label="`Prioridade de ${subjects.nameOf(r.subjectId)}`" @change="concurso.updateCycleItem(r.id, { priority: $event.target.value })"><option v-for="(l, k) in P" :key="k" :value="k">{{ l }}</option></select>
            <input :value="r.targetMinutes" type="number" min="5" step="5" class="w-16 rounded-lg border border-line bg-surface px-1.5 py-1 text-xs" :aria-label="`Minutos de ${subjects.nameOf(r.subjectId)}`" @change="concurso.updateCycleItem(r.id, { targetMinutes: Number($event.target.value) || 0 })" />
            <button class="btn-ghost btn-sm !p-1" :disabled="i === 0" aria-label="Subir" @click="concurso.moveCycleItem(r.id, -1)"><ArrowUp :size="14" /></button>
            <button class="btn-ghost btn-sm !p-1" :disabled="i === info.rows.length - 1" aria-label="Descer" @click="concurso.moveCycleItem(r.id, 1)"><ArrowDown :size="14" /></button>
            <button class="btn-ghost btn-sm !p-1 text-danger" aria-label="Remover do ciclo" @click="concurso.removeCycleItem(r.id)"><Trash2 :size="14" /></button>
          </div>
          <div class="mt-2 flex items-center gap-3"><ProgressBar :value="r.pct" :tone="r.complete ? 'ok' : 'accent'" /><span class="shrink-0 text-xs text-mute">{{ fmt(r.roundMinutes) }} / {{ fmt(r.targetMinutes) }}</span></div>
          <p class="mt-1 text-xs text-mute">Total acumulado: {{ fmt(r.totalMinutes) }}</p>
        </li>
      </ul>
    </template>
  </section>

  <section class="panel p-5">
    <h2 class="mb-3 font-display text-lg font-bold">Registrar sessão</h2>
    <form class="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]" @submit.prevent="addSession">
      <select v-model="sess.subjectId" class="field" aria-label="Matéria da sessão" required><option value="" disabled>Matéria</option><option v-for="s in subjects.items" :key="s.id" :value="s.id">{{ s.name }}</option></select>
      <input v-model="sess.minutes" type="number" min="1" max="1440" class="field" aria-label="Minutos da sessão" placeholder="Minutos" required />
      <input v-model="sess.date" type="date" :max="clock.today" class="field" aria-label="Data da sessão" />
      <button class="btn-primary" type="submit" data-testid="add-session">Registrar</button>
    </form>
    <p class="mt-2 text-xs text-mute">Dica: se já informou o tempo ao registrar o estudo, não repita aqui — o tempo é somado nos dois lugares.</p>
    <ul v-if="concurso.sessions.length" class="mt-4 divide-y divide-line text-sm">
      <li v-for="s in concurso.sessions.slice(0, 8)" :key="s.id" class="flex items-center justify-between gap-3 py-2"><span class="truncate">{{ subjects.nameOf(s.subjectId) }} · {{ fmt(s.minutes) }}</span><span class="flex shrink-0 items-center gap-1 text-xs text-mute">{{ formatDate(s.date) }}<button class="btn-ghost btn-sm !p-1 text-danger" aria-label="Excluir sessão" @click="delSession(s)"><Trash2 :size="13" /></button></span></li>
    </ul>
  </section>
</template>
