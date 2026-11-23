<script setup>
// Assunto do edital (recursivo: aceita subassuntos).
import { ref } from 'vue'
import { Plus, Trash2, Check, X } from 'lucide-vue-next'
import { useConcursoStore } from '../../stores/concurso'
import { useToast } from '../../composables/useToast'
import { useConfirm } from '../../composables/useConfirm'
import { TOPIC_STATUS } from '../../services/concursoEngine'

const props = defineProps({ node: { type: Object, required: true }, depth: { type: Number, default: 0 } })
const concurso = useConcursoStore(), toast = useToast(), confirm = useConfirm()
const adding = ref(false), name = ref('')
const tone = { not_started: 'text-mute', studying: 'text-warn', studied: 'text-accent', reviewing: 'text-accent', mastered: 'text-ok' }

async function addChild() {
  try { await concurso.addTopic({ subjectId: props.node.subjectId, name: name.value, parentId: props.node.id }); name.value = ''; adding.value = false } catch (e) { toast.error(e.message) }
}
async function del() {
  const n = props.node.children.length
  if (await confirm({ title: 'Excluir assunto', message: `Excluir "${props.node.name}"${n ? ` e seus ${n} subassunto(s)` : ''} do edital?\nEstudos e questões já registrados não são apagados.`, confirmLabel: 'Excluir', danger: true })) await concurso.removeTopic(props.node.id)
}
</script>

<template>
  <li>
    <div class="flex items-center gap-2 py-1.5" :style="{ paddingLeft: depth * 16 + 'px' }" data-testid="topic-row">
      <span class="min-w-0 flex-1 truncate text-sm" :class="node.status === 'mastered' && 'text-mute'">{{ node.name }}</span>
      <select :value="node.status" class="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold" :class="tone[node.status]" :aria-label="`Status de ${node.name}`" @change="concurso.updateTopic(node.id, { status: $event.target.value })">
        <option v-for="(l, k) in TOPIC_STATUS" :key="k" :value="k">{{ l }}</option>
      </select>
      <button class="btn-ghost btn-sm !p-1.5" :aria-label="`Adicionar subassunto em ${node.name}`" @click="adding = !adding"><Plus :size="14" /></button>
      <button class="btn-ghost btn-sm !p-1.5 text-danger" :aria-label="`Excluir ${node.name}`" @click="del"><Trash2 :size="14" /></button>
    </div>
    <form v-if="adding" class="flex gap-2 pb-1" :style="{ paddingLeft: (depth + 1) * 16 + 'px' }" @submit.prevent="addChild">
      <input v-model="name" class="field !py-1.5 text-xs" placeholder="Novo subassunto" aria-label="Novo subassunto" autofocus />
      <button class="btn-primary btn-sm !p-2" type="submit" aria-label="Salvar subassunto"><Check :size="14" /></button><button class="btn-ghost btn-sm !p-2" type="button" aria-label="Cancelar" @click="adding = false"><X :size="14" /></button>
    </form>
    <ul v-if="node.children.length"><TopicNode v-for="c in node.children" :key="c.id" :node="c" :depth="depth + 1" /></ul>
  </li>
</template>
