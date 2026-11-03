<script setup>
import { reactive, ref, watch } from 'vue'
import { useStudiesStore } from '../../stores/studies'
import { useClockStore } from '../../stores/clock'
import { useToast } from '../../composables/useToast'
import { hasErrors, validateStudy } from '../../utils/validators'
import BaseModal from '../ui/BaseModal.vue'
import SubjectSelect from './SubjectSelect.vue'

const props = defineProps({ open: Boolean, study: Object })
const emit = defineEmits(['close'])
const studies = useStudiesStore(), clock = useClockStore(), toast = useToast()
const form = reactive({ date: '', subjectId: '', topic: '', notes: '' })
const errors = ref({})
watch(() => props.open, (o) => { if (o && props.study) { Object.assign(form, props.study); errors.value = {} } })

async function submit() {
  errors.value = validateStudy(form)
  if (hasErrors(errors.value)) return
  try { await studies.update(props.study.id, form); toast.ok('Registro atualizado'); emit('close') } catch (e) { toast.error(e.message) }
}
</script>
<template>
  <BaseModal :open="open" title="Editar registro de estudo" @close="emit('close')">
    <form id="sform" class="space-y-4" novalidate @submit.prevent="submit">
      <div>
        <label class="label" for="se-date">Data</label>
        <input id="se-date" v-model="form.date" type="date" :max="clock.today" class="field" :class="{ 'field-error': errors.date }" />
        <p v-if="errors.date" class="hint-error">{{ errors.date }}</p>
      </div>
      <div><span class="label">Matéria</span><SubjectSelect v-model="form.subjectId" :error="errors.subjectId" /></div>
      <div>
        <label class="label" for="se-topic">Assunto</label>
        <input id="se-topic" v-model="form.topic" class="field" :class="{ 'field-error': errors.topic }" />
        <p v-if="errors.topic" class="hint-error">{{ errors.topic }}</p>
      </div>
      <div><label class="label" for="se-notes">Observações</label><textarea id="se-notes" v-model="form.notes" rows="3" class="field" /></div>
    </form>
    <template #footer>
      <button class="btn-line" @click="emit('close')">Cancelar</button>
      <button class="btn-primary" form="sform" type="submit">Salvar alterações</button>
    </template>
  </BaseModal>
</template>
