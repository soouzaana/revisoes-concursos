<script setup>
// Gráfico de linha em SVG (sem bibliotecas; funciona offline). Pontos em ordem cronológica.
import { computed } from 'vue'
const props = defineProps({
  points: { type: Array, default: () => [] },   // [{ label, value, tip }]
  percent: { type: Boolean, default: true },    // eixo em % (0–100) ou contagem
  trend: { type: Boolean, default: false },     // linha de tendência tracejada
  label: { type: String, default: 'Gráfico de evolução' }
})
const W = 600, H = 240, L = 40, R = 14, T = 14, B = 34
const range = computed(() => {
  const v = props.points.map((p) => p.value)
  if (!v.length) return { lo: 0, hi: 100 }
  const min = Math.min(...v), max = Math.max(...v)
  if (props.percent) return { lo: Math.max(0, Math.floor((min - 10) / 10) * 10), hi: Math.min(100, Math.max(Math.ceil((max + 10) / 10) * 10, 20)) }
  return { lo: 0, hi: Math.max(5, Math.ceil(max * 1.15)) }
})
const x = (i) => (props.points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (props.points.length - 1))
const y = (v) => T + (1 - (v - range.value.lo) / (range.value.hi - range.value.lo || 1)) * (H - T - B)
const path = computed(() => props.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '))
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => range.value.lo + ((range.value.hi - range.value.lo) * i) / 4))
const fmt = (v) => (props.percent ? `${Math.round(v)}%` : `${Math.round(v)}`)
const step = computed(() => Math.max(1, Math.ceil(props.points.length / 6)))
const trendLine = computed(() => {
  const n = props.points.length
  if (!props.trend || n < 3) return null
  const vals = props.points.map((p) => p.value)
  const mx = (n - 1) / 2, my = vals.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  vals.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) ** 2 })
  const m = num / den, b = my - m * mx
  const clamp = (v) => Math.min(range.value.hi, Math.max(range.value.lo, v))
  return { x1: x(0), y1: y(clamp(b)), x2: x(n - 1), y2: y(clamp(b + m * (n - 1))) }
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="h-auto w-full" role="img" :aria-label="label">
    <g class="text-mute" font-size="11" fill="currentColor">
      <g v-for="t in ticks" :key="t">
        <line :x1="L" :x2="W - R" :y1="y(t)" :y2="y(t)" stroke="rgb(var(--c-line))" stroke-width="1" />
        <text :x="L - 6" :y="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
      </g>
      <template v-for="(p, i) in points" :key="i">
        <text v-if="i % step === 0 || i === points.length - 1" :x="x(i)" :y="H - 12" text-anchor="middle">{{ p.label }}</text>
      </template>
    </g>
    <line v-if="trendLine" v-bind="trendLine" stroke="rgb(var(--c-mute))" stroke-width="1.5" stroke-dasharray="5 5" />
    <path v-if="points.length > 1" :d="path" fill="none" stroke="rgb(var(--c-accent))" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    <g v-for="(p, i) in points" :key="'d' + i">
      <circle :cx="x(i)" :cy="y(p.value)" r="5" fill="rgb(var(--c-surface))" stroke="rgb(var(--c-accent))" stroke-width="2.5"><title>{{ p.tip || fmt(p.value) }}</title></circle>
      <text v-if="points.length <= 8" :x="x(i)" :y="y(p.value) - 10" text-anchor="middle" font-size="11" font-weight="700" fill="rgb(var(--c-ink))">{{ fmt(p.value) }}</text>
    </g>
  </svg>
</template>
