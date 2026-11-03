<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuestionsStore } from '../../stores/questions'
import { useStudiesStore } from '../../stores/studies'
import { useClockStore } from '../../stores/clock'
import { useToast } from '../../composables/useToast'
import { hasErrors, validateQuestion } from '../../utils/validators'
import BaseModal from '../ui/BaseModal.vue'
import SubjectSelect from './SubjectSelect.vue'
import QuestionFields from './QuestionFields.vue'

const props = defineProps({ open: Boolean, question: Object, preset: Object })
const emit = defineEmits(['close', 'saved'])
const questions = useQuestionsStore(), studies = useStudiesStore(), clock = useClockStore(), toast = useToast()

const blank = () => ({ date: clock.today, subjectId: '', topic: '', statement: '', options: [], correctAnswer: '', chosenAnswer: '', explanation: '', status: 'not_mastered', ...props.preset })
const form = reactive(blank())
const errors = ref({})
const alsoStudy = ref(true)
const saving = ref(false)

watch(() => props.open, (o) => {
  if (!o) return
  Object.assign(form, props.question ? { ...props.question, options: [...(props.question.options || [])] } : { ...blank(), options: [] })
  errors.value = {}; alsoStudy.value = true
})

const topicOptions = computed(() => (form.subjectId ? [...new Set([...studies.topicsFor(form.subjectId), ...questions.topicsFor(form.subjectId)])] : []))
const hasStudy = computed(() => studies.items.some((s) => s.date === form.date && s.subjectId === form.subjectId && s.topic.trim().toLowerCase() === form.topic.trim().toLowerCase()))
const needsStudyOffer = computed(() => !props.question && !form.studyId && form.subjectId && form.topic.trim() && !hasStudy.value)

async function submit() {
  errors.value = validateQuestion(form)
  if (hasErrors(errors.value)) return
  saving.value = true
  try {
    await questions.save(form, { alsoRegisterStudy: needsStudyOffer.value && alsoStudy.value })
    toast.ok(props.question ? 'Questão atualizada' : 'Questão salva')
    emit('saved'); emit('close')
  } catch (e) { e.errors ? (errors.value = e.errors) : toast.error(e.message) } finally { saving.value = false }
}
</script>
<template>
  <BaseModal :open="open" :title="question ? 'Editar questão' : 'Nova questão'" wide @close="emit('close')">
    <form id="qform" class="space-y-4" novalidate @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="qf-date">Data do estudo</label>
          <input id="qf-date" v-model="form.date" type="date" :max="clock.today" class="field" :class="{ 'field-error': errors.date }" />
          <p v-if="errors.date" class="hint-error">{{ errors.date }}</p>
        </div>
        <div><span class="label">Matéria</span><SubjectSelect v-model="form.subjectId" :error="errors.subjectId" /></div>
      </div>
      <div>
        <label class="label" for="qf-topic">Assunto</label>
        <input id="qf-topic" v-model="form.topic" list="qf-topics" class="field" :class="{ 'field-error': errors.topic }" placeholder="Ex.: Modelo OSI" />
        <datalist id="qf-topics"><option v-for="t in topicOptions" :key="t" :value="t" /></datalist>
        <p v-if="errors.topic" class="hint-error">{{ errors.topic }}</p>
      </div>
      <QuestionFields :form="form" :errors="errors" id-prefix="qf" />
      <label v-if="question" class="flex items-center gap-2 text-sm"><input v-model="form.status" type="checkbox" true-value="mastered" false-value="not_mastered" class="h-4 w-4 accent-[rgb(var(--c-accent))]" /> Questão dominada</label>
      <label v-if="needsStudyOffer" class="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-sm">
        <input v-model="alsoStudy" type="checkbox" class="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]" />
        <span>Registrar também este assunto como estudado neste dia. <span class="text-mute">Sem um registro de estudo no dia, a questão não entra nas revisões.</span></span>
      </label>
    </form>
    <template #footer>
      <button class="btn-line" @click="emit('close')">Cancelar</button>
      <button class="btn-primary" form="qform" type="submit" :disabled="saving">Salvar questão</button>
    </template>
  </BaseModal>
</template>
