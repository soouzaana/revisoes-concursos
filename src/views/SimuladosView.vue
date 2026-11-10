<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Plus, Filter, FilterX, Pencil, Trash2, TrendingUp, TrendingDown, Minus, BellRing, CalendarClock, ArrowUp, ArrowDown } from 'lucide-vue-next'
import { useMocksStore } from '../stores/mocks'
import { useSubjectsStore } from '../stores/subjects'
import { useSettingsStore } from '../stores/settings'
import { useClockStore } from '../stores/clock'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import {
  comparePeriods, distinctValues, examTotals, filterExams, fmtDelta, fmtPct, monthlyAverages, overallSeries,
  restrictToSubject, seriesSummary, subjectRanking, subjectSeries, TREND_LABEL
} from '../services/mockEngine'
import { addDays, formatDate, formatDayMonth, formatMonthLabel } from '../utils/date'
import { plural } from '../utils/text'
import PageHeader from '../components/ui/PageHeader.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import ProgressBar from '../components/ui/ProgressBar.vue'
import LineChart from '../components/charts/LineChart.vue'
import HBarChart from '../components/charts/HBarChart.vue'

const router = useRouter(), mocks = useMocksStore(), subjects = useSubjectsStore(), settings = useSettingsStore(), clock = useClockStore()
const toast = useToast(), confirm = useConfirm()

const tab = ref('history')
const TABS = [['history', 'Histórico'], ['evolution', 'Evolução'], ['subjects', 'Matérias'], ['frequency', 'Frequência']]
const showFilters = ref(false)
const filters = reactive({ q: '', from: '', to: '', contest: '', board: '', ids: [] })
const hasFilters = computed(() => !!(filters.q || filters.from || filters.to || filters.contest || filters.board || filters.ids.length))
const clearFilters = () => Object.assign(filters, { q: '', from: '', to: '', contest: '', board: '', ids: [] })
const toggleId = (id) => { const i = filters.ids.indexOf(id); i >= 0 ? filters.ids.splice(i, 1) : filters.ids.push(id) }

const contests = computed(() => distinctValues(mocks.items, 'contest'))
const boards = computed(() => distinctValues(mocks.items, 'board'))
const filtered = computed(() => filterExams(mocks.items, filters))

// ---------- Histórico ----------
const sort = ref('recent')
const list = computed(() => {
  const rows = filtered.value.map((e) => ({ e, t: examTotals(e) }))
  const by = { recent: (a, b) => b.e.date.localeCompare(a.e.date) || (b.e.createdAt || '').localeCompare(a.e.createdAt || ''), oldest: (a, b) => a.e.date.localeCompare(b.e.date), best: (a, b) => b.t.pct - a.t.pct, worst: (a, b) => a.t.pct - b.t.pct }
  return rows.sort(by[sort.value])
})
const detail = ref(null)
const detailTotals = computed(() => (detail.value ? examTotals(detail.value) : null))
async function del(e) {
  if (!(await confirm({ title: 'Excluir simulado', message: `Excluir "${e.name}"? As estatísticas e gráficos serão recalculados.`, confirmLabel: 'Excluir', danger: true }))) return
  await mocks.remove(e.id); detail.value = null; toast.ok('Simulado excluído')
}
function edit(e) { detail.value = null; router.push(`/simulados/${e.id}/editar`) }

