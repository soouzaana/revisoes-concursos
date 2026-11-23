<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CalendarDays, Flame, ListChecks, Layers, StickyNote, Target, Timer, ChartColumn, TrendingUp, Repeat, NotebookPen, PenLine, ClipboardCheck, FileUp, GitMerge, Flag } from 'lucide-vue-next'
import PageHeader from '../components/ui/PageHeader.vue'

const route = useRoute()
const HUBS = {
  apps: { title: 'Aplicativos', subtitle: 'Ferramentas independentes, todas ligadas ao seu histórico e à ofensiva.', items: [
    { to: '/calendario', label: 'Calendário', text: 'Eventos, tarefas, estudos, simulados e revisões previstas.', icon: CalendarDays },
    { to: '/habitos', label: 'Hábitos', text: 'Sequência, consistência e evolução.', icon: Flame },
    { to: '/tarefas', label: 'Tarefas', text: 'Prazos, prioridade e recorrência.', icon: ListChecks },
    { to: '/flashcards', label: 'Flashcards', text: 'Estudo livre, revisão programada e estatísticas.', icon: Layers },
    { to: '/anotacoes', label: 'Anotações', text: 'Notas com pastas, tags e busca.', icon: StickyNote }
  ] },
  concurso: { title: 'Meu Concurso', subtitle: 'Sua preparação atual, sem precisar montar cronograma diário.', items: [
    { to: '/concurso/edital', label: 'Edital', text: 'Concurso, matérias e assuntos com status.', icon: Target },
    { to: '/concurso/importar', label: 'Importar edital (PDF)', text: 'Leitura local do PDF, com OCR offline e revisão antes de salvar.', icon: FileUp },
    { to: '/concurso/cruzamento', label: 'Cruzamento com o histórico', text: 'Sugestões do que você já estudou — você confirma.', icon: GitMerge },
    { to: '/concurso/acompanhamento', label: 'Cronograma do concurso', text: 'Etapas, status, resultados e linha do tempo.', icon: Flag },
    { to: '/estudos', label: 'Registrar estudo', text: 'O que estudou hoje; gera as revisões.', icon: PenLine },
    { to: '/concurso/ciclo', label: 'Ciclo de estudos', text: 'Sequência e tempo por matéria (opcional).', icon: Timer },
    { to: '/concurso/estatisticas', label: 'Estatísticas', text: 'Horas, questões, assuntos e evolução mensal.', icon: ChartColumn },
    { to: '/simulados', label: 'Desempenho', text: 'Simulados, evolução e matérias fortes e fracas.', icon: TrendingUp },
    { to: '/concurso/revisao-assuntos', label: 'Revisão de assuntos', text: 'Marque revisões e veja o que precisa de atenção.', icon: ClipboardCheck },
    { to: '/revisoes', label: 'Revisões diárias e semanais', text: 'Central automática com filtros e matérias ativas.', icon: Repeat },
    { to: '/caderno', label: 'Caderno de erros', text: 'Questões, explicações e desempenho.', icon: NotebookPen }
  ] }
}
const hub = computed(() => HUBS[route.meta.hub])
</script>

<template>
  <PageHeader :title="hub.title" :subtitle="hub.subtitle" />
  <div class="grid gap-3 sm:grid-cols-2" :data-testid="`hub-${route.meta.hub}`">
    <RouterLink v-for="i in hub.items" :key="i.to" :to="i.to" class="panel flex items-start gap-3 p-4 transition hover:border-accent">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><component :is="i.icon" :size="20" /></span>
      <span><span class="block font-display font-bold">{{ i.label }}</span><span class="block text-sm text-mute">{{ i.text }}</span></span>
    </RouterLink>
  </div>
</template>
