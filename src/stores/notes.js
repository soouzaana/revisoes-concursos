import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAll, putOne, removeOne } from '../database/repository'
import { uid } from '../utils/id'
import { plain } from '../utils/plain'
import { norm } from '../utils/text'

export const useNotesStore = defineStore('notes', () => {
  const items = ref([])
  async function load() { items.value = (await getAll('notes')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
  const folders = computed(() => [...new Set(items.value.map((n) => n.folder).filter(Boolean))].sort())
  const tags = computed(() => [...new Set(items.value.flatMap((n) => n.tags || []))].sort())

  async function save(form, id = null) {
    const title = (form.title || '').trim(), content = (form.content || '').trim()
    if (!title && !content) throw Object.assign(new Error('Escreva um título ou conteúdo.'), { errors: { title: 'Escreva um título ou conteúdo.' } })
    const prev = id ? items.value.find((n) => n.id === id) : null
    const now = new Date().toISOString()
    const tags = [...new Set((Array.isArray(form.tags) ? form.tags : String(form.tags || '').split(',')).map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]
    const n = { ...(prev ? plain(prev) : {}), id: prev?.id ?? uid(), title, content, folder: (form.folder || '').trim(), tags, favorite: !!form.favorite, subjectId: form.subjectId || '', topic: (form.topic || '').trim(), createdAt: prev?.createdAt ?? now, updatedAt: now }
    await putOne('notes', n); await load(); return n
  }
  async function toggleFavorite(id) {
    const n = items.value.find((x) => x.id === id); if (!n) return
    await putOne('notes', { ...plain(n), favorite: !n.favorite }); await load() // favoritar não altera "atualizado em"
  }
  async function remove(id) { await removeOne('notes', id); await load() }
  const search = (q) => { const k = norm(q); return k ? items.value.filter((n) => norm(`${n.title} ${n.content} ${(n.tags || []).join(' ')} ${n.folder}`).includes(k)) : items.value }
  return { items, folders, tags, load, save, toggleFavorite, remove, search }
})
