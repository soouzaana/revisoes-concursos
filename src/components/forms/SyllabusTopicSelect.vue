<script setup>
// Associação opcional de um registro (estudo, questão, flashcard) a um assunto do edital.
import { computed } from 'vue'
import { useConcursoStore } from '../../stores/concurso'
import { buildTree } from '../../services/concursoEngine'

const props = defineProps({ modelValue: { type: String, default: '' }, subjectId: { type: String, default: '' }, id: { type: String, default: 'syllabus-topic' } })
const emit = defineEmits(['update:modelValue'])
const concurso = useConcursoStore()
const options = computed(() => {
  if (!props.subjectId) return []
  const out = []
  const walk = (nodes, depth) => { for (const n of nodes) { out.push({ id: n.id, label: '— '.repeat(depth) + n.name }); walk(n.children, depth + 1) } }
  walk(buildTree(concurso.topics.filter((t) => t.subjectId === props.subjectId)), 0)
  return out
})
</script>

<template>
  <div v-if="options.length">
    <label class="label" :for="id">Assunto do edital <span class="font-normal text-mute">(opcional)</span></label>
    <select :id="id" :value="modelValue" class="field" @change="emit('update:modelValue', $event.target.value)">
      <option value="">Não associar</option>
      <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
    </select>
  </div>
</template>
