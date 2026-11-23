import { createRouter, createWebHashHistory } from 'vue-router'

const V = (f) => () => import(`../views/${f}.vue`)
// area: visão geral | aplicativos | meu concurso | histórico | ajustes (define o destaque na navegação)
const routes = [
  { path: '/', name: 'home', component: V('DashboardView'), meta: { title: 'Visão geral', area: 'overview' } },
  { path: '/ofensiva', name: 'streak', component: V('StreakView'), meta: { title: 'Ofensiva', area: 'overview' } },
  { path: '/historico', name: 'history', component: V('HistoryView'), meta: { title: 'Histórico', area: 'history' } },
  { path: '/aplicativos', name: 'hub-apps', component: V('HubView'), meta: { title: 'Aplicativos', area: 'apps', hub: 'apps' } },
  { path: '/calendario', name: 'calendar', component: V('CalendarView'), meta: { title: 'Calendário', area: 'apps' } },
  { path: '/habitos', name: 'habits', component: V('HabitsView'), meta: { title: 'Hábitos', area: 'apps' } },
  { path: '/tarefas', name: 'tasks', component: V('TasksView'), meta: { title: 'Tarefas', area: 'apps' } },
  { path: '/anotacoes', name: 'notes', component: V('NotesView'), meta: { title: 'Anotações', area: 'apps' } },
  { path: '/flashcards', name: 'flashcards', component: V('FlashcardsView'), meta: { title: 'Flashcards', area: 'apps' } },
  { path: '/flashcards/livre', name: 'flashcard-free', component: V('FlashcardFreeView'), meta: { title: 'Estudar flashcards', parent: 'flashcards', area: 'apps' } },
  { path: '/flashcards/estudar', name: 'flashcard-study', component: V('FlashcardStudyView'), meta: { title: 'Revisar flashcards', parent: 'flashcards', area: 'apps' } },
  { path: '/concurso', name: 'hub-concurso', component: V('HubView'), meta: { title: 'Meu Concurso', area: 'concurso', hub: 'concurso' } },
  { path: '/concurso/edital', name: 'edital', component: V('EditalView'), meta: { title: 'Edital', area: 'concurso' } },
  { path: '/concurso/ciclo', name: 'cycle', component: V('CicloView'), meta: { title: 'Ciclo de estudos', area: 'concurso' } },
  { path: '/concurso/estatisticas', name: 'concurso-stats', component: V('ConcursoStatsView'), meta: { title: 'Estatísticas do concurso', area: 'concurso' } },
  { path: '/concurso/revisao-assuntos', name: 'topic-review', component: V('TopicReviewView'), meta: { title: 'Revisão de assuntos', area: 'concurso' } },
  { path: '/estudos', name: 'studies', component: V('StudiesView'), meta: { title: 'Registrar estudo', area: 'concurso' } },
  { path: '/revisoes', name: 'reviews', component: V('ReviewsView'), meta: { title: 'Revisões', area: 'concurso' } },
  { path: '/revisoes/:id', name: 'review', component: V('ReviewSessionView'), meta: { title: 'Revisão', parent: 'reviews', area: 'concurso' } },
  { path: '/caderno', name: 'notebook', component: V('NotebookView'), meta: { title: 'Caderno de erros', area: 'concurso' } },
  { path: '/simulados', name: 'mocks', component: V('SimuladosView'), meta: { title: 'Desempenho · Simulados', area: 'concurso' } },
  { path: '/simulados/novo', name: 'mock-new', component: V('MockExamFormView'), meta: { title: 'Novo simulado', parent: 'mocks', area: 'concurso' } },
  { path: '/simulados/:id/editar', name: 'mock-edit', component: V('MockExamFormView'), meta: { title: 'Editar simulado', parent: 'mocks', area: 'concurso' } },
  { path: '/estatisticas', name: 'stats', component: V('StatsView'), meta: { title: 'Estatísticas detalhadas', parent: 'concurso-stats', area: 'concurso' } },
  { path: '/ajustes', name: 'settings', component: V('SettingsView'), meta: { title: 'Ajustes', area: 'settings' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
router.afterEach((to) => { document.title = `${to.meta.title ?? ''} · Revisões` })
