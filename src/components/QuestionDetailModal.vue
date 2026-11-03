<script setup>
import { computed } from 'vue'
import { Check, Pencil, Trash2, RotateCcw, Circle } from 'lucide-vue-next'
import { useQuestionsStore } from '../stores/questions'
import { useReviewsStore } from '../stores/reviews'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { formatDate } from '../utils/date'
import { LETTERS } from '../utils/text'
import BaseModal from './ui/BaseModal.vue'
import SubjectDot from './ui/SubjectDot.vue'

const props = defineProps({ id: String })
const emit = defineEmits(['close', 'edit'])
const questions = useQuestionsStore(), reviews = useReviewsStore(), toast = useToast(), confirm = useConfirm()
const q = computed(() => (props.id ? questions.get(props.id) : null))
const history = computed(() => reviews.logs.filter((l) => l.kind === 'question' && l.itemId === props.id).sort((a, b) => b.at.localeCompare(a.at)))
const hits = computed(() => history.value.filter((h) => h.correct).length)
const mastered = computed(() => q.value?.status === 'mastered')

async function toggle() {
  await questions.setStatus(q.value.id, mastered.value ? 'not_mastered' : 'mastered')
  toast.ok(mastered.value ? 'Marcada como dominada' : 'Voltou para não dominada')
}
async function del() {
  if (!(await confirm({ title: 'Excluir questão', message: 'Excluir esta questão do caderno de erros? O histórico agregado nas estatísticas é mantido.', confirmLabel: 'Excluir', danger: true }))) return
  await questions.remove(q.value.id); toast.ok('Questão excluída'); emit('close')
}
const label = (l) => (l.reviewType === 'weekly' ? 'Revisão semanal' : 'Revisão diária')
</script>
<template>
  <BaseModal :open="!!q" title="Questão" wide @close="emit('close')">
    <div v-if="q" class="space-y-5">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <SubjectDot :id="q.subjectId" /><span class="font-semibold">{{ q.topic }}</span><span class="text-mute">Estudo em {{ formatDate(q.date) }}</span>
        <span class="pill" :class="mastered ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'">{{ mastered ? 'Dominada' : 'Não dominada' }}</span>
      </div>
      <p class="whitespace-pre-line leading-relaxed">{{ q.statement }}</p>
      <ul v-if="q.options?.length" class="space-y-2">
        <li v-for="(o, i) in q.options" :key="i" class="flex gap-3 rounded-xl border px-3 py-2 text-sm"
          :class="LETTERS[i] === q.correctAnswer ? 'border-ok bg-ok-soft' : LETTERS[i] === q.chosenAnswer ? 'border-danger bg-danger-soft' : 'border-line'">
          <b>{{ LETTERS[i] }}</b><span>{{ o }}</span>
          <span v-if="LETTERS[i] === q.correctAnswer" class="ml-auto shrink-0 text-xs font-bold text-ok">Correta</span>
          <span v-else-if="LETTERS[i] === q.chosenAnswer" class="ml-auto shrink-0 text-xs font-bold text-danger">Marquei</span>
        </li>
      </ul>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div class="rounded-xl bg-ok-soft p-3"><dt class="text-xs font-bold text-ok">Resposta correta</dt><dd class="mt-0.5 font-semibold">{{ q.correctAnswer }}</dd></div>
        <div v-if="q.chosenAnswer" class="rounded-xl bg-danger-soft p-3"><dt class="text-xs font-bold text-danger">Resposta que marquei</dt><dd class="mt-0.5 font-semibold">{{ q.chosenAnswer }}</dd></div>
      </dl>
      <div v-if="q.explanation" class="rounded-xl bg-sunken p-4 text-sm"><p class="mb-1 text-xs font-bold text-mute">Explicação</p><p class="whitespace-pre-line">{{ q.explanation }}</p></div>

      <div>
        <h3 class="mb-2 text-sm font-bold">Histórico de revisões <span class="font-medium text-mute">({{ hits }} de {{ history.length }} acertos)</span></h3>
        <p v-if="!history.length" class="text-sm text-mute">Esta questão ainda não foi revisada.</p>
        <ul v-else class="divide-y divide-line rounded-xl border border-line text-sm">
          <li v-for="h in history" :key="h.id" class="flex items-center gap-2 px-3 py-2">
            <Check v-if="h.correct" :size="16" class="text-ok" /><Circle v-else :size="16" class="text-danger" />
            <span class="font-semibold" :class="h.correct ? 'text-ok' : 'text-danger'">{{ h.correct ? 'Acertei' : 'Errei' }}</span>
            <span class="text-mute">{{ label(h) }}</span><span class="ml-auto text-xs text-mute">{{ formatDate(h.date) }}</span>
          </li>
        </ul>
      </div>
    </div>
    <template v-if="q" #footer>
      <button class="btn-ghost text-danger" @click="del"><Trash2 :size="16" /> Excluir</button>
      <button class="btn-line" @click="emit('edit', q)"><Pencil :size="16" /> Editar</button>
      <button :class="mastered ? 'btn-line' : 'btn-ok'" @click="toggle"><component :is="mastered ? RotateCcw : Check" :size="16" /> {{ mastered ? 'Desmarcar dominada' : 'Marcar como dominada' }}</button>
    </template>
  </BaseModal>
</template>
