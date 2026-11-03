<script setup>
defineProps({ value: { type: Number, default: 0 }, tone: { type: String, default: 'accent' } })
</script>
<template>
  <div class="h-2 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <div class="h-full rounded-full transition-all duration-500" :class="tone === 'ok' ? 'bg-ok' : 'bg-accent'" :style="{ width: Math.min(100, Math.max(0, value)) + '%' }" />
  </div>
</template>