// ---------- Evolução geral ----------
const evoSubject = ref('')
const subjectsInData = computed(() => [...new Set(filtered.value.flatMap((e) => e.subjects.map((s) => s.subjectId)))]
  .map((id) => ({ id, name: subjects.nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
const evoExams = computed(() => restrictToSubject(filtered.value, evoSubject.value))
const series = computed(() => overallSeries(evoExams.value))
const sum = computed(() => seriesSummary(series.value))
const monthly = computed(() => monthlyAverages(evoExams.value))
const shortDate = (d) => formatDayMonth(d)
const pctPoints = computed(() => series.value.map((p) => ({ label: shortDate(p.date), value: p.pct, tip: `${p.name} · ${fmtPct(p.pct)} (${p.correct}/${p.total})` })))
const hitsPoints = computed(() => series.value.map((p) => ({ label: shortDate(p.date), value: p.correct, tip: `${p.name} · ${p.correct} acertos de ${p.total}` })))
const monthPoints = computed(() => monthly.value.map((m) => ({ label: formatMonthLabel(m.key), value: m.avg, tip: `${formatMonthLabel(m.key)} · média ${fmtPct(m.avg)} em ${plural(m.n, 'simulado', 'simulados')}` })))
const compareBars = computed(() => {
  const avg = sum.value.avg
  return series.value.map((p) => ({ label: p.name, value: p.pct, display: fmtPct(p.pct), sub: `${formatDate(p.date)} · ${p.correct}/${p.total} acertos`, tone: p.pct >= (avg ?? 0) ? 'ok' : 'warn' }))
})
watch(subjectsInData, (l) => { if (evoSubject.value && !l.some((s) => s.id === evoSubject.value)) evoSubject.value = '' })

// comparação de períodos (ignora o filtro de período global)
const pa = reactive({ from: addDays(clock.today, -89), to: clock.today })
const pb = reactive({ from: addDays(clock.today, -179), to: addDays(clock.today, -90) })
const cmp = computed(() => comparePeriods(filterExams(mocks.items, { ...filters, from: '', to: '' }), pa, pb))

// ---------- Por matéria ----------
const subjSel = ref('')
watch(subjectsInData, (l) => { if (!l.some((s) => s.id === subjSel.value)) subjSel.value = l[0]?.id || '' }, { immediate: true })
const sSeries = computed(() => subjectSeries(filtered.value, subjSel.value))
const sSum = computed(() => seriesSummary(sSeries.value))
const sPoints = computed(() => sSeries.value.map((p) => ({ label: shortDate(p.date), value: p.pct, tip: `${p.name} · ${p.correct}/${p.total} · ${fmtPct(p.pct)}` })))
const sRows = computed(() => sSeries.value.map((p, i, a) => ({ ...p, delta: i ? p.pct - a[i - 1].pct : null })))

const metric = ref('avg')
const METRICS = [['avg', 'Média'], ['best', 'Maior %'], ['worst', 'Menor %'], ['questions', 'Questões']]
const ranking = computed(() => {
  const r = subjectRanking(filtered.value)
  return [...r].sort((a, b) => b[metric.value] - a[metric.value])
})
const rankBars = computed(() => {
  const r = ranking.value
  const maxQ = Math.max(1, ...r.map((x) => x.questions))
  return r.map((x, i) => ({
    label: subjects.nameOf(x.subjectId), value: metric.value === 'questions' ? (x.questions / maxQ) * 100 : x[metric.value],
    display: metric.value === 'questions' ? String(x.questions) : fmtPct(x[metric.value]),
    sub: `Média ${fmtPct(x.avg)} · máx ${fmtPct(x.best)} · mín ${fmtPct(x.worst)} · ${plural(x.questions, 'questão', 'questões')} em ${plural(x.exams, 'simulado', 'simulados')}${x.stagnant ? ' · estagnada' : ''}`,
    tone: metric.value === 'questions' ? 'accent' : r.length < 2 ? 'accent' : i === 0 ? 'ok' : i === r.length - 1 ? 'danger' : i >= r.length - 2 && r.length > 3 ? 'warn' : 'accent'
  }))
})

const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus, insufficient: Minus }
const trendTone = { up: 'text-ok', down: 'text-danger', flat: 'text-mute', insufficient: 'text-mute' }

// ---------- Frequência ----------
const sch = computed(() => mocks.schedule)
const hist = computed(() => mocks.history)
const STATUS = { first: ['Primeiro registro', 'bg-sunken text-mute'], on_time: ['No prazo', 'bg-ok-soft text-ok'], early: ['Adiantado', 'bg-ok-soft text-ok'], late: ['Atrasado', 'bg-warn-soft text-warn'] }
</script>

<template>
  <PageHeader title="Simulados" subtitle="Registre resultados e acompanhe sua evolução, no geral e por matéria.">
    <RouterLink to="/simulados/novo" class="btn-primary"><Plus :size="17" /> Novo simulado</RouterLink>
  </PageHeader>

  <!-- Lembrete da frequência sugerida (apenas visual; nunca bloqueia cadastros) -->
  <div v-if="mocks.reminderActive" class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/60 bg-warn-soft p-4 text-warn" role="status">
    <p class="flex items-center gap-2 text-sm font-semibold"><BellRing :size="18" />{{ sch.status === 'due' ? 'Hoje é a data sugerida para um novo simulado.' : `Novo simulado sugerido desde ${formatDate(sch.nextDate)} (${plural(sch.overdueDays, 'dia', 'dias')} de atraso).` }}</p>
    <RouterLink to="/simulados/novo" class="btn-primary btn-sm">Cadastrar simulado</RouterLink>
  </div>

  <EmptyState v-if="!mocks.items.length" title="Nenhum simulado cadastrado" text="Cadastre o resultado do seu primeiro simulado. Os gráficos de evolução aparecem a partir daí.">
    <RouterLink to="/simulados/novo" class="btn-primary"><Plus :size="17" /> Cadastrar simulado</RouterLink>
  </EmptyState>

  <template v-else>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-2 text-sm" role="tablist">
        <button v-for="t in TABS" :key="t[0]" role="tab" :aria-selected="tab === t[0]" class="pill !px-3.5 !py-1.5" :class="tab === t[0] ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="tab = t[0]">{{ t[1] }}</button>
      </div>
      <button v-if="tab !== 'frequency'" class="btn-ghost btn-sm ml-auto" :class="hasFilters ? 'text-accent' : ''" @click="showFilters = !showFilters"><Filter :size="15" /> Filtros<span v-if="hasFilters" class="rounded-full bg-accent px-1.5 text-xs text-accent-fg">●</span></button>
    </div>

    <section v-if="showFilters && tab !== 'frequency'" class="panel mb-5 space-y-3 p-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label" for="sf-q">Nome</label><input id="sf-q" v-model="filters.q" type="search" class="field" placeholder="Buscar pelo nome" /></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="label" for="sf-from">De</label><input id="sf-from" v-model="filters.from" type="date" class="field" /></div><div><label class="label" for="sf-to">Até</label><input id="sf-to" v-model="filters.to" type="date" class="field" /></div></div>
        <div><label class="label" for="sf-contest">Concurso</label><select id="sf-contest" v-model="filters.contest" class="field"><option value="">Todos</option><option v-for="c in contests" :key="c" :value="c">{{ c }}</option></select></div>
        <div><label class="label" for="sf-board">Banca</label><select id="sf-board" v-model="filters.board" class="field"><option value="">Todas</option><option v-for="b in boards" :key="b" :value="b">{{ b }}</option></select></div>
      </div>
      <div>
        <p class="label">Simulados específicos <span class="font-normal text-mute">(nenhum marcado = todos)</span></p>
        <div class="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          <button v-for="e in mocks.sorted" :key="e.id" class="pill !px-3 !py-1.5 transition" :class="filters.ids.includes(e.id) ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink'" :aria-pressed="filters.ids.includes(e.id)" @click="toggleId(e.id)">{{ e.name }}</button>
        </div>
      </div>
      <button v-if="hasFilters" class="btn-ghost btn-sm" @click="clearFilters"><FilterX :size="15" /> Limpar filtros</button>
    </section>

    <p v-if="tab !== 'frequency' && !filtered.length" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-mute">Nenhum simulado atende aos filtros. <button class="font-semibold text-accent" @click="clearFilters">Limpar filtros</button></p>

    <!-- ================= HISTÓRICO ================= -->
    <template v-else-if="tab === 'history'">
      <div class="mb-3 flex items-center justify-between text-sm"><span class="text-mute">{{ plural(list.length, 'simulado', 'simulados') }}</span>
        <select v-model="sort" class="field !w-auto !py-1.5 text-sm" aria-label="Ordenar"><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="best">Maior aproveitamento</option><option value="worst">Menor aproveitamento</option></select></div>
      <ul class="panel divide-y divide-line overflow-hidden">
        <li v-for="r in list" :key="r.e.id">
          <button class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-sunken" data-testid="mock-item" @click="detail = r.e">
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ r.e.name }}</span>
              <span class="block truncate text-xs text-mute">{{ formatDate(r.e.date) }} · {{ plural(r.t.total, 'questão', 'questões') }} · {{ r.t.correct }} acertos<template v-if="r.e.contest || r.e.board"> · {{ [r.e.contest, r.e.board].filter(Boolean).join(' · ') }}</template></span></span>
            <span class="font-display text-xl font-extrabold text-accent">{{ fmtPct(r.t.pct) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <!-- ================= EVOLUÇÃO GERAL ================= -->
    <template v-else-if="tab === 'evolution'">
      <div class="mb-4"><label class="label" for="evo-subj">Analisar</label>
        <select id="evo-subj" v-model="evoSubject" class="field sm:max-w-xs"><option value="">Todas as matérias (geral)</option><option v-for="s in subjectsInData" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>

      <section class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ fmtPct(sum.current) }}</p><p class="text-xs text-mute">Último resultado</p>
          <p v-if="sum.delta !== null" class="mt-1 flex items-center gap-1 text-xs font-bold" :class="sum.delta > 0 ? 'text-ok' : sum.delta < 0 ? 'text-danger' : 'text-mute'"><component :is="sum.delta > 0 ? ArrowUp : sum.delta < 0 ? ArrowDown : Minus" :size="12" />{{ fmtDelta(sum.delta) }}</p></div>
        <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ fmtPct(sum.avg) }}</p><p class="text-xs text-mute">Média de aproveitamento</p></div>
        <div class="panel p-4"><p class="font-display text-2xl font-extrabold text-ok">{{ fmtPct(sum.best?.pct) }}</p><p class="truncate text-xs text-mute">Melhor · {{ sum.best?.name }}</p></div>
        <div class="panel p-4"><p class="flex items-center gap-1.5 font-display text-lg font-extrabold" :class="trendTone[sum.trend.kind]"><component :is="trendIcon[sum.trend.kind]" :size="18" />{{ TREND_LABEL[sum.trend.kind] }}</p><p class="text-xs text-mute">Tendência<template v-if="sum.stagnant"> · estagnada</template></p></div>
      </section>

      <section class="panel mb-5 p-5"><h2 class="mb-3 font-display text-lg font-bold">Percentual de acertos ao longo do tempo</h2>
        <LineChart :points="pctPoints" trend label="Evolução do percentual de acertos" />
        <p v-if="series.length < 2" class="mt-2 text-xs text-mute">Cadastre mais simulados para ver a linha de evolução.</p></section>
      <section class="panel mb-5 p-5"><h2 class="mb-3 font-display text-lg font-bold">Quantidade de acertos</h2>
        <LineChart :points="hitsPoints" :percent="false" label="Evolução da quantidade de acertos" /></section>
      <section v-if="monthly.length >= 2" class="panel mb-5 p-5"><h2 class="mb-1 font-display text-lg font-bold">Média por mês</h2><p class="mb-3 text-xs text-mute">Média dos percentuais dos simulados de cada mês.</p>
        <LineChart :points="monthPoints" label="Média mensal de aproveitamento" /></section>
      <section class="panel mb-5 p-5"><h2 class="mb-1 font-display text-lg font-bold">Comparação entre simulados</h2><p class="mb-3 text-xs text-mute">Verde: na média ou acima · laranja: abaixo da média.</p>
        <HBarChart :items="compareBars" /></section>

      <section class="panel p-5"><h2 class="mb-1 font-display text-lg font-bold">Comparar períodos</h2><p class="mb-3 text-xs text-mute">Veja se você melhorou entre dois intervalos de datas.</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <fieldset><legend class="label">Período A (atual)</legend><div class="grid grid-cols-2 gap-2"><input v-model="pa.from" type="date" class="field" aria-label="A de" /><input v-model="pa.to" type="date" class="field" aria-label="A até" /></div></fieldset>
          <fieldset><legend class="label">Período B (anterior)</legend><div class="grid grid-cols-2 gap-2"><input v-model="pb.from" type="date" class="field" aria-label="B de" /><input v-model="pb.to" type="date" class="field" aria-label="B até" /></div></fieldset>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-xl bg-sunken p-3"><p class="text-xs text-mute">Período A</p><p class="font-display text-xl font-extrabold">{{ fmtPct(cmp.a.avg) }}</p><p class="text-xs text-mute">{{ plural(cmp.a.n, 'simulado', 'simulados') }}</p></div>
          <div class="rounded-xl bg-sunken p-3"><p class="text-xs text-mute">Período B</p><p class="font-display text-xl font-extrabold">{{ fmtPct(cmp.b.avg) }}</p><p class="text-xs text-mute">{{ plural(cmp.b.n, 'simulado', 'simulados') }}</p></div>
          <div class="rounded-xl bg-sunken p-3"><p class="text-xs text-mute">Diferença</p><p class="font-display text-xl font-extrabold" :class="cmp.diff > 0 ? 'text-ok' : cmp.diff < 0 ? 'text-danger' : ''">{{ fmtDelta(cmp.diff) }}</p><p class="text-xs text-mute">{{ cmp.diff === null ? 'sem dados nos dois' : cmp.diff > 0 ? 'melhorou' : cmp.diff < 0 ? 'piorou' : 'igual' }}</p></div>
        </div>
        <ul v-if="cmp.subjects.some((x) => x.diff !== null)" class="mt-4 divide-y divide-line text-sm">
          <li v-for="x in cmp.subjects.filter((y) => y.diff !== null)" :key="x.subjectId" class="flex items-center justify-between gap-3 py-2"><span class="truncate">{{ subjects.nameOf(x.subjectId) }}</span><span class="shrink-0 tabular-nums text-mute">{{ fmtPct(x.b) }} → {{ fmtPct(x.a) }} <b :class="x.diff > 0 ? 'text-ok' : x.diff < 0 ? 'text-danger' : ''">{{ fmtDelta(x.diff) }}</b></span></li>
        </ul>
      </section>
    </template>

    <!-- ================= POR MATÉRIA ================= -->
    <template v-else-if="tab === 'subjects'">
      <section class="mb-6">
        <div class="mb-4"><label class="label" for="sub-sel">Matéria</label>
          <select id="sub-sel" v-model="subjSel" class="field sm:max-w-xs"><option v-for="s in subjectsInData" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <section class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ fmtPct(sSum.current) }}</p><p class="text-xs text-mute">Aproveitamento atual</p></div>
          <div class="panel p-4"><p class="font-display text-2xl font-extrabold text-ok">{{ fmtPct(sSum.best?.pct) }}</p><p class="text-xs text-mute">Melhor resultado</p></div>
          <div class="panel p-4"><p class="font-display text-2xl font-extrabold text-danger">{{ fmtPct(sSum.worst?.pct) }}</p><p class="text-xs text-mute">Pior resultado</p></div>
          <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ fmtPct(sSum.avg) }}</p><p class="text-xs text-mute">Média histórica</p></div>
          <div class="panel p-4"><p class="font-display text-2xl font-extrabold" :class="sSum.delta > 0 ? 'text-ok' : sSum.delta < 0 ? 'text-danger' : ''">{{ fmtDelta(sSum.delta) }}</p><p class="text-xs text-mute">Vs. simulado anterior</p></div>
          <div class="panel p-4"><p class="flex items-center gap-1.5 font-display text-lg font-extrabold" :class="trendTone[sSum.trend.kind]"><component :is="trendIcon[sSum.trend.kind]" :size="18" />{{ TREND_LABEL[sSum.trend.kind] }}</p><p class="text-xs text-mute">Tendência<template v-if="sSum.stagnant"> · <b class="text-warn">estagnada</b></template></p></div>
        </section>
        <section class="panel mb-4 p-5"><h2 class="mb-3 font-display text-lg font-bold">Evolução em {{ subjects.nameOf(subjSel) }}</h2>
          <LineChart :points="sPoints" trend :label="`Evolução em ${subjects.nameOf(subjSel)}`" /></section>
        <div class="panel overflow-x-auto"><table class="w-full min-w-[22rem] text-sm"><thead class="text-left text-xs text-mute"><tr><th class="px-4 py-2.5 font-semibold">Simulado</th><th class="px-2 py-2.5 text-right font-semibold">Acertos</th><th class="px-2 py-2.5 text-right font-semibold">Aproveit.</th><th class="px-4 py-2.5 text-right font-semibold">Δ</th></tr></thead>
          <tbody class="divide-y divide-line"><tr v-for="r in sRows" :key="r.examId"><td class="px-4 py-2.5"><span class="block font-medium">{{ r.name }}</span><span class="text-xs text-mute">{{ formatDate(r.date) }}</span></td><td class="px-2 py-2.5 text-right tabular-nums">{{ r.correct }}/{{ r.total }}</td><td class="px-2 py-2.5 text-right font-bold tabular-nums">{{ fmtPct(r.pct) }}</td><td class="px-4 py-2.5 text-right text-xs font-bold tabular-nums" :class="r.delta > 0 ? 'text-ok' : r.delta < 0 ? 'text-danger' : 'text-mute'">{{ r.delta === null ? '—' : fmtDelta(r.delta) }}</td></tr></tbody></table></div>
      </section>

      <section class="panel p-5"><h2 class="mb-1 font-display text-lg font-bold">Matérias mais fortes e mais fracas</h2><p class="mb-3 text-xs text-mute">Matérias ausentes em um simulado não contam como zero.</p>
        <div class="mb-4 flex flex-wrap gap-2 text-sm"><button v-for="m in METRICS" :key="m[0]" class="pill !px-3 !py-1.5" :class="metric === m[0] ? 'bg-ink text-bg' : 'bg-sunken text-mute'" @click="metric = m[0]">{{ m[1] }}</button></div>
        <HBarChart :items="rankBars" />
        <p class="mt-3 text-xs text-mute"><span class="font-semibold text-ok">Verde</span>: mais forte · <span class="font-semibold text-danger">vermelho</span>: mais fraca · <span class="font-semibold text-warn">laranja</span>: próximas da mais fraca.</p></section>
    </template>

    <!-- ================= FREQUÊNCIA ================= -->
  </template>

  <template v-if="tab === 'frequency' && mocks.items.length">
    <section class="panel mb-5 p-5" :class="mocks.reminderActive ? 'border-warn/60' : ''">
      <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="flex items-center gap-2 font-display text-lg font-bold"><CalendarClock :size="18" class="text-accent" />Próximo simulado sugerido</h2><RouterLink to="/ajustes" class="text-xs font-semibold text-accent">Frequência: {{ settings.mockFrequencyDays }} dias · alterar</RouterLink></div>
      <p class="mt-2 font-display text-2xl font-extrabold">{{ formatDate(sch.nextDate) }}</p>
      <p class="text-sm" :class="sch.status === 'upcoming' ? 'text-mute' : 'font-semibold text-warn'">{{ sch.status === 'upcoming' ? `Faltam ${plural(sch.daysLeft, 'dia', 'dias')}` : sch.status === 'due' ? 'É hoje!' : `Atrasado há ${plural(sch.overdueDays, 'dia', 'dias')} — o lembrete continua pendente` }} · último simulado em {{ formatDate(sch.lastDate) }}</p>
      <div class="mt-3"><ProgressBar :value="sch.elapsed * 100" :tone="sch.status === 'upcoming' ? 'accent' : 'ok'" /></div>
      <p class="mt-3 text-xs text-mute">É só uma sugestão: você pode cadastrar um simulado a qualquer momento, antes ou depois da data.</p>
    </section>

    <section class="mb-5 grid grid-cols-3 gap-3">
      <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ hist.avgInterval === null ? '—' : Math.round(hist.avgInterval) + ' d' }}</p><p class="text-xs text-mute">Intervalo médio real</p></div>
      <div class="panel p-4"><p class="font-display text-2xl font-extrabold">{{ hist.longest === null ? '—' : hist.longest + ' d' }}</p><p class="text-xs text-mute">Maior intervalo</p></div>
      <div class="panel p-4"><p class="font-display text-2xl font-extrabold" :class="hist.adherence !== null && hist.adherence >= 70 ? 'text-ok' : ''">{{ hist.adherence === null ? '—' : hist.adherence + '%' }}</p><p class="text-xs text-mute">Dentro da frequência</p></div>
    </section>

    <section>
      <h2 class="mb-1 font-display text-lg font-bold">Histórico de datas</h2><p class="mb-3 text-xs text-mute">Comparado com a frequência atual de {{ settings.mockFrequencyDays }} dias.</p>
      <ul class="panel divide-y divide-line">
        <li v-for="r in hist.rows" :key="r.examId" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span class="min-w-0"><span class="block truncate font-semibold">{{ r.name }}</span><span class="text-xs text-mute">{{ formatDate(r.date) }}</span></span>
          <span class="flex shrink-0 flex-col items-end gap-1"><span class="pill" :class="STATUS[r.status][1]">{{ STATUS[r.status][0] }}</span>
            <span v-if="r.interval !== null" class="text-xs text-mute">{{ plural(r.interval, 'dia', 'dias') }} após o anterior<template v-if="r.diff"> ({{ r.diff > 0 ? '+' : '' }}{{ r.diff }})</template></span></span>
        </li>
      </ul>
    </section>
  </template>

  <BaseModal :open="!!detail" :title="detail?.name || ''" wide @close="detail = null">
    <div v-if="detail" class="space-y-4">
      <p class="text-sm text-mute">{{ formatDate(detail.date) }}<template v-if="detail.contest"> · {{ detail.contest }}</template><template v-if="detail.board"> · {{ detail.board }}</template></p>
      <div class="overflow-x-auto rounded-xl border border-line"><table class="w-full min-w-[20rem] text-sm">
        <thead class="bg-sunken text-left text-xs text-mute"><tr><th class="px-3 py-2">Matéria</th><th class="px-2 py-2 text-right">Total</th><th class="px-2 py-2 text-right">Acertos</th><th class="px-2 py-2 text-right">Erros</th><th class="px-2 py-2 text-right">Branco</th><th class="px-3 py-2 text-right">%</th></tr></thead>
        <tbody class="divide-y divide-line"><tr v-for="s in detail.subjects" :key="s.subjectId"><td class="px-3 py-2 font-medium">{{ subjects.nameOf(s.subjectId) }}</td><td class="px-2 py-2 text-right tabular-nums">{{ s.total }}</td><td class="px-2 py-2 text-right tabular-nums text-ok">{{ s.correct }}</td><td class="px-2 py-2 text-right tabular-nums text-danger">{{ s.wrong }}</td><td class="px-2 py-2 text-right tabular-nums">{{ s.blank }}</td><td class="px-3 py-2 text-right font-bold tabular-nums">{{ fmtPct(s.correct / s.total * 100) }}</td></tr></tbody>
        <tfoot class="border-t border-line bg-sunken font-bold"><tr><td class="px-3 py-2">Total</td><td class="px-2 py-2 text-right tabular-nums">{{ detailTotals.total }}</td><td class="px-2 py-2 text-right tabular-nums">{{ detailTotals.correct }}</td><td class="px-2 py-2 text-right tabular-nums">{{ detailTotals.wrong }}</td><td class="px-2 py-2 text-right tabular-nums">{{ detailTotals.blank }}</td><td class="px-3 py-2 text-right tabular-nums text-accent">{{ fmtPct(detailTotals.pct) }}</td></tr></tfoot></table></div>
      <p v-if="detail.notes" class="whitespace-pre-line rounded-xl bg-sunken p-3 text-sm">{{ detail.notes }}</p>
    </div>
    <template #footer>
      <button class="btn-ghost text-danger" @click="del(detail)"><Trash2 :size="16" /> Excluir</button>
      <button class="btn-line" @click="edit(detail)"><Pencil :size="16" /> Editar resultados</button>
    </template>
  </BaseModal>
</template>
