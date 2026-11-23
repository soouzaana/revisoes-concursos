<script setup>
import { computed, reactive, ref } from 'vue'
import { Plus, Search, Star, Trash2, Pencil, FolderOpen } from 'lucide-vue-next'
import { useNotesStore } from '../stores/notes'
import { useSubjectsStore } from '../stores/subjects'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { norm } from '../utils/text'
import { localDate } from '../services/activityEngine'
import { formatDate } from '../utils/date'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'

const notes = useNotesStore(), subjects = useSubjectsStore(), toast = useToast(), confirm = useConfirm()
const q = ref(''), folder = ref(''), tag = ref(''), subject = ref(''), onlyFav = ref(false)
const open = ref(false), editing = ref(null), err = ref('')
const blank = () => ({ title: '', content: '', folder: '', tags: '', subjectId: '', topic: '', favorite: false })
const form = reactive(blank())

const list = computed(() => notes.search(q.value)
  .filter((n) => !folder.value || n.folder === folder.value)
  .filter((n) => !tag.value || (n.tags || []).includes(tag.value))
  .filter((n) => !subject.value || n.subjectId === subject.value)
  .filter((n) => !onlyFav.value || n.favorite)
  .sort((a, b) => (b.favorite - a.favorite) || b.updatedAt.localeCompare(a.updatedAt)))

function openNew() { editing.value = null; Object.assign(form, blank()); err.value = ''; open.value = true }
function openEdit(n) { editing.value = n.id; Object.assign(form, { ...blank(), ...n, tags: (n.tags || []).join(', ') }); err.value = ''; open.value = true }
async function submit() { try { await notes.save({ ...form }, editing.value); open.value = false; toast.ok('Anotação salva') } catch (e) { err.value = e.message } }
async function del(n) { if (await confirm({ title: 'Excluir anotação', message: `Excluir "${n.title || 'Sem título'}"?`, confirmLabel: 'Excluir', danger: true })) { await notes.remove(n.id); toast.ok('Anotação excluída') } }
</script>

<template>
  <PageHeader title="Anotações" subtitle="Notas com pastas, tags e vínculo com matérias e assuntos.">
    <button class="btn-primary" data-testid="new-note" @click="openNew"><Plus :size="18" /> Nova anotação</button>
  </PageHeader>

  <div class="mb-4 space-y-2">
    <div class="relative"><Search :size="16" class="pointer-events-none absolute left-3.5 top-3.5 text-mute" /><input v-model="q" type="search" class="field !pl-10" placeholder="Pesquisar em títulos, conteúdo e tags" aria-label="Pesquisar anotações" /></div>
    <div class="flex flex-wrap items-center gap-2">
      <select v-model="folder" class="field !w-auto !py-1.5 text-xs" aria-label="Pasta"><option value="">Todas as pastas</option><option v-for="f in notes.folders" :key="f" :value="f">{{ f }}</option></select>
      <select v-model="tag" class="field !w-auto !py-1.5 text-xs" aria-label="Tag"><option value="">Todas as tags</option><option v-for="t in notes.tags" :key="t" :value="t">#{{ t }}</option></select>
      <select v-model="subject" class="field !w-auto !py-1.5 text-xs" aria-label="Matéria"><option value="">Todas as matérias</option><option v-for="s in subjects.items" :key="s.id" :value="s.id">{{ s.name }}</option></select>
      <button class="btn-sm rounded-full px-3 py-1.5 text-xs font-semibold" :class="onlyFav ? 'bg-accent text-accent-fg' : 'bg-sunken text-mute'" :aria-pressed="onlyFav" @click="onlyFav = !onlyFav"><Star :size="12" class="mr-1 inline" />Favoritas</button>
    </div>
  </div>

  <EmptyState v-if="!list.length" :title="notes.items.length ? 'Nada encontrado' : 'Nenhuma anotação ainda'" :text="notes.items.length ? 'Ajuste a pesquisa ou os filtros.' : 'Registre resumos, macetes e lembretes.'" />
  <ul v-else class="grid gap-3 sm:grid-cols-2">
    <li v-for="n in list" :key="n.id" class="panel flex flex-col p-4" data-testid="note-item">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-display font-bold">{{ n.title || 'Sem título' }}</h3>
        <button class="shrink-0" :class="n.favorite ? 'text-warn' : 'text-mute'" :aria-label="n.favorite ? 'Remover dos favoritos' : 'Favoritar'" :aria-pressed="n.favorite" @click="notes.toggleFavorite(n.id)"><Star :size="18" :fill="n.favorite ? 'currentColor' : 'none'" /></button>
      </div>
      <p class="mt-1 line-clamp-4 whitespace-pre-line text-sm text-mute">{{ n.content }}</p>
      <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
        <span v-if="n.folder" class="pill bg-sunken text-mute"><FolderOpen :size="11" />{{ n.folder }}</span>
        <span v-if="n.subjectId" class="pill bg-accent-soft text-accent">{{ subjects.nameOf(n.subjectId) }}{{ n.topic ? ' · ' + n.topic : '' }}</span>
        <button v-for="t in n.tags" :key="t" class="pill bg-sunken text-mute" @click="tag = t">#{{ t }}</button>
      </div>
      <div class="mt-auto flex items-center justify-between pt-3 text-xs text-mute">
        <span>Criada {{ formatDate(localDate(n.createdAt)) }}<template v-if="localDate(n.updatedAt) !== localDate(n.createdAt)"> · atualizada {{ formatDate(localDate(n.updatedAt)) }}</template></span>
        <span class="flex"><button class="btn-ghost btn-sm !p-1.5" aria-label="Editar anotação" @click="openEdit(n)"><Pencil :size="14" /></button><button class="btn-ghost btn-sm !p-1.5 text-danger" aria-label="Excluir anotação" @click="del(n)"><Trash2 :size="14" /></button></span>
      </div>
    </li>
  </ul>

  <BaseModal :open="open" wide :title="editing ? 'Editar anotação' : 'Nova anotação'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div><label class="label" for="nt-title">Título</label><input id="nt-title" v-model="form.title" class="field" autofocus /></div>
      <div><label class="label" for="nt-content">Conteúdo</label><textarea id="nt-content" v-model="form.content" rows="8" class="field" /></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="nt-folder">Pasta / categoria</label><input id="nt-folder" v-model="form.folder" list="nt-folders" class="field" placeholder="Ex.: Resumos" /><datalist id="nt-folders"><option v-for="f in notes.folders" :key="f" :value="f" /></datalist></div>
        <div><label class="label" for="nt-tags">Tags <span class="font-normal text-mute">(separe por vírgula)</span></label><input id="nt-tags" v-model="form.tags" class="field" placeholder="lei, prazo" /></div>
        <div><label class="label" for="nt-subject">Matéria</label><select id="nt-subject" v-model="form.subjectId" class="field"><option value="">Sem matéria</option><option v-for="s in subjects.items" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <div><label class="label" for="nt-topic">Assunto</label><input id="nt-topic" v-model="form.topic" class="field" :disabled="!form.subjectId" /></div>
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.favorite" type="checkbox" class="h-4 w-4 accent-[rgb(var(--c-accent))]" /> Favorita</label>
      <p v-if="err" class="hint-error">{{ err }}</p>
      <button class="btn-primary w-full" type="submit">Salvar anotação</button>
    </form>
  </BaseModal>
</template>
