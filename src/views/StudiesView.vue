<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ChevronDown, Pencil, Trash2, X, FileQuestion, Plus } from 'lucide-vue-next'
import { useStudiesStore } from '../stores/studies'
import { useQuestionsStore } from '../stores/questions'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { formatDateShort, relativeDay } from '../utils/date'
import { plural } from '../utils/text'
import { hasErrors, validateQuestionFields, validateStudy } from '../utils/validators'
import PageHeader from '../components/ui/PageHeader.vue'
import SubjectDot from '../components/ui/SubjectDot.vue'
import SubjectSelect from '../components/forms/SubjectSelect.vue'
import QuestionFields from '../components/forms/QuestionFields.vue'
import StudyEditModal from '../components/forms/StudyEditModal.vue'
import SubjectsManager from '../components/forms/SubjectsManager.vue'

const studies = useStudiesStore(), questions = useQuestionsStore(), subjects = useSubjectsStore(), clock = useClockStore()
const toast = useToast(), confirm = useConfirm()

const form = reactive({ date: clock.today, subjectId: '', topic: '', notes: '' })
const errors = ref({})
const qErrors = ref({})
const showQ = ref(false)
const blankQ = () => ({ statement: '', options: [], correctAnswer: '', chosenAnswer: '', explanation: '' })
const draft = reactive(blankQ())
const drafts = ref([])
const saving = ref(false)
const editing = ref(null)
const shown = ref(10)

const topicOptions = computed(() => (form.subjectId ? studies.topicsFor(form.subjectId) : []))
const draftTouched = () => !!(draft.statement.trim() || draft.correctAnswer.trim() || draft.explanation.trim() || draft.options.length)
const resetDraft = () => { Object.assign(draft, blankQ()); qErrors.value = {} }

function addDraft() {
  qErrors.value = validateQuestionFields(draft)
  if (hasErrors(qErrors.value)) return false
  drafts.value.push({ ...draft, options: [...draft.options] }); resetDraft(); return true
}

async function submit() {
  errors.value = validateStudy(form)
  if (draftTouched() && showQ.value) { qErrors.value = validateQuestionFields(draft) }
  if (hasErrors(errors.value) || (showQ.value && draftTouched() && hasErrors(qErrors.value))) return
  if (showQ.value && draftTouched()) addDraft()
  saving.value = true
  try {
    const n = drafts.value.length
    await studies.add(form, drafts.value)
    toast.ok(n ? `Estudo registrado com ${plural(n, 'questão', 'questões')}` : 'Estudo registrado')
    form.topic = ''; form.notes = ''; drafts.value = []; resetDraft(); showQ.value = false
    await nextTick(); document.getElementById('st-topic')?.focus()
  } catch (e) { e.errors ? (errors.value = e.errors) : toast.error(e.message) } finally { saving.value = false }
}

async function del(s) {
  if (!(await confirm({ title: 'Excluir registro', message: `Excluir "${s.topic}"?\nAs questões do caderno de erros não são apagadas.`, confirmLabel: 'Excluir', danger: true }))) return
  await studies.remove(s.id); toast.ok('Registro excluído')
}

const qCount = (s) => questions.items.filter((q) => q.date === s.date && q.subjectId === s.subjectId && q.topic.trim().toLowerCase() === s.topic.trim().toLowerCase()).length
const days = computed(() => Object.keys(studies.byDate).sort().reverse())
</script>

