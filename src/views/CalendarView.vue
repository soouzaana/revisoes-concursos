<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-vue-next'
import { useEventsStore } from '../stores/events'
import { useTasksStore } from '../stores/tasks'
import { useStudiesStore } from '../stores/studies'
import { useMocksStore } from '../stores/mocks'
import { useReviewsStore } from '../stores/reviews'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { KINDS, buildCalendarItems, monthGrid, weekDays } from '../services/calendarEngine'
import { addDays, formatDateShort, parseDate } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const events = useEventsStore(), tasks = useTasksStore(), studies = useStudiesStore(), mocks = useMocksStore(), reviews = useReviewsStore(), subjects = useSubjectsStore(), clock = useClockStore()
const toast = useToast(), confirm = useConfirm()
const mode = ref('month')
const cursor = ref(clock.today)            // dia de referência da navegação
const selected = ref(clock.today)
const open = ref(false), editing = ref(null), errors = ref({})
const form = reactive({ title: '', date: '', time: '', notes: '' })

const items = computed(() => buildCalendarItems({
  events: events.items, tasks: tasks.items, studies: studies.items, mockExams: mocks.items,
  mockNext: mocks.schedule?.nextDate, reviews: reviews.enriched, studyDates: studies.studyDates, today: clock.today, nameOf: (id) => subjects.nameOf(id)
}))
const d = computed(() => parseDate(cursor.value))
const title = computed(() => mode.value === 'month'
  ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d.value)
  : `${formatDateShort(weekDays(cursor.value)[0])} – ${formatDateShort(weekDays(cursor.value)[6])}`)
const cells = computed(() => (mode.value === 'month' ? monthGrid(d.value.getFullYear(), d.value.getMonth()) : weekDays(cursor.value).map((date) => ({ date, inMonth: true }))))
const dayItems = (date) => items.value.get(date) || []
const selItems = computed(() => dayItems(selected.value))

