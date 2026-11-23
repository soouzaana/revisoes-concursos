<script setup>
import { computed, reactive, ref } from 'vue'
import { Check, Flame, Pencil, Plus, Trash2, Archive, ArchiveRestore } from 'lucide-vue-next'
import { useHabitsStore } from '../stores/habits'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { WEEKDAYS, isScheduled } from '../services/habitEngine'
import { addDays, formatDayMonth } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import MiniBars from '../components/charts/MiniBars.vue'

const habits = useHabitsStore(), clock = useClockStore(), toast = useToast(), confirm = useConfirm()
const open = ref(false), editing = ref(null), err = ref(''), showArchived = ref(false), expanded = ref('')
const form = reactive({ name: '', days: [] })
const last7 = computed(() => Array.from({ length: 7 }, (_, i) => addDays(clock.today, i - 6)))
const archived = computed(() => habits.habits.filter((h) => h.archived))
const freq = (h) => (h.days?.length ? h.days.map((d) => WEEKDAYS[d]).join(', ') : 'Todos os dias')

function openNew() { editing.value = null; Object.assign(form, { name: '', days: [] }); err.value = ''; open.value = true }
function openEdit(h) { editing.value = h.id; Object.assign(form, { name: h.name, days: [...(h.days || [])] }); err.value = ''; open.value = true }
const toggleDay = (d) => { form.days = form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] }
async function submit() {
  try { await habits.save({ name: form.name, days: form.days }, editing.value); open.value = false; toast.ok('Hábito salvo') } catch (e) { err.value = e.errors?.name || e.message }
}
async function mark(id, date) { try { await habits.toggle(id, date) } catch (e) { toast.error(e.message) } }
async function del(h) {
  if (!(await confirm({ title: 'Excluir hábito', message: `Excluir "${h.name}" e todo o histórico de conclusão dele?\nPara guardar o histórico, use Arquivar.`, confirmLabel: 'Excluir', danger: true }))) return
  await habits.remove(h.id); toast.ok('Hábito excluído')
}
</script>

