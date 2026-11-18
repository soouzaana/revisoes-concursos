<script setup>
// Matérias ativas/inativas e assuntos ativos/inativos nas revisões automáticas.
// Desativar NUNCA apaga dados: registros, questões, flashcards e histórico ficam salvos.
import { computed, reactive, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useSubjectsStore } from '../../stores/subjects'
import { useActivityStore } from '../../stores/activity'
import { useToast } from '../../composables/useToast'
import { plural } from '../../utils/text'

const subjects = useSubjectsStore(), activity = useActivityStore(), toast = useToast()
const view = ref('active')
const expanded = reactive({})
const list = computed(() => (view.value === 'active' ? subjects.activeItems : subjects.inactiveItems))
const isActive = (s) => s.active !== false

async function toggleSubject(s) {
  const next = !isActive(s)
  try {
    await activity.setSubjectActive(s.id, next)
    toast.ok(next ? `"${s.name}" reativada — volta às revisões automáticas` : `"${s.name}" desativada — dados preservados`)
  } catch (e) { toast.error('Não foi possível alterar: ' + e.message) }
}
async function toggleTopic(s, t) {
  try { await activity.setTopicActive(s.id, t.topic, !t.active) } catch (e) { toast.error('Não foi possível alterar: ' + e.message) }
}
const summary = (s) => { const t = activity.topicsOf(s.id); return { total: t.length, on: t.filter((x) => x.active).length } }
const meta = (t) => [t.studies && plural(t.studies, 'estudo'), t.questions && plural(t.questions, 'questão', 'questões'), t.flashcards && plural(t.flashcards, 'cartão', 'cartões')].filter(Boolean).join(' · ')
</script>

<template>
  <div data-testid="scope-manager">
    <div class="mb-3 flex gap-2 text-sm" role="tablist">
      <button role="tab" :aria-selected="view === 'active'" class="pill !px-3.5 !py-1.5" :class="view === 'active' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'active'">Ativas ({{ subjects.activeItems.length }})</button>
      <button role="tab" :aria-selected="view === 'inactive'" class="pill !px-3.5 !py-1.5" :class="view === 'inactive' ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="view = 'inactive'">Inativas ({{ subjects.inactiveItems.length }})</button>
    </div>

    <p v-if="!subjects.items.length" class="rounded-xl border border-dashed border-line p-4 text-center text-sm text-mute">Cadastre matérias abaixo para escolher quais participam das revisões.</p>
    <p v-else-if="!list.length" class="rounded-xl border border-dashed border-line p-4 text-center text-sm text-mute">{{ view === 'active' ? 'Nenhuma matéria ativa. Nada será gerado nas revisões automáticas.' : 'Nenhuma matéria inativa.' }}</p>

    <ul v-else class="divide-y divide-line rounded-xl border border-line">
      <li v-for="s in list" :key="s.id" data-testid="scope-subject">
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: s.color }" />
          <button class="flex min-w-0 flex-1 items-center gap-2 text-left" :aria-expanded="!!expanded[s.id]" :aria-label="`Assuntos de ${s.name}`" @click="expanded[s.id] = !expanded[s.id]">
            <span class="min-w-0"><span class="block truncate text-sm font-semibold">{{ s.name }}</span>
              <span class="block text-xs text-mute">{{ summary(s).total ? `${summary(s).on} de ${plural(summary(s).total, 'assunto', 'assuntos')} ativos` : 'Sem assuntos ainda' }}</span></span>
            <ChevronDown :size="16" class="shrink-0 text-mute transition" :class="expanded[s.id] ? 'rotate-180' : ''" />
          </button>
          <button role="switch" :aria-checked="isActive(s)" :aria-label="`${isActive(s) ? 'Desativar' : 'Ativar'} ${s.name}`" class="relative h-6 w-11 shrink-0 rounded-full transition" :class="isActive(s) ? 'bg-accent' : 'bg-line'" @click="toggleSubject(s)">
            <span class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" :class="isActive(s) ? 'left-[22px]' : 'left-0.5'" />
          </button>
        </div>
        <div v-if="expanded[s.id]" class="border-t border-line bg-sunken/50 px-4 py-3">
          <p v-if="!isActive(s)" class="mb-2 text-xs text-mute">Matéria inativa: os assuntos abaixo não participam das revisões. Reative a matéria para escolher assuntos.</p>
          <p v-if="!activity.topicsOf(s.id).length" class="text-xs text-mute">Os assuntos aparecem aqui conforme você registra estudos, questões e flashcards.</p>
          <template v-else>
            <div v-if="isActive(s)" class="mb-2 flex gap-3 text-xs font-semibold text-accent">
              <button @click="activity.setAllTopics(s.id, true)">Marcar todos</button><button @click="activity.setAllTopics(s.id, false)">Desmarcar todos</button>
            </div>
            <ul class="space-y-1.5">
              <li v-for="t in activity.topicsOf(s.id)" :key="t.key">
                <label class="flex items-start gap-2.5 text-sm" :class="isActive(s) ? '' : 'opacity-60'">
                  <input type="checkbox" class="mt-1 accent-[rgb(var(--c-accent))]" :checked="t.active" :disabled="!isActive(s)" :aria-label="`Assunto ${t.topic}`" @change="toggleTopic(s, t)" />
                  <span class="min-w-0"><span class="block">{{ t.topic }}</span><span class="block text-xs text-mute">{{ meta(t) }}</span></span>
                </label>
              </li>
            </ul>
          </template>
        </div>
      </li>
    </ul>
    <p class="mt-3 text-xs text-mute">Só matérias e assuntos ativos geram revisões e flashcards pendentes. Flashcards continuam disponíveis para estudo livre, e nada é excluído.</p>
  </div>
</template>
