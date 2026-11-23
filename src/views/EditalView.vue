<script setup>
import { computed, reactive, ref } from 'vue'
import { Pencil, Plus, Trash2, ChevronDown, CalendarClock } from 'lucide-vue-next'
import { useConcursoStore } from '../stores/concurso'
import { useSubjectsStore } from '../stores/subjects'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { CONTEST_STATUS, TOPIC_STATUS, STATUS_ORDER, buildTree } from '../services/concursoEngine'
import { formatDate } from '../utils/date'
import { norm, plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'
import TopicNode from '../components/domain/TopicNode.vue'

const concurso = useConcursoStore(), subjects = useSubjectsStore(), settings = useSettingsStore(), toast = useToast(), confirm = useConfirm()
const open = ref(false), editing = ref(null), errors = ref({})
const blank = () => ({ name: '', role: '', board: '', examDate: '', status: 'studying' })
const form = reactive(blank())
const subjectName = ref(''), topicNames = reactive({}), collapsed = reactive({})

const c = computed(() => concurso.current)
const included = computed(() => (c.value?.subjectIds || []).map((id) => subjects.get(id)).filter(Boolean))
const tree = (sid) => buildTree(concurso.topics.filter((t) => t.subjectId === sid))
const suggestions = computed(() => subjects.items.filter((s) => !(c.value?.subjectIds || []).includes(s.id)))

function openForm(edit) { editing.value = edit ? c.value.id : null; Object.assign(form, edit ? { ...blank(), ...c.value } : blank()); errors.value = {}; open.value = true }
async function submit() { try { await concurso.saveContest({ ...form }, editing.value); open.value = false; toast.ok('Concurso salvo') } catch (e) { errors.value = e.errors || {}; if (!e.errors) toast.error(e.message) } }
async function delContest() {
  if (await confirm({ title: 'Excluir concurso', message: `Excluir "${c.value.name}" e o edital cadastrado?\nMatérias, estudos, questões e simulados são mantidos.`, confirmLabel: 'Excluir', danger: true })) { await concurso.removeContest(c.value.id); toast.ok('Concurso excluído') }
}
async function addSubject() {
  const n = subjectName.value.trim(); if (!n) return
  try {
    let s = subjects.items.find((x) => norm(x.name) === norm(n))
    if (!s) s = await subjects.add(n)
    await concurso.addSubject(s.id); subjectName.value = ''
  } catch (e) { toast.error(e.message) }
}
async function addTopic(sid) {
  try { await concurso.addTopic({ subjectId: sid, name: topicNames[sid] }); topicNames[sid] = '' } catch (e) { toast.error(e.message) }
}
async function removeSubject(s) {
  if (await confirm({ title: 'Remover do edital', message: `Remover "${s.name}" e seus assuntos deste edital?\nA matéria e seus estudos continuam no app.`, confirmLabel: 'Remover', danger: true })) await concurso.removeSubject(s.id)
}
const statusColor = { not_started: 'bg-sunken', studying: 'bg-warn', studied: 'bg-accent/60', reviewing: 'bg-accent', mastered: 'bg-ok' }
</script>

<template>
  <PageHeader title="Edital" subtitle="Acompanhe o conteúdo programático sem precisar montar cronograma.">
    <button v-if="c" class="btn-line" @click="openForm(false)"><Plus :size="16" /> Novo concurso</button>
  </PageHeader>

  <EmptyState v-if="!c" title="Cadastre o concurso atual" text="Informe o concurso e depois monte as matérias e os assuntos do edital.">
    <button class="btn-primary" data-testid="new-contest" @click="openForm(false)"><Plus :size="18" /> Cadastrar concurso</button>
  </EmptyState>

  <template v-else>
    <section class="panel mb-6 p-5" data-testid="contest-card">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <select v-if="concurso.contests.length > 1" :value="c.id" class="mb-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs" aria-label="Concurso atual" @change="settings.setCurrentContest($event.target.value)"><option v-for="x in concurso.contests" :key="x.id" :value="x.id">{{ x.name }}</option></select>
          <h2 class="font-display text-xl font-extrabold">{{ c.name }}</h2>
          <p class="text-sm text-mute">{{ [c.role, c.board].filter(Boolean).join(' · ') || 'Cargo e banca não informados' }}</p>
          <p class="mt-2 flex flex-wrap items-center gap-2 text-sm"><span class="pill bg-accent-soft text-accent">{{ CONTEST_STATUS[c.status] }}</span><span v-if="c.examDate" class="flex items-center gap-1 text-mute"><CalendarClock :size="14" />Prova em {{ formatDate(c.examDate) }}<template v-if="concurso.daysToExam !== null"> · {{ concurso.daysToExam >= 0 ? `faltam ${plural(concurso.daysToExam, 'dia', 'dias')}` : 'prova já realizada' }}</template></span></p>
        </div>
        <div class="flex gap-1"><button class="btn-line btn-sm" @click="openForm(true)"><Pencil :size="14" /> Editar</button><button class="btn-ghost btn-sm text-danger" aria-label="Excluir concurso" @click="delContest"><Trash2 :size="14" /></button></div>
      </div>
      <div class="mt-4">
        <div class="mb-1.5 flex items-baseline justify-between text-sm"><span class="font-semibold" data-testid="edital-pct">{{ concurso.progress.completionPct }}% do edital concluído</span><span class="text-xs text-mute">{{ concurso.progress.done }} de {{ concurso.progress.total }} assuntos</span></div>
        <ProgressBar :value="concurso.progress.completionPct" tone="ok" />
        <div v-if="concurso.progress.total" class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute"><span v-for="k in STATUS_ORDER" :key="k" class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" :class="statusColor[k]" />{{ TOPIC_STATUS[k] }}: <b class="text-ink">{{ concurso.progress.count[k] }}</b></span></div>
      </div>
    </section>

    <form class="mb-6 flex gap-2" @submit.prevent="addSubject">
      <input v-model="subjectName" list="edital-subjects" class="field" placeholder="Adicionar matéria ao edital (ex.: Direito Constitucional)" aria-label="Nome da matéria do edital" />
      <datalist id="edital-subjects"><option v-for="s in suggestions" :key="s.id" :value="s.name" /></datalist>
      <button class="btn-primary shrink-0" type="submit"><Plus :size="18" /> Matéria</button>
    </form>

    <EmptyState v-if="!included.length" title="Edital vazio" text="Adicione as matérias e depois os assuntos de cada uma." />
    <div v-else class="space-y-4">
      <section v-for="s in included" :key="s.id" class="panel p-4" data-testid="edital-subject">
        <div class="flex items-center gap-2">
          <button class="flex min-w-0 flex-1 items-center gap-2 text-left" :aria-expanded="!collapsed[s.id]" @click="collapsed[s.id] = !collapsed[s.id]">
            <ChevronDown :size="16" class="shrink-0 text-mute transition" :class="collapsed[s.id] && '-rotate-90'" /><SubjectDot :color="s.color" /><span class="truncate font-display font-bold">{{ s.name }}</span>
            <span class="ml-auto shrink-0 text-xs font-semibold text-mute">{{ concurso.progressFor(s.id).completionPct }}%</span>
          </button>
          <button class="btn-ghost btn-sm !p-1.5 text-danger" :aria-label="`Remover ${s.name} do edital`" @click="removeSubject(s)"><Trash2 :size="14" /></button>
        </div>
        <ProgressBar :value="concurso.progressFor(s.id).completionPct" class="mt-2" />
        <div v-if="!collapsed[s.id]" class="mt-3">
          <ul class="divide-y divide-line"><TopicNode v-for="n in tree(s.id)" :key="n.id" :node="n" /></ul>
          <p v-if="!tree(s.id).length" class="py-2 text-sm text-mute">Nenhum assunto cadastrado.</p>
          <form class="mt-3 flex gap-2" @submit.prevent="addTopic(s.id)"><input v-model="topicNames[s.id]" class="field !py-2 text-sm" placeholder="Novo assunto" :aria-label="`Novo assunto de ${s.name}`" /><button class="btn-soft btn-sm shrink-0" type="submit"><Plus :size="14" /> Assunto</button></form>
        </div>
      </section>
    </div>
  </template>

  <BaseModal :open="open" :title="editing ? 'Editar concurso' : 'Novo concurso'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div><label class="label" for="ct-name">Nome do concurso</label><input id="ct-name" v-model="form.name" class="field" :class="{ 'field-error': errors.name }" autofocus /><p v-if="errors.name" class="hint-error">{{ errors.name }}</p></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="ct-role">Cargo</label><input id="ct-role" v-model="form.role" class="field" /></div>
        <div><label class="label" for="ct-board">Banca organizadora</label><input id="ct-board" v-model="form.board" class="field" /></div>
        <div><label class="label" for="ct-date">Data da prova</label><input id="ct-date" v-model="form.examDate" type="date" class="field" :class="{ 'field-error': errors.examDate }" /></div>
        <div><label class="label" for="ct-status">Situação</label><select id="ct-status" v-model="form.status" class="field"><option v-for="(l, k) in CONTEST_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
      </div>
      <button class="btn-primary w-full" type="submit">Salvar concurso</button>
    </form>
  </BaseModal>
</template>
