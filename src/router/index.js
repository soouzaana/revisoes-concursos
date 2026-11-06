import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/DashboardView.vue'), meta: { title: 'Início' } },
  { path: '/estudos', name: 'studies', component: () => import('../views/StudiesView.vue'), meta: { title: 'Registrar estudo' } },
  { path: '/revisoes', name: 'reviews', component: () => import('../views/ReviewsView.vue'), meta: { title: 'Revisões' } },
  { path: '/revisoes/:id', name: 'review', component: () => import('../views/ReviewSessionView.vue'), meta: { title: 'Revisão', parent: 'reviews' } },
  { path: '/caderno', name: 'notebook', component: () => import('../views/NotebookView.vue'), meta: { title: 'Caderno de erros' } },
  { path: '/flashcards', name: 'flashcards', component: () => import('../views/FlashcardsView.vue'), meta: { title: 'Flashcards' } },
  { path: '/flashcards/livre', name: 'flashcard-free', component: () => import('../views/FlashcardFreeView.vue'), meta: { title: 'Estudar flashcards', parent: 'flashcards' } },
  { path: '/flashcards/estudar', name: 'flashcard-study', component: () => import('../views/FlashcardStudyView.vue'), meta: { title: 'Revisar flashcards', parent: 'flashcards' } },
  { path: '/estatisticas', name: 'stats', component: () => import('../views/StatsView.vue'), meta: { title: 'Estatísticas' } },
  { path: '/ajustes', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Ajustes' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
router.afterEach((to) => { document.title = `${to.meta.title ?? ''} · Revisões` })
