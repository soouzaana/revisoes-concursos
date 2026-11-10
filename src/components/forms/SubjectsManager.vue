<script setup>
import { reactive, ref } from 'vue'
import { Pencil, Trash2, Plus } from 'lucide-vue-next'
import { SUBJECT_COLORS, SUGGESTED_SUBJECTS, useSubjectsStore } from '../../stores/subjects'
import { useToast } from '../../composables/useToast'
import { useConfirm } from '../../composables/useConfirm'
import { norm } from '../../utils/text'
import BaseModal from '../ui/BaseModal.vue'

const subjects = useSubjectsStore(), toast = useToast(), confirm = useConfirm()
const name = ref(''), err = ref('')
const edit = reactive({ open: false, id: '', name: '', color: '', err: '' })

async function add(n = name.value) {
  try { await subjects.add(n); name.value = ''; err.value = ''; toast.ok('Matéria adicionada') } catch (e) { err.value = e.message }
}
const suggestions = () => SUGGESTED_SUBJECTS.filter((s) => !subjects.items.some((x) => norm(x.name) === norm(s)))
function openEdit(s) { Object.assign(edit, { open: true, id: s.id, name: s.name, color: s.color, err: '' }) }
async function saveEdit() {
  try { await subjects.update(edit.id, edit.name, edit.color); edit.open = false; toast.ok('Matéria atualizada') } catch (e) { edit.err = e.message }
}
async function del(s) {
  if (!(await confirm({ title: 'Excluir matéria', message: `Excluir "${s.name}"?`, confirmLabel: 'Excluir', danger: true }))) return
  const r = await subjects.remove(s.id)
  if (r.ok) toast.ok('Matéria excluída')
  else toast.error(`"${s.name}" tem ${r.usage.studies} estudo(s), ${r.usage.questions} questão(ões), ${r.usage.flashcards} cartão(ões) e ${r.usage.mockExams} simulado(s). Remova ou mova esses registros antes de excluir.`)
}
</script>
<template>
  <div>
    <form class="flex gap-2" novalidate @submit.prevent="add()">
      <input v-model="name" class="field" :class="{ 'field-error': err }" placeholder="Nova matéria (ex.: Informática)" aria-label="Nome da nova matéria" />
      <button class="btn-primary shrink-0" type="submit"><Plus :size="16" /> Adicionar</button>
    </form>
    <p v-if="err" class="hint-error">{{ err }}</p>
    <div v-if="suggestions().length" class="mt-3 flex flex-wrap gap-2">
      <button v-for="s in suggestions()" :key="s" class="rounded-full border border-dashed border-line px-3 py-1 text-xs font-semibold text-mute transition hover:border-accent hover:text-accent" @click="add(s)">+ {{ s }}</button>
    </div>
    <ul v-if="subjects.items.length" class="mt-4 divide-y divide-line rounded-xl border border-line">
      <li v-for="s in subjects.items" :key="s.id" class="flex items-center gap-3 px-4 py-2.5">
        <span class="h-3 w-3 rounded-full" :style="{ background: s.color }" />
        <span class="flex-1 truncate text-sm font-medium">{{ s.name }}</span>
        <button class="btn-ghost btn-sm !p-2" :aria-label="'Editar ' + s.name" @click="openEdit(s)"><Pencil :size="15" /></button>
        <button class="btn-ghost btn-sm !p-2" :aria-label="'Excluir ' + s.name" @click="del(s)"><Trash2 :size="15" /></button>
      </li>
    </ul>
    <BaseModal :open="edit.open" title="Editar matéria" @close="edit.open = false">
      <form id="subj-edit" novalidate @submit.prevent="saveEdit">
        <label class="label" for="sub-name">Nome</label>
        <input id="sub-name" v-model="edit.name" class="field" :class="{ 'field-error': edit.err }" />
        <p v-if="edit.err" class="hint-error">{{ edit.err }}</p>
        <span class="label mt-4">Cor</span>
        <div class="flex flex-wrap gap-2">
          <button v-for="c in SUBJECT_COLORS" :key="c" type="button" class="h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition" :class="edit.color === c ? 'ring-2 ring-ink' : ''" :style="{ background: c }" :aria-label="'Cor ' + c" @click="edit.color = c" />
        </div>
      </form>
      <template #footer><button class="btn-line" @click="edit.open = false">Cancelar</button><button class="btn-primary" form="subj-edit" type="submit">Salvar</button></template>
    </BaseModal>
  </div>
</template>
