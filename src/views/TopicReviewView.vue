<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CheckCheck, AlertTriangle, History, Trash2 } from 'lucide-vue-next'
import { useConcursoStore } from '../stores/concurso'
import { useQuestionsStore } from '../stores/questions'
import { useSubjectsStore } from '../stores/subjects'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { TOPIC_STATUS, attentionReasons } from '../services/concursoEngine'
import { formatDate } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const concurso = useConcursoStore(), questions = useQuestionsStore(), subjects = useSubjectsStore(), clock = useClockStore(), toast = useToast()
const subjectId = ref(''), onlyAttention = ref(false), expanded = ref('')
const modal = ref(null), form = reactive({ date: '', note: '' })

const rows = computed(() => concurso.topics
  .filter((t) => !subjectId.value || t.subjectId === subjectId.value)
  .map((t) => ({ ...t, reasons: attentionReasons(t, { today: clock.today, questions: questions.items }) }))
  .filter((t) => !onlyAttention.value || t.reasons.length)
  .sort((a, b) => (b.reasons.length > 0) - (a.reasons.length > 0) || (a.lastReviewedAt || '').localeCompare(b.lastReviewedAt || '') || a.name.localeCompare(b.name, 'pt-BR')))
const attentionCount = computed(() => concurso.topics.filter((t) => attentionReasons(t, { today: clock.today, questions: questions.items }).length).length)

function openReview(t) { modal.value = t; Object.assign(form, { date: clock.today, note: '' }) }
async function submit() {
  try { await concurso.reviewTopic(modal.value.id, { ...form }); toast.ok('Revisão registrada'); modal.value = null } catch (e) { toast.error(e.message) }
}
</script>

<template>
  <PageHeader title="Revisão de assuntos" subtitle="Acompanhe a revisão dos assuntos do edital e veja o que precisa de atenção.">
    <RouterLink to="/revisoes" class="btn-line btn-sm">Revisões diárias e semanais</RouterLink>
  </PageHeader>

  <EmptyState v-if="!concurso.topics.length" title="Sem assuntos no edital" text="Cadastre as matérias e os assuntos do edital para acompanhar as revisões.">
    <RouterLink to="/concurso/edital" class="btn-primary">Ir para o edital</RouterLink>
  </EmptyState>

  <template v-else>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <select v-model="subjectId" class="field !w-auto !py-1.5 text-xs" aria-label="Matéria"><option value="">Todas as matérias</option><option v-for="id in concurso.subjectIds" :key="id" :value="id">{{ subjects.nameOf(id) }}</option></select>
      <button class="btn-sm rounded-full px-3 py-1.5 text-xs font-semibold" :class="onlyAttention ? 'bg-warn text-white' : 'bg-sunken text-mute'" :aria-pressed="onlyAttention" data-testid="only-attention" @click="onlyAttention = !onlyAttention"><AlertTriangle :size="12" class="mr-1 inline" />Precisam de atenção ({{ attentionCount }})</button>
    </div>
    <p v-if="!rows.length" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">Nenhum assunto neste filtro.</p>
    <ul class="space-y-2">
      <li v-for="t in rows" :key="t.id" class="panel p-3.5" data-testid="topic-review-row">
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ t.name }}</p>
            <p class="truncate text-xs text-mute">{{ subjects.nameOf(t.subjectId) }} · {{ TOPIC_STATUS[t.status] }} · {{ t.lastReviewedAt ? 'revisado em ' + formatDate(t.lastReviewedAt) : 'nunca revisado' }}</p>
            <p v-if="t.reasons.length" class="mt-1 flex flex-wrap gap-1.5"><span v-for="r in t.reasons" :key="r" class="pill bg-warn-soft text-warn"><AlertTriangle :size="11" />{{ r }}</span></p>
          </div>
          <button v-if="t.reviews?.length" class="btn-ghost btn-sm !p-2" :aria-label="`Histórico de ${t.name}`" @click="expanded = expanded === t.id ? '' : t.id"><History :size="16" /></button>
          <button class="btn-soft btn-sm shrink-0" @click="openReview(t)"><CheckCheck :size="14" /> Revisado</button>
        </div>
        <ul v-if="expanded === t.id" class="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <li v-for="r in t.reviews" :key="r.id" class="flex items-start justify-between gap-2"><span><b>{{ formatDate(r.date) }}</b><span v-if="r.note" class="text-mute"> — {{ r.note }}</span></span><button class="text-danger" :aria-label="`Excluir revisão de ${formatDate(r.date)}`" @click="concurso.removeTopicReview(t.id, r.id)"><Trash2 :size="14" /></button></li>
        </ul>
      </li>
    </ul>
  </template>

  <BaseModal :open="!!modal" :title="modal ? `Revisão: ${modal.name}` : ''" @close="modal = null">
    <form class="space-y-4" @submit.prevent="submit">
      <div><label class="label" for="tr-date">Data da revisão</label><input id="tr-date" v-model="form.date" type="date" :max="clock.today" class="field" /></div>
      <div><label class="label" for="tr-note">Observações <span class="font-normal text-mute">(opcional)</span></label><textarea id="tr-note" v-model="form.note" rows="3" class="field" /></div>
      <button class="btn-primary w-full" type="submit" data-testid="save-topic-review">Registrar revisão</button>
    </form>
  </BaseModal>
</template>
