<script setup>
defineProps({ title: String, text: String })
</script>
<template>
  <div class="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
    <component :is="$slots.icon" v-if="$slots.icon" />
    <h3 class="font-display text-base font-bold">{{ title }}</h3>
    <p v-if="text" class="mt-1 max-w-sm text-sm text-mute">{{ text }}</p>
    <div class="mt-4 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
