<script setup>
// Barras simples em SVG (0–100% ou contagem) para evolução semanal/mensal.
const props = defineProps({ items: { type: Array, default: () => [] }, max: { type: Number, default: 0 }, height: { type: Number, default: 64 }, label: { type: String, default: 'Gráfico de barras' }, unit: { type: String, default: '' } })
const top = () => props.max || Math.max(1, ...props.items.map((i) => i.value ?? 0))
</script>
<template>
  <div class="flex items-end gap-1.5" :style="{ height: height + 'px' }" role="img" :aria-label="label">
    <div v-for="(it, i) in items" :key="i" class="flex h-full flex-1 flex-col justify-end" :title="`${it.label}: ${it.value == null ? 'sem dados' : it.value + unit}`">
      <div class="w-full rounded-t-md" :class="it.value == null ? 'bg-sunken' : 'bg-accent'" :style="{ height: it.value == null ? '4px' : Math.max(4, (it.value / top()) * 100) + '%', opacity: it.value == null ? 1 : 0.35 + 0.65 * (it.value / top()) }" />
    </div>
  </div>
</template>
