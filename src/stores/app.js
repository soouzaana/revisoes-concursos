import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSubjectsStore } from './subjects'
import { useStudiesStore } from './studies'
import { useQuestionsStore } from './questions'
import { useFlashcardsStore } from './flashcards'
import { useReviewsStore } from './reviews'
import { useSettingsStore } from './settings'
import { useClockStore } from './clock'

export const useAppStore = defineStore('app', () => {
  const ready = ref(false)
  const error = ref('')

  async function loadAll() {
    await Promise.all([useSubjectsStore().load(), useStudiesStore().load(), useQuestionsStore().load(), useFlashcardsStore().load(), useSettingsStore().load()])
    await useReviewsStore().sync()
  }
  async function init() {
    try {
      await loadAll()
      ready.value = true
    } catch (e) {
      console.error(e)
      error.value = 'Não foi possível abrir o banco de dados do navegador. Verifique se o modo privado está desativado e se há espaço de armazenamento.'
    }
  }
  /** Chamado ao voltar para o app: detecta virada de dia e libera novas revisões. */
  async function onResume() {
    if (!ready.value) return
    if (useClockStore().refresh()) await useReviewsStore().sync()
  }
  return { ready, error, init, loadAll, onResume }
})
