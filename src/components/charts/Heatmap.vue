<script setup>
// Heatmap anual estilo GitHub Contributions. Cores em variáveis CSS (claro/escuro).
import { computed } from 'vue'
import { LEVEL_LABELS, yearGrid } from '../../services/activityEngine'
import { formatDate, parseDate } from '../../utils/date'

const props = defineProps({ year: { type: Number, required: true }, dayMap: { type: Object, required: true }, today: { type: String, required: true }, selected: { type: String, default: '' } })
const emit = defineEmits(['select'])
const weeks = computed(() => yearGrid(props.year, props.today))
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthLabels = computed(() => weeks.value.map((w, i) => {
  const first = w.find(Boolean); if (!first) return ''
  const d = parseDate(first.date)
  const prev = i > 0 ? weeks.value[i - 1].find(Boolean) : null
  return d.getDate() <= 7 && (!prev || parseDate(prev.date).getMonth() !== d.getMonth()) ? MONTHS[d.getMonth()] : ''
}))
const level = (d) => props.dayMap.get(d.date)?.level ?? 0
const tip = (d) => (d.future ? `${formatDate(d.date)} (futuro)` : `${formatDate(d.date)}: ${props.dayMap.get(d.date)?.count ?? 0} atividade(s) — ${LEVEL_LABELS[level(d)]}`)
</script>

<template>
  <div class="overflow-x-auto pb-2">
    <div class="inline-block min-w-max" role="grid" :aria-label="`Atividades de ${year}`" data-testid="heatmap">
      <div class="mb-1 flex gap-[3px] pl-0"><span v-for="(m, i) in monthLabels" :key="i" class="w-[13px] overflow-visible whitespace-nowrap text-[10px] text-mute">{{ m }}</span></div>
      <div class="flex gap-[3px]">
        <div v-for="(w, i) in weeks" :key="i" class="flex flex-col gap-[3px]">
          <template v-for="(d, k) in w" :key="k">
            <span v-if="!d" class="h-[13px] w-[13px]" />
            <button v-else class="hm h-[13px] w-[13px] rounded-[3px] transition hover:ring-2 hover:ring-accent" :class="[`hm-${d.future ? 'f' : level(d)}`, selected === d.date && 'ring-2 ring-ink']" :disabled="d.future" :title="tip(d)" :aria-label="tip(d)" :data-date="d.date" :data-level="level(d)" @click="emit('select', d.date)" />
          </template>
        </div>
      </div>
    </div>
  </div>
  <div class="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-mute" aria-hidden="true">Menos<span v-for="l in 5" :key="l" class="h-[13px] w-[13px] rounded-[3px]" :class="`hm-${l - 1}`" />Mais</div>
</template>

<style>
:root, [data-theme='light'] { --hm-0: #ebedf0; --hm-1: #9be9a8; --hm-2: #40c463; --hm-3: #30a14e; --hm-4: #216e39; --hm-f: transparent; }
[data-theme='dark'] { --hm-0: #1c2438; --hm-1: #0e4429; --hm-2: #006d32; --hm-3: #26a641; --hm-4: #39d353; }
.hm-0 { background: var(--hm-0); } .hm-1 { background: var(--hm-1); } .hm-2 { background: var(--hm-2); } .hm-3 { background: var(--hm-3); } .hm-4 { background: var(--hm-4); }
.hm-f { background: transparent; border: 1px dashed rgb(var(--c-line)); cursor: default; }
</style>
