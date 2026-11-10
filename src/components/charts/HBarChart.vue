<script setup>
// Barras horizontais (ranking/comparação). `tone`: 'ok' | 'danger' | 'accent' | 'warn'
defineProps({
  items: { type: Array, default: () => [] }, // [{ label, value, display, sub, tone }]
  max: { type: Number, default: 100 }
})
const bar = { ok: 'bg-ok', danger: 'bg-danger', warn: 'bg-warn', accent: 'bg-accent' }
</script>
<template>
  <ul class="space-y-3">
    <li v-for="(it, i) in items" :key="i">
      <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate font-semibold">{{ it.label }}</span>
        <span class="shrink-0 font-bold tabular-nums">{{ it.display }}</span>
      </div>
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="img" :aria-label="`${it.label}: ${it.display}`">
        <div class="h-full rounded-full transition-all duration-500" :class="bar[it.tone || 'accent']" :style="{ width: Math.min(100, Math.max(1.5, (it.value / max) * 100)) + '%' }" />
      </div>
      <p v-if="it.sub" class="mt-0.5 text-xs text-mute">{{ it.sub }}</p>
    </li>
  </ul>
</template>
