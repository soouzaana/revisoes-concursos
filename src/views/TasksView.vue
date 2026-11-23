<script setup>
import { computed, reactive, ref } from 'vue'
import { Plus, Pencil, Trash2, Repeat, Check } from 'lucide-vue-next'
import { useTasksStore } from '../stores/tasks'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { PRIORITIES, RECURRENCES, filterTasks, isOverdue } from '../services/taskEngine'
import { formatDate, relativeDay } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const tasks = useTasksStore(), clock = useClockStore(), toast = useToast(), confirm = useConfirm()
const filter = ref('pending'), priority = ref(''), category = ref('')
const open = ref(false), editing = ref(null), errors = ref({})
const blank = () => ({ title: '', description: '', dueDate: '', priority: 'medium', category: '', recurrence: 'none' })
const form = reactive(blank())
const FILTERS = [['pending', 'Pendentes'], ['overdue', 'Atrasadas'], ['done', 'Concluídas'], ['all', 'Todas']]
const list = computed(() => filterTasks(tasks.items, { filter: filter.value, priority: priority.value, category: category.value }, clock.today))
const tone = { high: 'bg-danger-soft text-danger', medium: 'bg-warn-soft text-warn', low: 'bg-sunken text-mute' }

function openNew() { editing.value = null; Object.assign(form, blank()); errors.value = {}; open.value = true }
function openEdit(t) { editing.value = t.id; Object.assign(form, { ...blank(), ...t }); errors.value = {}; open.value = true }
async function submit() { try { await tasks.save({ ...form }, editing.value); open.value = false; toast.ok('Tarefa salva') } catch (e) { errors.value = e.errors || {}; if (!e.errors) toast.error(e.message) } }
async function del(t) { if (await confirm({ title: 'Excluir tarefa', message: `Excluir "${t.title}"?`, confirmLabel: 'Excluir', danger: true })) { await tasks.remove(t.id); toast.ok('Tarefa excluída') } }
</script>

<template>
  <PageHeader title="Tarefas" subtitle="Pendências com prazo, prioridade e recorrência.">
    <button class="btn-primary" data-testid="new-task" @click="openNew"><Plus :size="18" /> Nova tarefa</button>
  </PageHeader>

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <div class="flex gap-1 overflow-x-auto" role="tablist"><button v-for="[k, l] in FILTERS" :key="k" role="tab" :aria-selected="filter === k" class="btn-sm shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold" :class="filter === k ? 'bg-accent text-accent-fg' : 'bg-sunken text-mute'" @click="filter = k">{{ l }}<span v-if="k === 'overdue' && tasks.overdue.length"> ({{ tasks.overdue.length }})</span></button></div>
    <select v-model="priority" class="field !w-auto !py-1.5 text-xs" aria-label="Prioridade"><option value="">Qualquer prioridade</option><option v-for="(l, k) in PRIORITIES" :key="k" :value="k">{{ l }}</option></select>
    <select v-if="tasks.categories.length" v-model="category" class="field !w-auto !py-1.5 text-xs" aria-label="Categoria"><option value="">Todas as categorias</option><option v-for="c in tasks.categories" :key="c" :value="c">{{ c }}</option></select>
  </div>

  <EmptyState v-if="!list.length" :title="tasks.items.length ? 'Nenhuma tarefa neste filtro' : 'Nenhuma tarefa ainda'" :text="tasks.items.length ? '' : 'Adicione tarefas com prazo para organizar o que precisa ser feito.'" />
  <ul v-else class="space-y-2">
    <li v-for="t in list" :key="t.id" class="panel flex items-start gap-3 p-3.5" data-testid="task-item">
      <button class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2" :class="t.status === 'done' ? 'border-ok bg-ok text-white' : 'border-line hover:border-accent'" :aria-label="t.status === 'done' ? 'Reabrir tarefa' : 'Concluir tarefa'" @click="tasks.toggle(t.id)"><Check v-if="t.status === 'done'" :size="14" /></button>
      <div class="min-w-0 flex-1">
        <p class="font-medium" :class="t.status === 'done' && 'text-mute line-through'">{{ t.title }}</p>
        <p v-if="t.description" class="mt-0.5 text-sm text-mute">{{ t.description }}</p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span class="pill" :class="tone[t.priority]">{{ PRIORITIES[t.priority] }}</span>
          <span v-if="t.dueDate" class="pill" :class="isOverdue(t, clock.today) ? 'bg-danger-soft text-danger' : 'bg-sunken text-mute'">{{ isOverdue(t, clock.today) ? 'Atrasada · ' : '' }}{{ relativeDay(t.dueDate, clock.today) }} · {{ formatDate(t.dueDate) }}</span>
          <span v-if="t.category" class="pill bg-accent-soft text-accent">{{ t.category }}</span>
          <span v-if="t.recurrence && t.recurrence !== 'none'" class="pill bg-sunken text-mute"><Repeat :size="11" />{{ RECURRENCES[t.recurrence] }}</span>
        </div>
      </div>
      <button class="btn-ghost btn-sm !p-2" aria-label="Editar tarefa" @click="openEdit(t)"><Pencil :size="15" /></button>
      <button class="btn-ghost btn-sm !p-2 text-danger" aria-label="Excluir tarefa" @click="del(t)"><Trash2 :size="15" /></button>
    </li>
  </ul>

  <BaseModal :open="open" :title="editing ? 'Editar tarefa' : 'Nova tarefa'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div><label class="label" for="tk-title">Título</label><input id="tk-title" v-model="form.title" class="field" :class="{ 'field-error': errors.title }" autofocus /><p v-if="errors.title" class="hint-error">{{ errors.title }}</p></div>
      <div><label class="label" for="tk-desc">Descrição <span class="font-normal text-mute">(opcional)</span></label><textarea id="tk-desc" v-model="form.description" rows="2" class="field" /></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="tk-due">Vencimento</label><input id="tk-due" v-model="form.dueDate" type="date" class="field" /></div>
        <div><label class="label" for="tk-prio">Prioridade</label><select id="tk-prio" v-model="form.priority" class="field"><option v-for="(l, k) in PRIORITIES" :key="k" :value="k">{{ l }}</option></select></div>
        <div><label class="label" for="tk-cat">Categoria</label><input id="tk-cat" v-model="form.category" list="tk-cats" class="field" placeholder="Ex.: Estudo" /><datalist id="tk-cats"><option v-for="c in tasks.categories" :key="c" :value="c" /></datalist></div>
        <div><label class="label" for="tk-rec">Recorrência</label><select id="tk-rec" v-model="form.recurrence" class="field" :disabled="!form.dueDate"><option v-for="(l, k) in RECURRENCES" :key="k" :value="k">{{ l }}</option></select><p v-if="!form.dueDate" class="mt-1 text-xs text-mute">Defina um vencimento para repetir.</p></div>
      </div>
      <button class="btn-primary w-full" type="submit">Salvar tarefa</button>
    </form>
  </BaseModal>
</template>
