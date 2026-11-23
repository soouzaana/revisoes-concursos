import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll, putOne, removeOne } from '../database/repository'
import { uid } from '../utils/id'
import { plain } from '../utils/plain'
import { isValidDateStr } from '../utils/date'

/** Eventos e compromissos do calendário (cadastro manual). */
export const useEventsStore = defineStore('events', () => {
  const items = ref([])
  async function load() { items.value = (await getAll('events')).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')) }
  async function save(form, id = null) {
    const errors = {}
    if (!(form.title || '').trim()) errors.title = 'Informe o título.'
    if (!isValidDateStr(form.date)) errors.date = 'Informe uma data válida.'
    if (Object.keys(errors).length) throw Object.assign(new Error('Formulário inválido'), { errors })
    const prev = id ? items.value.find((e) => e.id === id) : null
    const ev = { ...(prev ? plain(prev) : {}), id: prev?.id ?? uid(), title: form.title.trim(), date: form.date, time: form.time || '', notes: (form.notes || '').trim(), createdAt: prev?.createdAt ?? new Date().toISOString() }
    await putOne('events', ev); await load(); return ev
  }
  async function remove(id) { await removeOne('events', id); await load() }
  return { items, load, save, remove }
})
