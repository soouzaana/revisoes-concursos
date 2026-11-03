<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useFlashcardsStore } from '../../stores/flashcards'
import { useStudiesStore } from '../../stores/studies'
import { useToast } from '../../composables/useToast'
import { hasErrors, validateFlashcard } from '../../utils/validators'
import BaseModal from '../ui/BaseModal.vue'
import SubjectSelect from './SubjectSelect.vue'

const props = defineProps({ open: Boolean, card: Object })
const emit = defineEmits(['close'])
const cards = useFlashcardsStore(), studies = useStudiesStore(), toast = useToast()
const form = reactive({ subjectId: '', topic: '', front: '', back: '' })
const errors = ref({})
const keepOpen = ref(false)

watch(() => props.open, (o) => {
  if (!o) return
  errors.value = {}
  if (props.card) Object.assign(form, { id: props.card.id, subjectId: props.card.subjectId, topic: props.card.topic, front: props.card.front, back: props.card.back })
  else { delete form.id; Object.assign(form, { front: '', back: '' }) }
})
const topicOptions = computed(() => (form.subjectId ? [...new Set([...cards.topicsFor(form.subjectId), ...studies.topicsFor(form.subjectId)])] : []))

async function submit() {
  errors.value = validateFlashcard(form)
  if (hasErrors(errors.value)) return
  try {
    await cards.save(form)
    toast.ok(props.card ? 'Cartão atualizado' : 'Cartão criado')
    if (!props.card && keepOpen.value) { form.front = ''; form.back = ''; document.getElementById('fc-front')?.focus() } else emit('close')
  } catch (e) { toast.error(e.message) }
}
</script>
<template>
  <BaseModal :open="open" :title="card ? 'Editar cartão' : 'Novo cartão'" @close="emit('close')">
    <form id="fform" class="space-y-4" novalidate @submit.prevent="submit">
      <div><span class="label">Matéria</span><SubjectSelect v-model="form.subjectId" :error="errors.subjectId" /></div>
      <div>
        <label class="label" for="fc-topic">Assunto</label>
        <input id="fc-topic" v-model="form.topic" list="fc-topics" class="field" :class="{ 'field-error': errors.topic }" />
        <datalist id="fc-topics"><option v-for="t in topicOptions" :key="t" :value="t" /></datalist>
        <p v-if="errors.topic" class="hint-error">{{ errors.topic }}</p>
      </div>
      <div>
        <label class="label" for="fc-front">Pergunta (frente)</label>
        <textarea id="fc-front" v-model="form.front" rows="3" class="field" :class="{ 'field-error': errors.front }" />
        <p v-if="errors.front" class="hint-error">{{ errors.front }}</p>
      </div>
      <div>
        <label class="label" for="fc-back">Resposta (verso)</label>
        <textarea id="fc-back" v-model="form.back" rows="3" class="field" :class="{ 'field-error': errors.back }" />
        <p v-if="errors.back" class="hint-error">{{ errors.back }}</p>
      </div>
      <label v-if="!card" class="flex items-center gap-2 text-sm"><input v-model="keepOpen" type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-accent))]" /> Continuar criando cartões deste assunto</label>
    </form>
    <template #footer>
      <button class="btn-line" @click="emit('close')">Cancelar</button>
      <button class="btn-primary" form="fform" type="submit">Salvar cartão</button>
    </template>
  </BaseModal>
</template>
