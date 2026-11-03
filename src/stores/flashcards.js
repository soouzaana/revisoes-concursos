import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, getOne, putOne, removeOne } from '../database/repository'
import { uid } from '../utils/id'
import { hasErrors, validateFlashcard } from '../utils/validators'
import { isDue, isMastered, newCardFields } from '../services/flashcardEngine'
import { reviewFlashcard } from '../services/flashcardService'
import { useClockStore } from './clock'
import { useReviewsStore } from './reviews'

export const useFlashcardsStore = defineStore('flashcards', () => {
  const items = ref([])
  const clock = useClockStore()
  async function load() {
    items.value = (await getAll('flashcards')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  const due = computed(() => items.value.filter((c) => isDue(c, clock.today)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
  const masteredCount = computed(() => items.value.filter(isMastered).length)

  async function save(form) {
    const errors = validateFlashcard(form)
    if (hasErrors(errors)) throw Object.assign(new Error('Formulário inválido'), { errors })
    const base = { subjectId: form.subjectId, topic: form.topic.trim(), front: form.front.trim(), back: form.back.trim() }
    if (form.id) {
      const prev = await getOne('flashcards', form.id)
      await putOne('flashcards', { ...prev, ...base })
    } else {
      await putOne('flashcards', { id: uid(), ...base, createdAt: new Date().toISOString(), ...newCardFields(clock.today) })
    }
    await load()
  }
  async function remove(id) { await removeOne('flashcards', id); await load(); await useReviewsStore().load() }
  async function review(id, correct) {
    const card = await reviewFlashcard(id, correct, clock.today)
    await load(); await useReviewsStore().load()
    return card
  }
  const topicsFor = (subjectId) => [...new Set(items.value.filter((c) => c.subjectId === subjectId).map((c) => c.topic))]
  return { items, due, masteredCount, load, save, remove, review, topicsFor }
})