function move(dir) {
  if (mode.value === 'week') { cursor.value = addDays(cursor.value, 7 * dir); return }
  const x = new Date(d.value.getFullYear(), d.value.getMonth() + dir, 1)
  cursor.value = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`
}
const goToday = () => { cursor.value = clock.today; selected.value = clock.today }
function pick(date) { selected.value = date; if (mode.value === 'week') cursor.value = date }

function openNew() { editing.value = null; Object.assign(form, { title: '', date: selected.value, time: '', notes: '' }); errors.value = {}; open.value = true }
function openEdit(raw) { editing.value = raw.id; Object.assign(form, { title: raw.title, date: raw.date, time: raw.time || '', notes: raw.notes || '' }); errors.value = {}; open.value = true }
async function submit() { try { await events.save({ ...form }, editing.value); selected.value = form.date; open.value = false; toast.ok('Evento salvo') } catch (e) { errors.value = e.errors || {}; if (!e.errors) toast.error(e.message) } }
async function del(raw) { if (await confirm({ title: 'Excluir evento', message: `Excluir "${raw.title}"?`, confirmLabel: 'Excluir', danger: true })) { await events.remove(raw.id); toast.ok('Evento excluído') } }
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const kindsOn = (date) => [...new Set(dayItems(date).map((i) => i.kind))]
</script>

<template>
  <PageHeader title="Calendário" subtitle="Eventos, tarefas, estudos, simulados e revisões previstas.">
    <button class="btn-primary" data-testid="new-event" @click="openNew"><Plus :size="18" /> Novo evento</button>
  </PageHeader>

  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-1">
      <button class="btn-line btn-sm !p-2" aria-label="Anterior" @click="move(-1)"><ChevronLeft :size="16" /></button>
      <h2 class="min-w-[9rem] text-center font-display text-base font-bold capitalize" data-testid="cal-title">{{ title }}</h2>
      <button class="btn-line btn-sm !p-2" aria-label="Próximo" @click="move(1)"><ChevronRight :size="16" /></button>
      <button class="btn-ghost btn-sm" @click="goToday">Hoje</button>
    </div>
    <div class="flex gap-1" role="tablist"><button v-for="[k, l] in [['month', 'Mês'], ['week', 'Semana']]" :key="k" role="tab" :aria-selected="mode === k" class="btn-sm rounded-full px-3 py-1.5 text-xs font-semibold" :class="mode === k ? 'bg-accent text-accent-fg' : 'bg-sunken text-mute'" @click="mode = k">{{ l }}</button></div>
  </div>

  <div class="panel overflow-hidden">
    <div class="grid grid-cols-7 border-b border-line bg-sunken text-center text-xs font-semibold text-mute"><span v-for="(w, i) in WD" :key="i" class="py-2">{{ w }}</span></div>
    <div class="grid grid-cols-7" data-testid="cal-grid">
      <button v-for="c in cells" :key="c.date" class="relative flex flex-col items-center gap-1 border-b border-r border-line p-1 text-sm transition hover:bg-sunken" :class="[mode === 'week' ? 'min-h-[88px]' : 'min-h-[52px]', !c.inMonth && 'text-mute/50', selected === c.date && 'bg-accent-soft']" :aria-label="formatDateShort(c.date)" :aria-pressed="selected === c.date" @click="pick(c.date)">
        <span class="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold" :class="c.date === clock.today && 'bg-accent text-accent-fg'">{{ parseDate(c.date).getDate() }}</span>
        <span class="flex flex-wrap justify-center gap-0.5"><span v-for="k in kindsOn(c.date)" :key="k" class="h-1.5 w-1.5 rounded-full" :class="KINDS[k].dot" /></span>
        <template v-if="mode === 'week'"><span v-for="it in dayItems(c.date).slice(0, 3)" :key="it.id" class="w-full truncate rounded px-1 text-left text-[10px]" :class="[KINDS[it.kind].dot, 'text-white']">{{ it.title }}</span></template>
      </button>
    </div>
  </div>
  <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute" aria-label="Legenda"><li v-for="(k, key) in KINDS" :key="key" class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" :class="k.dot" />{{ k.label }}</li></ul>

  <section class="mt-6" data-testid="cal-day">
    <div class="mb-2 flex items-center justify-between"><h2 class="font-display text-lg font-bold capitalize">{{ formatDateShort(selected) }}</h2><button class="btn-line btn-sm" @click="openNew"><Plus :size="14" /> Evento neste dia</button></div>
    <p v-if="!selItems.length" class="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-mute">Nada neste dia.</p>
    <ul v-else class="panel divide-y divide-line">
      <li v-for="it in selItems" :key="it.id" class="flex items-center gap-3 px-4 py-3 text-sm">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="KINDS[it.kind].dot" />
        <component :is="it.to ? RouterLink : 'span'" :to="it.to" class="min-w-0 flex-1"><span class="block truncate font-medium" :class="it.done && 'text-mute line-through'">{{ it.time ? it.time + ' · ' : '' }}{{ it.title }}</span><span v-if="it.sub" class="block truncate text-xs text-mute">{{ it.sub }}</span></component>
        <template v-if="it.editable"><button class="btn-ghost btn-sm !p-1.5" aria-label="Editar evento" @click="openEdit(it.raw)"><Pencil :size="14" /></button><button class="btn-ghost btn-sm !p-1.5 text-danger" aria-label="Excluir evento" @click="del(it.raw)"><Trash2 :size="14" /></button></template>
      </li>
    </ul>
  </section>

  <BaseModal :open="open" :title="editing ? 'Editar evento' : 'Novo evento'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div><label class="label" for="ev-title">Título</label><input id="ev-title" v-model="form.title" class="field" :class="{ 'field-error': errors.title }" autofocus /><p v-if="errors.title" class="hint-error">{{ errors.title }}</p></div>
      <div class="grid grid-cols-2 gap-4"><div><label class="label" for="ev-date">Data</label><input id="ev-date" v-model="form.date" type="date" class="field" :class="{ 'field-error': errors.date }" /><p v-if="errors.date" class="hint-error">{{ errors.date }}</p></div><div><label class="label" for="ev-time">Horário <span class="font-normal text-mute">(opcional)</span></label><input id="ev-time" v-model="form.time" type="time" class="field" /></div></div>
      <div><label class="label" for="ev-notes">Observações</label><textarea id="ev-notes" v-model="form.notes" rows="2" class="field" /></div>
      <button class="btn-primary w-full" type="submit">Salvar evento</button>
    </form>
  </BaseModal>
</template>