<template>
  <PageHeader title="Hábitos" subtitle="Acompanhe sua constância. Concluir um hábito também mantém a ofensiva.">
    <button class="btn-primary" data-testid="new-habit" @click="openNew"><Plus :size="18" /> Novo hábito</button>
  </PageHeader>

  <EmptyState v-if="!habits.active.length" title="Nenhum hábito ainda" text="Crie hábitos como Estudar, Fazer questões, Revisar flashcards, Ler ou Treinar.">
    <button class="btn-primary" @click="openNew"><Plus :size="18" /> Criar primeiro hábito</button>
  </EmptyState>

  <template v-else>
    <p class="mb-3 text-sm text-mute" data-testid="habit-today">Hoje: <b class="text-ink">{{ habits.todayProgress.done }} de {{ habits.todayProgress.total }}</b> hábitos previstos concluídos</p>
    <ul class="space-y-3">
      <li v-for="s in habits.summaries" :key="s.habit.id" class="panel p-4" data-testid="habit-item">
        <div class="flex items-center gap-3">
          <button class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition" :class="s.doneToday ? 'border-ok bg-ok text-white' : 'border-line text-mute hover:border-accent'" :aria-pressed="s.doneToday" :aria-label="`${s.doneToday ? 'Desmarcar' : 'Concluir'} ${s.habit.name} hoje`" @click="mark(s.habit.id, clock.today)"><Check :size="20" /></button>
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold">{{ s.habit.name }}</p>
            <p class="text-xs text-mute">{{ freq(s.habit) }}<span v-if="!s.scheduledToday"> · hoje fora da frequência</span></p>
          </div>
          <span class="flex items-center gap-1 text-sm font-bold" :class="s.current ? 'text-warn' : 'text-mute'" title="Sequência atual"><Flame :size="16" />{{ s.current }}</span>
          <button class="btn-ghost btn-sm !p-2" :aria-label="`Detalhes de ${s.habit.name}`" @click="expanded = expanded === s.habit.id ? '' : s.habit.id">{{ s.consistency.pct }}%</button>
        </div>
        <div class="mt-3 flex justify-between gap-1">
          <button v-for="d in last7" :key="d" class="flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px]" :aria-label="`${habits.isDone(s.habit.id, d) ? 'Desmarcar' : 'Marcar'} ${formatDayMonth(d)}`" @click="mark(s.habit.id, d)">
            <span class="text-mute">{{ WEEKDAYS[new Date(d + 'T00:00:00').getDay()] }}</span>
            <span class="h-5 w-5 rounded-md" :class="habits.isDone(s.habit.id, d) ? 'bg-ok' : isScheduled(s.habit, d) ? 'bg-sunken ring-1 ring-line' : 'bg-transparent ring-1 ring-dashed ring-line opacity-40'" />
          </button>
        </div>
        <div v-if="expanded === s.habit.id" class="mt-4 space-y-3 border-t border-line pt-4">
          <div class="grid grid-cols-3 gap-3 text-center">
            <div><p class="font-display text-xl font-extrabold">{{ s.consistency.pct }}%</p><p class="text-xs text-mute">Consistência (30 dias)</p></div>
            <div><p class="font-display text-xl font-extrabold">{{ s.longest }}</p><p class="text-xs text-mute">Maior sequência</p></div>
            <div><p class="font-display text-xl font-extrabold">{{ s.total }}</p><p class="text-xs text-mute">Conclusões</p></div>
          </div>
          <div><p class="mb-1 text-xs font-semibold text-mute">Evolução semanal (últimas 8 semanas)</p><MiniBars :items="s.evolution.map((w) => ({ label: 'Semana de ' + formatDayMonth(w.week), value: w.pct }))" :max="100" unit="%" label="Evolução semanal do hábito" /></div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-line btn-sm" @click="openEdit(s.habit)"><Pencil :size="14" /> Editar</button>
            <button class="btn-line btn-sm" @click="habits.archive(s.habit.id)"><Archive :size="14" /> Arquivar</button>
            <button class="btn-ghost btn-sm text-danger" @click="del(s.habit)"><Trash2 :size="14" /> Excluir</button>
          </div>
        </div>
      </li>
    </ul>
  </template>

  <section v-if="archived.length" class="mt-8">
    <button class="text-sm font-semibold text-mute" @click="showArchived = !showArchived">{{ showArchived ? 'Ocultar' : 'Mostrar' }} arquivados ({{ archived.length }})</button>
    <ul v-if="showArchived" class="mt-2 space-y-2">
      <li v-for="h in archived" :key="h.id" class="panel flex items-center justify-between p-3 text-sm"><span>{{ h.name }}</span><button class="btn-line btn-sm" @click="habits.archive(h.id, false)"><ArchiveRestore :size="14" /> Restaurar</button></li>
    </ul>
  </section>

  <BaseModal :open="open" :title="editing ? 'Editar hábito' : 'Novo hábito'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div><label class="label" for="hb-name">Nome</label><input id="hb-name" v-model="form.name" class="field" :class="{ 'field-error': err }" placeholder="Ex.: Fazer 20 questões" autofocus /><p v-if="err" class="hint-error">{{ err }}</p></div>
      <div>
        <span class="label">Frequência</span>
        <p class="mb-2 text-xs text-mute">Sem nenhum dia marcado, o hábito é diário.</p>
        <div class="flex flex-wrap gap-2"><button v-for="(n, d) in WEEKDAYS" :key="d" type="button" class="btn-sm rounded-full border px-3 py-1.5 text-xs font-semibold" :class="form.days.includes(d) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-mute'" :aria-pressed="form.days.includes(d)" @click="toggleDay(d)">{{ n }}</button></div>
      </div>
      <button class="btn-primary w-full" type="submit">Salvar hábito</button>
    </form>
  </BaseModal>
</template>
