<script setup>
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useSubjectsStore } from '../../stores/subjects'
import { useToast } from '../../composables/useToast'
import BaseModal from '../ui/BaseModal.vue'

const model = defineModel({ type: String })
defineProps({ error: String, allowAll: Boolean, allLabel: { type: String, default: 'Todas as matérias' }, compact: Boolean })
const subjects = useSubjectsStore()
const toast = useToast()
const open = ref(false)
const name = ref('')
const err = ref('')

async function create() {
  try {
    const s = await subjects.add(name.value)
    model.value = s.id
    open.value = false; name.value = ''; err.value = ''
    toast.ok('Matéria adicionada')
  } catch (e) { err.value = e.message }
}
</script>
<template>
  <div>
    <div class="flex gap-2">
      <select v-model="model" class="field" :class="{ 'field-error': error }" aria-label="Matéria">
        <option v-if="allowAll" value="">{{ allLabel }}</option>
        <option v-else value="" disabled>Escolha a matéria</option>
        <option v-for="s in subjects.items" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <button v-if="!allowAll" type="button" class="btn-line shrink-0 !px-3" title="Nova matéria" aria-label="Nova matéria" @click="open = true"><Plus :size="18" /></button>
    </div>
    <p v-if="error" class="hint-error">{{ error }}</p>
    <BaseModal :open="open" title="Nova matéria" @close="open = false">
      <form @submit.prevent="create">
        <label class="label" for="ns-name">Nome da matéria</label>
        <input id="ns-name" v-model="name" class="field" :class="{ 'field-error': err }" placeholder="Ex.: Informática" autofocus />
        <p v-if="err" class="hint-error">{{ err }}</p>
        <button class="btn-primary mt-4 w-full" type="submit">Adicionar matéria</button>
      </form>
    </BaseModal>
  </div>
</template>
