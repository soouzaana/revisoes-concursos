<script setup>
// O elemento visual central do app: os 5 dias estudados do ciclo semanal.
defineProps({ studied: { type: Number, default: 0 }, size: { type: Number, default: 5 } })
</script>
<template>
  <div class="flex items-center gap-1.5" :aria-label="`${studied} de ${size} dias estudados`">
    <template v-for="i in size" :key="i">
      <span class="grid h-7 w-7 place-items-center rounded-lg border text-xs font-bold transition"
        :class="i <= studied ? 'border-accent bg-accent text-accent-fg' : 'border-dashed border-line text-mute'">{{ i }}</span>
    </template>
  </div>
</template>
