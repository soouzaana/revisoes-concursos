<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, Trash2 } from 'lucide-vue-next'
import { useMocksStore } from '../stores/mocks'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { distinctValues, fmtPct, normalizeEntry, pct, sumEntries, validateMockExam } from '../services/mockEngine'
import { formatDate, relativeDay } from '../utils/date'
import SubjectSelect from '../components/forms/SubjectSelect.vue'

const route = useRoute(), router = useRouter(), mocks = useMocksStore(), clock = useClockStore(), toast = useToast()
const editId = route.params.id || null
const existing = editId ? mocks.byId[editId] : null

const blankRow = () => ({ subjectId: '', total: '', correct: '', wrong: '', blank: '' })
const form = reactive(existing
  ? { name: existing.name, date: existing.date, contest: existing.contest, board: existing.board, notes: existing.notes,
      subjects: existing.subjects.map((s) => ({ subjectId: s.subjectId, total: String(s.total), correct: String(s.correct), wrong: String(s.wrong), blank: s.blank ? String(s.blank) : '' })) }
  : { name: `Simulado ${String(mocks.items.length + 1).padStart(2, '0')}`, date: clock.today, contest: '', board: '', notes: '', subjects: [blankRow()] })
const errors = ref({})
const saving = ref(false)

const contests = computed(() => distinctValues(mocks.items, 'contest'))
const boards = computed(() => distinctValues(mocks.items, 'board'))

// Resumo ao vivo (somente linhas válidas) e em branco calculado automaticamente.
const live = (r) => { const n = normalizeEntry(r); return n.ok ? n.value : null }
const totals = computed(() => sumEntries(form.subjects.map(live).filter(Boolean)))
const hint = computed(() => {
  const s = mocks.schedule
  if (editId || s.status === 'none' || !form.date) return ''
  const d = form.date < s.nextDate ? `antes da data sugerida (${formatDate(s.nextDate)})` : form.date > s.nextDate ? `depois da data sugerida (${formatDate(s.nextDate)})` : 'na data sugerida'
  return `Sem problema: simulados podem ser cadastrados quando você quiser. Este está ${d}.`
})

const add = () => form.subjects.push(blankRow())
const del = (i) => { form.subjects.splice(i, 1); if (errors.value.rows) errors.value.rows.splice(i, 1) }
const rowErr = (i, k) => errors.value.rows?.[i]?.[k]

async function submit() {
  const { errors: e } = validateMockExam(form, clock.today)
  errors.value = e
  if (Object.keys(e).length) { toast.error('Revise os campos destacados.'); return }
  saving.value = true
  try {
    await mocks.save(form, editId)
    toast.ok(editId ? 'Simulado atualizado — estatísticas recalculadas' : 'Simulado cadastrado')
    router.push('/simulados')
  } catch (err) {
    if (err.errors) errors.value = err.errors; else toast.error('Não foi possível salvar: ' + err.message)
  } finally { saving.value = false }
}
</script>

