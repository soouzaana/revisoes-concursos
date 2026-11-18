import { defineStore } from 'pinia'
import { computed } from 'vue'
import { topicKey } from '../utils/text'
import { listTopics, makeScope, withTopicActive } from '../services/activityScope'
import { useSubjectsStore } from './subjects'
import { useSettingsStore } from './settings'
import { useStudiesStore } from './studies'
import { useQuestionsStore } from './questions'
import { useFlashcardsStore } from './flashcards'

/** Quais matérias/assuntos participam das revisões automáticas (dados nunca são apagados). */
export const useActivityStore = defineStore('activity', () => {
  const subjects = useSubjectsStore(), settings = useSettingsStore()
  const scope = computed(() => makeScope(subjects.items, settings.inactiveTopics))

  /** Assuntos da matéria (estudos + questões + flashcards) com o estado ativo/inativo. Stores lidas sob demanda. */
  function topicsOf(subjectId) {
    const data = { studies: useStudiesStore().items, questions: useQuestionsStore().items, flashcards: useFlashcardsStore().items }
    return listTopics(subjectId, data).map((t) => ({ ...t, active: scope.value.isTopicActive(subjectId, t.topic) }))
  }
  const setSubjectActive = (id, active) => subjects.setActive(id, active)
  const setTopicActive = (subjectId, topic, active) =>
    settings.setInactiveTopics(withTopicActive(settings.inactiveTopics, topicKey(subjectId, topic), active))
  async function setAllTopics(subjectId, active) {
    let keys = settings.inactiveTopics
    for (const t of topicsOf(subjectId)) keys = withTopicActive(keys, t.key, active)
    await settings.setInactiveTopics(keys)
  }
  /** Quantos assuntos de matérias ativas estão desativados (para resumos). */
  const inactiveTopicCount = computed(() => {
    const active = new Set(subjects.activeItems.map((s) => s.id))
    return settings.inactiveTopics.filter((k) => active.has(k.split('|')[0])).length
  })
  return { scope, topicsOf, setSubjectActive, setTopicActive, setAllTopics, inactiveTopicCount }
})
