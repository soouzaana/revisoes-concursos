<script setup>
import { computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import { LETTERS } from '../../utils/text'

const props = defineProps({ form: { type: Object, required: true }, errors: { type: Object, default: () => ({}) }, idPrefix: { type: String, default: 'q' } })
const letters = computed(() => LETTERS.slice(0, props.form.options.length))
const hasOptions = computed(() => props.form.options.length > 0)

function addOption() { if (props.form.options.length < 5) props.form.options.push('') }
function removeOption(i) {
  props.form.options.splice(i, 1)
  const valid = LETTERS.slice(0, props.form.options.length)
  if (!valid.includes(props.form.correctAnswer)) props.form.correctAnswer = ''
  if (!valid.includes(props.form.chosenAnswer)) props.form.chosenAnswer = ''
}
</script>
<template>
  <div class="space-y-4">
    <div>
      <label class="label" :for="idPrefix + '-stmt'">Enunciado da questão</label>
      <textarea :id="idPrefix + '-stmt'" v-model="form.statement" rows="4" class="field" :class="{ 'field-error': errors.statement }" placeholder="Cole ou escreva a questão" />
      <p v-if="errors.statement" class="hint-error">{{ errors.statement }}</p>
    </div>
    <div>
      <div class="mb-1.5 flex items-center justify-between">
        <span class="label !mb-0">Alternativas <span class="font-normal text-mute">(opcional)</span></span>
        <button v-if="form.options.length < 5" type="button" class="btn-ghost btn-sm" @click="addOption"><Plus :size="14" /> Alternativa</button>
      </div>
      <div class="space-y-2">
        <div v-for="(_, i) in form.options" :key="i" class="flex items-center gap-2">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sunken text-sm font-bold">{{ LETTERS[i] }}</span>
          <input v-model="form.options[i]" class="field" :aria-label="'Alternativa ' + LETTERS[i]" />
          <button type="button" class="btn-ghost btn-sm !p-2" :aria-label="'Remover alternativa ' + LETTERS[i]" @click="removeOption(i)"><Trash2 :size="16" /></button>
        </div>
      </div>
      <p v-if="errors.options" class="hint-error">{{ errors.options }}</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" :for="idPrefix + '-ok'">Resposta correta</label>
        <select v-if="hasOptions" :id="idPrefix + '-ok'" v-model="form.correctAnswer" class="field" :class="{ 'field-error': errors.correctAnswer }">
          <option value="" disabled>Escolha</option><option v-for="l in letters" :key="l" :value="l">{{ l }}</option>
        </select>
        <input v-else :id="idPrefix + '-ok'" v-model="form.correctAnswer" class="field" :class="{ 'field-error': errors.correctAnswer }" placeholder="Ex.: Certo, Errado ou o texto" />
        <p v-if="errors.correctAnswer" class="hint-error">{{ errors.correctAnswer }}</p>
      </div>
      <div>
        <label class="label" :for="idPrefix + '-chosen'">Resposta que marquei <span class="font-normal text-mute">(opcional)</span></label>
        <select v-if="hasOptions" :id="idPrefix + '-chosen'" v-model="form.chosenAnswer" class="field">
          <option value="">Não informar</option><option v-for="l in letters" :key="l" :value="l">{{ l }}</option>
        </select>
        <input v-else :id="idPrefix + '-chosen'" v-model="form.chosenAnswer" class="field" />
      </div>
    </div>
    <div>
      <label class="label" :for="idPrefix + '-exp'">Explicação do erro <span class="font-normal text-mute">(o que confundi, a regra certa)</span></label>
      <textarea :id="idPrefix + '-exp'" v-model="form.explanation" rows="3" class="field" />
    </div>
  </div>
</template>