<template>
  <button class="btn-ghost btn-sm mb-3 -ml-2" @click="router.back()"><ArrowLeft :size="16" /> Simulados</button>
  <header class="mb-5"><h1 class="font-display text-2xl font-extrabold sm:text-3xl">{{ editId ? 'Editar simulado' : 'Novo simulado' }}</h1>
    <p class="mt-1 text-sm text-mute">Registre só os resultados — sem enunciados nem alternativas.</p></header>

  <p v-if="editId && !existing" class="panel p-5 text-sm text-danger">Simulado não encontrado.</p>
  <form v-else class="space-y-5" novalidate @submit.prevent="submit">
    <section class="panel space-y-4 p-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="mx-name">Nome do simulado</label><input id="mx-name" v-model="form.name" class="field" :class="{ 'field-error': errors.name }" placeholder="Ex.: Simulado PCRO" /><p v-if="errors.name" class="hint-error">{{ errors.name }}</p></div>
        <div><label class="label" for="mx-date">Data de realização</label><input id="mx-date" v-model="form.date" type="date" :max="clock.today" class="field" :class="{ 'field-error': errors.date }" /><p v-if="errors.date" class="hint-error">{{ errors.date }}</p></div>
        <div><label class="label" for="mx-contest">Concurso <span class="font-normal text-mute">(opcional)</span></label><input id="mx-contest" v-model="form.contest" list="mx-contests" class="field" placeholder="Ex.: PCRO" /><datalist id="mx-contests"><option v-for="c in contests" :key="c" :value="c" /></datalist></div>
        <div><label class="label" for="mx-board">Instituição / banca <span class="font-normal text-mute">(opcional)</span></label><input id="mx-board" v-model="form.board" list="mx-boards" class="field" placeholder="Ex.: IBADE" /><datalist id="mx-boards"><option v-for="b in boards" :key="b" :value="b" /></datalist></div>
      </div>
      <div><label class="label" for="mx-notes">Observações <span class="font-normal text-mute">(opcional)</span></label><textarea id="mx-notes" v-model="form.notes" rows="2" class="field" /></div>
      <p v-if="hint" class="rounded-xl bg-sunken px-3 py-2 text-xs text-mute">{{ hint }}</p>
    </section>

    <section>
      <h2 class="mb-2 font-display text-lg font-bold">Matérias</h2>
      <p v-if="errors.subjects" class="hint-error mb-2">{{ errors.subjects }}</p>
      <div class="space-y-3">
        <div v-for="(r, i) in form.subjects" :key="i" class="panel p-4" data-testid="mock-row">
          <div class="mb-3 flex items-start gap-2">
            <div class="min-w-0 flex-1"><SubjectSelect v-model="r.subjectId" :error="rowErr(i, 'subjectId')" /></div>
            <button type="button" class="btn-ghost btn-sm !p-2.5 text-danger" :aria-label="`Remover matéria ${i + 1}`" :disabled="form.subjects.length === 1" @click="del(i)"><Trash2 :size="17" /></button>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <div v-for="f in [['total', 'Total'], ['correct', 'Acertos'], ['wrong', 'Erros'], ['blank', 'Branco']]" :key="f[0]">
              <label class="label !mb-1 text-xs" :for="`mx-${i}-${f[0]}`">{{ f[1] }}</label>
              <input :id="`mx-${i}-${f[0]}`" v-model="r[f[0]]" type="number" inputmode="numeric" min="0" step="1" class="field !px-2 text-center" :class="{ 'field-error': rowErr(i, f[0]) }" :placeholder="f[0] === 'blank' ? 'auto' : '0'" />
            </div>
          </div>
          <template v-for="k in ['total', 'correct', 'wrong', 'blank']" :key="k"><p v-if="rowErr(i, k)" class="hint-error">{{ rowErr(i, k) }}</p></template>
          <p v-if="live(r)" class="mt-2 text-xs text-mute">Aproveitamento: <b class="text-ink">{{ fmtPct(pct(live(r).correct, live(r).total)) }}</b> · em branco: <b class="text-ink">{{ live(r).blank }}</b><span v-if="r.blank === ''"> (calculado)</span></p>
        </div>
      </div>
      <button type="button" class="btn-line mt-3" @click="add"><Plus :size="16" /> Adicionar matéria</button>
    </section>

    <section class="panel grid grid-cols-2 gap-3 p-5 text-center sm:grid-cols-5">
      <div><p class="font-display text-xl font-extrabold">{{ totals.total }}</p><p class="text-xs text-mute">Questões</p></div>
      <div><p class="font-display text-xl font-extrabold text-ok">{{ totals.correct }}</p><p class="text-xs text-mute">Acertos</p></div>
      <div><p class="font-display text-xl font-extrabold text-danger">{{ totals.wrong }}</p><p class="text-xs text-mute">Erros</p></div>
      <div><p class="font-display text-xl font-extrabold">{{ totals.blank }}</p><p class="text-xs text-mute">Em branco</p></div>
      <div class="col-span-2 sm:col-span-1"><p class="font-display text-xl font-extrabold text-accent">{{ fmtPct(totals.pct) }}</p><p class="text-xs text-mute">Aproveitamento</p></div>
    </section>

    <div class="flex justify-end gap-2">
      <button type="button" class="btn-line" @click="router.back()">Cancelar</button>
      <button type="submit" class="btn-primary" :disabled="saving">{{ editId ? 'Salvar alterações' : 'Cadastrar simulado' }}</button>
    </div>
  </form>
</template>