<template>
  <PageHeader title="Registrar estudo" subtitle="Anote o que estudou. As revisões são organizadas a partir daqui." />

  <section v-if="!subjects.items.length" class="panel mb-6 p-5">
    <h2 class="font-display text-lg font-bold">Comece pelas suas matérias</h2>
    <p class="mb-4 mt-1 text-sm text-mute">Escolha as sugestões ou escreva as suas. Você pode mudar isso depois em Ajustes.</p>
    <SubjectsManager />
  </section>

  <form v-else class="panel mb-8 space-y-4 p-5" novalidate @submit.prevent="submit">
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="st-date">Data do estudo</label>
        <input id="st-date" v-model="form.date" type="date" :max="clock.today" class="field" :class="{ 'field-error': errors.date }" />
        <p v-if="errors.date" class="hint-error">{{ errors.date }}</p>
      </div>
      <div><span class="label">Matéria</span><SubjectSelect v-model="form.subjectId" :error="errors.subjectId" /></div>
    </div>
    <div>
      <label class="label" for="st-topic">Assunto estudado</label>
      <input id="st-topic" v-model="form.topic" list="st-topics" class="field" :class="{ 'field-error': errors.topic }" placeholder="Ex.: Modelo OSI" autocomplete="off" />
      <datalist id="st-topics"><option v-for="t in topicOptions" :key="t" :value="t" /></datalist>
      <p v-if="errors.topic" class="hint-error">{{ errors.topic }}</p>
    </div>
    <div>
      <label class="label" for="st-notes">Observações <span class="font-normal text-mute">(opcional)</span></label>
      <textarea id="st-notes" v-model="form.notes" rows="2" class="field" />
    </div>

    <div class="rounded-xl border border-line">
      <button type="button" class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold" :aria-expanded="showQ" @click="showQ = !showQ">
        <span class="flex items-center gap-2"><FileQuestion :size="17" class="text-accent" /> Questão errada deste assunto <span class="font-normal text-mute">(opcional)</span>
          <span v-if="drafts.length" class="pill bg-accent-soft text-accent">{{ drafts.length }} na lista</span></span>
        <ChevronDown :size="18" class="transition" :class="showQ ? 'rotate-180' : ''" />
      </button>
      <div v-if="showQ" class="space-y-4 border-t border-line p-4">
        <ul v-if="drafts.length" class="space-y-2">
          <li v-for="(d, i) in drafts" :key="i" class="flex items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-sm">
            <span class="flex-1 truncate">{{ d.statement }}</span>
            <button type="button" class="btn-ghost btn-sm !p-1.5" aria-label="Remover questão da lista" @click="drafts.splice(i, 1)"><X :size="14" /></button>
          </li>
        </ul>
        <QuestionFields :form="draft" :errors="qErrors" id-prefix="sq" />
        <button type="button" class="btn-line btn-sm" @click="addDraft"><Plus :size="14" /> Adicionar outra questão</button>
      </div>
    </div>

    <button class="btn-primary w-full sm:w-auto" type="submit" :disabled="saving">Registrar estudo</button>
  </form>

  <section>
    <h2 class="mb-3 font-display text-lg font-bold">Seus registros</h2>
    <div v-if="!days.length" class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-mute">Nenhum estudo registrado ainda. Seu primeiro registro aparece aqui.</div>
    <div v-for="d in days.slice(0, shown)" :key="d" class="mb-4">
      <div class="mb-1.5 flex items-baseline justify-between px-1">
        <h3 class="text-sm font-bold">{{ relativeDay(d, clock.today) }} <span class="font-medium text-mute">{{ relativeDay(d, clock.today) === formatDateShort(d) ? '' : formatDateShort(d) }}</span></h3>
        <span class="text-xs text-mute">{{ plural(studies.byDate[d].length, 'registro', 'registros') }}</span>
      </div>
      <ul class="panel divide-y divide-line overflow-hidden">
        <li v-for="s in studies.byDate[d]" :key="s.id" class="flex items-start gap-3 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{{ s.topic }}</p>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute">
              <SubjectDot :id="s.subjectId" />
              <span v-if="qCount(s)">{{ plural(qCount(s), 'questão', 'questões') }} no caderno</span>
            </div>
            <p v-if="s.notes" class="mt-1.5 whitespace-pre-line text-sm text-mute">{{ s.notes }}</p>
          </div>
          <button class="btn-ghost btn-sm !p-2" :aria-label="'Editar ' + s.topic" @click="editing = s"><Pencil :size="15" /></button>
          <button class="btn-ghost btn-sm !p-2" :aria-label="'Excluir ' + s.topic" @click="del(s)"><Trash2 :size="15" /></button>
        </li>
      </ul>
    </div>
    <button v-if="days.length > shown" class="btn-line w-full" @click="shown += 10">Mostrar dias anteriores</button>
  </section>
  <StudyEditModal :open="!!editing" :study="editing" @close="editing = null" />
</template>
