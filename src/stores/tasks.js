import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, putOne, removeOne } from '../database/repository'
import { withTx } from '../database/db'
import { uid } from '../utils/id'
import { plain } from '../utils/plain'
import { useClockStore } from './clock'
import { isOverdue, nextDue } from '../services/taskEngine'

export const useTasksStore = defineStore('tasks', () => {
  const items = ref([])
  const clock = useClockStore()
  async function load() { items.value = await getAll('tasks') }
  const pending = computed(() => items.value.filter((t) => t.status !== 'done'))
  const overdue = computed(() => items.value.filter((t) => isOverdue(t, clock.today)))
  const categories = computed(() => [...new Set(items.value.map((t) => t.category).filter(Boolean))].sort())

  async function save(form, id = null) {
    const title = (form.title || '').trim()
    if (!title) throw Object.assign(new Error('Informe o título.'), { errors: { title: 'Informe o título da tarefa.' } })
    const prev = id ? items.value.find((t) => t.id === id) : null
    const t = {
      ...(prev ? plain(prev) : { status: 'pending', completedAt: null }),
      id: prev?.id ?? uid(), title, description: (form.description || '').trim(), dueDate: form.dueDate || '',
      priority: form.priority || 'medium', category: (form.category || '').trim(), recurrence: form.recurrence || 'none',
      createdAt: prev?.createdAt ?? new Date().toISOString()
    }
    await putOne('tasks', t); await load(); return t
  }
  /** Conclui/reabre. Concluir tarefa recorrente cria a próxima ocorrência (uma única vez). */
  async function toggle(id) {
    const t = items.value.find((x) => x.id === id); if (!t) return
    if (t.status === 'done') {
      await putOne('tasks', { ...plain(t), status: 'pending', completedAt: null })
    } else {
      const next = t.spawned ? null : nextDue(t.dueDate, t.recurrence)
      await withTx(['tasks'], 'readwrite', async (st) => {
        await st.tasks.put({ ...plain(t), status: 'done', completedAt: new Date().toISOString(), spawned: !!next || !!t.spawned })
        // próxima ocorrência criada uma única vez (flag `spawned`), mesmo se reabrir/concluir de novo
        if (next) await st.tasks.put({ ...plain(t), id: uid(), status: 'pending', completedAt: null, dueDate: next, createdAt: new Date().toISOString(), spawned: false })
      })
    }
    await load()
  }
  async function remove(id) { await removeOne('tasks', id); await load() }
  return { items, pending, overdue, categories, load, save, toggle, remove }
})
